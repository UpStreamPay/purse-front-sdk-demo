/** Presentational bits shared by the showcase panels. */

/** A Secure Fields mount point — the SDK renders its iframe into `id`. */
export function Field({ label, id }: { label: string; id: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="sf-field" id={id} />
    </label>
  );
}

export function Badge({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      {note && (
        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
          {note}
        </span>
      )}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 cursor-pointer transition-colors ${
          checked ? 'bg-accent' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
      <span>
        <span className="block text-[12.5px] font-medium leading-tight">{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Pill row used for eligible solutions and co-branded networks. */
export function Pills<T>({
  items,
  keyOf,
  labelOf,
  selected,
  disabled,
  onSelect,
}: {
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  selected: (item: T) => boolean;
  disabled?: (item: T) => boolean;
  onSelect: (item: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const off = disabled?.(item) ?? false;
        return (
          <button
            key={keyOf(item)}
            disabled={off}
            onClick={() => onSelect(item)}
            className={`text-[11.5px] px-2.5 py-1 rounded-full border font-[inherit] transition-colors ${
              selected(item)
                ? 'bg-accent text-white border-accent cursor-pointer'
                : off
                  ? 'bg-bg text-muted/60 border-border cursor-not-allowed'
                  : 'bg-white text-text border-border hover:border-accent cursor-pointer'
            }`}
          >
            {labelOf(item)}
          </button>
        );
      })}
    </div>
  );
}
