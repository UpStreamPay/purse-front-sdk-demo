import { useEffect, useRef, useState } from 'react';
import type { HeadlessCheckout, loadHeadlessCheckout } from '@purse-eu/web-sdk';
import { entityId, pollPayment, proxyBase } from '@shared/proxy';
import { getEnv } from '@shared/env';
import { Badge, Field } from '../ui/controls';
import { DebugPanel } from '../../shared/DebugPanel';
import { SHOWCASE_ENV_KEYS } from '../config';

/**
 * "One more thing": the same Netcetera 3DS, run by the widget in the session
 * flow (usp-widget#3395). The merchant creates a session and mounts Headless
 * Checkout: no create_payment, no challenge code. The widget reads
 * `three_ds_settings.vendor` off the session, arms Secure Fields' 3DS, runs the
 * challenge in its own dialog and sends the shopper to the session's
 * success/failure URL.
 *
 * It runs on its own page load (`?flow=session`): the advanced-flow checkout
 * above boots its own Secure Fields and the probe records every request, so
 * sharing a page with it would mix two SDK instances and two flows in one trace.
 */

// ponytail: no public CDN carries #3395 yet, override VITE_PURSE_HEADLESS_URL with a build that does.
const DEFAULT_HEADLESS_URL = 'https://cdn.purse-dev.com/headless-checkout/latest/purse.umd.js';
// The session id outlives the redirect, so the return leg can read the payment back.
const SESSION_KEY = 'purse_session_flow_id';

type HeadlessSDK = Awaited<ReturnType<typeof loadHeadlessCheckout>>;
type Checkout = Awaited<ReturnType<HeadlessSDK['createHeadlessCheckout']>>;

export const isSessionFlow = () => new URLSearchParams(location.search).get('flow') === 'session';

const returnUrl = () => new URL('?flow=session&back=1', location.href).href;
const entityQuery = () => (entityId() ? `?entity_id=${encodeURIComponent(entityId())}` : '');

/** The teaser at the bottom of the advanced-flow page. */
export function OneMoreThing() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-12">
      <div className="rounded-2xl border border-border bg-surface px-6 py-8 text-center">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">One more thing…</p>
        <h2 className="m-0 mt-2 text-[22px] font-bold">The same 3DS, with none of the code above</h2>
        <p className="mx-auto mt-2 mb-5 max-w-[620px] text-[13px] leading-relaxed text-muted">
          Create a session, mount Headless Checkout, call <code>submitPayment()</code>. The widget
          reads <code>three_ds_settings</code> off the session, runs versioning, fingerprint and the
          challenge itself, and brings the shopper back.
        </p>
        <a
          href="?flow=session"
          className="inline-block rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Try the session flow →
        </a>
      </div>
    </section>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

/** `widget.data` is base64 and may come unpadded. */
function decodeWidgetData(data: string): { three_ds_settings?: { vendor?: string } } {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

/** POST /orchestration_session with the proxy's default order, redirecting back here. */
async function createSession(): Promise<{ id: string; widgetData: string }> {
  const orderRes = await fetch(`${proxyBase()}/order/`);
  if (!orderRes.ok) {
    throw new Error(`Order failed: ${orderRes.status}`);
  }
  const { order } = await orderRes.json();
  // Orchestration sends the shopper to shopper_redirection_url once the session ends.
  const back = returnUrl();
  order.order = { ...order.order, redirection: back, success: back, failure: back };

  const res = await fetch(`${proxyBase()}/orchestration_session${entityQuery()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const data = await res.json();
  if (!res.ok || !data?.widget?.data) {
    throw new Error(`Session creation failed: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { id: data.id, widgetData: data.widget.data };
}

/** Back from the redirect: session → payment_id → the payment it settled as. */
async function readBack(sessionId: string) {
  const res = await fetch(`${proxyBase()}/orchestration_session/${encodeURIComponent(sessionId)}${entityQuery()}`);
  const session = await res.json();
  if (!session?.payment_id) {
    return { session, payment: null };
  }
  const { payment } = await pollPayment(session.payment_id);
  return { session, payment };
}

type Payment = {
  authentication?: { status?: string; flow?: string; eci?: string };
  authorization?: { status?: string };
};

export function SessionFlowDemo() {
  const back = new URLSearchParams(location.search).has('back');
  const [vendor, setVendor] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [fulfilled, setFulfilled] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ session: unknown; payment: Payment | null } | null>(null);
  const checkout = useRef<Checkout | null>(null);
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!proxyBase()) {
      setError('No proxy URL. Set VITE_PURSE_PROXY_URL in .env.local, or type one into ⚙ Config.');
      return;
    }
    if (back) {
      let id: string | null = null;
      try {
        id = sessionStorage.getItem(SESSION_KEY);
      } catch {
        // Storage blocked: nothing to read back.
      }
      if (!id) {
        setError('Back from the redirect, but the session id is gone — start again.');
        return;
      }
      readBack(id).then(r => setResult(r as typeof result), e => setError(String(e)));
      return;
    }

    (async () => {
      const session = await createSession();
      sessionId.current = session.id;
      setVendor(decodeWidgetData(session.widgetData).three_ds_settings?.vendor);

      await loadScript(getEnv('VITE_PURSE_HEADLESS_URL') || DEFAULT_HEADLESS_URL);
      const sdk = (window as unknown as { Purse?: HeadlessSDK }).Purse;
      if (!sdk) {
        throw new Error('Headless Checkout loaded, but window.Purse is missing');
      }
      const instance = await sdk.createHeadlessCheckout(session.widgetData);
      checkout.current = instance;

      let mounted = false;
      instance.paymentMethods.subscribe(methods => {
        const card = (methods as HeadlessCheckout.PurseHeadlessCheckoutPaymentMethod[]).find(
          (m): m is HeadlessCheckout.PurseHeadlessCheckoutPrimaryMethod =>
            m.method === 'creditcard' && !m.isSecondary,
        );
        if (!card || mounted) {
          return;
        }
        mounted = true;
        const hf = card.getHostedFields({
          fields: {
            cardNumber: { target: 'hc-pan', placeholder: '1234 5678 9012 3456' },
            holderName: { target: 'hc-name', placeholder: 'Card Holder Name' },
            expDate: { target: 'hc-exp', placeholder: 'MM/YY' },
            cvv: { target: 'hc-cvv', placeholder: '123' },
          },
          theme: {
            global: {},
            input: { fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#1a1d2e' },
          },
        });
        hf.on('ready', () => setReady(true));
        hf.render();
      });
      instance.isPaymentFulfilled.subscribe(setFulfilled);
    })().catch(e => setError((e as Error).message));
  }, [back]);

  const pay = async () => {
    if (!checkout.current || !sessionId.current) {
      return;
    }
    setPaying(true);
    try {
      sessionStorage.setItem(SESSION_KEY, sessionId.current);
    } catch {
      // Storage blocked: the payment still runs, the return leg just cannot read it back.
    }
    try {
      // On a Purse 3DS session this is the whole integration: the widget runs the
      // challenge in its own dialog, then redirects to session.success / failure.
      await checkout.current.submitPayment();
    } catch (e) {
      setError(String(e));
      setPaying(false);
    }
  };

  const authorization = result?.payment?.authorization?.status;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Purse · Session flow
            </p>
            <h1 className="m-0 mt-0.5 text-[22px] font-bold leading-tight">3DS, handled by the widget</h1>
          </div>
          {vendor !== undefined && <Badge label="three_ds_settings.vendor" value={vendor ?? '—'} />}
          <a href={location.pathname} className="text-xs text-muted hover:text-accent">
            ← Advanced flow
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-6 py-6 flex flex-col gap-4">
        {error && (
          <p className="m-0 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
            {error}
          </p>
        )}
        {vendor && vendor !== 'NETCETERA' && (
          <p className="m-0 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
            This entity's sessions are not on Purse 3DS (<code>vendor: {vendor}</code>) — the widget
            falls back to the partner's own 3DS.
          </p>
        )}

        {back ? (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="m-0 mb-3 text-sm font-bold">Back from the widget</h2>
            {!result && !error && <p className="m-0 text-[12.5px] text-muted">Reading the payment back…</p>}
            {result && (
              <>
                <p className={`m-0 text-base font-bold ${authorization === 'AUTHORIZED' ? 'text-emerald-600' : 'text-amber-700'}`}>
                  {authorization ?? 'No payment on this session'}
                </p>
                <p className="m-0 mt-1 font-mono text-[12px] text-muted">
                  {[
                    result.payment?.authentication?.status && `authentication ${result.payment.authentication.status}`,
                    result.payment?.authentication?.flow && `flow ${result.payment.authentication.flow}`,
                    result.payment?.authentication?.eci && `ECI ${result.payment.authentication.eci}`,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted">Payloads</summary>
                  <pre className="text-[11px] overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                </details>
              </>
            )}
            <a href="?flow=session" className="mt-4 inline-block text-xs text-accent">
              ↻ Another session
            </a>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="m-0 mb-3 text-sm font-bold">Checkout</h2>
            <div className="flex flex-col gap-2.5">
              <Field label="Card number" id="hc-pan" />
              <Field label="Cardholder" id="hc-name" />
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Expiry" id="hc-exp" />
                <Field label="CVV" id="hc-cvv" />
              </div>
            </div>
            <button
              onClick={pay}
              disabled={!ready || !fulfilled || paying}
              className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer border-0 font-[inherit]"
            >
              {paying ? 'The widget has it…' : ready ? 'Pay' : 'Loading Headless Checkout…'}
            </button>
            <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-muted">
              Challenge card <code>4916 9940 6425 2017</code>, OTP <code>1234</code>. No <code>create_payment</code>, no
              challenge handler: the widget opens the ACS dialog and redirects back here.
            </p>
          </section>
        )}
      </main>

      <DebugPanel keys={SHOWCASE_ENV_KEYS} />
    </div>
  );
}
