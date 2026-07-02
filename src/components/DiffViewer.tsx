import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Note } from '../App';

interface Props {
  notes: Note[];
  /** the currently-open note — used as the LEFT side by default */
  currentNote?: Note | null;
  theme?: 'dark' | 'light';
  fontSize?: number;
  onClose: () => void;
}

type DiffOp =
  | { type: 'equal'; left: number; right: number; text: string }
  | { type: 'remove'; left: number; text: string }
  | { type: 'add'; right: number; text: string };

type RowKind = 'equal' | 'remove' | 'add' | 'modify';

type Side = 'left' | 'right';

type PaneSource =
  | { kind: 'note'; noteId: string }
  | { kind: 'blank' };

// One IDEA-style hunk: a contiguous diff region with its line ranges on
// each ORIGINAL side. The SVG ribbon connects [leftFirst..leftLast+1] on
// the left to [rightFirst..rightLast+1] on the right.
type Hunk = {
  // Inclusive 0-based line indices in the original left/right text.
  // If a hunk is a pure addition the left range collapses (leftFirst = leftLast+1 = insertion point).
  // If a hunk is a pure deletion the right range collapses similarly.
  leftFirst: number; leftLast: number;
  rightFirst: number; rightLast: number;
  kind: 'add' | 'remove' | 'modify';
};

// LCS line diff
function computeDiff(a: string[], b: string[]): DiffOp[] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', left: i, right: j, text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', left: i, text: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', right: j, text: b[j] });
      j++;
    }
  }
  while (i < m) { ops.push({ type: 'remove', left: i, text: a[i] }); i++; }
  while (j < n) { ops.push({ type: 'add', right: j, text: b[j] }); j++; }
  return ops;
}

// Group ops into hunks. Each hunk = a run of non-equal ops, holding the
// original-line ranges on each side.
function buildHunks(ops: DiffOp[], leftTotal: number, rightTotal: number): Hunk[] {
  const hunks: Hunk[] = [];
  let i = 0;
  let li = 0, ri = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      li = op.left + 1;
      ri = op.right + 1;
      i++;
      continue;
    }
    // start of a hunk
    let removeCount = 0;
    let addCount = 0;
    const leftFirst = li;
    const rightFirst = ri;
    while (i < ops.length && ops[i].type !== 'equal') {
      const o = ops[i];
      if (o.type === 'remove') { removeCount++; li = o.left + 1; }
      else if (o.type === 'add') { addCount++; ri = o.right + 1; }
      i++;
    }
    const leftLast = leftFirst + removeCount - 1;     // -1 if no removes
    const rightLast = rightFirst + addCount - 1;       // -1 if no adds
    let kind: 'add' | 'remove' | 'modify';
    if (removeCount > 0 && addCount > 0) kind = 'modify';
    else if (addCount > 0) kind = 'add';
    else kind = 'remove';
    hunks.push({ leftFirst, leftLast, rightFirst, rightLast, kind });
  }
  // Guard against unused params warnings
  void leftTotal; void rightTotal;
  return hunks;
}

// =============================================================================
// Theme colors
// =============================================================================
type DiffColors = {
  bg: string;
  panelBg: string;
  headerBg: string;
  border: string;
  borderStrong: string;
  text: string;
  textSec: string;
  textDim: string;
  gutterBg: string;
  gutterText: string;
  removeBg: string;
  removeGutter: string;
  removeStrong: string;
  removeRibbon: string;
  addBg: string;
  addGutter: string;
  addStrong: string;
  addRibbon: string;
  modifyBg: string;
  modifyGutter: string;
  modifyStrong: string;
  modifyRibbon: string;
  accent: string;
  pickerBg: string;
  pickerItemHover: string;
};

// =============================================================================
// EditablePane — a single full-document textarea per side. Per-line color
// bands and a line-number gutter sit behind it as overlays. Heights match the
// side's own line count, NOT the merged row count → IDEA-style natural heights.
// =============================================================================
function EditablePane(props: {
  side: Side;
  text: string;
  onChange: (v: string) => void;
  hunks: Hunk[];
  lineHeight: number;
  fontSize: number;
  colors: DiffColors;
  paneRef: React.RefObject<HTMLDivElement>;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onScroll: (scrollTop: number, scrollLeft: number, fromSide: Side) => void;
  currentHunkIdx: number;
  toolbar: React.ReactNode;
  autoFocus?: boolean;
  /** Extra space appended below the document so both panes have matching
   *  total scroll heights — keeps scroll-sync aligned at the bottom. */
  bottomPadding: number;
}) {
  const {
    side, text, onChange, hunks,
    lineHeight, fontSize, colors, paneRef, textareaRef, onScroll,
    currentHunkIdx, toolbar, autoFocus, bottomPadding
  } = props;

  const numColWidth = 50;
  const gutterFontSize = Math.max(10, fontSize - 2);
  const textPadding = 24; // 12px left + 12px right on the textarea

  const totalLines = text === '' ? 0 : text.split('\n').length;
  const docHeight = Math.max(totalLines * lineHeight, 0);

  // Track the scroll container's inner width so short documents still fill the
  // pane (no phantom horizontal scroll) while long lines make it wider.
  const [availWidth, setAvailWidth] = useState(0);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => setAvailWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paneRef]);

  // Width of the text column: wide enough for the longest line so the pane can
  // scroll horizontally, but never narrower than the available space. Measure
  // the real rendered width with a canvas (a fixed char-width estimate is wrong
  // for CJK/wide glyphs and tabs, which left long lines unreachable at max
  // horizontal scroll).
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textContentWidth = useMemo(() => {
    if (typeof document === 'undefined') return 0;
    let canvas = measureCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      measureCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    const tab = '  '; // matches the textarea's tabSize of 2
    let max = 0;
    for (const raw of text.split('\n')) {
      const line = raw.indexOf('\t') >= 0 ? raw.replace(/\t/g, tab) : raw;
      const w = ctx.measureText(line).width;
      if (w > max) max = w;
    }
    // +2 leaves room for the caret at the end of the longest line.
    return Math.ceil(max) + textPadding + 2;
  }, [text, fontSize]);
  const colWidth = Math.max(textContentWidth, Math.max(0, availWidth - numColWidth));

  // Per-line kind, indexed by 0-based line in THIS side.
  const lineKinds = useMemo<RowKind[]>(() => {
    const out: RowKind[] = new Array(Math.max(totalLines, 0)).fill('equal');
    for (const h of hunks) {
      if (side === 'left') {
        if (h.leftLast >= h.leftFirst) {
          for (let i = h.leftFirst; i <= h.leftLast; i++) {
            if (i >= 0 && i < out.length) out[i] = h.kind;
          }
        }
      } else {
        if (h.rightLast >= h.rightFirst) {
          for (let i = h.rightFirst; i <= h.rightLast; i++) {
            if (i >= 0 && i < out.length) out[i] = h.kind;
          }
        }
      }
    }
    return out;
  }, [hunks, totalLines, side]);

  const lineBg = (kind: RowKind): string => {
    if (kind === 'equal') return 'transparent';
    if (kind === 'modify') return colors.modifyBg;
    if (kind === 'remove') return colors.removeBg;
    if (kind === 'add') return colors.addBg;
    return 'transparent';
  };

  const gutterLineBg = (kind: RowKind): string => {
    if (kind === 'equal') return 'transparent';
    if (kind === 'modify') return colors.modifyGutter;
    if (kind === 'remove') return colors.removeGutter;
    if (kind === 'add') return colors.addGutter;
    return 'transparent';
  };

  const gutterLineColor = (kind: RowKind): string => {
    if (kind === 'modify') return colors.modifyStrong;
    if (kind === 'remove') return colors.removeStrong;
    if (kind === 'add') return colors.addStrong;
    return colors.gutterText;
  };

  // Hunks where THIS side is empty — i.e. pure deletions on the right pane,
  // pure additions on the left pane. We mark the collapse point with a thin
  // colored horizontal line so the user can see WHERE the missing block lives
  // relative to the other side.
  const collapseMarkers = useMemo(() => {
    const out: { y: number; color: string }[] = [];
    for (const h of hunks) {
      if (side === 'left' && h.kind === 'add') {
        // left collapses → mark at h.leftFirst (= h.leftLast+1 since empty)
        out.push({ y: h.leftFirst * lineHeight, color: colors.addStrong });
      } else if (side === 'right' && h.kind === 'remove') {
        out.push({ y: h.rightFirst * lineHeight, color: colors.removeStrong });
      }
    }
    return out;
  }, [hunks, side, lineHeight, colors.addStrong, colors.removeStrong]);

  // currentHunkIdx is currently unreferenced — silence unused warnings.
  void currentHunkIdx;

  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
      background: colors.panelBg
    }}>
      {toolbar}
      <div
        ref={paneRef}
        onScroll={e => onScroll(e.currentTarget.scrollTop, e.currentTarget.scrollLeft, side)}
        className={side === 'left' ? 'dv-scroll dv-no-vscrollbar' : 'dv-scroll'}
        style={{
          position: 'relative', flex: 1, overflow: 'auto',
          background: colors.panelBg
        }}
      >
        <div style={{
          position: 'relative',
          minHeight: '100%',
          height: Math.max(docHeight + bottomPadding, 0),
          width: numColWidth + colWidth,
          display: 'flex',
          flexDirection: side === 'left' ? 'row-reverse' : 'row'
        }}>
          {/* Collapse markers — a thin colored line at the y-position where
              the OPPOSITE side has a block that this side doesn't. Rendered
              at the pane level (not inside the text-area column) so it spans
              BOTH the line-number gutter and the text area, visually fusing
              with the SVG ribbon in the middle strip. */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2
          }}>
            {collapseMarkers.map((m, i) => (
              <div
                key={`cm-${i}`}
                style={{
                  position: 'absolute',
                  top: m.y - 1,
                  left: 0, right: 0,
                  height: 2,
                  background: m.color,
                  opacity: 0.85
                }}
              />
            ))}
          </div>

          {/* Line number column — sits on the INNER side of each pane so the
              two number columns end up next to the center ribbon. Sticky on
              the inner edge so numbers stay visible during horizontal scroll. */}
          <div style={{
            width: numColWidth, flexShrink: 0,
            position: 'sticky',
            [side === 'left' ? 'right' : 'left']: 0,
            zIndex: 3,
            alignSelf: 'stretch',
            background: colors.gutterBg,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {lineKinds.map((k, idx) => {
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: idx * lineHeight,
                    left: 0, right: 0,
                    height: lineHeight,
                    padding: '0 8px',
                    textAlign: side === 'left' ? 'right' : 'left',
                    color: gutterLineColor(k),
                    background: gutterLineBg(k),
                    fontSize: gutterFontSize,
                    lineHeight: `${lineHeight}px`,
                    fontWeight: k !== 'equal' ? 700 : 500,
                    userSelect: 'none'
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          {/* Text area + per-line color bands behind it */}
          <div style={{ position: 'relative', width: colWidth, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none'
            }}>
              {lineKinds.map((k, idx) => {
                if (k === 'equal') return null;
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      top: idx * lineHeight,
                      left: 0, right: 0,
                      height: lineHeight,
                      background: lineBg(k)
                    }}
                  />
                );
              })}
            </div>
            <textarea
              ref={textareaRef}
              autoFocus={autoFocus}
              value={text}
              onChange={e => onChange(e.target.value)}
              placeholder={`${side === 'left' ? 'Left' : 'Right'} side — type or pick a file…`}
              spellCheck={false}
              wrap="off"
              style={{
                position: 'relative', zIndex: 1,
                width: '100%',
                height: Math.max(docHeight + bottomPadding, '100%' as any),
                minHeight: '100%',
                padding: '0 12px',
                resize: 'none', outline: 'none', border: 'none',
                background: 'transparent',
                color: colors.text,
                caretColor: colors.accent,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
                tabSize: 2,
                whiteSpace: 'pre',
                overflow: 'hidden',
                display: 'block'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ConnectorRibbon — IDEA-style middle strip. Draws a tinted trapezoid (or thin
// line for pure insertions/deletions) between corresponding left/right hunk
// regions, accounting for the current scroll positions of each pane.
// =============================================================================
function ConnectorRibbon(props: {
  width: number;
  height: number;
  hunks: Hunk[];
  currentHunkIdx: number;
  lineHeight: number;
  leftScrollTop: number;
  rightScrollTop: number;
  colors: DiffColors;
  onHunkClick: (idx: number) => void;
}) {
  const {
    width, height, hunks, currentHunkIdx, lineHeight,
    leftScrollTop, rightScrollTop, colors, onHunkClick
  } = props;

  const ribbonColor = (k: RowKind): string => {
    if (k === 'modify') return colors.modifyRibbon;
    if (k === 'remove') return colors.removeRibbon;
    if (k === 'add') return colors.addRibbon;
    return 'transparent';
  };
  const strokeColor = (k: RowKind): string => {
    if (k === 'modify') return colors.modifyStrong;
    if (k === 'remove') return colors.removeStrong;
    if (k === 'add') return colors.addStrong;
    return colors.border;
  };

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', position: 'absolute', inset: 0, pointerEvents: 'auto' }}
    >
      {hunks.map((h, idx) => {
        // Y in local pane viewport coordinates (after subtracting scrollTop).
        const lTop = h.leftFirst * lineHeight - leftScrollTop;
        const lBot = (h.leftLast + 1) * lineHeight - leftScrollTop;
        const rTop = h.rightFirst * lineHeight - rightScrollTop;
        const rBot = (h.rightLast + 1) * lineHeight - rightScrollTop;

        // Pure addition → left range is empty (leftLast < leftFirst).
        const leftEmpty = h.leftLast < h.leftFirst;
        const rightEmpty = h.rightLast < h.rightFirst;
        const lTopUse = leftEmpty ? lTop : lTop;
        const lBotUse = leftEmpty ? lTop : lBot;
        const rTopUse = rightEmpty ? rTop : rTop;
        const rBotUse = rightEmpty ? rTop : rBot;

        // Cull entirely-offscreen ribbons.
        const minY = Math.min(lTopUse, rTopUse);
        const maxY = Math.max(lBotUse, rBotUse);
        if (maxY < -20 || minY > height + 20) return null;

        const fill = ribbonColor(h.kind);
        const stroke = strokeColor(h.kind);
        const isCurrent = idx === currentHunkIdx;

        // Build a smooth bezier-bounded trapezoid.
        // Top edge: left(lTop) → right(rTop)
        // Bottom edge: right(rBot) → left(lBot)
        const midX = width / 2;
        const cpOffset = width * 0.4;
        const path =
          `M 0 ${lTopUse} ` +
          `C ${cpOffset} ${lTopUse}, ${width - cpOffset} ${rTopUse}, ${width} ${rTopUse} ` +
          `L ${width} ${rBotUse} ` +
          `C ${width - cpOffset} ${rBotUse}, ${cpOffset} ${lBotUse}, 0 ${lBotUse} ` +
          `Z`;

        return (
          <g key={idx} onClick={() => onHunkClick(idx)} style={{ cursor: 'pointer' }}>
            <path
              d={path}
              fill={fill}
              stroke="none"
              opacity={isCurrent ? 1 : 0.75}
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function DiffViewer({ notes, currentNote, theme = 'dark', fontSize = 13, onClose }: Props) {
  // Layout constants used by scroll math and the panes.
  const lineHeight = Math.round(fontSize * 1.55);

  const [leftSrc, setLeftSrc] = useState<PaneSource>(
    currentNote ? { kind: 'note', noteId: currentNote.id } : { kind: 'blank' }
  );
  const [rightSrc, setRightSrc] = useState<PaneSource>({ kind: 'blank' });

  const [leftText, setLeftText] = useState<string>(currentNote?.content || '');
  const [rightText, setRightText] = useState<string>('');

  const [pickerSide, setPickerSide] = useState<Side | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const [currentHunkIdx, setCurrentHunkIdx] = useState<number>(-1);
  const [formatError, setFormatError] = useState<{ side: Side; message: string } | null>(null);

  // Scroll state used by both ribbon SVG and cross-pane sync.
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);
  const [ribbonHeight, setRibbonHeight] = useState(0);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef<Side | null>(null);

  const leftTitle = leftSrc.kind === 'note'
    ? (notes.find(n => n.id === leftSrc.noteId)?.title || 'Untitled')
    : 'untitled-left.txt';
  const rightTitle = rightSrc.kind === 'note'
    ? (notes.find(n => n.id === rightSrc.noteId)?.title || 'Untitled')
    : 'untitled.txt';

  const leftLineCount = leftText === '' ? 0 : leftText.split('\n').length;
  const rightLineCount = rightText === '' ? 0 : rightText.split('\n').length;

  // Use the SAME small cushion on both sides — do NOT equalize total scroll
  // heights. The natural scrollHeight difference between the two panes is
  // exactly (R-L)*lineHeight, which matches the cumulative hunk offset the
  // scroll-sync mapping produces. Forcing equal heights makes the shorter
  // side map past its own max-scroll and the bottom drifts out of alignment.
  const baseBottomPad = 40;
  const leftBottomPad = baseBottomPad;
  const rightBottomPad = baseBottomPad;
  void leftLineCount; void rightLineCount;

  const hunks = useMemo(() => {
    const a = leftText.split('\n');
    const b = rightText.split('\n');
    if (leftText === '') a.length = 0;
    if (rightText === '') b.length = 0;
    return buildHunks(computeDiff(a, b), a.length, b.length);
  }, [leftText, rightText]);

  useEffect(() => {
    setCurrentHunkIdx(hunks.length > 0 ? 0 : -1);
  }, [hunks.length]);

  // auto-dismiss format error
  useEffect(() => {
    if (!formatError) return;
    const t = setTimeout(() => setFormatError(null), 2500);
    return () => clearTimeout(t);
  }, [formatError]);

  // Track ribbon area height — needed for SVG sizing and viewport math.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setRibbonHeight(el.clientHeight - 36 /* toolbar */);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Anchor scroll sync: when one side scrolls, find the line at its viewport
  // top, map it through the nearest hunk to the corresponding line on the
  // other side, scroll the other side so that line lands at the same y.
  const mapLineToOther = useCallback((line: number, from: Side): number => {
    // Equal regions outside hunks: identity offset relative to the previous hunk's end.
    // Walk hunks; figure out cumulative offsets.
    // Build a piecewise linear mapping on the fly.
    let acc = 0; // offset = other - this
    for (const h of hunks) {
      const thisStart = from === 'left' ? h.leftFirst : h.rightFirst;
      const thisEnd = from === 'left' ? h.leftLast : h.rightLast;
      const otherStart = from === 'left' ? h.rightFirst : h.leftFirst;
      const otherEnd = from === 'left' ? h.rightLast : h.leftLast;

      if (line < thisStart) {
        return line + acc;
      }
      const thisLen = Math.max(0, thisEnd - thisStart + 1);
      const otherLen = Math.max(0, otherEnd - otherStart + 1);
      if (line <= thisEnd && thisLen > 0) {
        // inside this hunk on `from` side: anchor to other hunk top
        return otherStart;
      }
      // past this hunk
      acc += otherLen - thisLen;
    }
    return line + acc;
  }, [hunks]);

  const handleScroll = useCallback((scrollTop: number, scrollLeft: number, fromSide: Side) => {
    if (fromSide === 'left') setLeftScrollTop(scrollTop);
    else setRightScrollTop(scrollTop);

    if (syncingScrollRef.current && syncingScrollRef.current !== fromSide) return;
    syncingScrollRef.current = fromSide;

    const fromRef = fromSide === 'left' ? leftPaneRef : rightPaneRef;
    const otherRef = fromSide === 'left' ? rightPaneRef : leftPaneRef;

    if (otherRef.current && fromRef.current) {
      const fromMax = Math.max(0, fromRef.current.scrollHeight - fromRef.current.clientHeight);
      const otherMax = Math.max(0, otherRef.current.scrollHeight - otherRef.current.clientHeight);

      // Boundary snap — when the source side is at (or within 1px of) its
      // own top/bottom, slam the other side to the matching edge. Skips the
      // line-anchored mapping, which can be off by a fractional line at the
      // limits and can also anchor into a near-bottom hunk instead of letting
      // the other side roll all the way down.
      let target: number;
      if (scrollTop >= fromMax - 1) {
        target = otherMax;
      } else if (scrollTop <= 1) {
        target = 0;
      } else {
        const fromLine = scrollTop / lineHeight;
        const toLine = mapLineToOther(fromLine, fromSide);
        target = Math.max(0, Math.min(otherMax, toLine * lineHeight));
      }

      if (Math.abs(otherRef.current.scrollTop - target) > 1) {
        otherRef.current.scrollTop = target;
        if (fromSide === 'left') setRightScrollTop(target);
        else setLeftScrollTop(target);
      }

      // Mirror horizontal scroll directly — both panes share the same
      // character grid, so a 1:1 left offset keeps them aligned.
      const otherHMax = Math.max(0, otherRef.current.scrollWidth - otherRef.current.clientWidth);
      const hTarget = Math.max(0, Math.min(otherHMax, scrollLeft));
      if (Math.abs(otherRef.current.scrollLeft - hTarget) > 1) {
        otherRef.current.scrollLeft = hTarget;
      }
    }
    requestAnimationFrame(() => { syncingScrollRef.current = null; });
  }, [lineHeight, mapLineToOther]);

  const scrollToHunk = useCallback((idx: number) => {
    if (idx < 0 || idx >= hunks.length) return;
    const h = hunks[idx];
    requestAnimationFrame(() => {
      const lLine = h.leftFirst;
      const rLine = h.rightFirst;
      if (leftPaneRef.current) {
        const target = Math.max(0, lLine * lineHeight - leftPaneRef.current.clientHeight / 3);
        leftPaneRef.current.scrollTo({ top: target, behavior: 'smooth' });
      }
      if (rightPaneRef.current) {
        const target = Math.max(0, rLine * lineHeight - rightPaneRef.current.clientHeight / 3);
        rightPaneRef.current.scrollTo({ top: target, behavior: 'smooth' });
      }
      // Move the caret to the start of the corresponding line on the RIGHT
      // pane so the user can start editing the diff target immediately.
      const ta = rightTextareaRef.current;
      if (ta) {
        // Pure additions/removals: if right side is empty for this hunk, use
        // rightFirst as the insertion line (it equals rightLast+1). Otherwise
        // jump to the start of the first changed line on the right.
        const lines = rightText.split('\n');
        const targetLine = Math.min(Math.max(0, rLine), Math.max(0, lines.length - 1));
        let offset = 0;
        for (let i = 0; i < targetLine; i++) {
          offset += lines[i].length + 1; // +1 for the newline
        }
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(offset, offset);
      }
    });
  }, [hunks, lineHeight, rightText]);

  const goPrevDiff = useCallback(() => {
    if (hunks.length === 0) return;
    const next = currentHunkIdx <= 0 ? hunks.length - 1 : currentHunkIdx - 1;
    setCurrentHunkIdx(next);
    scrollToHunk(next);
  }, [hunks.length, currentHunkIdx, scrollToHunk]);

  const goNextDiff = useCallback(() => {
    if (hunks.length === 0) return;
    const next = currentHunkIdx >= hunks.length - 1 ? 0 : currentHunkIdx + 1;
    setCurrentHunkIdx(next);
    scrollToHunk(next);
  }, [hunks.length, currentHunkIdx, scrollToHunk]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerSide) setPickerSide(null);
        else onClose();
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        if (e.shiftKey) goPrevDiff(); else goNextDiff();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerSide, goPrevDiff, goNextDiff]);

  const stats = useMemo(() => {
    let removed = 0, added = 0, modified = 0;
    for (const h of hunks) {
      if (h.kind === 'remove') removed += (h.leftLast - h.leftFirst + 1);
      else if (h.kind === 'add') added += (h.rightLast - h.rightFirst + 1);
      else {
        modified += Math.max(
          h.leftLast - h.leftFirst + 1,
          h.rightLast - h.rightFirst + 1
        );
      }
    }
    return { removed, added, modified };
  }, [hunks]);

  const colors: DiffColors = theme === 'dark' ? {
    bg: '#0b0d14',
    panelBg: '#0f111a',
    headerBg: '#0d0f14',
    border: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(255,255,255,0.1)',
    text: '#e2e8f0',
    textSec: '#94a3b8',
    textDim: '#64748b',
    gutterBg: '#0a0c12',
    gutterText: '#475569',
    removeBg: 'rgba(239, 68, 68, 0.16)',
    removeGutter: 'rgba(239, 68, 68, 0.24)',
    removeStrong: '#ef4444',
    removeRibbon: 'rgba(239, 68, 68, 0.18)',
    addBg: 'rgba(34, 197, 94, 0.16)',
    addGutter: 'rgba(34, 197, 94, 0.24)',
    addStrong: '#22c55e',
    addRibbon: 'rgba(34, 197, 94, 0.18)',
    modifyBg: 'rgba(234, 179, 8, 0.14)',
    modifyGutter: 'rgba(234, 179, 8, 0.24)',
    modifyStrong: '#eab308',
    modifyRibbon: 'rgba(234, 179, 8, 0.16)',
    accent: '#60a5fa',
    pickerBg: 'rgba(15, 17, 26, 0.96)',
    pickerItemHover: 'rgba(59, 130, 246, 0.15)'
  } : {
    bg: '#f8fafc',
    panelBg: '#ffffff',
    headerBg: '#ffffff',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    text: '#0f172a',
    textSec: '#475569',
    textDim: '#94a3b8',
    gutterBg: '#f1f5f9',
    gutterText: '#94a3b8',
    removeBg: 'rgba(239, 68, 68, 0.14)',
    removeGutter: 'rgba(239, 68, 68, 0.24)',
    removeStrong: '#dc2626',
    removeRibbon: 'rgba(239, 68, 68, 0.18)',
    addBg: 'rgba(34, 197, 94, 0.16)',
    addGutter: 'rgba(34, 197, 94, 0.26)',
    addStrong: '#16a34a',
    addRibbon: 'rgba(34, 197, 94, 0.20)',
    modifyBg: 'rgba(234, 179, 8, 0.16)',
    modifyGutter: 'rgba(234, 179, 8, 0.28)',
    modifyStrong: '#a8821a',
    modifyRibbon: 'rgba(234, 179, 8, 0.18)',
    accent: '#2563eb',
    pickerBg: 'rgba(255, 255, 255, 0.98)',
    pickerItemHover: 'rgba(59, 130, 246, 0.10)'
  };

  const ribbonWidth = 38;

  const candidates = notes;
  const filteredCandidates = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(n =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [candidates, pickerSearch]);

  const applyPick = (side: Side, pick: PaneSource, text: string) => {
    if (side === 'left') {
      setLeftSrc(pick);
      setLeftText(text);
    } else {
      setRightSrc(pick);
      setRightText(text);
    }
    setPickerSide(null);
    setPickerSearch('');
  };

  const swapSides = () => {
    const ls = leftSrc, lt = leftText;
    setLeftSrc(rightSrc); setLeftText(rightText);
    setRightSrc(ls); setRightText(lt);
  };

  const formatJsonOn = (side: Side) => {
    const text = side === 'left' ? leftText : rightText;
    if (!text.trim()) {
      setFormatError({ side, message: 'Nothing to format' });
      return;
    }
    try {
      const formatted = JSON.stringify(JSON.parse(text), null, 2);
      if (side === 'left') setLeftText(formatted);
      else setRightText(formatted);
      setFormatError(null);
    } catch (e: any) {
      setFormatError({ side, message: 'Invalid JSON' });
    }
  };

  const clearSide = (side: Side) => {
    if (side === 'left') {
      setLeftText('');
      setLeftSrc({ kind: 'blank' });
    } else {
      setRightText('');
      setRightSrc({ kind: 'blank' });
    }
  };

  const fileChip = (side: Side) => {
    const src = side === 'left' ? leftSrc : rightSrc;
    const title = side === 'left' ? leftTitle : rightTitle;
    const isNote = src.kind === 'note';
    const dot = side === 'left' ? colors.removeStrong : colors.addStrong;
    return (
      <button
        className="dv-file-chip"
        onClick={() => { setPickerSide(side); setPickerSearch(''); }}
        title="Choose a file for this side"
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        {isNote ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )}
        <span className="dv-file-chip-title">{title}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    );
  };

  const editToolbar = (side: Side) => {
    const text = side === 'left' ? leftText : rightText;
    const err = formatError && formatError.side === side ? formatError.message : null;
    return (
      <div style={{
        height: 36, flexShrink: 0, padding: '0 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: `1px solid ${colors.border}`,
        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: colors.textDim,
          letterSpacing: 0.04, textTransform: 'uppercase'
        }}>
          {side === 'left' ? 'Left' : 'Right'}
        </span>
        <div style={{ width: 1, height: 14, background: colors.border, margin: '0 4px' }} />
        <button className="dv-mini-btn" onClick={() => formatJsonOn(side)} title="Format JSON">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          Format JSON
        </button>
        <button className="dv-mini-btn" onClick={() => navigator.clipboard.writeText(text)} title="Copy">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button className="dv-mini-btn danger" onClick={() => clearSide(side)} title="Clear">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Clear
        </button>
        {err && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            color: colors.removeStrong, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.12)'
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill={colors.removeStrong} stroke="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"></line>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"></line>
            </svg>
            {err}
          </span>
        )}
        <span style={{
          marginLeft: err ? 8 : 'auto', fontSize: 10, fontWeight: 700,
          color: colors.textDim, letterSpacing: 0.04
        }}>
          {text.split('\n').length} LINES · {text.length} CHR
        </span>
      </div>
    );
  };

  void leftLineCount; void rightLineCount;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: colors.bg, color: colors.text,
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter", sans-serif',
      animation: 'diffFadeIn 0.18s ease-out'
    }}>
      <style>{`
        @keyframes diffFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes diffSlide { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .dv-btn {
          height: 30px; padding: 0 12px; border-radius: 7px;
          border: 1px solid ${colors.border}; background: transparent;
          color: ${colors.textSec}; font-size: 12px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
          transition: all 0.15s; outline: none;
        }
        .dv-btn:hover { color: ${colors.text}; border-color: ${colors.borderStrong}; background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}; }
        .dv-btn.primary { background: ${colors.accent}; border-color: ${colors.accent}; color: white; }
        .dv-btn.primary:hover { filter: brightness(1.1); }
        .dv-icon-btn {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid transparent; background: transparent;
          color: ${colors.textSec}; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .dv-icon-btn:hover:not(:disabled) { color: ${colors.text}; background: ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}; }
        .dv-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .dv-nav-btn {
          width: 26px; height: 26px; border-radius: 6px;
          border: 1px solid ${colors.border}; background: transparent;
          color: ${colors.textSec}; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .dv-nav-btn:hover:not(:disabled) {
          color: ${colors.accent}; border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.10)' : 'rgba(59, 130, 246, 0.06)'};
        }
        .dv-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .dv-nav-counter {
          font-size: 11px; font-weight: 800; color: ${colors.textSec};
          font-variant-numeric: tabular-nums;
          min-width: 36px; text-align: center; letter-spacing: 0.02em;
        }
        .dv-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 9px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.01em;
        }
        .dv-file-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 10px; height: 28px; max-width: 280px;
          border-radius: 7px; border: 1px solid ${colors.border};
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'};
          color: ${colors.text}; font-size: 12px; font-weight: 700;
          cursor: pointer; outline: none; transition: all 0.15s;
        }
        .dv-file-chip:hover {
          border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.10)' : 'rgba(59, 130, 246, 0.06)'};
        }
        .dv-file-chip-title {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          max-width: 180px;
        }
        .dv-mini-btn {
          height: 26px; padding: 0 9px; border-radius: 6px;
          border: 1px solid ${colors.border}; background: transparent;
          color: ${colors.textSec}; font-size: 11px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
          transition: all 0.15s; outline: none;
        }
        .dv-mini-btn:hover {
          color: ${colors.accent}; border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.08)' : 'rgba(59, 130, 246, 0.05)'};
        }
        .dv-mini-btn.danger:hover {
          color: ${colors.removeStrong}; border-color: ${colors.removeStrong};
          background: rgba(239, 68, 68, 0.08);
        }
        .dv-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .dv-scroll::-webkit-scrollbar-track { background: transparent; }
        .dv-scroll::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? '#334155' : '#cbd5e1'}; border-radius: 10px; border: 2px solid ${colors.bg}; }
        .dv-scroll::-webkit-scrollbar-thumb:hover { background: ${theme === 'dark' ? '#475569' : '#94a3b8'}; }
        .dv-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .dv-no-scrollbar::-webkit-scrollbar { width: 0; height: 0; display: none; }
        /* Left pane: hide only the vertical scrollbar (the ribbon-adjacent
           right pane carries the shared vertical one) but KEEP the horizontal
           one so long lines can still be scrolled sideways. */
        .dv-no-vscrollbar::-webkit-scrollbar:vertical { width: 0; display: none; }
        .dv-no-vscrollbar::-webkit-scrollbar-track { background: transparent; }
        .dv-no-vscrollbar::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? '#334155' : '#cbd5e1'}; border-radius: 10px; border: 2px solid ${colors.bg}; }
        .dv-picker-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: flex-start; justify-content: center; z-index: 50;
          animation: diffFadeIn 0.15s ease-out; padding-top: 80px;
        }
        .dv-picker {
          width: 480px; max-height: 60vh; display: flex; flex-direction: column;
          background: ${colors.pickerBg}; backdrop-filter: blur(18px);
          border: 1px solid ${colors.borderStrong}; border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          animation: diffSlide 0.18s ease-out; overflow: hidden;
        }
        .dv-picker-search-wrap {
          position: relative; border-bottom: 1px solid ${colors.border};
          display: flex; align-items: center;
        }
        .dv-picker-search-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: ${colors.textDim}; pointer-events: none; display: flex;
        }
        .dv-picker-search {
          width: 100%; height: 46px; padding: 0 14px 0 38px;
          border: none; outline: none; background: transparent;
          color: ${colors.text}; font-size: 13px; font-weight: 600;
          letter-spacing: 0.01em;
        }
        .dv-picker-search::placeholder { color: ${colors.textDim}; font-weight: 600; }
        .dv-picker-item {
          padding: 9px 14px; cursor: pointer; transition: background 0.12s;
          border-bottom: 1px solid ${colors.border};
          display: flex; flex-direction: column; gap: 2px;
        }
        .dv-picker-item.special {
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.06)' : 'rgba(59, 130, 246, 0.04)'};
        }
        .dv-picker-item:last-child { border-bottom: none; }
        .dv-picker-item:hover { background: ${colors.pickerItemHover}; }
        .dv-picker-item-title { font-size: 12px; font-weight: 700; color: ${colors.text}; display: flex; align-items: center; gap: 6px; }
        .dv-picker-item-meta { font-size: 10px; color: ${colors.textDim}; font-weight: 600; }
      `}</style>

      {/* Header */}
      <div style={{
        height: 48, flexShrink: 0, padding: '0 14px',
        background: colors.headerBg, borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 7,
            background: theme === 'dark' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.08)',
            color: colors.accent, fontSize: 11, fontWeight: 800, letterSpacing: 0.04
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"></line>
              <circle cx="18" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <path d="M18 9a9 9 0 0 1-9 9"></path>
            </svg>
            FILE COMPARE
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {fileChip('left')}
            <button className="dv-icon-btn" onClick={swapSides} title="Swap sides" style={{ width: 26, height: 26 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </button>
            {fileChip('right')}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 3, borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
          }}>
            <button
              className="dv-nav-btn"
              onClick={goPrevDiff}
              disabled={hunks.length === 0}
              title="Previous difference (Shift+F7)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span className="dv-nav-counter">
              {hunks.length === 0 ? '0 / 0' : `${currentHunkIdx + 1} / ${hunks.length}`}
            </span>
            <button
              className="dv-nav-btn"
              onClick={goNextDiff}
              disabled={hunks.length === 0}
              title="Next difference (F7)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dv-chip" style={{ background: colors.removeBg, color: colors.removeStrong }}>
              −{stats.removed}
            </span>
            <span className="dv-chip" style={{ background: colors.modifyBg, color: colors.modifyStrong }}>
              ~{stats.modified}
            </span>
            <span className="dv-chip" style={{ background: colors.addBg, color: colors.addStrong }}>
              +{stats.added}
            </span>
          </div>

          <div style={{ width: 1, height: 22, background: colors.border, margin: '0 2px' }} />

          <button className="dv-icon-btn" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        <EditablePane
          side="left"
          text={leftText}
          onChange={setLeftText}
          hunks={hunks}
          lineHeight={lineHeight}
          fontSize={fontSize}
          colors={colors}
          paneRef={leftPaneRef}
          textareaRef={leftTextareaRef}
          onScroll={handleScroll}
          currentHunkIdx={currentHunkIdx}
          toolbar={editToolbar('left')}
          bottomPadding={leftBottomPad}
        />

        {/* Connector ribbon column */}
        <div style={{
          width: ribbonWidth, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: colors.gutterBg,
          position: 'relative'
        }}>
          <div style={{
            height: 36, flexShrink: 0,
            background: colors.gutterBg
          }} />
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <ConnectorRibbon
              width={ribbonWidth}
              height={ribbonHeight}
              hunks={hunks}
              currentHunkIdx={currentHunkIdx}
              lineHeight={lineHeight}
              leftScrollTop={leftScrollTop}
              rightScrollTop={rightScrollTop}
              colors={colors}
              onHunkClick={idx => { setCurrentHunkIdx(idx); scrollToHunk(idx); }}
            />
          </div>
        </div>

        <EditablePane
          side="right"
          text={rightText}
          onChange={setRightText}
          hunks={hunks}
          lineHeight={lineHeight}
          fontSize={fontSize}
          colors={colors}
          paneRef={rightPaneRef}
          textareaRef={rightTextareaRef}
          onScroll={handleScroll}
          currentHunkIdx={currentHunkIdx}
          toolbar={editToolbar('right')}
          bottomPadding={rightBottomPad}
          autoFocus
        />

        {/* Picker overlay */}
        {pickerSide && (
          <div className="dv-picker-overlay" onClick={() => setPickerSide(null)}>
            <div className="dv-picker" onClick={e => e.stopPropagation()}>
              <div style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.text, letterSpacing: 0.02 }}>
                  Choose file for <span style={{ color: colors.accent }}>{pickerSide === 'left' ? 'left' : 'right'}</span> side
                </div>
                <button className="dv-icon-btn" onClick={() => setPickerSide(null)} style={{ width: 24, height: 24 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="dv-picker-search-wrap">
                <span className="dv-picker-search-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  autoFocus
                  className="dv-picker-search"
                  placeholder="Search files by name or content…"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                />
              </div>
              <div style={{ overflow: 'auto', flex: 1 }} className="dv-scroll">
                <div
                  className="dv-picker-item special"
                  onClick={() => applyPick(pickerSide, { kind: 'blank' }, '')}
                >
                  <div className="dv-picker-item-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New blank file
                  </div>
                  <div className="dv-picker-item-meta">Start with an empty scratch buffer</div>
                </div>

                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: colors.textDim, fontSize: 12, fontWeight: 600 }}>
                    {candidates.length === 0 ? 'No notes available.' : 'No matching files.'}
                  </div>
                ) : (
                  filteredCandidates.map(n => {
                    const isCurrentOnOtherSide =
                      (pickerSide === 'left' && rightSrc.kind === 'note' && rightSrc.noteId === n.id) ||
                      (pickerSide === 'right' && leftSrc.kind === 'note' && leftSrc.noteId === n.id);
                    return (
                      <div
                        key={n.id}
                        className="dv-picker-item"
                        onClick={() => applyPick(pickerSide, { kind: 'note', noteId: n.id }, n.content)}
                      >
                        <div className="dv-picker-item-title">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          {n.title}
                          {isCurrentOnOtherSide && (
                            <span style={{
                              fontSize: 9, fontWeight: 800, color: colors.textDim,
                              padding: '1px 6px', borderRadius: 4,
                              background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
                            }}>
                              ALREADY ON OTHER SIDE
                            </span>
                          )}
                        </div>
                        <div className="dv-picker-item-meta">
                          {n.content.split('\n').length} lines · {n.content.length} chars
                          {n.language ? ` · ${n.language}` : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
