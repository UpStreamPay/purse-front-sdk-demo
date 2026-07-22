import { LitElement } from 'lit';

/**
 * Base class for every demo component.
 *
 * These components render into the LIGHT DOM (not a shadow root) on purpose:
 *   1. The Purse SDKs (Secure Fields, Drop-in, payment element) inject iframes
 *      into target elements looked up with `document.getElementById`. Those
 *      targets must live in the main document, not a shadow tree.
 *   2. The demos are styled with global Tailwind utility classes, which do not
 *      cross a shadow boundary.
 *
 * So the components are effectively reactive template helpers: they own their
 * markup and props, but share the page's DOM and stylesheet.
 */
export class DemoElement extends LitElement {
  protected createRenderRoot() {
    return this;
  }
}
