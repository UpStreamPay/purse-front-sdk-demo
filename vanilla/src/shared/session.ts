import {getEnv} from './env';
import {proxyBase} from './proxy';
import {t} from '../i18n';

/**
 * The payment session the Drop-in / Headless demos boot with. A pasted
 * VITE_PURSE_SESSION_JSON — an explicit debug-panel override — always wins;
 * otherwise one is created through the merchant backend (Alfred), the same
 * two calls the Sandpack demos use (see docs/post-payment-redirect.md):
 *   1. GET  /order/                 → { order: <legacy order> }
 *   2. POST /orchestration_session/ → client session; `widget.data` is the SDK input
 *
 * In production, this is your own backend call.
 */
export async function getSession(): Promise<string> {
    const raw = getEnv('VITE_PURSE_SESSION_JSON').trim();
    if (raw) {
        const s = raw.replace(/=+$/, '');
        return s + '='.repeat((4 - (s.length % 4)) % 4);
    }
    if (!proxyBase()) {
        throw new Error(t('notice.noSession'));
    }
    return fetchProxySession();
}

async function fetchProxySession(): Promise<string> {
    const base = proxyBase();
    const orderRes = await fetch(`${base}/order/`);
    if (!orderRes.ok) {
        throw new Error(t('notice.orderFailed', {url: `${base}/order/`, status: `${orderRes.status} ${orderRes.statusText}`}));
    }
    const {order} = await orderRes.json();
    // The shopper comes back to this page after a redirection (3DS, bank auth, …).
    order.order.redirection = window.location.origin + window.location.pathname;

    const sessionRes = await fetch(`${base}/orchestration_session/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(order),
    });
    if (!sessionRes.ok) {
        throw new Error(t('notice.sessionFailed', {url: `${base}/orchestration_session/`, status: `${sessionRes.status} ${sessionRes.statusText}`}));
    }
    const data = await sessionRes.json();
    if (typeof data?.widget?.data !== 'string') {
        throw new Error(t('notice.sessionMalformed'));
    }
    return data.widget.data;
}
