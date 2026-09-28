import '../components';
import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnvironment, DEMO_ENV_KEYS} from '../shared/env';
import {getSession} from '../shared/session';
import {$, isFailedAuthorization, setStep, showNotice, showResult} from '../shared/ui';
import {localeTag, t} from '../i18n';
import {consumeRedirectionReturn, type RedirectionClaims} from '../shared/redirection';
import {mountDebugPanel} from '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Express checkout — one-click "Buy now" on a product page.
//
//   • Session has a saved card (paymentTokens) → the express sheet shows a
//     "Payer •••• 4242" button. If the partner needs no CVV, isPaymentFulfilled
//     is true right away and the payment is one tap; otherwise the first tap
//     reveals the token's CVV field right above the button.
//   • No token (or "Ignore saved tokens" checked), or "use another card"
//     → the same sheet continues to a card step built with
//     getHostedFields() on the credit card method, with an optional
//     "save my card" (register) checkbox.
//
// Only one payment element is mounted at a time: switching path removes the
// previous one so the split never has two primary sources.
// ─────────────────────────────────────────────────────────────────────────────

type Token = HeadlessCheckout.PurseHeadlessCheckoutPrimaryToken;
type CardMethod = HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod;
type ActiveElement = HeadlessCheckout.PurseHeadlessCheckoutPaymentElement | HeadlessCheckout.PurseHeadlessCheckoutHostedFields;

const buyNowBtn = $('buy-now') as HTMLButtonElement;
const expressPayBtn = $('express-pay') as HTMLButtonElement;
const cardPayBtn = $('card-pay') as HTMLButtonElement;
const forceNoToken = $('force-no-token') as HTMLInputElement;
const noCvv = $('no-cvv') as HTMLInputElement;
const saveCard = $('save-card') as HTMLInputElement;

let checkout: HeadlessCheckout.HeadlessCheckout | null = null;
let token: Token | null = null;
let cardMethod: CardMethod | null = null;
let walletMethods: CardMethod[] = [];
let activeElement: ActiveElement | null = null;
let fulfilled = false;

// paymentMethods and paymentTokens are independent Readable stores — one can
// emit before the other. Buy Now must wait on both, or a fast click can open
// the express sheet before the saved token has arrived and silently render
// the no-token path (missing the "Payer •••• 4242" badge) even though the
// session does have a saved card.
let methodsReady = false;
let tokensReady = false;

function maybeEnableBuyNow() {
    if (methodsReady && tokensReady && checkout?.sessionState.value !== 'submitted') {
        buyNowBtn.disabled = false;
        setStep('step-ready', 'done');
    }
}

const CARD_THEME: HeadlessCheckout.HostedFieldsTheme = {
    global: {},
    input: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#101828',
        backgroundColor: 'transparent',
        '::placeholder': {color: '#99A1AF'},
    },
};

// ── Sheet helpers ────────────────────────────────────────────────────────────

function show(id: string, visible: boolean) {
    $(id).hidden = !visible;
}

function unmount() {
    activeElement?.remove();
    activeElement = null;
}

function currentToken(): Token | null {
    return forceNoToken.checked ? null : token;
}

// `description.masked_pan` ("Will contain displayable value of the PAN") is
// typed as required but is empty on some real sessions — this one included.
// `description.label` ("the way the partner formats the masked pan") is the
// SDK's own documented fallback for exactly that case, but partners format it
// differently (4111********1111, ****1111, 424242XXXXXX4242, …) — so pull the
// trailing digit run out of whichever is set and display it the same way
// regardless of partner: "•••• 4242".
function tokenPanLabel(tok: Token): string {
    const raw = tok.description.masked_pan || tok.description.label || '';
    const last4 = raw.match(/\d{2,4}$/)?.[0];
    return last4 ? `•••• ${last4}` : raw;
}

// The token's CVV field is mounted as soon as the sheet opens but stays
// collapsed: the first tap on "Payer" either pays straight away (the token
// needs no CVV, so the payment is already fulfilled — true one-click) or
// reveals the field and waits for it.
let cvvRevealed = false;

function revealCvv(open: boolean) {
    cvvRevealed = open;
    const field = $('token-cvv-field');
    field.classList.toggle('is-open', open);
    if (open) {
        // The field sits below the button and may open under the sheet's fold:
        // bring it into view once it has expanded.
        // (Opacity finishes first; wait for the height, or the scroll falls short.)
        const onExpanded = (e: TransitionEvent) => {
            if (e.propertyName !== 'grid-template-rows') {
                return;
            }
            field.removeEventListener('transitionend', onExpanded);
            field.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        };
        field.addEventListener('transitionend', onExpanded);
    }
}

// ── Wallets (xPay) ───────────────────────────────────────────────────────────
// Rendered under the pay button when the session offers them. The SDK owns
// their whole flow: on approval the element fires `validationRequested`, and
// the SDK itself sets that method as the primary source and submits.
type Wallet = {method: string; partner?: string; slot: string; popupOnly?: boolean};
const WALLETS: Wallet[] = [
    {method: 'googlepay', slot: 'xpay-googlepay'},
    {method: 'applepay', slot: 'xpay-applepay'},
    // PayPal is the `wallet` method of the `paypal` partner. It also exists as
    // a full-page redirection; only the popup mode is a wallet button.
    {partner: 'paypal', method: 'wallet', slot: 'xpay-paypal', popupOnly: true},
];

const isWallet = (m: CardMethod, w: Wallet) => m.method === w.method && (!w.partner || m.partner === w.partner);

const XPAY_BUTTONS: HeadlessCheckout.PaymentElementOptions['xPayButton'] = {
    google: {buttonType: 'pay', buttonColor: 'black', buttonRadius: 4, buttonSizeMode: 'fill', height: 48},
    apple: {type: 'plain', buttonstyle: 'black', borderRadius: '4px', width: '100%', height: '48px', locale: localeTag},
    paypal: {layout: 'horizontal', color: 'gold', shape: 'rect', label: 'pay', height: 48, disableMaxWidth: true},
};

let walletElements: HeadlessCheckout.PurseHeadlessCheckoutPaymentElement[] = [];

function unmountWallets() {
    walletElements.forEach(el => el.remove());
    walletElements = [];
    show('xpay-block', false);
    WALLETS.forEach(w => show(w.slot, false));
}

function mountWallets() {
    unmountWallets();
    for (const wallet of WALLETS) {
        const method = walletMethods.find(m => isWallet(m, wallet));
        if (!method || (wallet.popupOnly && method.integrationType !== 'popup')) {
            continue;
        }
        const el = method.getPaymentElement({xPayButton: XPAY_BUTTONS, locale: localeTag});
        // A wallet the browser can't run (Apple Pay outside Safari…) never gets ready.
        el.on('ready', () => {
            show(wallet.slot, true);
            show('xpay-block', true);
        });
        el.on('fatalError', () => show(wallet.slot, false));
        el.on('validationRequested', () => show('busy', true));
        el.on('partnerError', () => show('busy', false));
        el.appendTo($(wallet.slot));
        walletElements.push(el);
    }
}

// A bare hosted-field iframe, themed like the card step — getPaymentElement()'s
// hosted form would draw its own framed input inside ours.
function mountCvvField(tok: Token): ActiveElement {
    const hf = tok.getHostedFields({
        fields: {cvv: {target: 'token-cvv', placeholder: '123'}},
        theme: CARD_THEME,
        locale: localeTag,
    });
    hf.render();
    return hf;
}

// hostedForm.noCVV is only honoured by the hosted form, which then renders
// nothing and is fulfilled at once. It suppresses the field and its requirement
// client-side only: the partner still enforces its own rule server-side, so
// forcing it on a token that needs CVV can make submitPayment() fail.
function mountWithoutCvv(tok: Token): ActiveElement {
    const el = tok.getPaymentElement({hostedForm: {noCVV: true}, locale: localeTag});
    el.appendTo($('token-cvv'));
    return el;
}

// Card scheme → CDN badge: the same table the SDK uses to build a card method's
// `additionalAssets`. Tokens carry no assets of their own (their `iconUrl` is the
// generic card icon), only `description.brand`.
const SCHEME_BADGES: Record<string, {badge: string; label: string}> = {
    VISA: {badge: 'visa', label: 'Visa'},
    MASTERCARD: {badge: 'mastercard', label: 'Mastercard'},
    CARTE_BANCAIRE: {badge: 'cb', label: 'Cartes Bancaires'},
    AMERICAN_EXPRESS: {badge: 'amex', label: 'American Express'},
    MAESTRO: {badge: 'maestro', label: 'Maestro'},
    ONEY: {badge: 'oney', label: 'Oney'},
};

// The badge sits next to the generic icon on the CDN, so swapping the file name
// keeps the environment (sandbox / production) the SDK already resolved.
function tokenBrandBadge(tok: Token): {src: string; alt: string} {
    const scheme = SCHEME_BADGES[(tok.description.brand ?? '').toUpperCase()];
    if (!scheme) {
        return {src: tok.iconUrl, alt: tok.description.brand ?? ''};
    }
    return {src: tok.iconUrl.replace(/[^/]+\.svg$/, `${scheme.badge}.svg`), alt: scheme.label};
}

function refreshPayButtons() {
    const tok = currentToken();
    // With a token, the first tap is always allowed (it pays or reveals the CVV);
    // without one, the button continues to the card step.
    expressPayBtn.disabled = tok ? cvvRevealed && !fulfilled : !cardMethod;
    cardPayBtn.disabled = !fulfilled;
}

// The sheet is one tunnel: the card step replaces the summary in place, with a
// back arrow — never a second sheet stacked on top.
type Step = 'express' | 'card';

function showStep(step: Step) {
    show('backdrop', true);
    show('sheet', true);
    show('view-express', step === 'express');
    show('view-card', step === 'card');
    show('card-back', step === 'card');
    $('sheet-title').textContent = step === 'card' ? t('shop.addCard') : t('shop.expressTitle');
    $(`view-${step}`).scrollTop = 0;
}

function expressStepOpen(): boolean {
    return !$('sheet').hidden && !$('view-express').hidden;
}

function openExpress() {
    const tok = currentToken();
    showStep('express');
    show('other-method', !!tok && !!cardMethod);
    show('express-pay-token', !!tok);
    revealCvv(false);

    unmount();
    if (tok) {
        $('express-pay-label').textContent = t('shop.pay');
        $('token-pan').textContent = tokenPanLabel(tok);
        $('token-cvv-card').textContent = tokenPanLabel(tok);
        const icon = $('token-icon') as HTMLImageElement;
        const brand = tokenBrandBadge(tok);
        icon.src = brand.src;
        icon.alt = brand.alt;
        // A scheme the CDN has no badge for falls back to the generic card icon.
        icon.onerror = () => {
            icon.onerror = null;
            icon.src = tok.iconUrl;
        };

        activeElement = noCvv.checked ? mountWithoutCvv(tok) : mountCvvField(tok);
        activeElement.on('fatalError', () => showResult('error', t('result.fatalToken')));
    } else {
        $('express-pay-label').textContent = t('shop.payByCard');
    }
    mountWallets();
    refreshPayButtons();
}

function openCard() {
    if (!cardMethod) {
        return;
    }
    showStep('card');
    unmount();
    unmountWallets();

    const hf = cardMethod.getHostedFields({
        fields: {
            cardNumber: {target: 'xc-pan', placeholder: '1234 5678 9101 1213'},
            expDate: {target: 'xc-exp', placeholder: t('common.placeholder.exp')},
            cvv: {target: 'xc-cvv', placeholder: '123'},
            holderName: {target: 'xc-name', placeholder: t('common.placeholder.holder')},
        },
        theme: CARD_THEME,
        locale: localeTag,
    });
    hf.render();
    activeElement = hf;

    // Checkbox keeps its state across sheet reopenings — it mirrors the last register() call.
    show('save-card-box', cardMethod.canBeRegistered);
    refreshPayButtons();
}

function closeAll() {
    unmount();
    unmountWallets();
    ['backdrop', 'sheet', 'busy', 'done'].forEach(id => show(id, false));
}

// Copy per authorization status. PENDING is what the sandbox returns for a
// submitted card payment until the partner settles it.
function confirmationCopy(status = ''): {title: string; detail: string} {
    if (isFailedAuthorization(status)) {
        return {title: t('shop.refusedTitle'), detail: t('shop.refusedDetail')};
    }
    if (status === 'AUTHORIZED' || status === 'CAPTURED') {
        return {title: t('shop.confirmedTitle'), detail: t('shop.confirmedDetail')};
    }
    return {title: t('shop.pendingTitle'), detail: t('shop.pendingDetail')};
}

function showConfirmation(claims: RedirectionClaims, methodLabel?: string) {
    const status = claims.authorization_status;
    const {title, detail} = confirmationCopy(status);
    $('done-title').textContent = title;
    $('done-detail').textContent = detail;
    $('done-ref').textContent = [methodLabel, claims.payment_id && t('shop.paymentRef', {id: claims.payment_id.slice(0, 8)})]
        .filter(Boolean)
        .join(' · ');
    show('done-ok', !isFailedAuthorization(status));
    show('done-failed', isFailedAuthorization(status));
    show('done', true);
    setStep('step-pay', isFailedAuthorization(status) ? 'error' : 'done');
}

async function pay(source: Token | CardMethod, methodLabel: string) {
    if (!checkout) {
        return;
    }
    setStep('step-pay', 'active');
    show('busy', true);
    try {
        // Pin the source actually shown to the user: a CVV-less token could
        // otherwise stay primary (and fulfilled) while the card step is open.
        source.setAsPrimarySource();
        // Usually never resolves here: with a shopper_redirection_url on the
        // session (shared/session.ts), the SDK navigates the tab away and the
        // shopper lands back on this page — see the return branch in main().
        await checkout.submitPayment();
        showConfirmation({}, methodLabel);
        // The session is consumed — no second purchase on it.
        buyNowBtn.disabled = true;
        showResult('success', {status: 'submitted', method: methodLabel});
    } catch (err) {
        setStep('step-pay', 'error');
        showResult('error', String(err));
    } finally {
        show('busy', false);
    }
}

// ── UI wiring ────────────────────────────────────────────────────────────────

buyNowBtn.addEventListener('click', openExpress);
$('backdrop').addEventListener('click', closeAll);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeAll));
// A paid session can't be reused — start over on a fresh one.
$('back-home').addEventListener('click', () => location.reload());
$('other-method').addEventListener('click', openCard);
$('card-back').addEventListener('click', openExpress);

expressPayBtn.addEventListener('click', () => {
    const tok = currentToken();
    if (!tok) {
        openCard();
    } else if (fulfilled) {
        pay(tok, `${tokenBrandBadge(tok).alt || t('shop.card')} ${tokenPanLabel(tok)}`);
    } else {
        revealCvv(true);
        refreshPayButtons();
    }
});
cardPayBtn.addEventListener('click', () => {
    if (cardMethod) {
        pay(cardMethod, t('shop.newCard'));
    }
});
saveCard.addEventListener('change', () => {
    cardMethod?.register(saveCard.checked).catch(err => showResult('error', String(err)));
});
forceNoToken.addEventListener('change', () => {
    if (expressStepOpen()) {
        openExpress();
    }
});
noCvv.addEventListener('change', () => {
    if (expressStepOpen() && currentToken()) {
        openExpress();
    }
});

// ── Checkout ─────────────────────────────────────────────────────────────────

async function main() {
    // Back from submitPayment()'s redirection: show the outcome, don't start over.
    const returned = consumeRedirectionReturn();
    if (returned) {
        ['step-sdk', 'step-init', 'step-ready'].forEach(id => setStep(id, 'done'));
        showConfirmation(returned);
        showResult(isFailedAuthorization(returned.authorization_status) ? 'error' : 'success', returned, t('result.returnedShort'));
        return;
    }

    setStep('step-sdk', 'active');
    const {createHeadlessCheckout} = await loadHeadlessCheckout(getEnvironment());
    setStep('step-sdk', 'done');

    setStep('step-init', 'active');
    let session: string;
    try {
        session = await getSession();
    } catch (err) {
        setStep('step-init', 'error');
        showNotice(String(err));
        return;
    }

    checkout = await createHeadlessCheckout(session);
    setStep('step-init', 'done');
    setStep('step-ready', 'active');

    checkout.paymentTokens.subscribe(tokens => {
        token = (tokens as HeadlessCheckout.PurseHeadlessCheckoutPaymentToken[])
            .find((tok): tok is Token => !tok.isSecondary && tok.type === 'token' && !tok.disabled.value) ?? null;
        $('token-status').textContent = token ? t('express.savedCard', {card: tokenPanLabel(token)}) : t('express.noSavedCard');
        tokensReady = true;
        maybeEnableBuyNow();
    });

    checkout.paymentMethods.subscribe(methods => {
        const primaries = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[])
            .filter((m): m is CardMethod => !m.isSecondary);
        cardMethod = primaries.find(m => m.method === 'creditcard') ?? null;
        walletMethods = primaries.filter(m => WALLETS.some(w => isWallet(m, w)));
        methodsReady = true;
        maybeEnableBuyNow();
    });

    // The amount is fixed by the payment session — display it, never compute it client-side.
    let currency = 'EUR';
    checkout.currency.subscribe(c => {
        currency = c || currency;
    });
    checkout.remainingAmountToPay.subscribe(amount => {
        // ponytail: assumes major units (79.99); switch to amount / 100 if the session carries minor units.
        const label = new Intl.NumberFormat(localeTag, {style: 'currency', currency}).format(amount);
        document.querySelectorAll('[data-total]').forEach(el => {
            el.textContent = label;
        });
    });

    checkout.isPaymentFulfilled.subscribe(ok => {
        fulfilled = ok;
        refreshPayButtons();
    });
}

main().catch(err => showNotice(String(err)));

mountDebugPanel(DEMO_ENV_KEYS.session);
