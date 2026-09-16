import type { FormEvent, HttpEvent, MarkEvent, ProbeEvent } from '../probe';
import { findThreeDSMethodData } from '../probe';

/** What the timeline shows as proof, picked out of the probe log. */

export const isMark = (e: ProbeEvent): e is MarkEvent => e.kind === 'mark';
export const isHttp = (e: ProbeEvent): e is HttpEvent => e.kind === 'http';

/** Last occurrence: a retry after a failed submit must not read the first attempt. */
export function mark(events: ProbeEvent[], label: string): MarkEvent | undefined {
  const matches = events.filter(isMark).filter(m => m.label === label);
  return matches[matches.length - 1];
}

export const between = (a?: MarkEvent, b?: MarkEvent) => (a && b ? b.at - a.at : undefined);

export type Window = { from: number; to: number } | null;

/** Versioning and the fingerprint both happen between these two marks. */
export function submitWindow(events: ProbeEvent[]): Window {
  const start = mark(events, 'tokenize:start');
  if (!start) return null;
  const end = mark(events, 'tokenize:done') ?? mark(events, 'tokenize:error');
  return { from: start.at, to: end ? end.at : Number.POSITIVE_INFINITY };
}

const within = (e: ProbeEvent, w: Window) => w !== null && e.at >= w.from && e.at <= w.to;

const httpPath = (events: ProbeEvent[], test: RegExp) =>
  events.filter(e => isHttp(e) && test.test(e.path));

/**
 * The 3DS Method frames. Deliberately narrow: Secure Fields also creates hidden
 * iframes for its own fields, so "a concealed iframe appeared" proves nothing.
 * What counts is the frame the SDK names `purse-3ds-method…`, the auto-submitted
 * threeDSMethodData form, or a load to a host that is neither ours nor Purse's.
 */
function methodEvidenceOf(events: ProbeEvent[], w: Window): ProbeEvent[] {
  const ourHosts = new Set(events.filter(isHttp).map(e => e.host));
  const isMethodFrame = (name: string) => /3ds.?method|threeds.?method/i.test(name);

  return events.filter(e => {
    if (!within(e, w)) return false;
    if (e.kind === 'form') return e.inputs.some(i => /threeDSMethod/i.test(i));
    if (e.kind === 'iframe') return isMethodFrame(e.name) || /threeDSMethod/i.test(e.src);
    if (e.kind === 'resource')
      return !ourHosts.has(e.host) && !/(^|\.)purse-(sandbox|test|secure)\.com$/.test(e.host);
    if (e.kind === 'http') return /threeDSMethod|3ds[-_]method/i.test(e.url);
    return false;
  });
}

export function collectEvidence(events: ProbeEvent[], w: Window) {
  const methodEvidence = methodEvidenceOf(events, w);

  return {
    orderCalls: httpPath(events, /\/(order|env)\b/),
    eligibleCalls: httpPath(events, /eligible_solutions/),
    paymentCalls: httpPath(events, /create_payment/),
    confirmCalls: httpPath(events, /\/payment\/[0-9a-f-]{8}/i),
    formFrames: events.filter(e => e.kind === 'iframe' && !e.concealed),
    // A call during the submit whose path reads as the authentication chain.
    versioningCalls: events.filter(
      e => isHttp(e) && within(e, w) && /3ds|three.?ds|version|authenticat/i.test(e.path),
    ),
    methodEvidence,
    // The injected form is the direct source; the rest are fallbacks.
    methodData:
      events.find((e): e is FormEvent => e.kind === 'form' && !!e.methodData)?.methodData ??
      findThreeDSMethodData(
        methodEvidence.map(e => ('src' in e ? e.src : 'url' in e ? e.url : '')),
      ) ??
      findThreeDSMethodData(events.filter(e => e.kind === 'message').map(e => e.preview)) ??
      findThreeDSMethodData(events.filter(isHttp).map(e => e.reqBody)) ??
      undefined,
  };
}

/** The visible challenge frame, plus whatever the ACS posted back into it. */
export function challengeEvidence(events: ProbeEvent[], start?: MarkEvent): ProbeEvent[] {
  if (!start) return [];
  return events.filter(
    e =>
      e.at >= start.at &&
      ((e.kind === 'iframe' && /3ds.?challenge/i.test(e.name)) || e.kind === 'message'),
  );
}
