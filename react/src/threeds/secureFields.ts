import { loadSecureFields, type Securefields } from '@purse-eu/web-sdk';
import { secureFieldsEnvironment } from './config';

// Types inferred from the SDK so callers stay type-safe without the SDK
// re-exporting them. Mirrors vanilla/src/shared/secure-fields.ts, which cannot
// be reused here because it imports a Lit component for the brand pills.
type SecureFieldsModule = Awaited<ReturnType<typeof loadSecureFields>>;
type SecureFieldsInstance = Awaited<ReturnType<SecureFieldsModule['initSecureFields']>>;
type InitParams = Parameters<SecureFieldsModule['initSecureFields']>[0];

const BRANDS: Securefields.Brand[] = [
  'CARTE_BANCAIRE',
  'VISA',
  'MASTERCARD',
  'AMERICAN_EXPRESS',
  'MAESTRO',
];

/**
 * What `submit()` resolves with. `threeDSServerTransID` is only present when
 * the instance was booted with 3DS armed and the versioning call succeeded; the
 * published SDK types do not carry it (vault-front#322 landed after
 * @purse-eu/web-sdk 0.10.0), hence the local shape.
 */
export type SubmitResult = {
  vault_form_token: string;
  threeDSServerTransID?: string;
};

export type BootOptions = {
  tenantId: string;
  apiKey: string;
  /**
   * Arm the 3DS sequence. The flag only arms it: `submit()` then chains 3DS
   * versioning and, when the card range advertises a 3DS Method URL, the
   * device fingerprint in a hidden iframe — both after tokenisation, since
   * versioning needs the form token.
   *
   * It is an init-time option, so flipping it means tearing the instance down
   * and mounting a fresh one rather than patching the live config.
   */
  threeDS: boolean;
  onReady?: () => void;
  onBrands?: (brands: Securefields.Brand[]) => void;
};

export type Handle = {
  sf: SecureFieldsInstance;
  submit: (selectedNetwork: Securefields.Brand | null) => Promise<SubmitResult | { error: string }>;
};

export async function bootSecureFields(opts: BootOptions): Promise<Handle> {
  const { initSecureFields } = await loadSecureFields(
    // `test` is accepted at runtime but absent from the SDK's public types.
    secureFieldsEnvironment() as Parameters<typeof loadSecureFields>[0],
  );

  const sf = await initSecureFields({
    tenantId: opts.tenantId,
    apiKey: opts.apiKey,
    config: {
      brands: BRANDS,
      // false → the page owns brand selection.
      brandSelector: false,
      fields: {
        cardNumber: { target: 'sf-pan', placeholder: '1234 5678 9012 3456' },
        holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
        expDate: { target: 'sf-exp', placeholder: 'MM/YY' },
        cvv: { target: 'sf-cvv', placeholder: '123' },
      },
      styles: { input: { placeholderColor: '#94a3b8', fontSize: '15px' } },
      // `threeDS` is absent from the published SDK types (see SubmitResult), so
      // the config is cast; the runtime SDK loaded from the CDN accepts it.
      ...(opts.threeDS ? { threeDS: { enabled: true } } : {}),
    } as InitParams['config'],
  });

  if (opts.onReady) sf.on('ready', opts.onReady);
  if (opts.onBrands) {
    const onBrands = opts.onBrands;
    sf.on('brandDetected', ({ brands }) => onBrands(brands ?? []));
  }

  sf.render();

  return {
    sf,
    submit: async selectedNetwork => {
      const result = await sf.submit({
        ...(selectedNetwork ? { selectedNetwork } : {}),
      });
      if ('error' in result && result.error) return { error: String(result.error) };
      return result as SubmitResult;
    },
  };
}
