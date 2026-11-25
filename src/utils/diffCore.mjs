/**
 * Pure LCS line-diff core supporting optional whitespace-insensitive comparison.
 */

export function normalizeLineForDiff(line, ignoreWhitespace = false) {
  if (!ignoreWhitespace) return line;
  return line.trim().replace(/\s+/g, ' ');
}

export function computeLineDiff(a, b, { ignoreWhitespace = false } = {}) {
  const m = a.length;
  const n = b.length;
  const normA = ignoreWhitespace ? a.map(line => normalizeLineForDiff(line, true)) : a;
  const normB = ignoreWhitespace ? b.map(line => normalizeLineForDiff(line, true)) : b;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (normA[i] === normB[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (normA[i] === normB[j]) {
      ops.push({ type: 'equal', left: i, right: j, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', left: i, text: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', right: j, text: b[j] });
      j++;
    }
  }
  while (i < m) {
    ops.push({ type: 'remove', left: i, text: a[i] });
    i++;
  }
  while (j < n) {
    ops.push({ type: 'add', right: j, text: b[j] });
    j++;
  }
  return ops;
}
