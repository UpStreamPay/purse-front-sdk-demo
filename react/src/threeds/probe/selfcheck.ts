import { decodeThreeDSMethodData, findThreeDSMethodData } from './method-data';
import { MAX_STRING, redact, REDACTED } from './redact';

// ─────────────────────────────────────────────────────────────────────────────
// Self-check
//
// There is no test runner in this repo, so the two pieces of non-trivial pure
// logic check themselves on every dev page load (see main.tsx). A broken
// redactor throws here rather than leaking a card number onto a projector.
// ─────────────────────────────────────────────────────────────────────────────

export function selfCheck(): void {
  const assert = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`probe self-check failed: ${what}`);
  };

  const dirty = {
    amount: 1250,
    split: [{ card_number: '4111111111111111', cvv: '123', partner: 'uspmock' }],
    headers: { Authorization: 'Bearer abc', 'content-type': 'application/json' },
    apiKey: 'sk_live_nope',
  };
  const clean = redact(dirty) as typeof dirty & Record<string, unknown>;
  const json = JSON.stringify(clean);
  assert(!json.includes('4111111111111111'), 'card_number survived redaction');
  assert(!json.includes('123456') && !/"cvv":"123"/.test(json), 'cvv survived redaction');
  assert(!json.includes('sk_live_nope'), 'apiKey survived redaction');
  assert(!json.includes('Bearer abc'), 'Authorization survived redaction');
  assert(clean.amount === 1250, 'redaction ate a non-secret number');
  assert(clean.split[0].partner === 'uspmock', 'redaction ate a non-secret string');
  assert(
    (clean.headers as Record<string, string>)['content-type'] === 'application/json',
    'redaction ate a non-secret header',
  );

  // A structured node whose key collides with a secret name must survive — the
  // v2 payment response's `authorization` object is exactly this case.
  const structured = redact({
    authorization: { status: 'AUTHORIZED', partner_transactions: [{ amount: 480 }] },
    headers: { authorization: 'Bearer nope' },
  }) as { authorization: { status: string }; headers: { authorization: string } };
  assert(structured.authorization.status === 'AUTHORIZED', 'authorization object was redacted away');
  assert(structured.headers.authorization === REDACTED, 'authorization header was not redacted');

  const long = redact('x'.repeat(MAX_STRING + 500)) as string;
  assert(long.length < MAX_STRING + 100, 'long strings are not truncated');

  const sample = { threeDSServerTransID: 'abc-123', threeDSMethodNotificationURL: 'https://vault/n' };
  const encoded = btoa(JSON.stringify(sample));
  const decoded = decodeThreeDSMethodData(encoded);
  assert(decoded?.threeDSServerTransID === 'abc-123', 'threeDSMethodData did not round-trip');
  assert(
    decoded?.threeDSMethodNotificationURL === 'https://vault/n',
    'notification URL did not round-trip',
  );
  assert(decodeThreeDSMethodData('not base64 at all !!') === null, 'garbage did not return null');

  // The method blob's notification URL carries an api-key; it must never render.
  const withKey = redact({
    threeDSMethodNotificationURL: 'https://api.purse-test.com/v2/3ds/notify?api-key=abc123&x=1',
  }) as { threeDSMethodNotificationURL: string };
  assert(!withKey.threeDSMethodNotificationURL.includes('abc123'), 'api-key survived in a URL value');
  assert(withKey.threeDSMethodNotificationURL.includes('x=1'), 'scrubbing dropped a harmless param');
  assert(decodeThreeDSMethodData(btoa('"a string"')) === null, 'non-object did not return null');

  assert(
    findThreeDSMethodData({ body: `threeDSMethodData=${encoded}` })?.threeDSServerTransID === 'abc-123',
    'threeDSMethodData not found inside a string',
  );
  assert(findThreeDSMethodData({ nothing: 'here' }) === null, 'false positive on a clean object');
}
