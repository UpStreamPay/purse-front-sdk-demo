import '../components';
import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnv, getEnvironment} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import type {DemoButton} from '../components/demo-button';
import type {DemoOptionList} from '../components/demo-option-list';
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

const payBtn = document.querySelector<DemoButton>('demo-button')!;
const methodList = document.querySelector<DemoOptionList>('demo-option-list')!;
let activeElement: HeadlessCheckout.PurseHeadlessCheckoutPaymentElement | null = null;

// Resolve the selected method by id, and remember the checkout across the
// possibly-repeated paymentMethods emissions. The listener is attached once.
const methodsById = new Map<string, HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod>();
let checkoutRef: HeadlessCheckout.HeadlessCheckout | null = null;

methodList.addEventListener('option-select', e => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    const method = methodsById.get(id);
    if (method && checkoutRef) renderPaymentElement(method, checkoutRef);
});

function isPrimary(
    m: HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod,
): m is HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod {
    return !m.isSecondary;
}

function renderMethods(methods: HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[], checkout: HeadlessCheckout.HeadlessCheckout) {
    checkoutRef = checkout;
    const primaryMethods = methods.filter(isPrimary);
    methodsById.clear();
    primaryMethods.forEach(m => methodsById.set(m.id, m));

    methodList.options = primaryMethods.map(m => ({
        id: m.id,
        title: `${m.partner} · ${m.method}`,
        secondary: '→',
    }));
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
        payBtn.label = 'Processing…';
        payBtn.loading = true;

        try {
            await checkout.submitPayment();
            setStep('step-pay', 'done');
            showResult('success', {status: 'submitted'});
        } catch (err) {
            setStep('step-pay', 'error');
            showResult('error', String(err));
            payBtn.disabled = false;
            payBtn.label = 'Retry';
            payBtn.loading = false;
        }
    });
}

main();
