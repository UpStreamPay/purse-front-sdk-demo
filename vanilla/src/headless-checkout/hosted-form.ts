import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnv, getEnvironment} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Session setup — replace with your backend call in production.
// ─────────────────────────────────────────────────────────────────────────────

const payBtn = $('pay-btn') as HTMLButtonElement;
let activeForm: HeadlessCheckout.PurseHeadlessCheckoutPaymentElement | null = null;

const PAYMENT_ELEMENT_OPTIONS: HeadlessCheckout.PaymentElementOptions = {
    locale: 'en-GB',
    hostedForm: {
        // ── Card number ────────────────────────────────────────────
        panInputLabel: 'Card number',
        panPlaceholder: '1234 5678 9012 3456',
        panRequiredError: 'Card number is required',
        panFormatError: 'Card number is invalid',
        panCannotBeEmptyError: 'Card number cannot be empty',
        // ── Expiry ────────────────────────────────────────────────
        expirationInputLabel: 'Expiry date',
        expirationPlaceholder: 'MM/YY',
        expirationRequiredError: 'Expiry date is required',
        expirationFormatError: 'Expiry date is invalid',
        expirationCannotBeEmptyError: 'Expiry date cannot be empty',
        expirationOutOfRangeError: 'Card is expired',
        // ── CVV ───────────────────────────────────────────────────
        cvvInputLabel: 'CVV',
        cvvPlaceholder: '123',
        cvv4InputLabel: 'CVV',
        cvv4Placeholder: '1234',
        cvvRequiredError: 'CVV is required',
        cvvFormatError: 'CVV is invalid',
        cvvCannotBeEmptyError: 'CVV cannot be empty',
        // ── Holder name ───────────────────────────────────────────
        holderInputLabel: 'Cardholder name',
        holderPlaceholder: 'John Doe',
        holderRequiredError: 'Cardholder name is required',
        holderFormatError: 'Cardholder name is invalid',
        holderCannotBeEmptyError: 'Cardholder name cannot be empty',
        // ── Brand ─────────────────────────────────────────────────
        brandSelectionMode: 'implicit',
    },
    theme: {
        global: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '15px',
        },
        input: {
            color: '#1a1d2e',
            backgroundColor: '#f8f9fc',
            borderColor: '#e2e5ed',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderRadius: '8px',
            padding: '10px 12px',
            '::placeholder': {color: '#9ca3af'},
            ':focus': {
                borderColor: '#6366f1',
                boxShadow: '0 0 0 3px rgba(99,102,241,0.1)',
            },
        },
        label: {
            color: '#6b7280',
            fontSize: '11px',
            fontWeight: '600',
            margin: '0 0 6px 0',
        },
        helperText: {
            color: '#dc2626',
            fontSize: '12px',
            margin: '4px 0 0 0',
        },
    },
};

// Step 4 — Mount (or re-mount) the hosted form when the credit card method changes.
function renderHostedForm(method: HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod) {
    activeForm?.remove();
    activeForm = null;

    setStep('step-form', 'active');
    const container = $('payment-element');
    container.innerHTML = '';

    const form = method.getPaymentElement(PAYMENT_ELEMENT_OPTIONS);
    form.on('fatalError', () => showResult('error', 'Fatal error in payment form'));
    form.appendTo(container);
    activeForm = form;

    setStep('step-form', 'done');
    setStep('step-pay', 'active');
}

async function main() {
    setStep('step-sdk', 'active');

    // Step 1 — Load SDK
    const {createHeadlessCheckout} = await loadHeadlessCheckout(
        getEnvironment(),
    );
    setStep('step-sdk', 'done');
    setStep('step-init', 'active');

    // Step 2 — Init checkout
    let session: string;
    try {
        session = getSession();
    } catch (err) {
        setStep('step-init', 'error');
        showNotice(String(err));
        return;
    }

    const checkout = await createHeadlessCheckout(session);
    setStep('step-init', 'done');
    setStep('step-method', 'active');

    // Step 3 — Re-render hosted form whenever the credit card method appears or changes.
    checkout.paymentMethods.subscribe(methods => {
        const creditCard = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[])
            .find((m): m is HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod =>
                m.method === 'creditcard' && !m.isSecondary
            );

        if (!creditCard) return;
        setStep('step-method', 'done');
        renderHostedForm(creditCard);
    });

    // isPaymentFulfilled and pay button wired once — independent of form re-renders.
    checkout.isPaymentFulfilled.subscribe(ok => {
        payBtn.disabled = !ok;
    });

    // Step 5 — Submit
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
