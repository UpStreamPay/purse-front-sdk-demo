import { loadSecureFields, type Securefields } from '@purse-eu/web-sdk';
import { getSecureFieldsEnvironment } from './env';
import { $ } from './ui';

// Precise types inferred from the SDK, so callers stay type-safe without the
// SDK re-exporting them.
type SecureFieldsModule = Awaited<ReturnType<typeof loadSecureFields>>;
type SecureFieldsInstance = Awaited<ReturnType<SecureFieldsModule['initSecureFields']>>;
type FieldsConfig = Parameters<SecureFieldsModule['initSecureFields']>[0]['config']['fields'];

const BRAND_PILL_BASE = 'px-2.5 py-0.5 bg-bg border border-border rounded-full text-xs cursor-pointer transition-all';
const BRAND_PILL_SELECTED = 'px-2.5 py-0.5 bg-accent text-white border-accent rounded-full text-xs cursor-pointer transition-all';

const DEFAULT_BRANDS: Securefields.Brand[] = [
  'CARTE_BANCAIRE', 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'MAESTRO',
];

export type SecureFieldsHandle = {
  sf: SecureFieldsInstance;
  // The network the shopper picked for a co-branded card (null otherwise).
  getSelectedBrand: () => Securefields.Brand | null;
};

type BootOptions = {
  tenantId: string;
  apiKey: string;
  // Which Secure Fields to render, keyed by the SDK field name → DOM target id.
  fields: FieldsConfig;
  // Wire the #brand-indicator / #brand-pills UI (rendered by <sf-card-form brand>).
  brandSelect?: boolean;
  onReady?: () => void;
};

/**
 * Load the Secure Fields SDK, initialise the given fields, wire brand detection
 * (optional) and render. Shared by the tokenize and advanced-flow demos.
 *
 * The `test` environment is accepted at runtime but absent from the SDK's public
 * types, hence the cast (see env.ts / getSecureFieldsEnvironment).
 */
export async function bootSecureFields(opts: BootOptions): Promise<SecureFieldsHandle> {
  const { initSecureFields } = await loadSecureFields(
    getSecureFieldsEnvironment() as Parameters<typeof loadSecureFields>[0],
  );

  let selectedBrand: Securefields.Brand | null = null;

  const sf = await initSecureFields({
    tenantId: opts.tenantId,
    apiKey: opts.apiKey,
    config: {
      brands: DEFAULT_BRANDS,
      // false → we own brand selection via the pills below.
      brandSelector: false,
      fields: opts.fields,
      styles: { input: { placeholderColor: '#9ca3af' } },
    },
  });

  if (opts.onReady) sf.on('ready', opts.onReady);

  if (opts.brandSelect) {
    // brandDetected fires once enough digits identify the scheme. Co-branded
    // cards (e.g. CB/Visa) return more than one brand — let the shopper choose.
    sf.on('brandDetected', ({ brands }) => {
      const indicator = $('brand-indicator') as HTMLElement;
      const pills = $('brand-pills');
      if (!brands || brands.length === 0) {
        indicator.style.display = 'none';
        selectedBrand = null;
        return;
      }
      indicator.style.display = 'flex';
      pills.innerHTML = '';
      brands.forEach(brand => {
        const pill = document.createElement('button');
        pill.className = BRAND_PILL_BASE;
        pill.textContent = brand;
        pill.addEventListener('click', () => {
          selectedBrand = brand;
          pills.querySelectorAll('button').forEach(p => (p.className = BRAND_PILL_BASE));
          pill.className = BRAND_PILL_SELECTED;
        });
        pills.appendChild(pill);
      });
      if (brands.length === 1) {
        selectedBrand = brands[0];
        const first = pills.querySelector('button');
        if (first) first.className = BRAND_PILL_SELECTED;
      }
    });
  }

  sf.render();
  return { sf, getSelectedBrand: () => selectedBrand };
}
