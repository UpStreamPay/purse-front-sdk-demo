import type { Step, StepState } from './steps';

const DOT: Record<StepState, { ring: string; fill: string; glyph: string }> = {
  pending:    { ring: 'border-xray-line',       fill: 'bg-transparent',  glyph: '' },
  active:     { ring: 'border-indigo-400',      fill: 'bg-indigo-500',   glyph: '' },
  done:       { ring: 'border-emerald-400',     fill: 'bg-emerald-500',  glyph: '✓' },
  error:      { ring: 'border-red-400',         fill: 'bg-red-500',      glyph: '!' },
  skipped:    { ring: 'border-xray-line',       fill: 'bg-xray-line',    glyph: '–' },
  unobserved: { ring: 'border-amber-400/70',    fill: 'bg-amber-500/30', glyph: '?' },
};

const LABEL: Partial<Record<StepState, { text: string; cls: string }>> = {
  skipped:    { text: 'skipped',        cls: 'text-xray-dim border-xray-line' },
  unobserved: { text: 'not observable', cls: 'text-amber-300 border-amber-400/40' },
  error:      { text: 'failed',         cls: 'text-red-300 border-red-400/40' },
};

function evidenceLine(step: Step): string | null {
  if (step.evidence.length === 0) return null;
  const parts = step.evidence.slice(0, 3).map(e => {
    switch (e.kind) {
      case 'http':     return `${e.method} ${e.host}${e.path.slice(0, 40)}${e.status ? ` → ${e.status}` : ''}`;
      case 'iframe':   return `iframe ${e.concealed ? '(hidden) ' : ''}${e.src.slice(0, 48)}`;
      case 'form':     return `form → ${e.inputs.join(', ').slice(0, 48)}`;
      case 'resource': return `${e.initiatorType} ${e.host} ${e.ms}ms`;
      default:         return e.kind;
    }
  });
  const more = step.evidence.length - parts.length;
  return parts.join(' · ') + (more > 0 ? ` · +${more} more` : '');
}

export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="list-none m-0 p-0">
      {steps.map((step, i) => {
        const dot = DOT[step.state];
        const label = step.state === 'skipped' && step.skipLabel
          ? { text: step.skipLabel, cls: 'text-xray-dim border-xray-line' }
          : LABEL[step.state];
        const last = i === steps.length - 1;
        const muted = step.state === 'pending' || step.state === 'skipped';

        return (
          <li key={step.id} className="relative pl-9 pb-5">
            {!last && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 bottom-0 w-px bg-xray-line"
              />
            )}
            <span
              className={`absolute left-0 top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full border-2 text-[11px] font-bold text-white transition-colors duration-300 ${dot.ring} ${dot.fill} ${
                step.state === 'active' ? 'step-active-dot' : ''
              }`}
            >
              {dot.glyph}
            </span>

            <div className="flex items-baseline gap-2 flex-wrap">
              <h3
                className={`m-0 text-[13.5px] font-semibold transition-colors duration-300 ${
                  muted ? 'text-xray-dim' : 'text-white'
                }`}
              >
                {step.title}
              </h3>
              {step.ms !== undefined && (
                <span className="xray-mono text-[11px] text-xray-dim font-mono">{step.ms} ms</span>
              )}
              {label && (
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-px rounded-full border ${label.cls}`}>
                  {label.text}
                </span>
              )}
            </div>

            <p className={`m-0 mt-1 text-[12px] leading-snug ${muted ? 'text-xray-dim/70' : 'text-xray-text/85'}`}>
              {step.blurb}
            </p>

            {step.detail && (
              <p className="xray-mono m-0 mt-1.5 font-mono text-[11.5px] text-emerald-300 break-all">
                {step.detail}
              </p>
            )}

            {step.state === 'unobserved' && step.unobservedNote && (
              <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-amber-200/80">
                {step.unobservedNote}
              </p>
            )}

            {evidenceLine(step) && (
              <p className="xray-mono m-0 mt-1.5 font-mono text-[10.5px] text-xray-dim break-all">
                ↳ {evidenceLine(step)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
