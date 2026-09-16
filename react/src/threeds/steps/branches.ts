import { between } from './evidence';
import type { Facts, Step, StepState } from './types';

/**
 * The fork: the ACS either authenticated on the fingerprint alone, or asked for
 * the cardholder. The arms do not run the same steps — only the challenge one
 * has to read the payment back — so each carries its own, and the arm that did
 * not run is greyed out whole.
 */
export function branchSteps(f: Facts): Step[] {
  const { marks: m, armed, chalRejected, outcome, authorization, needsRedirect } = f;
  const skipIfOff = (s: StepState): StepState => (armed ? s : 'skipped');
  const offLabel = armed ? undefined : '3DS off';

  const challenged = !!(m['challenge:start'] || f.payResponse?.authentication?.challenge_data);
  const taken: Step['branch'] | undefined = challenged
    ? 'challenge'
    : m['payment:done']
      ? 'frictionless'
      : undefined;

  const authState = (): StepState => {
    if (chalRejected) return 'error';
    if (!outcome) return m['payment:done'] ? 'unobserved' : m['payment:start'] ? 'active' : 'pending';
    if (outcome.status === 'SUCCESS') return 'done';
    // IN_PROGRESS is not a failure — a challenged payment sits there until it settles.
    return outcome.status === 'IN_PROGRESS' ? 'active' : 'error';
  };

  const authzState = (): StepState => {
    // A rejected challenge leaves the stale PENDING behind: refused, not in flight.
    if (chalRejected) return 'error';
    if (!authorization) return m['payment:done'] ? 'unobserved' : 'pending';
    if (authorization === 'AUTHORIZED') return 'done';
    if (needsRedirect) return 'skipped';
    return authorization === 'PENDING' ? 'active' : 'error';
  };

  const authentication = (branch: Step['branch']): Step => ({
    id: `authentication-${branch}`,
    branch,
    title: 'Authentication result',
    blurb:
      branch === 'frictionless'
        ? 'The ARes settles it: authenticated on the AReq alone. ECI 05 (Visa) or 02 (Mastercard) carries the liability shift.'
        : 'Settled by the RReq once the cardholder answered. Same fields, reached the long way round.',
    state: skipIfOff(authState()),
    skipLabel: offLabel,
    unobservedNote:
      'The payment response carried no authentication node — the payment was created without a 3DS authentication.',
    detail: outcome
      ? [
          outcome.status,
          outcome.flow,
          outcome.eci && `ECI ${outcome.eci}`,
          outcome.version && `3DS ${outcome.version}`,
          outcome.directory_response && `directory “${outcome.directory_response}”`,
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined,
    evidence: [],
  });

  const authorizationStep = (branch: Step['branch']): Step => ({
    id: `authorization-${branch}`,
    branch,
    title: 'Authorization',
    blurb: needsRedirect
      ? 'The partner wants the shopper on its own page before it authorises. Out of scope here; the vanilla advanced-flow demo follows redirections.'
      : 'Whether the payment was actually authorised, once the authentication was settled.',
    state: authzState(),
    unobservedNote:
      'The payment was created but carried no authorization status. The real outcome comes from the payment.updated webhook.',
    skipLabel: needsRedirect ? 'redirect required' : undefined,
    detail: chalRejected
      ? `REJECTED${f.chalCompletion?.reason ? ` — ${f.chalCompletion.reason}` : ''}`
      : needsRedirect
        ? `${authorization} — partner redirect required`
        : authorization,
    evidence: [],
  });

  const frictionlessArm: Step[] = [
    {
      id: 'frictionless',
      branch: 'frictionless',
      title: 'No challenge',
      blurb:
        'The fingerprint satisfied the ACS: create_payment comes back already authenticated, and the cardholder is never interrupted.',
      state: skipIfOff(
        outcome?.flow === 'FRICTIONLESS' ? 'done' : m['payment:done'] ? 'skipped' : 'pending',
      ),
      detail: outcome?.flow === 'FRICTIONLESS' ? 'no cardholder interaction' : undefined,
      evidence: [],
    },
    authentication('frictionless'),
    authorizationStep('frictionless'),
  ];

  const challengeArm: Step[] = [
    {
      id: 'challenge',
      branch: 'challenge',
      title: '3DS challenge',
      blurb:
        'create_payment carries authentication.challenge_data. threeDSChallenge() posts it to the ACS in an in-context iframe and waits for the purse:3ds:challenge-completed message.',
      state: skipIfOff(challengeState(f)),
      ms: f.chalResult?.durationMs,
      detail: m['challenge:done']
        ? [
            f.chalResult?.status,
            f.chalCompletion?.result,
            f.chalCompletion?.reason,
            f.chalCompletion?.payment_id,
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined,
      evidence: f.challengeEvidence,
    },
    {
      id: 'confirm',
      branch: 'challenge',
      title: 'Confirm server-side',
      blurb:
        'GET /payment/{id} through the merchant backend, until the authorization leaves PENDING. Only this arm needs it: create_payment answered before the cardholder authenticated.',
      state: confirmState(f),
      ms: f.confirmDetail?.unsupported
        ? undefined
        : between(m['confirm:start'], m['confirm:done']),
      detail:
        m['confirm:done'] && !f.confirmDetail?.unsupported
          ? `${f.confirmDetail?.polls ?? 1} read${(f.confirmDetail?.polls ?? 1) > 1 ? 's' : ''}`
          : undefined,
      unobservedNote: f.confirmDetail?.unsupported
        ? 'This proxy has no GET /payment/{id}. Point VITE_PURSE_PROXY_URL at a backend that exposes it (usp-widget/packages/alfred, http://localhost:9001 locally) to see this step run.'
        : 'Still PENDING when the polling gave up. Not a failure — Orchestration settles it asynchronously, and the webhook is what a real integration waits on.',
      evidence: f.evidence.confirmCalls,
    },
    authentication('challenge'),
    authorizationStep('challenge'),
  ];

  return [...arm(frictionlessArm, 'frictionless', taken), ...arm(challengeArm, 'challenge', taken)];
}

function challengeState(f: Facts): StepState {
  if (f.marks['challenge:done'])
    return f.chalResult?.status === 'completed' && !f.chalRejected ? 'done' : 'error';
  if (f.marks['challenge:start']) return 'active';
  return f.marks['payment:done'] ? 'skipped' : 'pending';
}

function confirmState(f: Facts): StepState {
  if (f.marks['confirm:done']) return f.confirmDetail?.settled ? 'done' : 'unobserved';
  return f.marks['confirm:start'] ? 'active' : 'pending';
}

/** Values belong to the arm that ran; the other one shows none of them. */
function arm(list: Step[], branch: Step['branch'], taken: Step['branch'] | undefined): Step[] {
  if (!taken || taken === branch) return list;
  return list.map(step => ({
    ...step,
    state: 'skipped' as StepState,
    skipLabel: branch === 'frictionless' ? 'challenged' : 'frictionless',
    detail: undefined,
    ms: undefined,
    evidence: [],
  }));
}
