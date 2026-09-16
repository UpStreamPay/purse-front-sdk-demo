import type { ChallengeCompletion } from '@shared/three-ds';
import type { MarkEvent, ProbeEvent, ThreeDSMethodData } from '../probe';

/**
 * `unobserved` is not `done`: work that runs inside the cross-origin Secure
 * Fields iframe leaves no evidence here, and the timeline says so rather than
 * quietly turning green.
 */
export type StepState = 'pending' | 'active' | 'done' | 'error' | 'skipped' | 'unobserved';

export type Step = {
  id: string;
  title: string;
  blurb: string;
  state: StepState;
  ms?: number;
  detail?: string;
  /** Shown when the state is `unobserved` — why no evidence turned up. */
  unobservedNote?: string;
  /** Replaces the generic "skipped" chip with the actual reason. */
  skipLabel?: string;
  /** Which arm of the fork this step belongs to. */
  branch?: 'frictionless' | 'challenge';
  evidence: ProbeEvent[];
};

/** `authentication.partner_authentications[].card.three_ds` — what the ACS decided. */
export type ThreeDSOutcome = {
  flow?: string;
  eci?: string;
  version?: string;
  directory_response?: string;
  ds_transaction_id?: string;
  acs_transaction_id?: string;
  cavv?: string;
  partner_status?: string;
  status?: string;
};

/** The `POST /v2/payments` subset the timeline reads. */
export type PaymentResponse = {
  id?: string;
  authorization?: { status?: string };
  redirection?: { href?: string };
  authentication?: {
    status?: string;
    /** Present when the issuer asked for a challenge. */
    challenge_data?: string;
    partner_authentications?: Array<{
      partner_status?: string;
      status?: string;
      card?: { three_ds?: Record<string, string> };
    }>;
  };
};

/** `challenge:done` — the SDK's frame result, wrapping the completion message. */
export type ChallengeDetail = {
  status?: string;
  reason?: string;
  durationMs?: number;
  data?: ChallengeCompletion;
};

/** `confirm:done` — the payment read back, and how many reads it took. */
export type ConfirmDetail = {
  settled?: boolean;
  polls?: number;
  unsupported?: boolean;
  payment?: PaymentResponse;
};

export type Derived = {
  steps: Step[];
  threeDSServerTransID?: string;
  methodData?: ThreeDSMethodData;
  authorization?: string;
  outcome?: ThreeDSOutcome;
  /** The ACS authenticated on the fingerprint alone. */
  frictionless: boolean;
  /** Wall time from the first submit to the transaction id landing. */
  authMs?: number;
  paymentResponse?: unknown;
  paymentRequest?: unknown;
  /** The opaque `authentication.challenge_data` blob. */
  challengeBlob?: string;
  challengeFrame?: unknown;
  /** The `purse:3ds:challenge-completed` message. */
  completion?: ChallengeCompletion;
  /** The payment read back from the API after the challenge. */
  confirmedPayment?: unknown;
  failed: boolean;
};

/** What the log says, once read — the input both halves of the timeline render from. */
export type Facts = {
  events: ProbeEvent[];
  marks: Record<string, MarkEvent | undefined>;
  evidence: ReturnType<typeof import('./evidence').collectEvidence>;
  challengeEvidence: ProbeEvent[];
  payResponse?: PaymentResponse;
  confirmed?: PaymentResponse;
  confirmDetail?: ConfirmDetail;
  chalResult?: ChallengeDetail;
  chalCompletion?: ChallengeCompletion;
  chalRejected: boolean;
  outcome?: ThreeDSOutcome;
  authorization?: string;
  needsRedirect: boolean;
  threeDSServerTransID?: string;
  /** 3DS armed on this submit — the steps it covers say "3DS off" when not. */
  armed: boolean;
};
