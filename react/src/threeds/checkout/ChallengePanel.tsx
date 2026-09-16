/**
 * Where the challenge iframe is mounted. The slot stays in the DOM at all times:
 * threeDSChallenge() looks it up by id the moment it is called.
 */
export const CHALLENGE_SLOT = 'threeds-challenge';

/**
 * The challenge, laid over the card form so the timeline stays visible. The ACS
 * frame keeps the size the AReq announced, so the panel scrolls rather than
 * resizing it.
 */
export function ChallengePanel({
  open,
  running,
  status,
  onClose,
}: {
  open: boolean;
  running: boolean;
  status?: string;
  onClose: () => void;
}) {
  return (
    <div
      className={`absolute -inset-x-2 top-0 z-40 rounded-xl border border-border bg-surface p-4 shadow-2xl ${
        open ? '' : 'hidden'
      }`}
    >
      <div className="flex items-center gap-3">
        <h3 className="m-0 text-sm font-bold">3DS challenge</h3>
        <button
          onClick={onClose}
          disabled={running}
          className="ml-auto rounded-lg border border-border bg-white px-3 py-1.5 text-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 font-[inherit]"
        >
          Close
        </button>
      </div>
      <p className="m-0 mt-2 text-[12px] leading-relaxed text-muted">
        The fingerprint was not enough — the payment came back <code>IN_PROGRESS</code> with{' '}
        <code>authentication.challenge_data</code>. The cardholder authenticates below; the settled
        state arrives as <code>purse:3ds:challenge-completed</code>.
      </p>
      <div
        id={CHALLENGE_SLOT}
        className="mt-3 flex min-h-[400px] max-h-[60vh] items-start justify-center overflow-auto"
      />
      <p className="m-0 mt-2 font-mono text-[11px] text-muted">
        {running ? 'Waiting for the cardholder…' : (status ?? '')}
      </p>
    </div>
  );
}
