import type { Derived } from './steps';
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
  ['flow', 'FRICTIONLESS: the fingerprint satisfied the issuer, so no challenge was shown.'],
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
  const { methodData, threeDSServerTransID, paymentRequest, paymentResponse, outcome } = derived;

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

      <Section title="threeDSServerTransID">
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
          hint="What the ACS decided, straight off the create_payment response."
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
        hint="threeds_server_trans_id on the split is what switches the payment into the Purse 3DS advanced flow."
      >
        <div className="rounded-lg bg-black/30 border border-xray-line p-2.5">
          <Json value={paymentRequest} />
        </div>
      </Section>

      <Section title="create_payment response">
        <div className="rounded-lg bg-black/30 border border-xray-line p-2.5">
          <Json value={paymentResponse} />
        </div>
      </Section>
    </div>
  );
}
