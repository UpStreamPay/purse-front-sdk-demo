import '../components';
import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnvironment, DEMO_ENV_KEYS} from '../shared/env';
import {getSession} from '../shared/session';
import {$, showNotice, showResult} from '../shared/ui';
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
const saveCard = $('save-card') as HTMLInputElement;

let checkout: HeadlessCheckout.HeadlessCheckout | null = null;
let token: Token | null = null;
let cardMethod: CardMethod | null = null;
let activeElement: ActiveElement | null = null;
let fulfilled = false;

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

    unmount();
    if (t) {
        $('express-pay-label').textContent = 'Payer';
        $('token-pan').textContent = t.description.masked_pan;
        ($('token-icon') as HTMLImageElement).src = t.iconUrl;
        ($('token-icon') as HTMLImageElement).alt = t.description.brand ?? '';

        // Renders nothing when the token needs no CVV — then it's a true one-click.
        const el = t.getPaymentElement();
        el.on('fatalError', () => showResult('error', 'Fatal error in token element'));
        el.appendTo($('token-element'));
        activeElement = el;
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
    show('busy', true);
    try {
        // Pin the source actually shown to the user: a CVV-less token could
        // otherwise stay primary (and fulfilled) while the card sheet is open.
        source.setAsPrimarySource();
        await checkout.submitPayment();
        $('done-method').textContent = methodLabel;
        show('done', true);
        // The session is consumed — no second purchase on it.
        buyNowBtn.disabled = true;
        showResult('success', {status: 'submitted', method: methodLabel});
    } catch (err) {
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
        pay(t, `${t.description.brand ?? 'Carte'} ${t.description.masked_pan}`);
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

// ── Checkout ─────────────────────────────────────────────────────────────────

async function main() {
    const {createHeadlessCheckout} = await loadHeadlessCheckout(getEnvironment());

    let session: string;
    try {
        session = getSession();
    } catch (err) {
        showNotice(String(err));
        return;
    }

    checkout = await createHeadlessCheckout(session);

    checkout.paymentTokens.subscribe(tokens => {
        token = (tokens as HeadlessCheckout.PurseHeadlessCheckoutPaymentToken[])
            .find((t): t is Token => !t.isSecondary && t.type === 'token' && !t.disabled.value) ?? null;
        $('token-status').textContent = token ? `Saved card: ${token.description.masked_pan}` : 'No saved card in session';
    });

    checkout.paymentMethods.subscribe(methods => {
        cardMethod = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[])
            .find((m): m is CardMethod => m.method === 'creditcard' && !m.isSecondary) ?? null;
        if (checkout?.sessionState.value !== 'submitted') {
            buyNowBtn.disabled = false;
        }
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
