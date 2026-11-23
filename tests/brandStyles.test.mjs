import assert from 'node:assert/strict';
import { BRAND_NAME, BRAND_ACCENT_LENGTH, BRAND_FONT_FAMILY, getBrandStyle } from '../src/components/brandStyles.mjs';

assert.equal(BRAND_NAME, 'DiffPad');
assert.equal(BRAND_ACCENT_LENGTH, 4);
assert.equal(BRAND_NAME.slice(0, BRAND_ACCENT_LENGTH), 'Diff');
assert.equal(BRAND_NAME.slice(BRAND_ACCENT_LENGTH), 'Pad');
assert.match(BRAND_FONT_FAMILY, /Space Grotesk/);
assert.match(BRAND_FONT_FAMILY, /sans-serif/);

const dark = getBrandStyle('dark');
const light = getBrandStyle('light');

assert.notEqual(dark.text, light.text);
assert.notEqual(dark.accent, light.accent);
assert.match(dark.glow, /rgba/);
assert.match(light.glow, /rgba/);

console.log('brandStyles tests passed');
