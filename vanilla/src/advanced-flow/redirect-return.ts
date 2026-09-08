import '../components';
import { showNotice, showResult } from '../shared/ui';
import { RETURN_MESSAGE, type RedirectionReturn } from '../shared/redirection';

/**
 * Advanced flow — redirection return page
 * https://docs.purse.tech/docs/references/glossary/redirection
 *
 * This is the page you configure as `shopper_redirection_url`. The partner (or
 * the Purse redirection API) sends the shopper here once the 3DS / redirect flow
 * is over, with a signed `purse-redirection-data` JWS query parameter:
 *
 *   { client_session_id, payment_id, authorization_status, client_session_status }
 *
 * Verify that JWS SERVER-SIDE against GET /payment/v2/signing-jwks — never trust
 * the query parameter as-is — and treat the final payment status as the one you
 * get from the `payment.updated` webhook.
 *
 * Two contexts:
 *   • top-level (full-page redirect) — render the confirmation page.
 *   • inside an iframe (embedded redirect) — the parent checkout has no way to
 *     know the flow ended (the frame was cross-origin the whole time), so this
 *     page posts a same-origin message back and lets the parent close it.
 */

const query = Object.fromEntries(new URLSearchParams(window.location.search));
const payload: RedirectionReturn = {
  redirectionData: query['purse-redirection-data'] ?? null,
  query,
};

const embedded = window.parent !== window;

if (embedded) {
  // Same-origin only: this page is served from the merchant domain, so the
  // parent can validate `event.origin` before trusting the message.
  window.parent.postMessage({ type: RETURN_MESSAGE, payload }, window.location.origin);
}

if (!payload.redirectionData) {
  showNotice('No purse-redirection-data parameter — open this page through an actual redirection.');
}

showResult(
  'success',
  payload,
  embedded ? 'Returned inside the iframe — parent notified' : 'Returned from the partner page',
);
