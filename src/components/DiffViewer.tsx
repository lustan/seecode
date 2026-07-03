import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { Note } from '../App';

interface Props {
  notes: Note[];
  /** the currently-open note — used as the LEFT side by default */
  currentNote?: Note | null;
  theme?: 'dark' | 'light';
  fontSize?: number;
  /** Persist an edited side back to the note it was loaded from. */
  onSaveNote?: (noteId: string, content: string) => void;
  onClose: () => void;
}

type DiffOp =
  | { type: 'equal'; left: number; right: number; text: string }
  | { type: 'remove'; left: number; text: string }
  | { type: 'add'; right: number; text: string };

type RowKind = 'equal' | 'remove' | 'add' | 'modify';

type Side = 'left' | 'right';

// One search hit, addressed by 0-based line + column range within that line.
type Match = { line: number; start: number; end: number };

// Per-side find state. `open` toggles the floating find bar; `currentIdx`
// is the index into the matches array (or -1 when there are none).
type SearchState = {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  currentIdx: number;
};

const EMPTY_SEARCH: SearchState = { open: false, query: '', caseSensitive: false, currentIdx: -1 };

// Find every occurrence of `query` in `text`, returned per-line so the
// highlight overlay can position each rect. Plain substring search (not regex)
// to stay predictable; non-overlapping matches.
function findMatches(text: string, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const out: Match[] = [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const lines = text.split('\n');
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const hay = caseSensitive ? raw : raw.toLowerCase();
    let from = 0;
    while (from <= hay.length) {
      const idx = hay.indexOf(needle, from);
      if (idx < 0) break;
      out.push({ line, start: idx, end: idx + query.length });
      from = idx + query.length; // non-overlapping
    }
  }
  return out;
}

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
// Collapse unchanged fragments (IDEA-style folding)
// -----------------------------------------------------------------------------
// Equal regions between hunks map 1:1 left↔right, so a region collapsed by the
// same amount on both sides keeps the two panes row-aligned. We keep CONTEXT
// lines of unchanged text next to each change and fold the middle into a single
// clickable "⋯ N unchanged lines" strip.
// =============================================================================
const CONTEXT_LINES = 3;
// Only fold a gap when doing so hides at least this many lines — otherwise the
// strip would save no space.
const COLLAPSE_MIN = 4;

type CollapseRegion = {
  id: string;
  // Inclusive 0-based hidden line ranges on each side (equal length).
  leftStart: number; leftEnd: number;
  rightStart: number; rightEnd: number;
  count: number;
};

// Derive foldable regions from the hunk list + each side's total line count.
// Walks the equal gaps: before the first hunk, between hunks, and after the
// last. Leading/trailing gaps keep context only on the side facing a change.
function computeCollapseRegions(hunks: Hunk[], leftTotal: number, rightTotal: number): CollapseRegion[] {
  type Gap = { ls: number; le: number; rs: number; re: number; pos: 'lead' | 'mid' | 'trail' | 'all' };
  const gaps: Gap[] = [];
  if (hunks.length === 0) {
    gaps.push({ ls: 0, le: leftTotal - 1, rs: 0, re: rightTotal - 1, pos: 'all' });
  } else {
    gaps.push({ ls: 0, le: hunks[0].leftFirst - 1, rs: 0, re: hunks[0].rightFirst - 1, pos: 'lead' });
    for (let k = 0; k < hunks.length - 1; k++) {
      gaps.push({
        ls: hunks[k].leftLast + 1, le: hunks[k + 1].leftFirst - 1,
        rs: hunks[k].rightLast + 1, re: hunks[k + 1].rightFirst - 1, pos: 'mid'
      });
    }
    const last = hunks[hunks.length - 1];
    gaps.push({ ls: last.leftLast + 1, le: leftTotal - 1, rs: last.rightLast + 1, re: rightTotal - 1, pos: 'trail' });
  }

  const regions: CollapseRegion[] = [];
  for (const g of gaps) {
    const len = g.le - g.ls + 1;
    if (len <= 0) continue;
    // Equal regions must have matching length on both sides — bail if not.
    if (g.le - g.ls !== g.re - g.rs) continue;

    let hlStart: number, hlEnd: number, hrStart: number, hrEnd: number;
    if (g.pos === 'lead') {
      // Only a change below → keep context at the bottom, fold from the top.
      hlStart = g.ls; hlEnd = g.le - CONTEXT_LINES;
      hrStart = g.rs; hrEnd = g.re - CONTEXT_LINES;
    } else if (g.pos === 'trail') {
      // Only a change above → keep context at the top, fold to the end.
      hlStart = g.ls + CONTEXT_LINES; hlEnd = g.le;
      hrStart = g.rs + CONTEXT_LINES; hrEnd = g.re;
    } else {
      // Changes on both sides ('mid') or none at all ('all') → context both ends.
      hlStart = g.ls + CONTEXT_LINES; hlEnd = g.le - CONTEXT_LINES;
      hrStart = g.rs + CONTEXT_LINES; hrEnd = g.re - CONTEXT_LINES;
    }
    const count = hlEnd - hlStart + 1;
    if (count < COLLAPSE_MIN) continue;
    regions.push({ id: `${g.ls}:${g.le}`, leftStart: hlStart, leftEnd: hlEnd, rightStart: hrStart, rightEnd: hrEnd, count });
  }
  return regions;
}

// A display row is either a run of visible document lines or a single fold strip.
type DisplayItem =
  | { type: 'lines'; index: number; startLine: number; endLine: number; startRow: number }
  | { type: 'strip'; index: number; regionId: string; row: number; count: number };

type SideLayout = {
  items: DisplayItem[];
  totalRows: number;
  // rowOfLine[line] = display row of that line's top. rowOfLine[totalLines] = totalRows.
  // Hidden lines map to their strip's row.
  rowOfLine: number[];
  // lineOfRow[row] = document line at that display row (strip rows → first hidden line).
  lineOfRow: number[];
};

// Turn a side's line count + active (non-expanded) collapse regions into an
// ordered list of display items plus line↔row lookup tables.
function buildSideLayout(side: Side, totalLines: number, regions: CollapseRegion[]): SideLayout {
  const items: DisplayItem[] = [];
  const rowOfLine = new Array(Math.max(totalLines + 1, 1)).fill(0);
  const lineOfRow: number[] = [];

  const startOf = (r: CollapseRegion) => (side === 'left' ? r.leftStart : r.rightStart);
  const endOf = (r: CollapseRegion) => (side === 'left' ? r.leftEnd : r.rightEnd);
  const startMap = new Map<number, CollapseRegion>();
  for (const r of regions) startMap.set(startOf(r), r);
  const sortedStarts = regions.map(startOf).sort((a, b) => a - b);

  let row = 0, line = 0, index = 0;
  while (line < totalLines) {
    const r = startMap.get(line);
    if (r) {
      const e = endOf(r);
      items.push({ type: 'strip', index: index++, regionId: r.id, row, count: r.count });
      for (let l = line; l <= e; l++) rowOfLine[l] = row;
      lineOfRow[row] = line;
      row += 1;
      line = e + 1;
      continue;
    }
    // Emit the visible run up to the next fold start (or EOF).
    let nextStart = totalLines;
    for (const s of sortedStarts) { if (s > line) { nextStart = s; break; } }
    const segStart = line;
    const segEnd = nextStart - 1;
    items.push({ type: 'lines', index: index++, startLine: segStart, endLine: segEnd, startRow: row });
    for (let l = segStart; l <= segEnd; l++) { rowOfLine[l] = row + (l - segStart); lineOfRow[row + (l - segStart)] = l; }
    row += (segEnd - segStart + 1);
    line = segEnd + 1;
  }
  rowOfLine[totalLines] = row;
  // Keep an editable buffer for a fully-empty side.
  if (items.length === 0) items.push({ type: 'lines', index: 0, startLine: 0, endLine: -1, startRow: 0 });
  return { items, totalRows: row, rowOfLine, lineOfRow };
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
  searchMatch: string;
  searchCurrent: string;
  searchCurrentBorder: string;
};

// Imperative handle a pane exposes so the parent can focus a specific document
// line + selection range regardless of which segment textarea it lives in.
type PaneHandle = {
  focusRange: (line: number, start: number, end: number) => void;
};

// =============================================================================
// EditablePane — the side's document, split into one textarea per VISIBLE
// segment with clickable "⋯ N unchanged lines" fold strips between them. Per-
// line color bands and a line-number gutter sit behind as overlays. Everything
// is positioned in DISPLAY-ROW space (folded lines removed) via `layout`.
// =============================================================================
function EditablePane(props: {
  side: Side;
  text: string;
  onChange: (v: string) => void;
  hunks: Hunk[];
  layout: SideLayout;
  lineHeight: number;
  fontSize: number;
  colors: DiffColors;
  paneRef: React.RefObject<HTMLDivElement>;
  apiRef?: React.MutableRefObject<PaneHandle | null>;
  onScroll: (scrollTop: number, scrollLeft: number, fromSide: Side) => void;
  currentHunkIdx: number;
  toolbar: React.ReactNode;
  autoFocus?: boolean;
  /** Search matches on THIS side, and the index of the active one (-1 = none). */
  matches: Match[];
  currentMatchIdx: number;
  onFocusPane?: () => void;
  /** Focus left the pane's textareas — parent clears active-edit tracking. */
  onBlurPane?: () => void;
  /** Floating find bar for this side (or null when closed). */
  findBar?: React.ReactNode;
  /** Expand the collapsed region with this id (click on a fold strip). */
  onExpandRegion: (id: string) => void;
  /** Report the doc line the caret is editing, so the parent keeps that
   *  region from auto-collapsing while the user types in it. */
  onActiveLine?: (line: number) => void;
  /** Extra space appended below the document so both panes have matching
   *  total scroll heights — keeps scroll-sync aligned at the bottom. */
  bottomPadding: number;
}) {
  const {
    side, text, onChange, hunks, layout,
    lineHeight, fontSize, colors, paneRef, apiRef, onScroll,
    currentHunkIdx, toolbar, autoFocus, bottomPadding,
    matches, currentMatchIdx, onFocusPane, findBar, onExpandRegion, onActiveLine, onBlurPane
  } = props;

  const numColWidth = 50;
  const gutterFontSize = Math.max(10, fontSize - 2);
  const textPadding = 24; // 12px left + 12px right on the textarea

  const totalLines = text === '' ? 0 : text.split('\n').length;
  const { rowOfLine, totalRows } = layout;
  const docHeight = Math.max(totalRows * lineHeight, 0);

  const docLines = useMemo(() => text.split('\n'), [text]);

  // A line is folded away when its display row is a strip row (which reports
  // the region's first line, not this line).
  const isHidden = useCallback((line: number): boolean => {
    const row = rowOfLine[line];
    return layout.lineOfRow[row] !== line;
  }, [rowOfLine, layout.lineOfRow]);

  // Per-segment textarea elements, keyed by display item index. Lets the
  // parent (and internal helpers) focus the right box for a given line.
  const segEls = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  // Absolute document caret offset pending restoration after an edit re-diffs
  // and possibly re-segments the pane (see the useLayoutEffect below).
  const pendingCaretRef = useRef<number | null>(null);

  // Rebuild each visible segment's text from the current document lines.
  const segmentText = useCallback((startLine: number, endLine: number): string => {
    if (endLine < startLine) return '';
    return docLines.slice(startLine, endLine + 1).join('\n');
  }, [docLines]);

  // Splice an edited segment back into the whole document, then bubble up.
  // Also record the caret's new ABSOLUTE document offset so the layout effect
  // can restore it after the re-diff possibly re-segments the pane.
  const handleSegmentChange = useCallback((startLine: number, endLine: number, el: HTMLTextAreaElement) => {
    const value = el.value;
    const before = docLines.slice(0, startLine);
    const after = endLine < startLine ? docLines.slice(startLine) : docLines.slice(endLine + 1);
    // Absolute offset of the caret in the whole document = (chars in all lines
    // before this segment) + (caret offset within the segment).
    let segStartOffset = 0;
    for (let i = 0; i < startLine; i++) segStartOffset += (docLines[i]?.length ?? 0) + 1;
    pendingCaretRef.current = segStartOffset + el.selectionStart;
    // Report the doc line the caret sits on so the parent can keep that
    // region unfolded — otherwise an edit that makes the region "unchanged"
    // would collapse it out from under the cursor.
    const caretDocLine = startLine + (value.slice(0, el.selectionStart).split('\n').length - 1);
    onActiveLine?.(caretDocLine);
    onChange([...before, ...value.split('\n'), ...after].join('\n'));
  }, [docLines, onChange, onActiveLine]);

  // Locate the segment holding `line`, focus its textarea and select [start,end].
  const focusRange = useCallback((line: number, start: number, end: number) => {
    const item = layout.items.find(it => it.type === 'lines' && line >= it.startLine && line <= it.endLine) as
      Extract<DisplayItem, { type: 'lines' }> | undefined;
    const target = item ?? (layout.items.find(it => it.type === 'lines') as Extract<DisplayItem, { type: 'lines' }> | undefined);
    if (!target) return;
    const el = segEls.current.get(target.index);
    if (!el) return;
    let offset = 0;
    for (let i = target.startLine; i < line && i <= target.endLine; i++) offset += (docLines[i]?.length ?? 0) + 1;
    el.focus({ preventScroll: true });
    el.setSelectionRange(offset + start, offset + end);
  }, [layout.items, docLines]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { focusRange };
    return () => { if (apiRef.current?.focusRange === focusRange) apiRef.current = null; };
  }, [apiRef, focusRange]);

  // Track the scroll container's inner width/height so short documents still
  // fill the pane (no phantom horizontal scroll, and the last segment stretches
  // to fill the blank area below the text so clicks there still land a caret).
  const [availWidth, setAvailWidth] = useState(0);
  const [availHeight, setAvailHeight] = useState(0);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => { setAvailWidth(el.clientWidth); setAvailHeight(el.clientHeight); };
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

  // Index of the last visible text segment — its textarea is stretched to fill
  // the empty area below the document so clicking anywhere in the blank space
  // still lands a caret (instead of doing nothing).
  const lastLinesIndex = useMemo(() => {
    let idx = -1;
    for (const it of layout.items) if (it.type === 'lines') idx = it.index;
    return idx;
  }, [layout.items]);

  // The left pane is laid out row-reverse (its gutter hugs the center ribbon).
  // A row-reverse flex container anchors its scroll to the RIGHT edge, so any
  // relayout — e.g. editing a long diff line away — makes Chrome snap the
  // horizontal scrollbar to the far right. We track the intended scrollLeft on
  // every scroll and reassert it synchronously after each render (before paint)
  // so the left pane keeps the user's horizontal position instead of jumping.
  const hScrollRef = useRef(0);
  const handlePaneScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    hScrollRef.current = e.currentTarget.scrollLeft;
    onScroll(e.currentTarget.scrollTop, e.currentTarget.scrollLeft, side);
  }, [onScroll, side]);
  useLayoutEffect(() => {
    if (side !== 'left') return;
    const el = paneRef.current;
    if (el && Math.abs(el.scrollLeft - hScrollRef.current) > 1) {
      el.scrollLeft = hScrollRef.current;
    }
  });

  // Restore the text caret after an edit. Every keystroke re-diffs, which can
  // re-segment the pane (segments mount/unmount) and drop the native caret.
  // We stash the caret's ABSOLUTE document offset on edit and, after the
  // re-render, map it back to whichever segment now holds it. Absolute offset
  // survives re-segmentation; a per-segment index would not.
  useLayoutEffect(() => {
    const off = pendingCaretRef.current;
    if (off == null) return;
    pendingCaretRef.current = null;

    // Absolute offset → (doc line, column).
    let acc = 0, lineIdx = 0, col = 0;
    for (let i = 0; i < docLines.length; i++) {
      const len = docLines[i].length;
      if (off <= acc + len) { lineIdx = i; col = off - acc; break; }
      acc += len + 1;
      lineIdx = i; col = len;
    }
    // Find the visible segment holding that line (edited lines are inside a
    // change hunk, which is never folded, so this normally hits directly).
    const target = layout.items.find(
      it => it.type === 'lines' && lineIdx >= it.startLine && lineIdx <= it.endLine
    ) as Extract<DisplayItem, { type: 'lines' }> | undefined;
    if (!target) return;
    const el = segEls.current.get(target.index);
    if (!el) return;
    let within = 0;
    for (let i = target.startLine; i < lineIdx; i++) within += (docLines[i]?.length ?? 0) + 1;
    within += col;
    el.focus({ preventScroll: true });
    el.setSelectionRange(within, within);
  }, [docLines, layout]);

  // Pixel rects for each search match, positioned with the same canvas metrics
  // used for column width so CJK/wide glyphs and tabs land correctly. x is the
  // width of the text before the match; width is the matched substring's width.
  // `top` is in DISPLAY-ROW space; matches on folded lines are dropped.
  const matchRects = useMemo(() => {
    if (matches.length === 0 || typeof document === 'undefined') return [];
    const canvas = measureCanvasRef.current || document.createElement('canvas');
    measureCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    const tab = '  ';
    const lines = text.split('\n');
    const expand = (s: string) => (s.indexOf('\t') >= 0 ? s.replace(/\t/g, tab) : s);
    return matches
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !isHidden(m.line))
      .map(({ m, i }) => {
        const raw = lines[m.line] ?? '';
        const before = expand(raw.slice(0, m.start));
        const inner = expand(raw.slice(m.start, m.end));
        const x = 12 + ctx.measureText(before).width; // 12 = textarea left padding
        const w = Math.max(1, ctx.measureText(inner).width);
        return { x, w, top: rowOfLine[m.line] * lineHeight, current: i === currentMatchIdx };
      });
  }, [matches, currentMatchIdx, text, fontSize, lineHeight, rowOfLine, isHidden]);

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
        out.push({ y: rowOfLine[h.leftFirst] * lineHeight, color: colors.addStrong });
      } else if (side === 'right' && h.kind === 'remove') {
        out.push({ y: rowOfLine[h.rightFirst] * lineHeight, color: colors.removeStrong });
      }
    }
    return out;
  }, [hunks, side, lineHeight, rowOfLine, colors.addStrong, colors.removeStrong]);

  // currentHunkIdx is currently unreferenced — silence unused warnings.
  void currentHunkIdx;

  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
      background: colors.panelBg, position: 'relative'
    }}>
      {toolbar}
      {findBar}
      <div
        ref={paneRef}
        onScroll={handlePaneScroll}
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
              the inner edge so numbers stay visible during horizontal scroll.
              Positioned in DISPLAY-ROW space; folded lines are omitted and the
              fold strip gets its own gutter row. */}
          <div style={{
            width: numColWidth, flexShrink: 0,
            position: 'sticky',
            [side === 'left' ? 'right' : 'left']: 0,
            zIndex: 3,
            alignSelf: 'stretch',
            background: colors.gutterBg,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {layout.items.map(item => {
              if (item.type === 'strip') {
                return (
                  <div
                    key={`g-strip-${item.index}`}
                    style={{
                      position: 'absolute',
                      top: item.row * lineHeight,
                      left: 0, right: 0,
                      height: lineHeight,
                      background: colors.gutterBg
                    }}
                  />
                );
              }
              const rows = [];
              for (let ln = item.startLine; ln <= item.endLine; ln++) {
                const k = lineKinds[ln] ?? 'equal';
                rows.push(
                  <div
                    key={`g-${ln}`}
                    style={{
                      position: 'absolute',
                      top: rowOfLine[ln] * lineHeight,
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
                    {ln + 1}
                  </div>
                );
              }
              return rows;
            })}
          </div>

          {/* Text area + per-line color bands behind it */}
          <div style={{ position: 'relative', width: colWidth, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none'
            }}>
              {layout.items.map(item => {
                if (item.type !== 'lines') return null;
                const bands = [];
                for (let ln = item.startLine; ln <= item.endLine; ln++) {
                  const k = lineKinds[ln] ?? 'equal';
                  if (k === 'equal') continue;
                  bands.push(
                    <div
                      key={`b-${ln}`}
                      style={{
                        position: 'absolute',
                        top: rowOfLine[ln] * lineHeight,
                        left: 0, right: 0,
                        height: lineHeight,
                        background: lineBg(k)
                      }}
                    />
                  );
                }
                return bands;
              })}
            </div>
            {/* Search-match highlight overlay — sits above the color bands but
                below the (transparent) textarea, so the text stays readable. */}
            {matchRects.length > 0 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                {matchRects.map((r, i) => (
                  <div
                    key={`sm-${i}`}
                    style={{
                      position: 'absolute',
                      top: r.top,
                      left: r.x,
                      width: r.w,
                      height: lineHeight,
                      background: r.current ? colors.searchCurrent : colors.searchMatch,
                      borderRadius: 2,
                      boxShadow: r.current ? `0 0 0 1px ${colors.searchCurrentBorder}` : 'none'
                    }}
                  />
                ))}
              </div>
            )}
            {/* One textarea per visible segment, positioned at its display row.
                Fold strips render as clickable "⋯ N unchanged lines" bands. */}
            {layout.items.map(item => {
              if (item.type === 'strip') {
                return (
                  <div
                    key={`strip-${item.index}`}
                    className="dv-fold-strip"
                    onClick={() => onExpandRegion(item.regionId)}
                    title="Click to expand unchanged lines"
                    style={{
                      position: 'absolute', zIndex: 2,
                      top: item.row * lineHeight,
                      left: 0, right: 0,
                      height: lineHeight,
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '0 12px',
                      fontSize: Math.max(10, fontSize - 2),
                      lineHeight: `${lineHeight}px`
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="7 8 3 12 7 16"></polyline>
                      <polyline points="17 8 21 12 17 16"></polyline>
                    </svg>
                    {item.count} unchanged {item.count === 1 ? 'line' : 'lines'}
                  </div>
                );
              }
              const segStartRow = item.startRow;
              // The last visible segment stretches to cover the blank area below
              // the document (down to the bottom of the scroll viewport, or the
              // document's natural end — whichever is lower) so a click anywhere
              // in the empty space still focuses this textarea and places a caret.
              const naturalHeight = Math.max((item.endLine - item.startLine + 1) * lineHeight, lineHeight);
              const segHeight = item.index === lastLinesIndex
                ? Math.max(naturalHeight, availHeight - segStartRow * lineHeight)
                : naturalHeight;
              return (
                <textarea
                  key={`seg-${item.index}`}
                  ref={el => { if (el) segEls.current.set(item.index, el); else segEls.current.delete(item.index); }}
                  autoFocus={autoFocus && item.index === 0}
                  value={segmentText(item.startLine, item.endLine)}
                  onChange={e => handleSegmentChange(item.startLine, item.endLine, e.target)}
                  onFocus={onFocusPane}
                  onBlur={() => {
                    // A re-diff can remount this textarea (the caret is
                    // restored right after), which fires a transient blur.
                    // Defer and only clear active-edit tracking if focus has
                    // genuinely left every segment in this pane.
                    requestAnimationFrame(() => {
                      const active = typeof document !== 'undefined' ? document.activeElement : null;
                      for (const el of segEls.current.values()) {
                        if (el === active) return;
                      }
                      onBlurPane?.();
                    });
                  }}
                  placeholder={layout.items.length === 1 ? `${side === 'left' ? 'Left' : 'Right'} side — type or pick a file…` : undefined}
                  spellCheck={false}
                  wrap="off"
                  style={{
                    position: 'absolute', zIndex: 1,
                    top: segStartRow * lineHeight,
                    left: 0, right: 0,
                    width: '100%',
                    height: segHeight,
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ConnectorRibbon — IDEA-style middle strip. Draws a tinted trapezoid (or thin
// line for pure insertions/deletions) between corresponding left/right hunk
// regions, accounting for the current scroll positions of each pane. The wavy
// fold seams are drawn separately by SeamOverlay (a single full-width path) so
// they stay continuous across the pane/ribbon boundaries.
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
  /** Convert a document line to its display-row top on each side. */
  leftRowOfLine: number[];
  rightRowOfLine: number[];
}) {
  const {
    width, height, hunks, currentHunkIdx, lineHeight,
    leftScrollTop, rightScrollTop, colors, onHunkClick,
    leftRowOfLine, rightRowOfLine
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
        // Y in local pane viewport coordinates, in DISPLAY-ROW space (folded
        // lines removed) after subtracting scrollTop.
        const lTop = leftRowOfLine[h.leftFirst] * lineHeight - leftScrollTop;
        const lBot = leftRowOfLine[h.leftLast + 1] * lineHeight - leftScrollTop;
        const rTop = rightRowOfLine[h.rightFirst] * lineHeight - rightScrollTop;
        const rBot = rightRowOfLine[h.rightLast + 1] * lineHeight - rightScrollTop;

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

// =============================================================================
// SeamOverlay — a SINGLE full-width overlay that draws the torn-seam wave for
// every collapsed "unchanged" region. Each region's top and bottom edges are
// drawn as ONE continuous path spanning left pane → ribbon gap → right pane,
// with the sine phase anchored to the body's x=0. Because there is exactly one
// path per edge (not one-per-pane-plus-one-in-the-ribbon, each with its own
// phase origin), the wave never breaks at the pane/ribbon boundaries.
//
// The panes and ribbon render only the flat fold-strip *background*; this
// overlay is the sole source of the wavy edges, so nothing can fall out of
// phase with it.
// =============================================================================
function SeamOverlay(props: {
  width: number;
  height: number;
  ribbonWidth: number;
  lineHeight: number;
  collapseRegions: CollapseRegion[];
  leftRowOfLine: number[];
  rightRowOfLine: number[];
  leftScrollTop: number;
  rightScrollTop: number;
  colors: DiffColors;
}) {
  const {
    width, height, ribbonWidth, lineHeight, collapseRegions,
    leftRowOfLine, rightRowOfLine, leftScrollTop, rightScrollTop, colors
  } = props;
  if (width <= 0) return null;

  // x-zones across the body: [0, paneW] left pane, [paneW, ribbonEnd] ribbon
  // gap, [ribbonEnd, width] right pane.
  const paneW = (width - ribbonWidth) / 2;
  const ribbonEnd = paneW + ribbonWidth;
  const period = 8;   // px per wave cycle (matches the old pane/ribbon waves)
  const amp = 1.6;    // wave amplitude
  const steps = Math.max(2, Math.round(width / 2));

  // Baseline y at x: flat at the left value across the left pane, flat at the
  // right value across the right pane, linearly interpolated across the ribbon.
  const baseAt = (x: number, lv: number, rv: number): number => {
    if (x <= paneW) return lv;
    if (x >= ribbonEnd) return rv;
    return lv + (rv - lv) * ((x - paneW) / ribbonWidth);
  };
  const waveY = (x: number, lv: number, rv: number): number =>
    baseAt(x, lv, rv) + Math.sin((x / period) * Math.PI * 2) * amp;
  const edgePath = (lv: number, rv: number): string => {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${waveY(x, lv, rv).toFixed(2)} `;
    }
    return d;
  };

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {collapseRegions.map(r => {
        const lTop = leftRowOfLine[r.leftStart] * lineHeight - leftScrollTop;
        const rTop = rightRowOfLine[r.rightStart] * lineHeight - rightScrollTop;
        const lBot = lTop + lineHeight;
        const rBot = rTop + lineHeight;
        if (Math.max(lBot, rBot) < -20 || Math.min(lTop, rTop) > height + 20) return null;

        // Fill the ribbon-gap slice of the band so the fold reads as continuous
        // colour across the gap (the panes fill their own slices). Sampled only
        // within [paneW, ribbonEnd] so we never paint over pane text.
        const gsteps = Math.max(2, Math.round(ribbonWidth / 2));
        const top: string[] = [];
        const bot: string[] = [];
        for (let i = 0; i <= gsteps; i++) {
          const x = paneW + (ribbonEnd - paneW) * (i / gsteps);
          top.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${waveY(x, lTop, rTop).toFixed(2)}`);
          bot.push(`L ${x.toFixed(2)} ${waveY(x, lBot, rBot).toFixed(2)}`);
        }
        const gapFill = `${top.join(' ')} ${[...bot].reverse().join(' ')} Z`;

        return (
          <g key={`seam-${r.id}`}>
            <path d={gapFill} fill={colors.gutterBg} />
            <path d={edgePath(lTop, rTop)} fill="none" stroke={colors.accent} strokeWidth={1} opacity={0.9} />
            <path d={edgePath(lBot, rBot)} fill="none" stroke={colors.accent} strokeWidth={1} opacity={0.9} />
          </g>
        );
      })}
    </svg>
  );
}

export default function DiffViewer({ notes, currentNote, theme = 'dark', fontSize = 13, onSaveNote, onClose }: Props) {
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

  // Independent find state per side.
  const [leftSearch, setLeftSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [rightSearch, setRightSearch] = useState<SearchState>(EMPTY_SEARCH);
  // Which pane last had focus — Ctrl+F targets it (defaults to right).
  const [focusedSide, setFocusedSide] = useState<Side>('right');
  const leftFindInputRef = useRef<HTMLInputElement>(null);
  const rightFindInputRef = useRef<HTMLInputElement>(null);

  const [currentHunkIdx, setCurrentHunkIdx] = useState<number>(-1);
  const [formatError, setFormatError] = useState<{ side: Side; message: string } | null>(null);

  // Collapse-unchanged-fragments state. `collapseOn` toggles the whole feature
  // (default on, like IDEA). `expanded` holds region ids the user has manually
  // opened back up.
  const [collapseOn, setCollapseOn] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // The side + doc line the user is actively editing. Any collapse region
  // spanning this line stays unfolded so an edit that makes the region match
  // the other side doesn't collapse it out from under the cursor. Cleared
  // when focus leaves the pane.
  const [activeEdit, setActiveEdit] = useState<{ side: Side; line: number } | null>(null);

  // Scroll state used by both ribbon SVG and cross-pane sync.
  const [leftScrollTop, setLeftScrollTop] = useState(0);
  const [rightScrollTop, setRightScrollTop] = useState(0);
  const [ribbonHeight, setRibbonHeight] = useState(0);
  // Full body width — the single full-width seam overlay uses it to place its
  // per-pane and ribbon-gap segments so the fold edge reads as one line.
  const [bodyWidth, setBodyWidth] = useState(0);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const leftApiRef = useRef<PaneHandle | null>(null);
  const rightApiRef = useRef<PaneHandle | null>(null);
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

  const leftTotalLines = leftText === '' ? 0 : leftText.split('\n').length;
  const rightTotalLines = rightText === '' ? 0 : rightText.split('\n').length;

  // Foldable equal regions, minus any the user has expanded (or all, when the
  // collapse toggle is off).
  const collapseRegions = useMemo(() => {
    if (!collapseOn) return [];
    const all = computeCollapseRegions(hunks, leftTotalLines, rightTotalLines);
    return all.filter(r => {
      if (expanded.has(r.id)) return false;
      // Keep the region the user is currently editing unfolded.
      if (activeEdit) {
        const s = activeEdit.side === 'left' ? r.leftStart : r.rightStart;
        const e = activeEdit.side === 'left' ? r.leftEnd : r.rightEnd;
        if (activeEdit.line >= s && activeEdit.line <= e) return false;
      }
      return true;
    });
  }, [collapseOn, hunks, leftTotalLines, rightTotalLines, expanded, activeEdit]);

  const leftLayout = useMemo(
    () => buildSideLayout('left', leftTotalLines, collapseRegions),
    [leftTotalLines, collapseRegions]
  );
  const rightLayout = useMemo(
    () => buildSideLayout('right', rightTotalLines, collapseRegions),
    [rightTotalLines, collapseRegions]
  );

  // Total foldable regions available (ignoring current expand state) — used to
  // decide whether to show the "expand all" affordance.
  const foldableCount = useMemo(
    () => computeCollapseRegions(hunks, leftTotalLines, rightTotalLines).length,
    [hunks, leftTotalLines, rightTotalLines]
  );

  const expandRegion = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    setCurrentHunkIdx(hunks.length > 0 ? 0 : -1);
  }, [hunks.length]);

  // Search matches per side. Recomputed when the text, query, or case-mode
  // changes.
  const leftMatches = useMemo(
    () => findMatches(leftText, leftSearch.query, leftSearch.caseSensitive),
    [leftText, leftSearch.query, leftSearch.caseSensitive]
  );
  const rightMatches = useMemo(
    () => findMatches(rightText, rightSearch.query, rightSearch.caseSensitive),
    [rightText, rightSearch.query, rightSearch.caseSensitive]
  );

  // Keep each side's currentIdx within range as matches change. When the set
  // becomes empty → -1; otherwise clamp into [0, len).
  useEffect(() => {
    setLeftSearch(s => {
      const idx = leftMatches.length === 0 ? -1 : Math.min(Math.max(s.currentIdx, 0), leftMatches.length - 1);
      return idx === s.currentIdx ? s : { ...s, currentIdx: idx };
    });
  }, [leftMatches.length]);
  useEffect(() => {
    setRightSearch(s => {
      const idx = rightMatches.length === 0 ? -1 : Math.min(Math.max(s.currentIdx, 0), rightMatches.length - 1);
      return idx === s.currentIdx ? s : { ...s, currentIdx: idx };
    });
  }, [rightMatches.length]);

  // Scroll a pane so the given match is comfortably in view and select its
  // range via the pane's segment-aware handle. If the match sits inside a
  // folded region, expand that region first so it becomes reachable.
  const revealMatch = useCallback((side: Side, m: Match | undefined) => {
    if (!m) return;
    const layout = side === 'left' ? leftLayout : rightLayout;
    const startLine = side === 'left' ? 'leftStart' : 'rightStart';
    const endLine = side === 'left' ? 'leftEnd' : 'rightEnd';
    // Is the match line currently folded? (Its display row is a strip row.)
    const row = layout.rowOfLine[m.line];
    const hidden = layout.lineOfRow[row] !== m.line;
    if (hidden) {
      const region = collapseRegions.find(r => m.line >= (r as any)[startLine] && m.line <= (r as any)[endLine]);
      if (region) { expandRegion(region.id); return; } // re-run after layout updates
    }
    const paneRef = side === 'left' ? leftPaneRef : rightPaneRef;
    const api = side === 'left' ? leftApiRef : rightApiRef;
    requestAnimationFrame(() => {
      const pane = paneRef.current;
      if (pane) {
        const y = layout.rowOfLine[m.line] * lineHeight;
        const top = Math.max(0, y - pane.clientHeight / 3);
        pane.scrollTo({ top, behavior: 'smooth' });
      }
      api.current?.focusRange(m.line, m.start, m.end);
    });
  }, [leftLayout, rightLayout, collapseRegions, expandRegion, lineHeight]);

  // Move to prev/next match on a side (wraps around).
  const stepMatch = useCallback((side: Side, dir: 1 | -1) => {
    const matches = side === 'left' ? leftMatches : rightMatches;
    if (matches.length === 0) return;
    const setSearch = side === 'left' ? setLeftSearch : setRightSearch;
    setSearch(s => {
      const base = s.currentIdx < 0 ? (dir === 1 ? -1 : 0) : s.currentIdx;
      const next = (base + dir + matches.length) % matches.length;
      revealMatch(side, matches[next]);
      return { ...s, currentIdx: next };
    });
  }, [leftMatches, rightMatches, revealMatch]);

  // Open the find bar for a side and focus its input.
  const openFind = useCallback((side: Side) => {
    const setSearch = side === 'left' ? setLeftSearch : setRightSearch;
    setSearch(s => ({ ...s, open: true }));
    requestAnimationFrame(() => {
      const input = side === 'left' ? leftFindInputRef.current : rightFindInputRef.current;
      input?.focus();
      input?.select();
    });
  }, []);

  const closeFind = useCallback((side: Side) => {
    const setSearch = side === 'left' ? setLeftSearch : setRightSearch;
    setSearch(s => ({ ...s, open: false }));
  }, []);

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
    const update = () => {
      setRibbonHeight(el.clientHeight - 36 /* toolbar */);
      setBodyWidth(el.clientWidth);
    };
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
        // scrollTop is in display-row space. Convert to a document line on the
        // source side, map that through the hunks, then convert the result to
        // the OTHER side's display-row space. Fractional part is preserved so
        // scrolling stays smooth inside a segment.
        const fromLayout = fromSide === 'left' ? leftLayout : rightLayout;
        const otherLayout = fromSide === 'left' ? rightLayout : leftLayout;
        const fromRow = scrollTop / lineHeight;
        const rowInt = Math.floor(fromRow);
        const frac = fromRow - rowInt;
        const fromLine = (fromLayout.lineOfRow[rowInt] ?? rowInt) + frac;
        const toLine = mapLineToOther(fromLine, fromSide);
        const toInt = Math.floor(toLine);
        const toFrac = toLine - toInt;
        const otherRow = (otherLayout.rowOfLine[toInt] ?? toInt) + toFrac;
        target = Math.max(0, Math.min(otherMax, otherRow * lineHeight));
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
  }, [lineHeight, mapLineToOther, leftLayout, rightLayout]);

  const scrollToHunk = useCallback((idx: number) => {
    if (idx < 0 || idx >= hunks.length) return;
    const h = hunks[idx];
    requestAnimationFrame(() => {
      // Hunk edges are never folded (folding keeps CONTEXT lines around each
      // change), so map to display rows directly.
      const lRow = leftLayout.rowOfLine[h.leftFirst] ?? h.leftFirst;
      const rRow = rightLayout.rowOfLine[h.rightFirst] ?? h.rightFirst;
      if (leftPaneRef.current) {
        const target = Math.max(0, lRow * lineHeight - leftPaneRef.current.clientHeight / 3);
        leftPaneRef.current.scrollTo({ top: target, behavior: 'smooth' });
      }
      if (rightPaneRef.current) {
        const target = Math.max(0, rRow * lineHeight - rightPaneRef.current.clientHeight / 3);
        rightPaneRef.current.scrollTo({ top: target, behavior: 'smooth' });
      }
      // Move the caret to the start of the corresponding line on the RIGHT
      // pane so the user can start editing the diff target immediately.
      const lines = rightText.split('\n');
      const targetLine = Math.min(Math.max(0, h.rightFirst), Math.max(0, lines.length - 1));
      rightApiRef.current?.focusRange(targetLine, 0, 0);
    });
  }, [hunks, lineHeight, rightText, leftLayout, rightLayout]);

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
      // Ctrl/Cmd+F opens the find bar for the last-focused pane.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        openFind(focusedSide);
        return;
      }
      if (e.key === 'Escape') {
        if (leftSearch.open) { closeFind('left'); return; }
        if (rightSearch.open) { closeFind('right'); return; }
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
  }, [onClose, pickerSide, goPrevDiff, goNextDiff, openFind, closeFind, focusedSide, leftSearch.open, rightSearch.open]);

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
    pickerItemHover: 'rgba(59, 130, 246, 0.15)',
    searchMatch: 'rgba(250, 204, 21, 0.28)',
    searchCurrent: 'rgba(249, 115, 22, 0.45)',
    searchCurrentBorder: '#fb923c'
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
    pickerItemHover: 'rgba(59, 130, 246, 0.10)',
    searchMatch: 'rgba(250, 204, 21, 0.45)',
    searchCurrent: 'rgba(249, 115, 22, 0.55)',
    searchCurrentBorder: '#ea580c'
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

  // Persist edits back to the note a side was loaded from. Blank (scratch)
  // sides have no backing note, so their edits stay local to the diff view.
  const handleTextChange = (side: Side, value: string) => {
    const src = side === 'left' ? leftSrc : rightSrc;
    if (side === 'left') setLeftText(value);
    else setRightText(value);
    if (src.kind === 'note') onSaveNote?.(src.noteId, value);
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
      handleTextChange(side, formatted);
      setFormatError(null);
      // Formatting widens the content. The left pane is laid out row-reverse,
      // so Chrome keeps its right-edge anchor and snaps the horizontal
      // scrollbar to the far right. Pull both panes back to the leftmost
      // column (scrollLeft 0) once the new width is measured.
      requestAnimationFrame(() => {
        if (leftPaneRef.current) leftPaneRef.current.scrollLeft = 0;
        if (rightPaneRef.current) rightPaneRef.current.scrollLeft = 0;
      });
    } catch (e: any) {
      setFormatError({ side, message: 'Invalid JSON' });
    }
  };

  const clearSide = (side: Side) => {
    // Detach into a blank scratch buffer. Does NOT wipe the backing note —
    // to edit a note's content, type in the pane instead.
    if (side === 'left') {
      setLeftText('');
      setLeftSrc({ kind: 'blank' });
    } else {
      setRightText('');
      setRightSrc({ kind: 'blank' });
    }
  };

  // Floating find bar for a side — anchored top-right of the pane's scroll
  // area. Rendered only when that side's search is open.
  const findBar = (side: Side) => {
    const search = side === 'left' ? leftSearch : rightSearch;
    if (!search.open) return null;
    const matches = side === 'left' ? leftMatches : rightMatches;
    const setSearch = side === 'left' ? setLeftSearch : setRightSearch;
    const inputRef = side === 'left' ? leftFindInputRef : rightFindInputRef;
    const total = matches.length;
    const pos = total === 0 ? 0 : search.currentIdx + 1;
    return (
      <div className="dv-find-bar" onMouseDown={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="dv-find-input"
          placeholder="Find…"
          value={search.query}
          onChange={e => setSearch(s => ({ ...s, query: e.target.value, currentIdx: e.target.value ? 0 : -1 }))}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); stepMatch(side, e.shiftKey ? -1 : 1); }
            else if (e.key === 'Escape') { e.preventDefault(); closeFind(side); }
            else if (e.key === 'F3') { e.preventDefault(); stepMatch(side, e.shiftKey ? -1 : 1); }
          }}
        />
        <span className="dv-find-count">
          {search.query ? `${pos} / ${total}` : ''}
        </span>
        <button
          className={`dv-find-toggle${search.caseSensitive ? ' active' : ''}`}
          onClick={() => setSearch(s => ({ ...s, caseSensitive: !s.caseSensitive }))}
          title="Match case"
        >
          Aa
        </button>
        <button className="dv-find-nav" onClick={() => stepMatch(side, -1)} disabled={total === 0} title="Previous (Shift+Enter)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
        <button className="dv-find-nav" onClick={() => stepMatch(side, 1)} disabled={total === 0} title="Next (Enter)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <button className="dv-find-nav" onClick={() => closeFind(side)} title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    );
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
        <button className="dv-mini-btn" onClick={() => openFind(side)} title="Find (Ctrl+F)">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Find
        </button>
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
        .dv-toggle-btn {
          height: 30px; padding: 0 11px; border-radius: 7px;
          border: 1px solid ${colors.border}; background: transparent;
          color: ${colors.textSec}; font-size: 12px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
          transition: all 0.15s; outline: none; white-space: nowrap;
        }
        .dv-toggle-btn:hover {
          color: ${colors.text}; border-color: ${colors.borderStrong};
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'};
        }
        .dv-toggle-btn.active {
          color: ${colors.accent}; border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.10)' : 'rgba(59, 130, 246, 0.06)'};
        }
        /* Collapsed-fragment strip inside a pane's text column. The wavy
           top/bottom edges are drawn by the full-width SeamOverlay, so this
           only carries the flat fill + hover. */
        .dv-fold-strip {
          cursor: pointer;
          color: ${colors.textSec};
          background-color: ${theme === 'dark' ? 'rgba(148, 163, 184, 0.07)' : 'rgba(15, 23, 42, 0.04)'};
          font-weight: 700;
          user-select: none;
          transition: background-color 0.12s, color 0.12s;
        }
        .dv-fold-strip:hover {
          color: ${colors.accent};
          background-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.08)'};
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
        .dv-find-bar {
          position: absolute; top: 8px; right: 16px; z-index: 20;
          display: flex; align-items: center; gap: 4px;
          padding: 4px 6px; border-radius: 9px;
          background: ${colors.pickerBg}; backdrop-filter: blur(18px);
          border: 1px solid ${colors.borderStrong};
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
          animation: diffSlide 0.15s ease-out;
        }
        .dv-find-input {
          width: 168px; height: 26px; padding: 0 8px;
          border: 1px solid ${colors.border}; border-radius: 6px;
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'};
          color: ${colors.text}; font-size: 12px; font-weight: 600;
          outline: none; transition: border-color 0.15s;
        }
        .dv-find-input:focus { border-color: ${colors.accent}; }
        .dv-find-input::placeholder { color: ${colors.textDim}; }
        .dv-find-count {
          min-width: 46px; text-align: center; font-size: 11px; font-weight: 700;
          color: ${colors.textSec}; font-variant-numeric: tabular-nums;
        }
        .dv-find-toggle {
          height: 24px; min-width: 26px; padding: 0 6px; border-radius: 6px;
          border: 1px solid ${colors.border}; background: transparent;
          color: ${colors.textSec}; font-size: 11px; font-weight: 800;
          cursor: pointer; transition: all 0.15s;
        }
        .dv-find-toggle:hover { color: ${colors.text}; border-color: ${colors.borderStrong}; }
        .dv-find-toggle.active {
          color: white; background: ${colors.accent}; border-color: ${colors.accent};
        }
        .dv-find-nav {
          width: 24px; height: 24px; border-radius: 6px;
          border: 1px solid transparent; background: transparent;
          color: ${colors.textSec}; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .dv-find-nav:hover:not(:disabled) { color: ${colors.accent}; background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.10)' : 'rgba(59, 130, 246, 0.06)'}; }
        .dv-find-nav:disabled { opacity: 0.35; cursor: not-allowed; }
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

          <button
            className={`dv-toggle-btn${collapseOn ? ' active' : ''}`}
            onClick={() => { setCollapseOn(v => !v); setExpanded(new Set()); }}
            disabled={foldableCount === 0}
            style={foldableCount === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            title="Collapse unchanged fragments"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            {collapseOn ? 'Unchanged: collapsed' : 'Unchanged: shown'}
          </button>

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
          onChange={v => handleTextChange('left', v)}
          hunks={hunks}
          layout={leftLayout}
          lineHeight={lineHeight}
          fontSize={fontSize}
          colors={colors}
          paneRef={leftPaneRef}
          apiRef={leftApiRef}
          onScroll={handleScroll}
          currentHunkIdx={currentHunkIdx}
          toolbar={editToolbar('left')}
          bottomPadding={leftBottomPad}
          matches={leftMatches}
          currentMatchIdx={leftSearch.currentIdx}
          onFocusPane={() => setFocusedSide('left')}
          findBar={findBar('left')}
          onExpandRegion={expandRegion}
          onActiveLine={line => setActiveEdit({ side: 'left', line })}
          onBlurPane={() => setActiveEdit(a => (a?.side === 'left' ? null : a))}
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
              leftRowOfLine={leftLayout.rowOfLine}
              rightRowOfLine={rightLayout.rowOfLine}
            />
          </div>
        </div>

        <EditablePane
          side="right"
          text={rightText}
          onChange={v => handleTextChange('right', v)}
          hunks={hunks}
          layout={rightLayout}
          lineHeight={lineHeight}
          fontSize={fontSize}
          colors={colors}
          paneRef={rightPaneRef}
          apiRef={rightApiRef}
          onScroll={handleScroll}
          currentHunkIdx={currentHunkIdx}
          toolbar={editToolbar('right')}
          bottomPadding={rightBottomPad}
          matches={rightMatches}
          currentMatchIdx={rightSearch.currentIdx}
          onFocusPane={() => setFocusedSide('right')}
          findBar={findBar('right')}
          onExpandRegion={expandRegion}
          onActiveLine={line => setActiveEdit({ side: 'right', line })}
          onBlurPane={() => setActiveEdit(a => (a?.side === 'right' ? null : a))}
          autoFocus
        />

        {/* Fold-seam overlay — one full-width layer drawing every collapsed
            region's wavy top/bottom edge as a single continuous path across
            both panes and the ribbon gap. Sits below the toolbars (top: 36)
            and is click-through so it never blocks the panes or ribbon. */}
        <div style={{
          position: 'absolute',
          top: 36, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none', zIndex: 4, overflow: 'hidden'
        }}>
          <SeamOverlay
            width={bodyWidth}
            height={ribbonHeight}
            ribbonWidth={ribbonWidth}
            lineHeight={lineHeight}
            collapseRegions={collapseRegions}
            leftRowOfLine={leftLayout.rowOfLine}
            rightRowOfLine={rightLayout.rowOfLine}
            leftScrollTop={leftScrollTop}
            rightScrollTop={rightScrollTop}
            colors={colors}
          />
        </div>

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
