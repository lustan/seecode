import assert from 'node:assert/strict';
import { buildInlineDiffs, computeInlineDiff } from '../src/utils/inlineDiff.mjs';

assert.deepEqual(computeInlineDiff('same', 'same'), { left: [], right: [] });

assert.deepEqual(computeInlineDiff('abcXYZdef', 'abc123def'), {
  left: [{ start: 3, end: 6 }],
  right: [{ start: 3, end: 6 }]
});

assert.deepEqual(computeInlineDiff('a-old-b-old-c', 'a-new-b-new-c'), {
  left: [{ start: 2, end: 5 }, { start: 8, end: 11 }],
  right: [{ start: 2, end: 5 }, { start: 8, end: 11 }]
});

assert.deepEqual(computeInlineDiff('中文🙂A', '中文🙂B'), {
  left: [{ start: 4, end: 5 }],
  right: [{ start: 4, end: 5 }]
});

const hunks = [{ leftFirst: 1, leftLast: 2, rightFirst: 1, rightLast: 3, kind: 'modify' }];
assert.deepEqual(
  buildInlineDiffs(['same', 'left one', 'left two'], ['same', 'right one', 'right two', 'extra'], hunks),
  {
    left: [
      { line: 1, start: 0, end: 3 },
      { line: 2, start: 0, end: 3 }
    ],
    right: [
      { line: 1, start: 0, end: 4 },
      { line: 2, start: 0, end: 4 }
    ]
  }
);

console.log('inline diff tests passed');
