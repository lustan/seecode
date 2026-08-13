/**
 * Compute the changed character ranges for a pair of modified lines.
 * Offsets are UTF-16 offsets so they can be used directly with slice(),
 * textarea selections and DOM/canvas measurements.
 */
export function computeInlineDiff(left, right, maxCells = 250_000) {
  if (left === right) return { left: [], right: [] };

  const leftChars = toChars(left);
  const rightChars = toChars(right);

  // Keep live editing responsive for pathological long lines. The fallback
  // still preserves the common prefix/suffix and highlights only the middle.
  if (leftChars.length * rightChars.length > maxCells) {
    return prefixSuffixDiff(leftChars, rightChars);
  }

  const m = leftChars.length;
  const n = rightChars.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = leftChars[i].value === rightChars[j].value
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const leftRanges = [];
  const rightRanges = [];
  let leftRun = null;
  let rightRun = null;
  const flush = () => {
    if (leftRun) leftRanges.push(leftRun);
    if (rightRun) rightRanges.push(rightRun);
    leftRun = null;
    rightRun = null;
  };
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && leftChars[i].value === rightChars[j].value) {
      flush();
      i++;
      j++;
    } else if (i < m && (j === n || dp[i + 1][j] >= dp[i][j + 1])) {
      leftRun = extendRange(leftRun, leftChars[i]);
      i++;
    } else {
      rightRun = extendRange(rightRun, rightChars[j]);
      j++;
    }
  }
  flush();
  return { left: leftRanges, right: rightRanges };
}

/** Pair modified hunk lines by relative position and return per-side ranges. */
export function buildInlineDiffs(leftLines, rightLines, hunks) {
  const left = [];
  const right = [];
  for (const hunk of hunks) {
    if (hunk.kind !== 'modify') continue;
    const pairCount = Math.min(
      hunk.leftLast - hunk.leftFirst + 1,
      hunk.rightLast - hunk.rightFirst + 1
    );
    for (let offset = 0; offset < pairCount; offset++) {
      const leftLine = hunk.leftFirst + offset;
      const rightLine = hunk.rightFirst + offset;
      const ranges = computeInlineDiff(leftLines[leftLine] ?? '', rightLines[rightLine] ?? '');
      for (const range of ranges.left) left.push({ line: leftLine, ...range });
      for (const range of ranges.right) right.push({ line: rightLine, ...range });
    }
  }
  return { left, right };
}

function toChars(text) {
  const chars = [];
  let offset = 0;
  for (const value of text) {
    chars.push({ value, start: offset, end: offset + value.length });
    offset += value.length;
  }
  return chars;
}

function extendRange(range, char) {
  return range ? { start: range.start, end: char.end } : { start: char.start, end: char.end };
}

function prefixSuffixDiff(left, right) {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix].value === right[prefix].value) prefix++;
  let leftEnd = left.length;
  let rightEnd = right.length;
  while (leftEnd > prefix && rightEnd > prefix && left[leftEnd - 1].value === right[rightEnd - 1].value) {
    leftEnd--;
    rightEnd--;
  }
  return {
    left: rangeBetween(left, prefix, leftEnd),
    right: rangeBetween(right, prefix, rightEnd)
  };
}

function rangeBetween(chars, start, end) {
  if (start >= end) return [];
  return [{ start: chars[start].start, end: chars[end - 1].end }];
}
