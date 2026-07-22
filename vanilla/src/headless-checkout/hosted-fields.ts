import '../components';
import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnv, getEnvironment} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import type {DemoButton} from '../components/demo-button';
import type {DemoBrandPills} from '../components/demo-brand-pills';
import '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Session setup — replace with your backend call in production.
// ─────────────────────────────────────────────────────────────────────────────

const payBtn = document.querySelector<DemoButton>('demo-button')!;

type Layout = 'grid' | 'single-line' | 'card';
let currentLayout: Layout = 'grid';
let activeHF: HeadlessCheckout.PurseHeadlessCheckoutHostedFields | null = null;
let currentMethod: HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod | null = null;

const LAYOUT_TAB_BASE = 'px-3.5 py-1.5 border border-border rounded-full text-xs font-[inherit] bg-bg cursor-pointer transition-all';
const LAYOUT_TAB_ACTIVE = 'px-3.5 py-1.5 border rounded-full text-xs font-[inherit] cursor-pointer transition-all bg-accent text-white border-accent';

// Brand picker is shared across layouts; a single listener drives the current hf.
const brandPills = document.querySelector<DemoBrandPills>('demo-brand-pills')!;
brandPills.addEventListener('brand-select', e => {
    const { brand } = (e as CustomEvent<{ brand: string }>).detail;
    activeHF?.setSelectedBrand(brand as HeadlessCheckout.CardScheme);
});

const LIGHT_THEME: HeadlessCheckout.HostedFieldsTheme = {
    global: {},
    input: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: '#1a1d2e',
        backgroundColor: 'transparent',
        '::placeholder': {color: '#9ca3af'},
    },
};

const CARD_THEME: HeadlessCheckout.HostedFieldsTheme = {
    global: {},
    input: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: 'transparent',
        '::placeholder': {color: 'rgba(255,255,255,0.35)'},
    },
};

const THEMES: Record<Layout, HeadlessCheckout.HostedFieldsTheme> = {
    grid: LIGHT_THEME,
    'single-line': LIGHT_THEME,
    card: CARD_THEME,
};

const FIELD_TARGETS: Record<Layout, HeadlessCheckout.HostedFieldsOptions['fields']> = {
    grid: {
        cardNumber: {target: 'grid-pan', placeholder: '1234 5678 9012 3456'},
        holderName: {target: 'grid-name', placeholder: 'Card Holder Name'},
        expDate: {target: 'grid-exp', placeholder: 'MM/YY'},
        cvv: {target: 'grid-cvv', placeholder: '123'},
    },
    'single-line': {
        cardNumber: {target: 'sl-pan', placeholder: '1234 5678 9012 3456'},
        holderName: {target: 'sl-name', placeholder: 'Card Holder Name'},
        expDate: {target: 'sl-exp', placeholder: 'MM/YY'},
        cvv: {target: 'sl-cvv', placeholder: '123'},
    },
    card: {
        cardNumber: {target: 'card-pan', placeholder: '1234 5678 9012 3456'},
        holderName: {target: 'card-name', placeholder: 'Card Holder Name'},
        expDate: {target: 'card-exp', placeholder: 'MM/YY'},
        cvv: {target: 'card-cvv', placeholder: '123'},
    },
};

function showLayout(layout: Layout) {
    (['grid', 'single-line', 'card'] as Layout[]).forEach(l => {
        ($(`layout-${l}`) as HTMLElement).style.display = l === layout ? 'block' : 'none';
    });
    document.querySelectorAll('[data-layout]').forEach(tab => {
        const isActive = (tab as HTMLElement).dataset.layout === layout;
        tab.className = isActive ? LAYOUT_TAB_ACTIVE : LAYOUT_TAB_BASE;
    });
}

function setupHostedFields(method: HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod, layout: Layout) {
    activeHF?.remove();
    activeHF = null;

    showLayout(layout);
    setStep('step-render', 'active');

    const hf = method.getHostedFields({
        fields: FIELD_TARGETS[layout],
        theme: THEMES[layout],
    });

    hf.on('ready', () => setStep('step-render', 'done'));

    // <demo-brand-pills> renders the picker and tracks selection; the module-level
    // brand-select listener forwards the choice to the current hf (and auto-selects
    // a lone brand). Just feed it the detected brands here.
    hf.detectedBrands.subscribe((brands: string[]) => {
        brandPills.brands = brands;
    });

    hf.render();
    activeHF = hf;
}

// Wire layout tabs once at startup — uses currentMethod ref set when methods load.
document.querySelectorAll('[data-layout]').forEach(tab => {
    tab.addEventListener('click', () => {
        if (!currentMethod) return;
        currentLayout = (tab as HTMLElement).dataset.layout as Layout;
        setupHostedFields(currentMethod, currentLayout);
    });
});

async function main() {
    setStep('step-sdk', 'active');

    const {createHeadlessCheckout} = await loadHeadlessCheckout(
        getEnvironment(),
    );
    setStep('step-sdk', 'done');
    setStep('step-init', 'active');

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

    checkout.paymentMethods.subscribe(methods => {
        const creditCard = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[])
            .find((m): m is HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod =>
                m.method === 'creditcard' && !m.isSecondary
            );
        if (!creditCard) return;

        currentMethod = creditCard;
        setStep('step-method', 'done');
        setupHostedFields(creditCard, currentLayout);
    });

    checkout.isPaymentFulfilled.subscribe(ok => {
        payBtn.disabled = !ok;
    });

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
