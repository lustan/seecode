import assert from 'node:assert/strict';
import { applyDiffHunk, spliceSegmentLines, textToLines } from '../src/utils/applyDiffHunk.mjs';

assert.deepEqual(textToLines(''), []);
assert.deepEqual(textToLines('a\n\n'), ['a', '', '']);

assert.equal(spliceSegmentLines('', 0, -1, 'hello'), 'hello');
assert.equal(spliceSegmentLines('', 0, -1, 'line 1\nline 2'), 'line 1\nline 2');
assert.equal(spliceSegmentLines('a\nb\nc', 1, 1, 'B'), 'a\nB\nc');
assert.equal(spliceSegmentLines('a\nb\nc', 0, 2, ''), '');

const modify = { leftFirst: 1, leftLast: 2, rightFirst: 1, rightLast: 1, kind: 'modify' };
assert.deepEqual(applyDiffHunk('same\nleft 1\nleft 2\nend', 'same\nright\nend', modify, 'left'), {
  targetSide: 'right', text: 'same\nleft 1\nleft 2\nend', targetLine: 1, copiedLines: 2, replacedLines: 1
});
assert.deepEqual(applyDiffHunk('same\nleft 1\nleft 2\nend', 'same\nright\nend', modify, 'right'), {
  targetSide: 'left', text: 'same\nright\nend', targetLine: 1, copiedLines: 1, replacedLines: 2
});

const rightOnly = { leftFirst: 1, leftLast: 0, rightFirst: 1, rightLast: 2, kind: 'add' };
assert.equal(applyDiffHunk('start\nend', 'start\nnew 1\nnew 2\nend', rightOnly, 'right').text, 'start\nnew 1\nnew 2\nend');
assert.equal(applyDiffHunk('start\nend', 'start\nnew 1\nnew 2\nend', rightOnly, 'left').text, 'start\nend');

const leftOnlyAtEnd = { leftFirst: 1, leftLast: 1, rightFirst: 1, rightLast: 0, kind: 'remove' };
assert.equal(applyDiffHunk('start\nextra', 'start', leftOnlyAtEnd, 'left').text, 'start\nextra');
assert.equal(applyDiffHunk('start\nextra', 'start', leftOnlyAtEnd, 'right').text, 'start');

console.log('apply diff hunk tests passed');
