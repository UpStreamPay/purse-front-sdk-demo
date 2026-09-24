import { useEffect, useRef, useState } from 'react';
import type { loadDropInCheckout } from '@purse-eu/web-sdk';
import { entityId, pollPayment, proxyBase } from '@shared/proxy';
import { getEnv } from '@shared/env';
import { Badge } from '../ui/controls';
import { DebugPanel } from '../../shared/DebugPanel';
import { Fireworks } from '../ui/Fireworks';
import { SHOWCASE_ENV_KEYS } from '../config';
import oneMoreThing from './one-more-thing.gif';

/**
 * "One more thing": the same Netcetera 3DS, run by the widget in the session
 * flow (usp-widget#3395). The merchant creates a session and mounts the Drop-in:
 * no create_payment, no challenge code, not even a Pay button. The widget reads
 * `three_ds_settings.vendor` off the session, arms Secure Fields' 3DS, runs the
 * challenge in its own dialog and sends the shopper to the session's
 * success/failure URL.
 *
 * It runs on its own page load (`?flow=session`): the advanced-flow checkout
 * above boots its own Secure Fields and the probe records every request, so
 * sharing a page with it would mix two SDK instances and two flows in one trace.
 */

// ponytail: no public CDN carries #3395 yet, override VITE_PURSE_DROPIN_URL with a build that does.
const DEFAULT_DROPIN_URL = 'https://cdn.purse-dev.com/dropin-checkout/latest/purse.js';
// The session id outlives the redirect, so the return leg can read the payment back.
const SESSION_KEY = 'purse_session_flow_id';

type DropinSDK = Awaited<ReturnType<typeof loadDropInCheckout>>;

export const isSessionFlow = () => new URLSearchParams(location.search).get('flow') === 'session';

const returnUrl = () => new URL('?flow=session&back=1', location.href).href;
const entityQuery = () => (entityId() ? `?entity_id=${encodeURIComponent(entityId())}` : '');

/** The teaser at the bottom of the advanced-flow page. Says nothing on purpose: the page it opens does the talking. */
export function OneMoreThing() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-12">
      <div className="rounded-2xl border border-border bg-surface px-6 py-8 text-center">
        <p className="m-0 mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">One more thing…</p>
        <a
          href="?flow=session"
          className="inline-block rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Show me →
        </a>
      </div>
    </section>
  );
}

// Auto-advance once the clip has played through (~4.1s).
const REVEAL_MS = 4500;
const REVEAL_FADE_MS = 700;

/**
 * The dark "one more thing" curtain over the checkout. Same document, not its own
 * page: a reload would flash the light background between the two, and the session
 * and the Drop-in load behind the curtain while the clip plays.
 */
function Reveal() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (leaving) {
      const t = setTimeout(() => setGone(true), REVEAL_FADE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLeaving(true), REVEAL_MS);
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'ArrowRight', 'Escape'].includes(e.key)) {
        setLeaving(true);
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      removeEventListener('keydown', onKey);
    };
  }, [leaving]);

  if (gone) {
    return null;
  }
  return (
    <div
      onClick={() => setLeaving(true)}
      style={{ transitionDuration: `${REVEAL_FADE_MS}ms` }}
      className={`fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black transition-opacity ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Scaled up inside a clipping box to crop the watermark in the corner. */}
      <div className="reveal-in w-[min(90vw,720px)] overflow-hidden">
        <img src={oneMoreThing} alt="Steve Jobs on stage: “One more thing…”" className="block w-full scale-[1.12]" />
      </div>
    </div>
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
async function createSession(): Promise<{ id: string; widgetData: string; order: Order }> {
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
  // The page renders this same order, so what the shopper sees is what the session charges.
  return { id: data.id, widgetData: data.widget.data, order: order.order };
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

type Address = { first_name?: string; last_name?: string; address_lines?: string[]; postal_code?: string; city?: string; country_code?: string; email?: string };
type Order = {
  reference: string;
  amount: number;
  net_amount: number;
  tax_amount: number;
  currency_code: string;
  tax_lines?: { rate: number }[];
  customer?: { first_name?: string; last_name?: string; locale_code?: string; billing_address?: Address };
  shipments?: {
    seller_name?: string;
    delivery_type_code?: string;
    shipping_address?: Address;
    item_lines?: { sku_reference: string; name: string; brand?: string; price: number; quantity: number; amount: number }[];
  }[];
};

type Payment = {
  authentication?: { status?: string; flow?: string; eci?: string };
  authorization?: { status?: string };
};

export function SessionFlowDemo() {
  const back = new URLSearchParams(location.search).has('back');
  const [vendor, setVendor] = useState<string | undefined>();
  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ session: unknown; payment: Payment | null } | null>(null);
  const dropinTarget = useRef<HTMLDivElement>(null);

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
      try {
        // The Drop-in's own Pay button redirects away: keep the id for the return leg.
        sessionStorage.setItem(SESSION_KEY, session.id);
      } catch {
        // Storage blocked: the payment still runs, the return leg just cannot read it back.
      }
      setOrder(session.order);
      setVendor(decodeWidgetData(session.widgetData).three_ds_settings?.vendor);

      await loadScript(getEnv('VITE_PURSE_DROPIN_URL') || DEFAULT_DROPIN_URL);
      const sdk = (window as unknown as { Purse?: DropinSDK }).Purse;
      if (!sdk) {
        throw new Error('Drop-in loaded, but window.Purse is missing');
      }
      // On a Purse 3DS session this is the whole integration: the widget lists the
      // session's methods, runs the challenge in its own dialog, then redirects to
      // session.success / failure.
      const dropin = await sdk.createDropinCheckout({ session: session.widgetData });
      await dropin.mount(dropinTarget.current!);
      setReady(true);
    })().catch(e => setError((e as Error).message));
  }, [back]);

  const authorization = result?.payment?.authorization?.status;
  const shipment = order?.shipments?.[0];
  const money = (minor: number) =>
    order
      ? new Intl.NumberFormat(order.customer?.locale_code ?? 'fr', { style: 'currency', currency: order.currency_code }).format(minor / 100)
      : '';

  return (
    <div className="min-h-screen">
      {!back && <Reveal />}
      <Fireworks go={authorization === 'AUTHORIZED'} />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1080px] px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <p className="m-0 text-[22px] font-extrabold tracking-tight leading-tight">{shipment?.seller_name ?? 'Checkout'}</p>
            <p className="m-0 mt-0.5 text-xs text-muted">🔒 Secure checkout{order && ` · Order #${order.reference}`}</p>
          </div>
          {vendor !== undefined && <Badge label="three_ds_settings.vendor" value={vendor ?? '—'} />}
          <a href={location.pathname} className="text-xs text-muted hover:text-accent">
            ← Advanced flow
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-6 py-6 flex flex-col gap-4">
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
          <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-border bg-surface p-5">
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
          <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
            <div className="flex flex-col gap-4">
              {order && (
                <section className="rounded-2xl border border-border bg-surface p-5">
                  <h2 className="m-0 mb-3 text-sm font-bold">Delivery</h2>
                  <div className="grid gap-4 sm:grid-cols-2 text-[13px] leading-relaxed">
                    <AddressBlock title="Ship to" address={shipment?.shipping_address} />
                    <AddressBlock title="Bill to" address={order.customer?.billing_address} />
                  </div>
                  {shipment?.delivery_type_code && (
                    <p className="m-0 mt-3 rounded-lg bg-bg px-3 py-2 text-[12.5px] capitalize">
                      {shipment.delivery_type_code.replace(/_/g, ' ')} · free
                    </p>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-border bg-surface p-5">
                <h2 className="m-0 mb-3 text-sm font-bold">Payment</h2>
                {!ready && !error && <p className="m-0 text-[12.5px] text-muted">Loading payment methods…</p>}
                <div ref={dropinTarget} />
                <p className="m-0 mt-3 text-[11.5px] leading-relaxed text-muted">
                  Pick the CentralPay card · test card <code>4916 9940 6425 2017</code>, OTP <code>1234</code>.
                </p>
              </section>
            </div>

            <div className="flex flex-col gap-4">
              {order && (
                <section className="rounded-2xl border border-border bg-surface p-5">
                  <h2 className="m-0 mb-3 text-sm font-bold">Order summary</h2>
                  <ul className="m-0 p-0 list-none flex flex-col gap-3">
                    {shipment?.item_lines?.map(item => (
                      <li key={item.sku_reference} className="flex gap-3 text-[13px]">
                        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-bg text-lg font-bold text-muted">{item.name[0]}</span>
                        <span className="flex-1">
                          <span className="block font-semibold">{item.name}</span>
                          <span className="block text-xs text-muted">
                            {item.brand} · {item.quantity} × {money(item.price)}
                          </span>
                        </span>
                        <span className="font-mono">{money(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="m-0 mt-4 flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
                    <Row label="Subtotal (excl. VAT)" value={money(order.net_amount)} />
                    <Row label={`VAT${order.tax_lines?.[0] ? ` ${order.tax_lines[0].rate}%` : ''}`} value={money(order.tax_amount)} />
                    <Row label="Shipping" value={money(0)} />
                    <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
                      <dt>Total</dt>
                      <dd className="m-0 font-mono">{money(order.amount)}</dd>
                    </div>
                  </dl>
                </section>
              )}

              <aside className="rounded-2xl border border-dashed border-border p-5 text-[12.5px] leading-relaxed text-muted">
                <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Behind this page</p>
                <p className="m-0">
                  The same 3DS as the advanced flow, with none of its code. The merchant created an orchestration
                  session and mounted the Drop-in on it. That's it: no <code>create_payment</code>, no challenge
                  handler, not even a Pay button — the methods and the button above are the widget's.
                </p>
                <p className="m-0 mt-2">
                  The widget reads <code>three_ds_settings</code> off the session, runs versioning, device fingerprint
                  and the challenge in its own dialog, then redirects the shopper back here.
                </p>
              </aside>
            </div>
          </div>
        )}
      </main>

      <DebugPanel keys={SHOWCASE_ENV_KEYS} />
    </div>
  );
}

function AddressBlock({ title, address }: { title: string; address?: Address }) {
  if (!address) {
    return null;
  }
  return (
    <div>
      <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <p className="m-0 font-semibold">
        {address.first_name} {address.last_name}
      </p>
      {address.address_lines?.map(line => (
        <p key={line} className="m-0">
          {line}
        </p>
      ))}
      <p className="m-0">
        {address.postal_code} {address.city}, {address.country_code}
      </p>
      {address.email && <p className="m-0 text-muted">{address.email}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 font-mono">{value}</dd>
    </div>
  );
}
