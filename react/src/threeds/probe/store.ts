import { redact } from './redact';
import type { ProbeEvent } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// The log
// ─────────────────────────────────────────────────────────────────────────────

let events: ProbeEvent[] = [];
let listeners: Array<() => void> = [];
let nextId = 0;
let origin = performance.now();

// Distributes over the union — a plain Omit<ProbeEvent, …> would collapse it to
// the shared keys and reject every variant's own fields.
type Draft<T> = T extends unknown ? Omit<T, 'id' | 'at'> & { at?: number } : never;

export function emit(event: Draft<ProbeEvent>): ProbeEvent {
  const full = {
    ...event,
    id: nextId++,
    at: event.at ?? Math.round(performance.now() - origin),
  } as ProbeEvent;
  // New array reference on every push: useSyncExternalStore compares by identity.
  events = [...events, full];
  for (const l of listeners) l();
  return full;
}

/** The clock every event is timed against. */
export const getOrigin = (): number => origin;

/** Restart that clock — the observers call it when they install. */
export function resetOrigin(): void {
  origin = performance.now();
}

/** Re-publish the current log: an async body landed on an event already in it. */
export function touch(): void {
  events = [...events];
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function getSnapshot(): ProbeEvent[] {
  return events;
}

/** A milestone from the demo's own code, so observed traffic has anchors. */
export function mark(label: string, detail?: unknown): void {
  emit({ kind: 'mark', label, detail: detail === undefined ? undefined : redact(detail) });
}

/** Clear the log so a second run on stage starts from nothing. */
export function reset(): void {
  events = [];
  nextId = 0;
  origin = performance.now();
  for (const l of listeners) l();
}
