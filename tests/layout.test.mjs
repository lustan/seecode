import assert from 'node:assert/strict';
import { getSidebarWidth } from '../src/utils/layout.mjs';

assert.equal(getSidebarWidth(true), 140);
assert.equal(getSidebarWidth(false), 198);

console.log('layout tests passed');
