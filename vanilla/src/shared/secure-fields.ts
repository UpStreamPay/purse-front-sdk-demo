import { loadSecureFields, type Securefields } from '@purse-eu/web-sdk';
import { getSecureFieldsEnvironment } from './env';
import type { DemoBrandPills } from '../components/demo-brand-pills';

// Precise types inferred from the SDK, so callers stay type-safe without the
// SDK re-exporting them.
type SecureFieldsModule = Awaited<ReturnType<typeof loadSecureFields>>;
type SecureFieldsInstance = Awaited<ReturnType<SecureFieldsModule['initSecureFields']>>;
type FieldsConfig = Parameters<SecureFieldsModule['initSecureFields']>[0]['config']['fields'];
type InitParams = Parameters<SecureFieldsModule['initSecureFields']>[0];

const DEFAULT_BRANDS: Securefields.Brand[] = [
  'CARTE_BANCAIRE', 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'MAESTRO',
];

export type SecureFieldsHandle = {
  sf: SecureFieldsInstance;
  // The network the shopper picked for a co-branded card (null otherwise).
  getSelectedBrand: () => Securefields.Brand | null;
};

/**
 * What `submit()` resolves with. `threeDSServerTransID` is only present when the
 * instance was booted with `threeDS: true` and the versioning call succeeded;
 * the published SDK types do not carry it yet (vault-front#322 landed after
 * @purse-eu/web-sdk 0.10.0), hence the local shape.
 */
export type SubmitResult = {
  vault_form_token: string;
  threeDSServerTransID?: string;
};

type BootOptions = {
  tenantId: string;
  apiKey: string;
  // Which Secure Fields to render, keyed by the SDK field name → DOM target id.
  fields: FieldsConfig;
  // Wire the <demo-brand-pills> scheme selector (rendered by <sf-card-form brand>).
  brandSelect?: boolean;
  /**
   * Arm the 3DS sequence. The flag only arms it: `submit()` then chains 3DS
   * versioning and, when the card range has a 3DS Method URL, the device
   * fingerprint in a hidden iframe — both after tokenisation, since versioning
   * needs the form token. The result carries `threeDSServerTransID`.
   *
   * Purse-vault only, and only versioning + the frictionless outcome are wired
   * today — there is no challenge handling here.
   */
  threeDS?: boolean;
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
      // `threeDS` is absent from the published SDK types (see SubmitResult), so
      // the config is cast; the runtime SDK loaded from the CDN accepts it.
      ...(opts.threeDS ? { threeDS: { enabled: true } } : {}),
    } as InitParams['config'],
  });

  if (opts.onReady) sf.on('ready', opts.onReady);

  if (opts.brandSelect) {
    // <demo-brand-pills> renders the scheme picker and tracks selection; we just
    // feed it detected brands and record the shopper's choice. brandDetected
    // fires once enough digits identify the scheme (co-branded cards return >1).
    const pills = document.querySelector<DemoBrandPills>('demo-brand-pills');
    pills?.addEventListener('brand-select', e => {
      selectedBrand = (e as CustomEvent<{ brand: Securefields.Brand }>).detail.brand;
    });
    sf.on('brandDetected', ({ brands }) => {
      selectedBrand = null;
      if (pills) pills.brands = brands ?? [];
    });
  }

  sf.render();
  return { sf, getSelectedBrand: () => selectedBrand };
}
