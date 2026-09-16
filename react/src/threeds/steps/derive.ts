import type { ChallengeCompletion } from '@shared/three-ds';
import type { ProbeEvent } from '../probe';
import { branchSteps } from './branches';
import { between, challengeEvidence, collectEvidence, mark, submitWindow } from './evidence';
import { trunkSteps } from './trunk';
import type {
  ChallengeDetail,
  ConfirmDetail,
  Derived,
  Facts,
  PaymentResponse,
  ThreeDSOutcome,
} from './types';

const MARKS = [
  'flow:start',
  'flow:error',
  'order:done',
  'eligible:done',
  'form:ready',
  'tokenize:start',
  'tokenize:done',
  'tokenize:error',
  'payment:start',
  'payment:done',
  'payment:error',
  'challenge:start',
  'challenge:done',
  'confirm:start',
  'confirm:done',
] as const;

/**
 * The timeline is a pure function of the probe log: the flow drops marks at the
 * points only it knows about, everything else is inferred from observed traffic.
 *
 * @param armed live state of the 3DS toggle. Read from the caller, not the log:
 * the `3ds:armed` mark only lands once Secure Fields is ready, so the 3DS steps
 * would read "3DS off" for the seconds before the form mounts.
 */
export function derive(events: ProbeEvent[], armed: boolean): Derived {
  const marks = Object.fromEntries(MARKS.map(label => [label, mark(events, label)]));
  const w = submitWindow(events);
  const evidence = collectEvidence(events, w);

  const payResponse = marks['payment:done']?.detail as PaymentResponse | undefined;
  const chalResult = marks['challenge:done']?.detail as ChallengeDetail | undefined;
  const chalCompletion = chalResult?.data as ChallengeCompletion | undefined;
  const confirmDetail = marks['confirm:done']?.detail as ConfirmDetail | undefined;
  const confirmed = confirmDetail?.payment;

  // Three sources, most authoritative first: the payment read back, then the
  // completion message, then create_payment (written before the cardholder answered).
  const partnerAuth = (confirmed ?? payResponse)?.authentication?.partner_authentications?.[0];
  const threeDs = partnerAuth?.card?.three_ds;
  const outcome: ThreeDSOutcome | undefined = threeDs
    ? {
        ...threeDs,
        partner_status: partnerAuth?.partner_status,
        status:
          confirmed?.authentication?.status ??
          chalCompletion?.authentication?.status ??
          payResponse?.authentication?.status,
      }
    : undefined;
  const authorization =
    confirmed?.authorization?.status ??
    chalCompletion?.authorization?.status ??
    payResponse?.authorization?.status;

  const facts: Facts = {
    events,
    marks,
    evidence,
    challengeEvidence: challengeEvidence(events, marks['challenge:start']),
    payResponse,
    confirmed,
    confirmDetail,
    chalResult,
    chalCompletion,
    // A rejection carries `reason` instead of the two status nodes.
    chalRejected: chalCompletion?.result === 'REJECTED',
    outcome,
    authorization,
    // PENDING plus a redirection means the shopper has somewhere else to go.
    needsRedirect: authorization === 'PENDING' && !!payResponse?.redirection?.href,
    threeDSServerTransID: (marks['tokenize:done']?.detail as
      | { three_ds_server_trans_id?: string }
      | undefined)?.three_ds_server_trans_id,
    armed,
  };

  return {
    steps: [...trunkSteps(facts), ...branchSteps(facts)],
    threeDSServerTransID: facts.threeDSServerTransID,
    methodData: evidence.methodData,
    authorization,
    outcome,
    frictionless: outcome?.flow === 'FRICTIONLESS',
    authMs: between(marks['tokenize:start'], marks['tokenize:done']),
    paymentResponse: payResponse,
    paymentRequest: marks['payment:start']?.detail,
    challengeBlob: payResponse?.authentication?.challenge_data,
    challengeFrame: chalResult,
    completion: chalCompletion,
    confirmedPayment: confirmed,
    failed: !!(marks['tokenize:error'] || marks['payment:error'] || marks['flow:error']),
  };
}
