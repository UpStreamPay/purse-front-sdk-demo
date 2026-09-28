import '../components';
import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnvironment, DEMO_ENV_KEYS} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import {mountDebugPanel} from '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Express checkout — one-click "Buy now" on a product page.
//
//   • Session has a saved card (paymentTokens) → the express sheet shows a
//     "Payer •••• 4242" button. If the partner needs no CVV, isPaymentFulfilled
//     is true right away and the payment is one tap; otherwise the token's CVV
//     field mounts right above the button.
//   • No token (or "Ignore saved tokens" checked) → the pay button opens a card
//     sheet built with getHostedFields() on the credit card method, with an
//     optional "save my card" (register) checkbox.
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
function tokenPanLabel(t: Token): string {
    const raw = t.description.masked_pan || t.description.label || '';
    const last4 = raw.match(/\d{2,4}$/)?.[0];
    return last4 ? `•••• ${last4}` : raw;
}

function refreshPayButtons() {
    const t = currentToken();
    // The express button is always clickable without a token: it opens the card sheet.
    expressPayBtn.disabled = t ? !fulfilled : !cardMethod;
    cardPayBtn.disabled = !fulfilled;
}

function openExpress() {
    const t = currentToken();
    show('backdrop', true);
    show('sheet-express', true);
    show('sheet-card', false);
    show('other-method', !!t && !!cardMethod);
    show('express-pay-token', !!t);
    show('token-cvv-field', false);

    unmount();
    if (t) {
        $('express-pay-label').textContent = 'Payer';
        $('token-pan').textContent = tokenPanLabel(t);
        ($('token-icon') as HTMLImageElement).src = t.iconUrl;
        ($('token-icon') as HTMLImageElement).alt = t.description.brand ?? '';

        // hostedForm.noCVV only suppresses the field and its requirement client-side;
        // it doesn't change what the partner enforces server-side, so forcing it on a
        // token that actually needs CVV can make submitPayment() fail even though the
        // UI shows nothing left to fill in.
        const el = t.getPaymentElement(noCvv.checked ? {hostedForm: {noCVV: true}} : undefined);
        el.on('fatalError', () => showResult('error', 'Fatal error in token element'));
        el.appendTo($('token-element'));
        activeElement = el;

        // hasUI() is the SDK's own signal for "nothing to render" — true one-click
        // when the token needs no CVV, so the field row collapses instead of
        // showing an empty box.
        show('token-cvv-field', el.hasUI());
    } else {
        $('express-pay-label').textContent = 'Payer par carte bancaire';
    }
    refreshPayButtons();
}

function openCard() {
    if (!cardMethod) {
        return;
    }
    show('sheet-card', true);
    unmount();

    const hf = cardMethod.getHostedFields({
        fields: {
            cardNumber: {target: 'xc-pan', placeholder: '1234 5678 9101 1213'},
            expDate: {target: 'xc-exp', placeholder: 'MM/AA'},
            cvv: {target: 'xc-cvv', placeholder: '123'},
            holderName: {target: 'xc-name', placeholder: 'Olivier Dupont'},
        },
        theme: CARD_THEME,
    });
    hf.render();
    activeElement = hf;

    // Checkbox keeps its state across sheet reopenings — it mirrors the last register() call.
    show('save-card-box', cardMethod.canBeRegistered);
    refreshPayButtons();
}

function closeAll() {
    unmount();
    ['backdrop', 'sheet-express', 'sheet-card', 'busy', 'done'].forEach(id => show(id, false));
}

async function pay(source: Token | CardMethod, methodLabel: string) {
    if (!checkout) {
        return;
    }
    setStep('step-pay', 'active');
    show('busy', true);
    try {
        // Pin the source actually shown to the user: a CVV-less token could
        // otherwise stay primary (and fulfilled) while the card sheet is open.
        source.setAsPrimarySource();
        await checkout.submitPayment();
        setStep('step-pay', 'done');
        $('done-method').textContent = methodLabel;
        show('done', true);
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
$('back-home').addEventListener('click', closeAll);
$('other-method').addEventListener('click', openCard);
$('card-back').addEventListener('click', openExpress);

expressPayBtn.addEventListener('click', () => {
    const t = currentToken();
    if (t) {
        pay(t, `${t.description.brand ?? 'Carte'} ${tokenPanLabel(t)}`);
    } else {
        openCard();
    }
});
cardPayBtn.addEventListener('click', () => {
    if (cardMethod) {
        pay(cardMethod, 'Nouvelle carte');
    }
});
saveCard.addEventListener('change', () => {
    cardMethod?.register(saveCard.checked).catch(err => showResult('error', String(err)));
});
forceNoToken.addEventListener('change', () => {
    if (!$('sheet-express').hidden) {
        openExpress();
    }
});
noCvv.addEventListener('change', () => {
    if (!$('sheet-express').hidden && currentToken()) {
        openExpress();
    }
});

// ── Checkout ─────────────────────────────────────────────────────────────────

async function main() {
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
            .find((t): t is Token => !t.isSecondary && t.type === 'token' && !t.disabled.value) ?? null;
        $('token-status').textContent = token ? `Saved card: ${tokenPanLabel(token)}` : 'No saved card in session';
        tokensReady = true;
        maybeEnableBuyNow();
    });

    checkout.paymentMethods.subscribe(methods => {
        cardMethod = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[])
            .find((m): m is CardMethod => m.method === 'creditcard' && !m.isSecondary) ?? null;
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
        const label = new Intl.NumberFormat('fr-FR', {style: 'currency', currency}).format(amount);
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
