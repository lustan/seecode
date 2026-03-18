import assert from 'node:assert/strict';
import { getToastTheme } from '../src/utils/toastTheme.mjs';

const light = getToastTheme('light', 'success');
const dark = getToastTheme('dark', 'success');

assert.equal(light.text, '#0f172a');
assert.match(light.background, /255/);
assert.notEqual(light.background, dark.background);
assert.notEqual(light.border, dark.border);

console.log('toastTheme tests passed');
