// Self-check for resolveLocale — run with: node vanilla/src/i18n/resolve.check.ts
import assert from 'node:assert/strict';
import {resolveLocale} from './resolve.ts';

const supported = ['en', 'fr'] as const;

assert.equal(resolveLocale(supported, null), 'en', 'no stored choice → English');
assert.equal(resolveLocale(supported, 'fr'), 'fr', 'stored choice wins');
assert.equal(resolveLocale(supported, 'xx'), 'en', 'unknown stored value is ignored');
assert.equal(resolveLocale(supported, 'constructor'), 'en', 'no prototype-key false positive');

console.log('resolveLocale: ok');
