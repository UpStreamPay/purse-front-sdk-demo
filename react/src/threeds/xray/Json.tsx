import { useState } from 'react';

/** Minimal syntax-highlighted JSON — a projector-legible <pre>, not a library. */
export function Json({ value, collapsedHeight = 220 }: { value: unknown; collapsedHeight?: number }) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (!text) return <p className="text-xray-dim text-xs italic">nothing captured</p>;

  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"([^"]+)":/g, '<span style="color:#8ab4ff">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#7ee787">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span style="color:#f0b354">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#ff9ec7">$1</span>')
    .replace(/‹redacted›/g, '<span style="color:#ff7b72;font-style:italic">‹redacted›</span>');

  return (
    <div className="relative">
      <pre
        className="xray-mono text-[11.5px] leading-[1.55] font-mono overflow-auto text-xray-text m-0"
        style={{ maxHeight: expanded ? 640 : collapsedHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {text.split('\n').length > 10 && (
        <button
          className="mt-1 text-[11px] text-xray-dim hover:text-xray-text bg-transparent border-0 cursor-pointer p-0 font-[inherit]"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      )}
    </div>
  );
}
