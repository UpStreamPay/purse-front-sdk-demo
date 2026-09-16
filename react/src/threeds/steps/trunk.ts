import { between } from './evidence';
import type { Facts, Step, StepState } from './types';

/** The steps every run walks, up to the fork: order → create_payment. */
export function trunkSteps(f: Facts): Step[] {
  const { marks: m, evidence: ev, armed, threeDSServerTransID } = f;
  const skipIfOff = (s: StepState): StepState => (armed ? s : 'skipped');
  const offLabel = armed ? undefined : '3DS off';
  const eligibleCount = (m['eligible:done']?.detail as { count?: number } | undefined)?.count;

  return [
    {
      id: 'order',
      title: 'Order & browser IP',
      blurb: 'GET /order/ for the basket, GET /env to read back the cardholder IP the AReq needs.',
      state: m['order:done'] ? 'done' : m['flow:start'] ? 'active' : 'pending',
      ms: between(m['flow:start'], m['order:done']),
      evidence: ev.orderCalls,
    },
    {
      id: 'eligible',
      title: 'Eligible solutions',
      blurb: 'POST /eligible_solutions — which partner/method pairs can take this order.',
      state: m['eligible:done'] ? 'done' : m['order:done'] ? 'active' : 'pending',
      ms: between(m['order:done'], m['eligible:done']),
      detail: eligibleCount === undefined ? undefined : `${eligibleCount} eligible`,
      evidence: ev.eligibleCalls,
    },
    {
      id: 'form',
      title: 'Secure Fields mounted',
      blurb:
        'PAN, expiry, CVV and holder name render in cross-origin iframes — the page never sees them.',
      state: m['form:ready'] ? 'done' : m['eligible:done'] ? 'active' : 'pending',
      evidence: ev.formFrames,
    },
    {
      id: 'submit',
      title: 'submit() called',
      blurb:
        'One call does the lot: the card is tokenised first, then the 3DS chain below runs on top of that token. All of it before submit() resolves.',
      state: m['tokenize:error'] ? 'error' : m['tokenize:start'] ? 'done' : 'pending',
      detail: m['tokenize:error']
        ? String((m['tokenize:error'].detail as { error?: string })?.error ?? 'failed')
        : undefined,
      evidence: [],
    },
    {
      id: 'versioning',
      skipLabel: offLabel,
      title: '3DS versioning',
      blurb:
        'The vault asks the 3DS Server which protocol version the card range speaks, and whether it advertises a Method URL. This is what mints the three_ds_server_trans_id.',
      state: skipIfOff(
        ev.versioningCalls.length > 0
          ? 'done'
          : m['tokenize:done']
            ? threeDSServerTransID
              ? 'unobserved'
              : 'error'
            : m['tokenize:start']
              ? 'active'
              : 'pending',
      ),
      unobservedNote:
        'A transaction id came back, so versioning ran, but no matching request was captured — the SDK reached the 3DS Server by a route the page cannot see.',
      evidence: ev.versioningCalls,
    },
    {
      id: 'method',
      skipLabel: offLabel,
      title: 'Device fingerprint (3DS Method)',
      blurb:
        'A hidden iframe loads the ACS page and POSTs it a threeDSMethodData blob. The ACS profiles the browser, then calls its notification URL back.',
      state: skipIfOff(
        ev.methodEvidence.length > 0
          ? 'done'
          : m['tokenize:done']
            ? 'unobserved'
            : m['tokenize:start']
              ? 'active'
              : 'pending',
      ),
      unobservedNote:
        'No 3DS Method frame appeared. Usually that means this card range advertises no Method URL, so there is no fingerprint to collect. Try a card whose range has one.',
      evidence: ev.methodEvidence,
    },
    {
      id: 'transid',
      skipLabel: offLabel,
      title: 'three_ds_server_trans_id',
      blurb:
        'The id the authentication hangs off. Putting it on the split is what triggers the Purse 3DS advanced flow.',
      state: skipIfOff(
        threeDSServerTransID
          ? 'done'
          : m['tokenize:done']
            ? 'error'
            : m['tokenize:start']
              ? 'active'
              : 'pending',
      ),
      detail: threeDSServerTransID,
      evidence: [],
    },
    {
      id: 'payment',
      title: 'Create payment',
      blurb:
        'POST /create_payment with the vault token, the three_ds_server_trans_id and the browser node the AReq is built from.',
      state: m['payment:error']
        ? 'error'
        : m['payment:done']
          ? 'done'
          : m['payment:start']
            ? 'active'
            : 'pending',
      ms: between(m['payment:start'], m['payment:done'] ?? m['payment:error']),
      evidence: ev.paymentCalls,
    },
  ];
}
