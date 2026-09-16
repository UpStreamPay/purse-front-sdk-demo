/**
 * Presenter trick: make the hidden 3DS Method iframe visible.
 *
 * The fingerprint iframe is deliberately invisible — 1×1, or display:none. If
 * the SDK puts it in our document we can force it on screen, which is the most
 * literal way to show an audience the invisible step. Secure Fields' own field
 * iframes are left alone: they are inside `.sf-field` and are meant to be seen.
 */
export const REVEALED = new Map<HTMLIFrameElement, string>();
let revealArmed = false;

const REVEAL_CSS =
  ';display:block!important;visibility:visible!important;opacity:1!important;' +
  'position:fixed!important;right:16px!important;bottom:16px!important;' +
  'width:320px!important;height:220px!important;z-index:50!important;' +
  'border:2px solid #6366f1!important;border-radius:10px!important;background:#fff!important;';

export function isConcealed(frame: HTMLIFrameElement): boolean {
  const style = getComputedStyle(frame);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    frame.offsetWidth <= 1 ||
    frame.offsetHeight <= 1
  );
}

export function revealOne(frame: HTMLIFrameElement): void {
  if (REVEALED.has(frame)) return;
  // Secure Fields' own field iframes live inside .sf-field and are meant to be
  // seen; leave them alone.
  if (frame.closest('.sf-field')) return;
  if (!isConcealed(frame)) return;
  REVEALED.set(frame, frame.style.cssText);
  frame.style.cssText += REVEAL_CSS;
}

/**
 * Arm or disarm the reveal. This is a *mode*, not a one-shot sweep: the SDK
 * removes the 3DS Method frame a few seconds after the fingerprint completes
 * (teardownDelayMs in the CDN bundle), so by the time anyone could click a
 * button the frame is long gone. Armed beforehand, the frame is forced visible
 * the instant it is inserted.
 */
export function setReveal(on: boolean): number {
  revealArmed = on;
  if (!on) {
    for (const [frame, cssText] of REVEALED) frame.style.cssText = cssText;
    REVEALED.clear();
    return 0;
  }
  for (const frame of document.querySelectorAll('iframe')) revealOne(frame);
  return REVEALED.size;
}

/** Armed state, read by the DOM observer. */
export const isRevealArmed = () => revealArmed;
