import { loadSecureFields } from '@purse-eu/web-sdk';
import { getApiOrigin, getSecureFieldsEnvironment } from './env';

/**
 * 3DS challenge helpers, shared by both demos (plain TS — React reaches them through `@shared`).
 * The challenge is the second half of 3DS: when the fingerprint is not enough, the payment comes
 * back with `authentication.challenge_data` and the cardholder has to answer the ACS.
 */

/** What `sf.submit()` resolves with once the 3DS sequence ran. */
export type SubmitResult = {
  vault_form_token: string;
  three_ds_server_trans_id?: string;
  /** Pre-vault-front#334 spelling. Dropped once the test CDN ships that rename. */
  threeDSServerTransID?: string;
};

/**
 * The id the authentication hangs off, whichever spelling the loaded build uses. It goes on the
 * split item verbatim — `split[].three_ds_server_trans_id` — which is why the SDK renamed it.
 */
export function threeDSTransId(result: SubmitResult): string | undefined {
  return result.three_ds_server_trans_id ?? result.threeDSServerTransID;
}

/** The `POST /v2/payments` subset the challenge is driven from. */
export type PaymentAuthentication = {
  authentication?: {
    status?: string;
    /** Opaque blob: ACS URL, CReq and the challenge window size the AReq announced. */
    challenge_data?: string;
  };
};

/**
 * The challenge blob, when the issuer asked for one. Absent on a frictionless authentication —
 * and absent too when the partner wants a plain redirection instead (shared/redirection.ts).
 */
export function challengeData(payment: unknown): string | undefined {
  return (payment as PaymentAuthentication | null)?.authentication?.challenge_data || undefined;
}

/**
 * Outcome of `threeDSChallenge()`. It never rejects on a timeout or an abort: a silent ACS resolves
 * with the matching status rather than leaving the checkout on a pending promise.
 */
export type ChallengeResult = {
  status: 'completed' | 'timeout' | 'aborted';
  reason: 'message' | 'load' | 'timeout' | 'abort';
  /** The decoded completion message. `{ type, result, payment_id }` for the Purse challenge. */
  data?: unknown;
  durationMs: number;
};

/**
 * Posted into the challenge frame by the page answering `POST /v2/3ds/challenge-notification`.
 * Keys are absent rather than null; `REJECTED` carries `reason` instead of the status nodes.
 */
export type ChallengeCompletion = {
  type?: string;
  three_ds_server_trans_id?: string;
  payment_id?: string;
  result?: 'SETTLED' | 'PENDING' | 'REJECTED';
  /** `REJECTED` only. */
  reason?: string;
  /** Absent on `REJECTED`. */
  authentication?: { status?: string };
  /** Absent on `REJECTED`. */
  authorization?: { status?: string };
};

const COMPLETION_MESSAGE = 'purse:3ds:challenge-completed';

type ChallengeOptions = {
  challengeData: string;
  container: string | HTMLElement;
  signal?: AbortSignal;
};

// `threeDSChallenge` is exported by the Secure Fields bundle loaded from the CDN, but absent from
// @purse-eu/web-sdk 0.10.0's published types (same situation as the `threeDS` init config).
type ChallengeModule = {
  threeDSChallenge: (options: {
    challengeData: string;
    container: string | HTMLElement;
    completion: { origins: string[]; match?: (data: unknown) => boolean };
    signal?: AbortSignal;
  }) => Promise<ChallengeResult>;
};

/**
 * Render the challenge in-context and wait for the cardholder. The blob carries the ACS URL, the
 * CReq and the announced window size, so `container` needs a real height. The wait ends on the
 * notification page's postMessage — not `resolveAfterLoads`, which would settle on the ACS's own
 * navigation. The outcome is authoritative server-side; confirm the payment through your backend.
 */
export async function runChallenge(options: ChallengeOptions): Promise<ChallengeResult> {
  // The already-loaded bundle first: `loadSecureFields()` appends a fresh <script>
  // on every call (it memoizes nothing), so calling it again mid-checkout would
  // re-execute the SDK underneath the live Secure Fields instance.
  const loaded = (window as unknown as { PurseSecureFields?: ChallengeModule }).PurseSecureFields;
  const module =
    loaded ??
    ((await loadSecureFields(
      getSecureFieldsEnvironment() as Parameters<typeof loadSecureFields>[0],
    )) as unknown as ChallengeModule);

  return module.threeDSChallenge({
    challengeData: options.challengeData,
    container: options.container,
    completion: {
      origins: [getApiOrigin()],
      match: data => (data as ChallengeCompletion)?.type === COMPLETION_MESSAGE,
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
