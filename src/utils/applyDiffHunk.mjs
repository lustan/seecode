/** Convert the diff viewer's text model to lines without inventing a line for
 * an actually empty document. Intentional blank lines remain intact. */
export function textToLines(text) {
  return text === '' ? [] : text.split('\n');
}

/**
 * Copy one complete diff hunk from `sourceSide` to the opposite side.
 *
 * Hunk ranges are inclusive. A pure add/remove is represented by last < first,
 * which naturally becomes a zero-length splice at the hunk's insertion point.
 */
export function applyDiffHunk(leftText, rightText, hunk, sourceSide) {
  if (!hunk || (sourceSide !== 'left' && sourceSide !== 'right')) {
    throw new TypeError('A hunk and a valid source side are required');
  }

  const sourceText = sourceSide === 'left' ? leftText : rightText;
  const targetText = sourceSide === 'left' ? rightText : leftText;
  const sourceFirst = sourceSide === 'left' ? hunk.leftFirst : hunk.rightFirst;
  const sourceLast = sourceSide === 'left' ? hunk.leftLast : hunk.rightLast;
  const targetFirst = sourceSide === 'left' ? hunk.rightFirst : hunk.leftFirst;
  const targetLast = sourceSide === 'left' ? hunk.rightLast : hunk.leftLast;

  const sourceLines = textToLines(sourceText);
  const targetLines = textToLines(targetText);
  const replacement = sourceLast < sourceFirst
    ? []
    : sourceLines.slice(sourceFirst, sourceLast + 1);
  const deleteCount = targetLast < targetFirst ? 0 : targetLast - targetFirst + 1;
  const nextLines = [...targetLines];
  nextLines.splice(targetFirst, deleteCount, ...replacement);

  return {
    targetSide: sourceSide === 'left' ? 'right' : 'left',
    text: nextLines.join('\n'),
    targetLine: Math.min(targetFirst, Math.max(0, nextLines.length - 1)),
    copiedLines: replacement.length,
    replacedLines: deleteCount
  };
}
