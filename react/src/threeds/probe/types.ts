/**
 * Browser instrumentation for the 3DS fingerprint showcase.
 *
 * Why this exists: `@purse-eu/web-sdk` exposes no 3DS API at all. There is no
 * `threeDS` member on `SecureFieldsConfig`, no `threeDSServerTransID` on
 * `SubmitResult` and no 3DS entry in `SecureFieldsEvents` (see
 * node_modules/@purse-eu/web-sdk/dist/generated/types/securefields.d.ts). The
 * runtime that performs versioning and the device fingerprint is fetched from
 * cdn.purse-*.com at load time and is not part of this repo.
 *
 * So the only way to *show* the fingerprint happening is to watch the browser
 * do it: patch fetch/XHR, listen for postMessages, observe the DOM for the
 * hidden iframe, and read the resource timings. Everything here is observation
 * — nothing is inferred, and a step with no evidence is reported as
 * unobserved rather than assumed to have happened.
 *
 * Install before the SDK loads (see main.tsx), or the CDN bundle captures the
 * originals first and the patches see nothing.
 */

import type { ThreeDSMethodData } from './method-data';

export type HttpEvent = {
  kind: 'http';
  id: number;
  at: number;
  ms?: number;
  via: 'fetch' | 'xhr';
  method: string;
  url: string;
  host: string;
  path: string;
  status?: number | 'error';
  reqBody?: unknown;
  resBody?: unknown;
};

export type MessageEvent_ = {
  kind: 'message';
  id: number;
  at: number;
  origin: string;
  keys: string[];
  preview: unknown;
};

export type IframeEvent = {
  kind: 'iframe';
  id: number;
  at: number;
  name: string;
  src: string;
  width: number;
  height: number;
  concealed: boolean;
};

export type FormEvent = {
  kind: 'form';
  id: number;
  at: number;
  action: string;
  target: string;
  inputs: string[];
  /** The decoded 3DS Method blob, when this is that form. Scrubbed of secrets. */
  methodData?: ThreeDSMethodData;
};

export type ResourceEvent = {
  kind: 'resource';
  id: number;
  at: number;
  ms: number;
  url: string;
  host: string;
  initiatorType: string;
};

/** A milestone emitted by the demo itself, to anchor the observed events. */
export type MarkEvent = {
  kind: 'mark';
  id: number;
  at: number;
  label: string;
  detail?: unknown;
};

export type ProbeEvent =
  | HttpEvent
  | MessageEvent_
  | IframeEvent
  | FormEvent
  | ResourceEvent
  | MarkEvent;
