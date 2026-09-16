import type { Derived } from '../steps';
import { Json } from './Json';

/**
 * What each browser field is for. These are the JS-reachable members of the
 * 3DS AReq browser node — see browserData() in vanilla/src/shared/proxy.ts.
 */
const BROWSER_FIELD_NOTES: Record<string, string> = {
  user_agent: 'Identifies the browser build to the ACS risk engine.',
  color_depth: 'Screen colour depth in bits. One of the oldest fingerprinting signals there is.',
  java_enabled: 'Legacy AReq field. Almost always false; still mandatory.',
  javascript_enabled: 'Always true here — a page that can ask has JS.',
  screen_height: 'Viewport dimensions, part of the device profile.',
  screen_width: 'Viewport dimensions, part of the device profile.',
  locale: 'navigator.language — compared against the billing country.',
  utc_time_zone: 'Offset in minutes; a mismatch with the IP geolocation is a risk signal.',
};

const SERVER_SIDE_NOTES: Array<[string, string]> = [
  ['accept_header', 'Unreadable from JavaScript. The merchant backend captures it from the cardholder’s own request.'],
  ['accept_language', 'Same — the browser never exposes its own Accept-Language to script.'],
  ['ip_address', 'A page cannot read its own address. Read back from the proxy’s GET /env, which is the hop that sees it.'],
];

/** base64url JSON, as `challenge_data` and its `creq` arrive. Undecodable → shown raw. */
function decodeBlob(blob: string | undefined): unknown {
  if (!blob) return undefined;
  try {
    const padded = blob.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
  } catch {
    return blob;
  }
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h3 className="m-0 mb-1 font-mono text-[12px] font-bold tracking-[0.02em] text-xray-dim">
        {title}
      </h3>
      {hint && <p className="m-0 mb-2 text-[11.5px] leading-snug text-xray-text/70">{hint}</p>}
      {children}
    </section>
  );
}

/** Each field of the 3DS outcome, and why it matters. */
const OUTCOME_FIELDS: Array<[keyof NonNullable<Derived['outcome']>, string]> = [
  ['flow', 'FRICTIONLESS: the fingerprint satisfied the issuer. CHALLENGE: it asked for the cardholder.'],
  ['eci', 'E-commerce indicator. 05 on Visa, 02 on Mastercard: authenticated, liability sits with the issuer.'],
  ['version', '3DS protocol version the card range negotiated during versioning.'],
  ['directory_response', 'The Directory Server’s verdict. Y means authenticated.'],
  ['cavv', 'The cryptogram proving the authentication happened, passed on to the acquirer. Single-use; truncated here.'],
  ['ds_transaction_id', 'Directory Server’s id for this authentication.'],
  ['acs_transaction_id', 'The issuer ACS’s own id for it.'],
  ['partner_status', 'What the acquirer made of it.'],
];

export function PayloadInspector({
  derived,
  browserNode,
}: {
  derived: Derived;
  browserNode?: Record<string, unknown>;
}) {
  const {
    methodData,
    threeDSServerTransID,
    paymentRequest,
    paymentResponse,
    outcome,
    challengeBlob,
    challengeFrame,
    completion,
    confirmedPayment,
  } = derived;

  const challengePayload = decodeBlob(challengeBlob) as { creq?: string } | undefined;
  const creq = decodeBlob(challengePayload?.creq);

  return (
    <div>
      <Section
        title="threeDSMethodData"
        hint="The one base64url field POSTed to the ACS in the hidden iframe. Decoded below."
      >
        {methodData ? (
          <div className="rounded-lg bg-black/30 border border-xray-line p-2.5 pop-in">
            <Json value={methodData} />
          </div>
        ) : (
          <p className="m-0 text-[11.5px] leading-snug text-amber-200/80">
            Not captured yet. The SDK builds the form in this document, so it shows up here once a
            fingerprint actually runs — which needs a card range that advertises a Method URL.
          </p>
        )}
      </Section>

      <Section title="three_ds_server_trans_id">
        {threeDSServerTransID ? (
          <p className="xray-mono m-0 font-mono text-[13px] text-emerald-300 break-all pop-in">
            {threeDSServerTransID}
          </p>
        ) : (
          <p className="m-0 text-[11.5px] text-xray-dim italic">
            Minted by 3DS versioning — appears once submit() resolves.
          </p>
        )}
      </Section>

      {outcome && (
        <Section
          title="Authentication result"
          hint="What the ACS decided — read off the payment fetched back after the challenge when there was one, off create_payment otherwise."
        >
          <div className="pop-in rounded-lg border border-emerald-400/30 bg-emerald-500/[0.07] p-3">
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {OUTCOME_FIELDS.map(([key, note]) => {
                const value = outcome[key];
                if (!value) return null;
                const shown = key === 'cavv' ? `${String(value).slice(0, 12)}…` : String(value);
                return (
                  <li key={key} className="border-l-2 border-emerald-400/40 pl-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="xray-mono font-mono text-[11.5px] text-indigo-300">{key}</span>
                      <span className="xray-mono font-mono text-[12.5px] font-semibold text-emerald-300 break-all">
                        {shown}
                      </span>
                    </div>
                    <p className="m-0 text-[11px] leading-snug text-xray-text/65">{note}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      )}

      <Section
        title="Browser node (AReq)"
        hint="Collected in the page and sent on create_payment. This is the data the ACS scores when it decides frictionless or challenge."
      >
        {browserNode ? (
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {Object.entries(browserNode).map(([k, v]) => (
              <li key={k} className="border-l-2 border-xray-line pl-2.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="xray-mono font-mono text-[11.5px] text-indigo-300">{k}</span>
                  <span className="xray-mono font-mono text-[11.5px] text-emerald-300 break-all">
                    {String(v)}
                  </span>
                </div>
                {BROWSER_FIELD_NOTES[k] && (
                  <p className="m-0 text-[11px] leading-snug text-xray-text/60">
                    {BROWSER_FIELD_NOTES[k]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[11.5px] text-xray-dim italic">Collected when you pay.</p>
        )}

        <p className="m-0 mt-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-xray-dim">
          Filled in server-side
        </p>
        <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
          {SERVER_SIDE_NOTES.map(([k, note]) => (
            <li key={k} className="border-l-2 border-dashed border-xray-line pl-2.5">
              <span className="xray-mono font-mono text-[11.5px] text-xray-dim">{k}</span>
              <p className="m-0 text-[11px] leading-snug text-xray-text/60">{note}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="create_payment request"
        hint="three_ds_server_trans_id on the split is what switches the payment into the Purse 3DS advanced flow."
      >
        <div className="rounded-lg bg-black/30 border border-xray-line p-2.5">
          <Json value={paymentRequest} />
        </div>
      </Section>

      <Section
        title="create_payment response"
        hint="Written before the cardholder authenticates: a challenged payment reads authentication.status IN_PROGRESS and authorization.status PENDING here, whatever it settles as."
      >
        <div className="rounded-lg bg-black/30 border border-xray-line p-2.5">
          <Json value={paymentResponse} />
        </div>
      </Section>

      {challengeBlob && (
        <Section
          title="authentication.challenge_data"
          hint="Forwarded verbatim to threeDSChallenge(). base64url JSON: where to post (acsURL), what to post (creq) and the window size the AReq announced — EMVCo requires the rendered frame to match it."
        >
          <div className="rounded-lg bg-black/30 border border-xray-line p-2.5 pop-in">
            <Json value={challengePayload} />
          </div>
          {creq !== undefined && (
            <>
              <p className="m-0 mt-2 mb-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-xray-dim">
                creq, decoded
              </p>
              <div className="rounded-lg bg-black/30 border border-xray-line p-2.5">
                <Json value={creq} />
              </div>
            </>
          )}
        </Section>
      )}

      {challengeFrame !== undefined && (
        <Section
          title="purse:3ds:challenge-completed"
          hint="Posted into the challenge iframe by the page answering POST /v2/3ds/challenge-notification. The SDK wraps it: status/reason/durationMs are the frame’s own, data is the message."
        >
          <div className="rounded-lg bg-black/30 border border-xray-line p-2.5 pop-in">
            <Json value={challengeFrame} />
          </div>
          {completion?.result && (
            <p className="xray-mono m-0 mt-2 font-mono text-[11.5px] text-emerald-300">
              {[
                completion.result,
                completion.authentication?.status && `authentication ${completion.authentication.status}`,
                completion.authorization?.status && `authorization ${completion.authorization.status}`,
                completion.reason,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
          )}
        </Section>
      )}

      {confirmedPayment !== undefined && (
        <Section
          title="GET /payment/{id}"
          hint="The payment read back once the challenge reported in — the only state here that was written after the authentication. A real integration still treats the payment.updated webhook as the authority."
        >
          <div className="rounded-lg bg-black/30 border border-xray-line p-2.5 pop-in">
            <Json value={confirmedPayment} />
          </div>
        </Section>
      )}
    </div>
  );
}
