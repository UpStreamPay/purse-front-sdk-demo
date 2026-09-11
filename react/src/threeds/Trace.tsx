import { useState } from 'react';
import type { ProbeEvent } from './probe';
import { Json } from './Json';

const KIND_STYLE: Record<ProbeEvent['kind'], { tag: string; cls: string }> = {
  http:     { tag: 'HTTP',  cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/30' },
  message:  { tag: 'MSG',   cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30' },
  iframe:   { tag: 'FRAME', cls: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30' },
  form:     { tag: 'FORM',  cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
  resource: { tag: 'RES',   cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30' },
  mark:     { tag: 'MARK',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
};

function summary(e: ProbeEvent): string {
  switch (e.kind) {
    case 'http':     return `${e.method} ${e.host}${e.path}`;
    case 'message':  return `${e.origin} · {${e.keys.join(', ') || 'non-object'}}`;
    case 'iframe':   return `${e.concealed ? '(hidden) ' : ''}${e.name} ← ${e.src}`;
    case 'form':     return `→ ${e.action} [${e.inputs.join(', ')}]`;
    case 'resource': return `${e.initiatorType} ${e.host}`;
    case 'mark':     return e.label;
  }
}

function rightMeta(e: ProbeEvent): string {
  if (e.kind === 'http') return `${e.status ?? '…'}${e.ms !== undefined ? ` · ${e.ms}ms` : ''}`;
  if (e.kind === 'resource') return `${e.ms}ms`;
  if (e.kind === 'iframe') return `${e.width}×${e.height}`;
  return '';
}

function body(e: ProbeEvent): unknown {
  if (e.kind === 'http') {
    if (e.reqBody === undefined && e.resBody === undefined) return undefined;
    return { request: e.reqBody, response: e.resBody };
  }
  if (e.kind === 'message') return e.preview;
  if (e.kind === 'mark') return e.detail;
  return undefined;
}

export function Trace({ events, span }: { events: ProbeEvent[]; span: number }) {
  const [open, setOpen] = useState<number | null>(null);

  if (events.length === 0) {
    return (
      <p className="text-xray-dim text-xs italic m-0">
        Nothing yet. Everything the page does lands here as it happens.
      </p>
    );
  }

  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-px">
      {events.map(e => {
        const style = KIND_STYLE[e.kind];
        const expandable = body(e) !== undefined;
        const isOpen = open === e.id;
        const width = span > 0 ? Math.max(1, (e.at / span) * 100) : 0;

        return (
          <li key={e.id} className="row-in">
            <button
              disabled={!expandable}
              onClick={() => setOpen(isOpen ? null : e.id)}
              className={`w-full text-left bg-transparent border-0 p-0 font-[inherit] ${
                expandable ? 'cursor-pointer' : 'cursor-default'
              } group`}
            >
              <div className="flex items-center gap-2 px-2 py-[5px] rounded hover:bg-white/[0.04]">
                <span className="xray-mono font-mono text-[10.5px] text-xray-dim w-12 shrink-0 text-right tabular-nums">
                  {e.at}ms
                </span>
                <span
                  className={`text-[9.5px] font-bold tracking-wide px-1.5 py-px rounded border shrink-0 ${style.cls}`}
                >
                  {style.tag}
                </span>
                <span className="xray-mono font-mono text-[11.5px] text-xray-text truncate flex-1 min-w-0">
                  {summary(e)}
                </span>
                <span className="xray-mono font-mono text-[10.5px] text-xray-dim shrink-0 tabular-nums">
                  {rightMeta(e)}
                </span>
                <span className="text-[10px] text-xray-dim w-3 shrink-0">
                  {expandable ? (isOpen ? '▾' : '▸') : ''}
                </span>
              </div>
              {/* Where in the run this happened. */}
              <div className="h-px bg-xray-line/40 mx-2">
                <div className="h-px bg-indigo-400/50" style={{ width: `${width}%` }} />
              </div>
            </button>
            {isOpen && (
              <div className="mx-2 mb-2 mt-1 rounded-lg bg-black/30 border border-xray-line p-2.5">
                <Json value={body(e)} collapsedHeight={200} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
