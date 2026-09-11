import type { HttpEvent, MarkEvent, ProbeEvent, ThreeDSMethodData } from './probe';
import { findThreeDSMethodData } from './probe';

/**
 * The timeline is a pure function of the probe log. The flow drops `mark`
 * events at the points only it knows about (a submit started, a token came
 * back); everything else is inferred from traffic the browser actually made.
 *
 * The distinction that matters for an honest demo: `unobserved` is not `done`.
 * If the fingerprint runs entirely inside the cross-origin Secure Fields
 * iframe, we cannot see it, and the step says so rather than quietly turning
 * green.
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
  evidence: ProbeEvent[];
};

/**
 * The 3DS authentication result, as it comes back on the create_payment
 * response — `authentication.partner_authentications[].card.three_ds`. This is
 * the actual outcome of the fingerprint: whether the ACS was satisfied without
 * a challenge, and the cryptogram it issued.
 */
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
  failed: boolean;
};

const isMark = (e: ProbeEvent): e is MarkEvent => e.kind === 'mark';
const isHttp = (e: ProbeEvent): e is HttpEvent => e.kind === 'http';

function mark(events: ProbeEvent[], label: string): MarkEvent | undefined {
  return events.filter(isMark).find(m => m.label === label);
}

/** Versioning and the fingerprint both happen between these two marks. */
function window_(events: ProbeEvent[]): { from: number; to: number } | null {
  const start = mark(events, 'tokenize:start');
  if (!start) return null;
  const end = mark(events, 'tokenize:done') ?? mark(events, 'tokenize:error');
  return { from: start.at, to: end ? end.at : Number.POSITIVE_INFINITY };
}

const within = (e: ProbeEvent, w: { from: number; to: number } | null) =>
  w !== null && e.at >= w.from && e.at <= w.to;

/**
 * @param armed the live state of the 3DS toggle. Passed in rather than read
 * from the marks: the `3ds:armed` mark is only emitted once Secure Fields is
 * ready, so deriving it from the log alone would label the 3DS steps "3DS off"
 * during the seconds before the form mounts — and again whenever the form
 * fails to load at all.
 */
export function derive(events: ProbeEvent[], armed: boolean): Derived {
  const started = mark(events, 'flow:start');
  const orderDone = mark(events, 'order:done');
  const eligibleDone = mark(events, 'eligible:done');
  const formReady = mark(events, 'form:ready');
  const tokStart = mark(events, 'tokenize:start');
  const tokDone = mark(events, 'tokenize:done');
  const tokError = mark(events, 'tokenize:error');
  const payStart = mark(events, 'payment:start');
  const payDone = mark(events, 'payment:done');
  const payError = mark(events, 'payment:error');
  const flowError = mark(events, 'flow:error');

  const w = window_(events);

  const tokDetail = tokDone?.detail as { threeDSServerTransID?: string } | undefined;
  const threeDSServerTransID = tokDetail?.threeDSServerTransID;

  // Evidence buckets.
  const orderCalls = events.filter(e => isHttp(e) && /\/(order|env)\b/.test(e.path));
  const eligibleCalls = events.filter(e => isHttp(e) && e.path.includes('eligible_solutions'));
  const paymentCalls = events.filter(e => isHttp(e) && e.path.includes('create_payment'));

  // 3DS versioning: a call made during the submit whose path looks like the
  // authentication chain rather than plain tokenisation.
  const versioningCalls = events.filter(
    e => isHttp(e) && within(e, w) && /3ds|three.?ds|version|authenticat/i.test(e.path),
  );

  // The 3DS Method (fingerprint). Deliberately narrow: Secure Fields also
  // creates display:none iframes for its own non-visible fields, so "a
  // concealed iframe appeared" is not evidence of anything. What counts is the
  // frame the SDK names `purse-3ds-method…`, the auto-submitted form carrying a
  // threeDSMethodData input, or a resource load to a host that is neither ours
  // nor Purse's — i.e. the issuer's ACS.
  const isMethodFrameName = (name: string) => /3ds.?method|threeds.?method/i.test(name);

  const methodEvidence = events.filter(e => {
    if (!within(e, w)) return false;
    if (e.kind === 'form') return e.inputs.some(i => /threeDSMethod/i.test(i));
    if (e.kind === 'iframe') return isMethodFrameName(e.name) || /threeDSMethod/i.test(e.src);
    if (e.kind === 'resource') return !/(^|\.)purse-(sandbox|test|secure)\.com$/.test(e.host);
    if (e.kind === 'http') return /threeDSMethod/i.test(e.url);
    return false;
  });

  const methodData =
    findThreeDSMethodData(methodEvidence.map(e => ('src' in e ? e.src : 'url' in e ? e.url : ''))) ??
    findThreeDSMethodData(events.filter(e => e.kind === 'message').map(e => e.preview)) ??
    findThreeDSMethodData(events.filter(isHttp).map(e => e.reqBody)) ??
    undefined;

  const payResponse = payDone?.detail as
    | {
        authorization?: { status?: string };
        redirection?: { href?: string };
        authentication?: {
          status?: string;
          partner_authentications?: Array<{
            partner_status?: string;
            status?: string;
            card?: { three_ds?: Record<string, string> };
          }>;
        };
      }
    | undefined;

  const partnerAuth = payResponse?.authentication?.partner_authentications?.[0];
  const threeDs = partnerAuth?.card?.three_ds;
  const outcome: ThreeDSOutcome | undefined = threeDs
    ? {
        ...threeDs,
        partner_status: partnerAuth?.partner_status,
        status: payResponse?.authentication?.status,
      }
    : undefined;
  const frictionless = outcome?.flow === 'FRICTIONLESS';
  const authorization = payResponse?.authorization?.status;
  // PENDING plus a redirection means the ACS asked for a challenge. This
  // showcase is the frictionless path only, so it says so instead of sitting on
  // an "active" step for ever.
  const challengeRequired = authorization === 'PENDING' && !!payResponse?.redirection?.href;

  const failed = !!(tokError || payError || flowError);

  // A step whose 3DS phase never applies.
  const skipIfOff = (s: StepState): StepState => (armed ? s : 'skipped');
  const offLabel = armed ? undefined : '3DS off';

  const between = (a?: MarkEvent, b?: MarkEvent) => (a && b ? b.at - a.at : undefined);

  const eligibleCount = (eligibleDone?.detail as { count?: number } | undefined)?.count;

  const steps: Step[] = [
    {
      id: 'order',
      title: 'Order & browser IP',
      blurb: 'GET /order/ for the basket, GET /env to read back the cardholder IP the AReq needs.',
      state: orderDone ? 'done' : started ? 'active' : 'pending',
      ms: between(started, orderDone),
      evidence: orderCalls,
    },
    {
      id: 'eligible',
      title: 'Eligible solutions',
      blurb: 'POST /eligible_solutions — which partner/method pairs can take this order.',
      state: eligibleDone ? 'done' : orderDone ? 'active' : 'pending',
      ms: between(orderDone, eligibleDone),
      detail: eligibleCount === undefined ? undefined : `${eligibleCount} eligible`,
      evidence: eligibleCalls,
    },
    {
      id: 'form',
      title: 'Secure Fields mounted',
      blurb: 'PAN, expiry, CVV and holder name render in cross-origin iframes — the page never sees them.',
      state: formReady ? 'done' : eligibleDone ? 'active' : 'pending',
      evidence: events.filter(e => e.kind === 'iframe' && !e.concealed),
    },
    {
      id: 'tokenize',
      title: 'Tokenise the card',
      blurb: 'submit() exchanges the card data for a short-lived vault form token.',
      state: tokError ? 'error' : tokDone ? 'done' : tokStart ? 'active' : 'pending',
      ms: between(tokStart, tokDone ?? tokError),
      detail: tokError ? String((tokError.detail as { error?: string })?.error ?? 'failed') : undefined,
      evidence: events.filter(e => isHttp(e) && within(e, w) && !/3ds|version/i.test(e.path)),
    },
    {
      id: 'versioning',
      skipLabel: offLabel,
      title: '3DS versioning',
      blurb:
        'The vault asks the 3DS Server which protocol version the card range speaks, and whether it advertises a Method URL. This is what mints the threeDSServerTransID.',
      state: skipIfOff(
        versioningCalls.length > 0
          ? 'done'
          : tokDone
            ? threeDSServerTransID
              ? 'unobserved'
              : 'error'
            : tokStart
              ? 'active'
              : 'pending',
      ),
      unobservedNote:
        'A transaction id came back, so versioning ran, but no matching request was captured — the SDK reached the 3DS Server by a route the page cannot see.',
      evidence: versioningCalls,
    },
    {
      id: 'method',
      skipLabel: offLabel,
      title: 'Device fingerprint (3DS Method)',
      blurb:
        'A hidden iframe loads the ACS page and POSTs it a threeDSMethodData blob. The ACS profiles the browser, then calls its notification URL back.',
      state: skipIfOff(
        methodEvidence.length > 0
          ? 'done'
          : tokDone
            ? 'unobserved'
            : tokStart
              ? 'active'
              : 'pending',
      ),
      unobservedNote:
        'No 3DS Method frame appeared. Usually that means this card range advertises no Method URL, so there is no fingerprint to collect. Try a card whose range has one.',
      evidence: methodEvidence,
    },
    {
      id: 'transid',
      skipLabel: offLabel,
      title: 'threeDSServerTransID',
      blurb: 'The id the authentication hangs off. Putting it on the split is what triggers the Purse 3DS advanced flow.',
      state: skipIfOff(
        threeDSServerTransID ? 'done' : tokDone ? 'error' : tokStart ? 'active' : 'pending',
      ),
      detail: threeDSServerTransID,
      evidence: [],
    },
    {
      id: 'payment',
      title: 'Create payment',
      blurb:
        'POST /create_payment with the vault token, the threeds_server_trans_id and the browser node the AReq is built from.',
      state: payError ? 'error' : payDone ? 'done' : payStart ? 'active' : 'pending',
      ms: between(payStart, payDone ?? payError),
      evidence: paymentCalls,
    },
    {
      id: 'authentication',
      title: '3DS authentication result',
      blurb:
        'What the issuer decided. FRICTIONLESS means the fingerprint was enough on its own. ECI 05 carries the liability shift.',
      state: skipIfOff(
        outcome
          ? outcome.status === 'SUCCESS'
            ? 'done'
            : 'error'
          : payDone
            ? 'unobserved'
            : payStart
              ? 'active'
              : 'pending',
      ),
      skipLabel: offLabel,
      unobservedNote:
        'The payment response carried no authentication node — the payment was created without a 3DS authentication.',
      detail: outcome
        ? [
            outcome.flow,
            outcome.eci && `ECI ${outcome.eci}`,
            outcome.version && `3DS ${outcome.version}`,
            outcome.directory_response && `directory \u201c${outcome.directory_response}\u201d`,
          ]
            .filter(Boolean)
            .join(' \u00b7 ')
        : undefined,
      evidence: [],
    },
    {
      id: 'authorization',
      title: 'Authorization',
      blurb: challengeRequired
        ? 'The fingerprint was not enough and the issuer asked for a challenge. Following that redirection is out of scope here; the vanilla advanced-flow demo handles it.'
        : 'Whether the payment was actually authorised, once the authentication was settled.',
      state: authorization
        ? authorization === 'AUTHORIZED'
          ? 'done'
          : challengeRequired
            ? 'skipped'
            : authorization === 'PENDING'
              ? 'active'
              : 'error'
        : payDone
          ? 'unobserved'
          : 'pending',
      unobservedNote:
        'The payment was created but carried no authorization status. The real outcome comes from the payment.updated webhook, not this response.',
      skipLabel: challengeRequired ? 'challenge required' : undefined,
      detail: challengeRequired ? `${authorization} — challenge required` : authorization,
      evidence: [],
    },
  ];

  return {
    steps,
    threeDSServerTransID,
    methodData,
    authorization,
    outcome,
    frictionless,
    authMs: between(tokStart, tokDone),
    paymentResponse: payDone?.detail,
    paymentRequest: payStart?.detail,
    failed,
  };
}
