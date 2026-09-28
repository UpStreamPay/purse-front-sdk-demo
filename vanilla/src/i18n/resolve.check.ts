// Self-check for resolveLocale — run with: node vanilla/src/i18n/resolve.check.ts
import assert from 'node:assert/strict';
import {resolveLocale} from './resolve.ts';

const supported = ['en', 'fr'] as const;

assert.equal(resolveLocale(supported, null, ['fr-FR', 'en-US']), 'fr', 'browser language');
assert.equal(resolveLocale(supported, null, ['fr-CA']), 'fr', 'region subtag ignored');
assert.equal(resolveLocale(supported, null, ['de-DE', 'fr-FR']), 'fr', 'first supported browser language');
assert.equal(resolveLocale(supported, null, ['de-DE', 'es-ES']), 'en', 'unsupported browser → English');
assert.equal(resolveLocale(supported, null, []), 'en', 'no browser languages → English');
assert.equal(resolveLocale(supported, 'en', ['fr-FR']), 'en', 'stored choice beats the browser');
assert.equal(resolveLocale(supported, 'xx', ['fr-FR']), 'fr', 'unknown stored value is ignored');
assert.equal(resolveLocale(supported, 'constructor', []), 'en', 'no prototype-key false positive');

console.log('resolveLocale: ok');
