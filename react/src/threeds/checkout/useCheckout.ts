import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { Securefields } from '@purse-eu/web-sdk';
import {
  browserData,
  createPayment,
  fetchEligibleSolutions,
  fetchOrder,
  pollPayment,
  proxyBase,
  type CardSolution,
  type OrderInfo,
} from '@shared/proxy';
import { getEnv } from '@shared/env';
import { challengeData, runChallenge } from '@shared/three-ds';
import { secureFieldsEnvironment } from '../config';
import * as probe from '../probe';
import { derive } from '../steps';
import { bootSecureFields, type Handle } from './secureFields';
import { CHALLENGE_SLOT } from './ChallengePanel';

export const solutionId = ({ partner, method }: CardSolution) => `${partner}:${method}`;

export type Checkout = ReturnType<typeof useCheckout>;

/**
 * The whole flow of the showcase: order → eligible solutions → Secure Fields →
 * submit → create_payment → challenge → confirm. Every step drops a probe mark;
 * the timeline is derived from those plus the traffic the probe observed.
 */
export function useCheckout() {
  const events = useSyncExternalStore(probe.subscribe, probe.getSnapshot);

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [cards, setCards] = useState<CardSolution[]>([]);
  const [solutions, setSolutions] = useState<CardSolution[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [threeDS, setThreeDS] = useState(true);
  const [brands, setBrands] = useState<Securefields.Brand[]>([]);
  const [brand, setBrand] = useState<Securefields.Brand | null>(null);
  const [formReady, setFormReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [challenging, setChallenging] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [browserNode, setBrowserNode] = useState<Record<string, unknown> | undefined>();

  const handle = useRef<Handle | null>(null);
  const derived = derive(events, threeDS);

  // ── Steps 1 & 2: order + eligible solutions ───────────────────────────────
  useEffect(() => {
    if (!proxyBase()) {
      setNotice('No proxy URL. Set VITE_PURSE_PROXY_URL in .env.local, or type one into ⚙ Config.');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        probe.mark('flow:start', { environment: secureFieldsEnvironment(), proxy: proxyBase() });
        const info = await fetchOrder();
        if (cancelled) return;
        probe.mark('order:done', { amount: info.amount, currency: info.currency });
        setOrder(info);

        const { solutions: all, cards: cardSolutions } = await fetchEligibleSolutions(info.eligibleBody);
        if (cancelled) return;
        probe.mark('eligible:done', { count: all.length, cards: cardSolutions.length });
        setSolutions(all);
        setCards(cardSolutions);
        if (cardSolutions.length === 0) {
          setNotice('No credit-card solution is eligible for this order — nothing to run 3DS against.');
          return;
        }
        // Prefer a real acquirer over uspmock: the mock always comes back
        // PENDING with a redirect, so the demo would never reach AUTHORIZED.
        const preferred = cardSolutions.find(c => c.partner !== 'uspmock') ?? cardSolutions[0];
        setPicked(solutionId(preferred));
      } catch (e) {
        if (cancelled) return;
        const message = (e as Error).message;
        probe.mark('flow:error', { error: message });
        // A failed cross-origin fetch says only "Failed to fetch" — name the host.
        setNotice(
          /failed to fetch|networkerror|load failed/i.test(message)
            ? `Cannot reach the merchant backend at ${proxyBase()}. Is it running?`
            : message,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 3: mount Secure Fields. `threeDS` is an init option, so flipping it
  // tears the instance down and mounts a fresh one. ──────────────────────────
  useEffect(() => {
    if (cards.length === 0) return;
    const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
    const apiKey = getEnv('VITE_PURSE_API_KEY');
    if (!tenantId || !apiKey) {
      setNotice('Set the Tenant ID and API Key in .env.local, or in ⚙ Config.');
      return;
    }

    let cancelled = false;
    setFormReady(false);
    handle.current?.sf.destroy();
    handle.current = null;

    // `ready` can fire before the boot promise resolves, so enabling Pay on it
    // alone races: the click would land while the instance is still null.
    let ready = false;
    const enableIfReady = () => {
      if (!cancelled && ready && handle.current) setFormReady(true);
    };

    bootSecureFields({
      tenantId,
      apiKey,
      threeDS,
      onReady: () => {
        if (cancelled) return;
        probe.mark('form:ready');
        probe.mark(threeDS ? '3ds:armed' : '3ds:off');
        ready = true;
        enableIfReady();
      },
      onBrands: detected => {
        if (cancelled) return;
        setBrands(detected);
        setBrand(prev => (detected.includes(prev as Securefields.Brand) ? prev : null));
      },
    })
      .then(h => {
        if (cancelled) {
          h.sf.destroy();
          return;
        }
        handle.current = h;
        enableIfReady();
      })
      .catch(e => {
        if (cancelled) return;
        probe.mark('flow:error', { error: (e as Error).message });
        setNotice(`Secure Fields failed to load: ${(e as Error).message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [cards.length, threeDS]);

  // ── Step 6: the challenge, when the fingerprint was not enough ────────────
  const challenge = useCallback(async (blob: string) => {
    // Committed synchronously, so the panel is on screen before the SDK mounts
    // the iframe into it.
    flushSync(() => {
      setChallengeOpen(true);
      setChallenging(true);
    });
    probe.mark('challenge:start');
    try {
      const outcome = await runChallenge({ challengeData: blob, container: CHALLENGE_SLOT });
      probe.mark('challenge:done', outcome);
      // Settled by the notification message: take the panel away. A timeout or an
      // abort keeps it up, with the reason on it.
      if (outcome.reason === 'message') setChallengeOpen(false);
    } catch (e) {
      // An unusable blob throws. Mark it, or the timeline challenges forever.
      probe.mark('challenge:done', { status: 'error', reason: (e as Error).message });
      setNotice(`3DS challenge failed: ${(e as Error).message}`);
    }
    setChallenging(false);
  }, []);

  // ── Step 7: only the API is authoritative, and it settles a beat late ─────
  const confirm = useCallback(async (paymentId?: string) => {
    if (!paymentId) return;
    probe.mark('confirm:start', { payment_id: paymentId });
    probe.mark('confirm:done', await pollPayment(paymentId));
  }, []);

  // ── Steps 4 & 5: tokenise (3DS runs inside), then create the payment ──────
  const pay = useCallback(async () => {
    const h = handle.current;
    const solution = cards.find(c => solutionId(c) === picked);
    if (!h || !order || !solution) return;

    setPaying(true);
    setNotice(null);

    try {
      probe.mark('tokenize:start', { threeDS, brand });
      const result = await h.submit(brand);

      if ('error' in result) {
        probe.mark('tokenize:error', { error: result.error });
        setNotice(`Tokenisation failed: ${result.error}`);
        setPaying(false);
        return;
      }

      probe.mark('tokenize:done', {
        three_ds_server_trans_id: result.three_ds_server_trans_id,
        hasToken: !!result.vault_form_token,
      });

      const browser = browserData();
      setBrowserNode({ ...browser, ip_address: order.customer.ip_address });

      const body = {
        amount: order.amount,
        currency: order.currency,
        order: order.v2Order,
        customer: order.customer,
        split: [
          {
            amount: order.amount,
            partner: solution.partner,
            method: solution.method,
            vault_form_token: result.vault_form_token,
            ...(result.three_ds_server_trans_id
              ? { three_ds_server_trans_id: result.three_ds_server_trans_id }
              : {}),
            // What the merchant asks for — the issuer decides anyway.
            three_ds_authentication_options: { challenge_indicator: 'NO_CHALLENGE_REQUESTED' },
          },
        ],
        browser,
      };

      probe.mark('payment:start', body);
      const { ok, data } = await createPayment(body);
      if (!ok) {
        probe.mark('payment:error', data);
        setNotice('create_payment was rejected — see the response in Payloads.');
        setPaying(false);
        return;
      }
      probe.mark('payment:done', data);

      const blob = challengeData(data);
      if (blob) await challenge(blob);
      // A payment waiting on a partner redirect will not settle by itself.
      const payment = data as { id?: string; redirection?: { href?: string } };
      if (blob || !payment?.redirection?.href) await confirm(payment?.id);
    } catch (e) {
      probe.mark('flow:error', { error: (e as Error).message });
      setNotice((e as Error).message);
    } finally {
      setPaying(false);
      setChallenging(false);
    }
  }, [brand, cards, challenge, confirm, order, picked, threeDS]);

  // Arm it *before* paying: the SDK tears the 3DS Method frame down seconds
  // after the fingerprint, so there is nothing left to reveal afterwards.
  const toggleReveal = useCallback((on: boolean) => {
    probe.setReveal(on);
    setRevealed(on);
  }, []);

  const restart = useCallback(() => {
    probe.reset();
    probe.setReveal(false);
    location.reload();
  }, []);

  return {
    events,
    derived,
    order,
    solutions,
    cards,
    picked,
    setPicked,
    brands,
    brand,
    setBrand,
    threeDS,
    setThreeDS,
    revealed,
    toggleReveal,
    formReady,
    paying,
    challenging,
    challengeOpen,
    closeChallenge: () => setChallengeOpen(false),
    notice,
    browserNode,
    pay,
    restart,
  };
}
