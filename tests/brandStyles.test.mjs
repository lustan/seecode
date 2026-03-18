import assert from 'node:assert/strict';
import { BRAND_NAME, BRAND_FONT_FAMILY, getBrandStyle } from '../src/components/brandStyles.mjs';

assert.equal(BRAND_NAME, 'Seecode');
assert.match(BRAND_FONT_FAMILY, /Space Grotesk/);
assert.match(BRAND_FONT_FAMILY, /sans-serif/);

const dark = getBrandStyle('dark');
const light = getBrandStyle('light');

assert.notEqual(dark.text, light.text);
assert.notEqual(dark.accent, light.accent);
assert.match(dark.glow, /rgba/);
assert.match(light.glow, /rgba/);

console.log('brandStyles tests passed');
