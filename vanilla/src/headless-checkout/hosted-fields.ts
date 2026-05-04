import {loadHeadlessCheckout, type HeadlessCheckout} from '@purse-eu/web-sdk';
import {getEnv, getEnvironment} from '../shared/env';
import {getSession} from '../shared/session';
import {$, setStep, showNotice, showResult} from '../shared/ui';
import '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Session setup — replace with your backend call in production.
// ─────────────────────────────────────────────────────────────────────────────

const payBtn = $('pay-btn') as HTMLButtonElement;

type Layout = 'grid' | 'single-line' | 'card';
let currentLayout: Layout = 'grid';
let activeHF: HeadlessCheckout.PurseHeadlessCheckoutHostedFields | null = null;
let currentMethod: HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod | null = null;

const LAYOUT_TAB_BASE = 'px-3.5 py-1.5 border border-border rounded-full text-xs font-[inherit] bg-bg cursor-pointer transition-all';
const LAYOUT_TAB_ACTIVE = 'px-3.5 py-1.5 border rounded-full text-xs font-[inherit] cursor-pointer transition-all bg-accent text-white border-accent';

const BRAND_PILL_BASE = 'px-2.5 py-0.5 bg-bg border border-border rounded-full text-xs cursor-pointer transition-all';
const BRAND_PILL_SELECTED = 'px-2.5 py-0.5 bg-accent text-white border-accent rounded-full text-xs cursor-pointer transition-all';

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

    hf.detectedBrands.subscribe((brands: string[]) => {
        if (brands.length === 0) {
            ($('brand-indicator') as HTMLElement).style.display = 'none';
            return;
        }

        ($('brand-indicator') as HTMLElement).style.display = 'flex';
        const pills = $('brand-pills');
        pills.innerHTML = '';

        brands.forEach(brand => {
            const pill = document.createElement('button');
            pill.className = BRAND_PILL_BASE;
            pill.textContent = brand;
            pill.addEventListener('click', () => {
                hf.setSelectedBrand(brand as HeadlessCheckout.CardScheme);
                pills.querySelectorAll('button').forEach(p => {
                    (p as HTMLButtonElement).className = BRAND_PILL_BASE;
                });
                pill.className = BRAND_PILL_SELECTED;
            });
            pills.appendChild(pill);
        });

        if (brands.length === 1) {
            hf.setSelectedBrand(brands[0] as HeadlessCheckout.CardScheme);
            const firstPill = pills.querySelector('button');
            if (firstPill) firstPill.className = BRAND_PILL_SELECTED;
        }
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
