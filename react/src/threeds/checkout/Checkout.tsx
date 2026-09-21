import { ChallengePanel } from './ChallengePanel';
import { Field, Pills, Toggle } from '../ui/controls';
import { solutionId, type Checkout as CheckoutState } from './useCheckout';

/** The shopper's side: order, card form, the 3DS toggles and Pay. */
export function Checkout({ checkout }: { checkout: CheckoutState }) {
  const {
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
    closeChallenge,
    notice,
    derived,
    pay,
  } = checkout;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="m-0 mb-3 text-sm font-bold">Checkout</h2>

      {notice && (
        <p className="m-0 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          {notice}
        </p>
      )}

      {order && (
        <div className="mb-4 flex items-baseline justify-between rounded-lg bg-bg px-3 py-2">
          <span className="text-xs text-muted">Order total</span>
          <span className="font-mono text-base font-semibold">
            {(order.amount / 100).toFixed(2)} {order.currency}
          </span>
        </div>
      )}

      {solutions.length > 0 && (
        <div className="mb-4">
          <Label>Eligible solutions</Label>
          <Pills
            items={solutions}
            keyOf={solutionId}
            labelOf={s => `${s.method} · ${s.partner}`}
            selected={s => picked === solutionId(s)}
            // Only card solutions can be paid with this form.
            disabled={s => !cards.some(c => solutionId(c) === solutionId(s))}
            onSelect={s => setPicked(solutionId(s))}
          />
        </div>
      )}

      <div className="relative flex flex-col gap-2.5">
        <Field label="Card number" id="sf-pan" />
        <Field label="Cardholder" id="sf-name" />
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Expiry" id="sf-exp" />
          <Field label="CVV" id="sf-cvv" />
        </div>
        {paying && <div className="scanning absolute inset-0 overflow-hidden rounded-xl" />}

        <ChallengePanel
          open={challengeOpen}
          running={challenging}
          status={derived.steps.find(s => s.id === 'challenge')?.detail}
          onClose={closeChallenge}
        />
      </div>

      {brands.length > 1 && (
        <div className="mt-3">
          <Label>Co-branded — pick a network</Label>
          <Pills
            items={brands}
            keyOf={b => b}
            labelOf={b => b.replace(/_/g, ' ').toLowerCase()}
            selected={b => brand === b}
            onSelect={setBrand}
          />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
        <Toggle
          checked={threeDS}
          onChange={setThreeDS}
          label="Arm 3DS on submit"
          hint="threeDS: { enabled: true } — versioning + device fingerprint"
        />
        <Toggle
          checked={revealed}
          onChange={toggleReveal}
          label="Reveal the hidden frame"
          hint="Arm before paying — the 3DS Method frame is torn down seconds after"
        />
      </div>

      <button
        onClick={pay}
        disabled={!formReady || paying || !picked}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer border-0 font-[inherit]"
      >
        {paying ? 'Authenticating…' : formReady ? 'Pay' : 'Loading Secure Fields…'}
      </button>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}
