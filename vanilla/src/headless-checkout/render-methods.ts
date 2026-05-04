import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnv, getEnvironment} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Session setup
//
// In production, replace this function with a fetch to your backend API.
// Example:
//   const session = await fetch('/api/payment/session').then(r => r.json());
//
// For local testing, paste your session JSON into VITE_PURSE_SESSION_JSON
// in .env.local (see .env.example).
// ─────────────────────────────────────────────────────────────────────────────

const payBtn = $('pay-btn') as HTMLButtonElement;
let activeElement: HeadlessCheckout.PurseHeadlessCheckoutPaymentElement | null = null;

const METHOD_BTN_BASE = 'flex items-center gap-3 w-full px-3.5 py-3 bg-bg border border-border rounded-lg cursor-pointer text-left text-sm font-[inherit] transition-all hover:border-accent hover:bg-violet-50';
const METHOD_BTN_ACTIVE = 'flex items-center gap-3 w-full px-3.5 py-3 border rounded-lg cursor-pointer text-left text-sm font-[inherit] transition-all border-accent bg-violet-50';

function isPrimary(
    m: HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod,
): m is HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod {
    return !m.isSecondary;
}

function renderMethods(methods: HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[], checkout: HeadlessCheckout.HeadlessCheckout) {
    const list = $('method-list');
    list.innerHTML = '';

    const primaryMethods = methods.filter(isPrimary);

    if (primaryMethods.length === 0) {
        list.innerHTML = '<div class="flex items-center justify-center min-h-20 text-muted text-sm">No payment methods in this session</div>';
        return;
    }

    primaryMethods.forEach(method => {
        const btn = document.createElement('button');
        btn.className = METHOD_BTN_BASE;
        btn.dataset.id = method.id;
        btn.innerHTML = `
      <span class="font-medium">${method.partner} · ${method.method}</span>
      <span class="text-xs text-muted ml-auto">→</span>`;

        btn.addEventListener('click', () => {
            list.querySelectorAll('button').forEach(b => {
                (b as HTMLButtonElement).className = METHOD_BTN_BASE;
            });
            btn.className = METHOD_BTN_ACTIVE;
            renderPaymentElement(method, checkout);
        });

        list.appendChild(btn);
    });
}

function renderPaymentElement(
    method: HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod,
    checkout: HeadlessCheckout.HeadlessCheckout,
) {
    const container = $('payment-element');
    container.innerHTML = '';

    // getPaymentElement() renders a hosted form (single iframe)
    const el = method.getPaymentElement();

    el.on('fatalError', () => {
        showResult('error', 'Fatal error in payment element');
    });

    el.appendTo(container);
    activeElement = el;

    setStep('step-form', 'active');
    ($('form-card') as HTMLElement).style.display = 'block';

    // isPaymentFulfilled becomes true once the SDK considers the form ready to submit
    checkout.isPaymentFulfilled.subscribe(ok => {
        payBtn.disabled = !ok;
        if (ok) setStep('step-form', 'done');
    });
}

async function main() {
    setStep('step-sdk', 'active');

    // Step 1 — Load the SDK from CDN
    const {createHeadlessCheckout} = await loadHeadlessCheckout(
        getEnvironment(),
    );
    setStep('step-sdk', 'done');
    setStep('step-init', 'active');

    // Step 2 — Fetch session and initialise checkout
    let session: string;
    try {
        session = getSession();
    } catch (err) {
        setStep('step-init', 'error');
        showNotice(String(err));
        return;
    }

    const checkout = await createHeadlessCheckout(session, {
        // Called just before the SDK posts to the payment network.
        // Useful for collecting analytics or applying last-minute logic.
        // onBeforeValidate: async () => {},

        // Handle redirections (3DS, bank redirect, etc.)
        // onRedirection: async ({ redirect }) => redirect(),
    });
    setStep('step-init', 'done');
    setStep('step-methods', 'active');

    // Step 3 — Subscribe to payment methods
    checkout.paymentMethods.subscribe(methods => {
        const primary = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[]).filter(isPrimary);
        if (primary.length > 0) {
            setStep('step-methods', 'done');
            ($('methods-card') as HTMLElement).style.display = 'block';
        }
        renderMethods(methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[], checkout);
    });

    // Step 5 — Pay button
    setStep('step-pay', 'active');
    payBtn.addEventListener('click', async () => {
        payBtn.disabled = true;
        payBtn.textContent = 'Processing…';
        payBtn.classList.add('loading');

        try {
            await checkout.submitPayment();
            setStep('step-pay', 'done');
            showResult('success', {status: 'submitted'});
        } catch (err) {
            setStep('step-pay', 'error');
            showResult('error', String(err));
            payBtn.disabled = false;
            payBtn.textContent = 'Retry';
            payBtn.classList.remove('loading');
        }
    });
}

main();
