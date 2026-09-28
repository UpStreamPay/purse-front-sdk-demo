import {getEnv} from './env';
import {proxyBase} from './proxy';

/**
 * The payment session the drop-in / headless demos boot with. A pasted
 * VITE_PURSE_SESSION_JSON wins; otherwise one is created through the merchant
 * backend (Alfred) — in production, this is your own backend call.
 */
export async function getSession(): Promise<string> {
    const raw = getEnv('VITE_PURSE_SESSION_JSON').trim();
    if (raw) {
        const s = raw.replace(/=+$/, '');
        return s + '='.repeat((4 - (s.length % 4)) % 4);
    }
    if (!proxyBase()) {
        throw new Error('No session — set VITE_PURSE_PROXY_URL or VITE_PURSE_SESSION_JSON in .env.local or the debug panel');
    }

    // GET /order returns the sample legacy order; /orchestration_session turns
    // it into a session. The shopper comes back to this page after a redirection.
    const orderRes = await fetch(`${proxyBase()}/order/`);
    if (!orderRes.ok) {
        throw new Error(`Order fetch failed: ${orderRes.status} ${orderRes.statusText}`);
    }
    const {order} = await orderRes.json();
    order.order.redirection = window.location.origin + window.location.pathname;

    const res = await fetch(`${proxyBase()}/orchestration_session/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(order),
    });
    if (!res.ok) {
        throw new Error(`Session creation failed: ${res.status} ${res.statusText}`);
    }
    const {widget} = await res.json();
    return widget.data;
}
