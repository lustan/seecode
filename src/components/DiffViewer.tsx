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

type Row = {
  kind: 'equal' | 'remove' | 'add' | 'modify';
  leftNum?: number;
  rightNum?: number;
  leftText?: string;
  rightText?: string;
};

type Side = 'left' | 'right';

type PaneSource =
  | { kind: 'note'; noteId: string }
  | { kind: 'blank' };

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

function buildRows(ops: DiffOp[]): Row[] {
  const rows: Row[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      rows.push({
        kind: 'equal',
        leftNum: op.left + 1, leftText: op.text,
        rightNum: op.right + 1, rightText: op.text
      });
      i++;
    } else {
      const removes: { left: number; text: string }[] = [];
      const adds: { right: number; text: string }[] = [];
      while (i < ops.length && (ops[i].type === 'remove' || ops[i].type === 'add')) {
        const o = ops[i];
        if (o.type === 'remove') removes.push({ left: o.left, text: o.text });
        else if (o.type === 'add') adds.push({ right: o.right, text: o.text });
        i++;
      }
      const pairs = Math.min(removes.length, adds.length);
      for (let k = 0; k < pairs; k++) {
        rows.push({
          kind: 'modify',
          leftNum: removes[k].left + 1, leftText: removes[k].text,
          rightNum: adds[k].right + 1, rightText: adds[k].text
        });
      }
      for (let k = pairs; k < removes.length; k++) {
        rows.push({ kind: 'remove', leftNum: removes[k].left + 1, leftText: removes[k].text });
      }
      for (let k = pairs; k < adds.length; k++) {
        rows.push({ kind: 'add', rightNum: adds[k].right + 1, rightText: adds[k].text });
      }
    }
  }
  return rows;
}

function inlineDiff(a: string, b: string): { aSegs: { text: string; changed: boolean }[]; bSegs: { text: string; changed: boolean }[] } {
  const aArr = Array.from(a);
  const bArr = Array.from(b);
  const m = aArr.length, n = bArr.length;
  if (m > 400 || n > 400) {
    return {
      aSegs: [{ text: a, changed: true }],
      bSegs: [{ text: b, changed: true }]
    };
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aArr[i] === bArr[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const aSegs: { text: string; changed: boolean }[] = [];
  const bSegs: { text: string; changed: boolean }[] = [];
  let i = 0, j = 0;
  const pushA = (ch: string, changed: boolean) => {
    const last = aSegs[aSegs.length - 1];
    if (last && last.changed === changed) last.text += ch;
    else aSegs.push({ text: ch, changed });
  };
  const pushB = (ch: string, changed: boolean) => {
    const last = bSegs[bSegs.length - 1];
    if (last && last.changed === changed) last.text += ch;
    else bSegs.push({ text: ch, changed });
  };
  while (i < m && j < n) {
    if (aArr[i] === bArr[j]) { pushA(aArr[i], false); pushB(bArr[j], false); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { pushA(aArr[i], true); i++; }
    else { pushB(bArr[j], true); j++; }
  }
  while (i < m) { pushA(aArr[i], true); i++; }
  while (j < n) { pushB(bArr[j], true); j++; }
  return { aSegs, bSegs };
}

// Build diff chunks: maximal runs of non-equal rows
function buildChunks(rows: Row[]): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind !== 'equal') {
      const start = i;
      while (i < rows.length && rows[i].kind !== 'equal') i++;
      chunks.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }
  return chunks;
}

export default function DiffViewer({ notes, currentNote, theme = 'dark', fontSize = 13, onClose }: Props) {
  const [leftSrc, setLeftSrc] = useState<PaneSource>(
    currentNote ? { kind: 'note', noteId: currentNote.id } : { kind: 'blank' }
  );
  const [rightSrc, setRightSrc] = useState<PaneSource>({ kind: 'blank' });

  const [leftText, setLeftText] = useState<string>(currentNote?.content || '');
  const [rightText, setRightText] = useState<string>('');

  const [mode, setMode] = useState<'diff' | 'edit'>('diff');
  const [pickerSide, setPickerSide] = useState<Side | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Collapse unchanged fragments — IDEA-style
  const [collapseUnchanged, setCollapseUnchanged] = useState(true);
  const [expandedFolds, setExpandedFolds] = useState<Set<string>>(new Set());
  const CONTEXT_LINES = 3;
  const MIN_FOLD = CONTEXT_LINES * 2 + 2; // only collapse runs longer than this

  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(-1);
  const [formatError, setFormatError] = useState<{ side: Side; message: string } | null>(null);

  const diffScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const leftTitle = leftSrc.kind === 'note'
    ? (notes.find(n => n.id === leftSrc.noteId)?.title || 'Untitled')
    : 'untitled-left.txt';
  const rightTitle = rightSrc.kind === 'note'
    ? (notes.find(n => n.id === rightSrc.noteId)?.title || 'Untitled')
    : 'untitled.txt';

  const rows = useMemo(() => {
    const a = leftText.split('\n');
    const b = rightText.split('\n');
    if (leftText === '') a.length = 0;
    if (rightText === '') b.length = 0;
    return buildRows(computeDiff(a, b));
  }, [leftText, rightText]);

  const chunks = useMemo(() => buildChunks(rows), [rows]);

  // Compute foldable regions: maximal runs of equal rows with CONTEXT_LINES of context
  // preserved at each end (or at the file start/end). Only collapse if the resulting
  // hidden run is at least 1 line.
  type Fold = { start: number; end: number; hiddenStart: number; hiddenEnd: number; key: string };
  const folds = useMemo<Fold[]>(() => {
    if (!collapseUnchanged) return [];
    const out: Fold[] = [];
    let i = 0;
    while (i < rows.length) {
      if (rows[i].kind === 'equal') {
        const start = i;
        while (i < rows.length && rows[i].kind === 'equal') i++;
        const end = i - 1;
        const isFileStart = start === 0;
        const isFileEnd = end === rows.length - 1;
        const ctxBefore = isFileStart ? 0 : CONTEXT_LINES;
        const ctxAfter = isFileEnd ? 0 : CONTEXT_LINES;
        const hiddenStart = start + ctxBefore;
        const hiddenEnd = end - ctxAfter;
        if (hiddenEnd >= hiddenStart && (hiddenEnd - hiddenStart + 1) >= 1 &&
            (end - start + 1) >= (ctxBefore + ctxAfter + 1)) {
          out.push({
            start, end, hiddenStart, hiddenEnd,
            key: `${hiddenStart}-${hiddenEnd}`
          });
        }
      } else {
        i++;
      }
    }
    return out;
  }, [rows, collapseUnchanged]);

  // Map: rowIdx → fold it belongs to (only for actually-hidden indices); also map fold start position
  const foldAtRow = useMemo<Map<number, Fold>>(() => {
    const m = new Map<number, Fold>();
    folds.forEach(f => {
      if (expandedFolds.has(f.key)) return;
      for (let i = f.hiddenStart; i <= f.hiddenEnd; i++) m.set(i, f);
    });
    return m;
  }, [folds, expandedFolds]);

  // reset chunk index whenever chunks change
  useEffect(() => {
    setCurrentChunkIdx(chunks.length > 0 ? 0 : -1);
  }, [chunks.length]);

  // auto-dismiss format error
  useEffect(() => {
    if (!formatError) return;
    const t = setTimeout(() => setFormatError(null), 2500);
    return () => clearTimeout(t);
  }, [formatError]);

  const scrollToChunk = useCallback((idx: number) => {
    if (idx < 0 || idx >= chunks.length) return;
    const targetRow = chunks[idx].start;
    // chunk rows are non-equal, so they are never inside a fold — no expansion needed.
    // requestAnimationFrame waits one paint so refs are up to date after any state changes.
    requestAnimationFrame(() => {
      const el = rowRefs.current[targetRow];
      if (!el || !diffScrollRef.current) return;
      const scroller = diffScrollRef.current;
      const elTop = el.offsetTop;
      const desired = elTop - scroller.clientHeight / 3;
      scroller.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });
    });
  }, [chunks]);

  const goPrevDiff = useCallback(() => {
    if (chunks.length === 0) return;
    const next = currentChunkIdx <= 0 ? chunks.length - 1 : currentChunkIdx - 1;
    setCurrentChunkIdx(next);
    scrollToChunk(next);
  }, [chunks.length, currentChunkIdx, scrollToChunk]);

  const goNextDiff = useCallback(() => {
    if (chunks.length === 0) return;
    const next = currentChunkIdx >= chunks.length - 1 ? 0 : currentChunkIdx + 1;
    setCurrentChunkIdx(next);
    scrollToChunk(next);
  }, [chunks.length, currentChunkIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerSide) setPickerSide(null);
        else onClose();
        return;
      }
      // F7 / Shift+F7 — IDEA-style next/prev diff
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
    for (const r of rows) {
      if (r.kind === 'remove') removed++;
      else if (r.kind === 'add') added++;
      else if (r.kind === 'modify') modified++;
    }
    return { removed, added, modified };
  }, [rows]);

  const colors = theme === 'dark' ? {
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
    removeBg: 'rgba(239, 68, 68, 0.12)',
    removeGutter: 'rgba(239, 68, 68, 0.22)',
    removeInline: 'rgba(239, 68, 68, 0.4)',
    addBg: 'rgba(34, 197, 94, 0.12)',
    addGutter: 'rgba(34, 197, 94, 0.22)',
    addInline: 'rgba(34, 197, 94, 0.42)',
    modifyBg: 'rgba(234, 179, 8, 0.10)',
    modifyGutter: 'rgba(234, 179, 8, 0.22)',
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
    removeBg: 'rgba(239, 68, 68, 0.10)',
    removeGutter: 'rgba(239, 68, 68, 0.20)',
    removeInline: 'rgba(239, 68, 68, 0.35)',
    addBg: 'rgba(34, 197, 94, 0.12)',
    addGutter: 'rgba(34, 197, 94, 0.22)',
    addInline: 'rgba(34, 197, 94, 0.38)',
    modifyBg: 'rgba(234, 179, 8, 0.12)',
    modifyGutter: 'rgba(234, 179, 8, 0.25)',
    accent: '#2563eb',
    pickerBg: 'rgba(255, 255, 255, 0.98)',
    pickerItemHover: 'rgba(59, 130, 246, 0.10)'
  };

  const rowBgFor = (kind: Row['kind'], side: Side) => {
    if (kind === 'equal') return 'transparent';
    if (kind === 'modify') return colors.modifyBg;
    if (kind === 'remove') return side === 'left' ? colors.removeBg : 'transparent';
    if (kind === 'add') return side === 'right' ? colors.addBg : 'transparent';
    return 'transparent';
  };

  const centerGutterBgFor = (kind: Row['kind']) => {
    if (kind === 'equal') return colors.gutterBg;
    if (kind === 'modify') return colors.modifyGutter;
    if (kind === 'remove') return colors.removeGutter;
    if (kind === 'add') return colors.addGutter;
    return colors.gutterBg;
  };

  const markerColorFor = (kind: Row['kind']) => {
    if (kind === 'remove') return '#ef4444';
    if (kind === 'add') return '#22c55e';
    if (kind === 'modify') return '#eab308';
    return colors.gutterText;
  };

  const markerFor = (kind: Row['kind']) => {
    if (kind === 'remove') return '−';
    if (kind === 'add') return '+';
    if (kind === 'modify') return '~';
    return '';
  };

  const lineHeight = Math.round(fontSize * 1.55);
  const numCol = 46;
  const markerCol = 18;
  const centerGutterWidth = numCol * 2 + markerCol;
  const gutterFontSize = Math.max(10, fontSize - 2);

  const renderInline = (text: string | undefined, segs: { text: string; changed: boolean }[] | null, side: Side, kind: Row['kind']) => {
    if (!text && !segs) return <span style={{ opacity: 0.3 }}>&nbsp;</span>;
    if (kind === 'modify' && segs) {
      const bg = side === 'left' ? colors.removeInline : colors.addInline;
      return (
        <>
          {segs.map((s, i) => s.changed
            ? <span key={i} style={{ background: bg, borderRadius: 2 }}>{s.text || ' '}</span>
            : <span key={i}>{s.text}</span>
          )}
        </>
      );
    }
    return <span>{text || ' '}</span>;
  };

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

  const renderRows = () => {
    rowRefs.current = [];
    if (rows.length === 0) {
      return (
        <div style={{
          padding: 40, textAlign: 'center', color: colors.textDim,
          fontSize: 13, fontWeight: 600
        }}>
          Both sides are empty. Pick a file or start typing to see differences.
        </div>
      );
    }
    const out: React.ReactNode[] = [];
    let idx = 0;
    while (idx < rows.length) {
      const fold = foldAtRow.get(idx);
      if (fold && idx === fold.hiddenStart) {
        // Render the fold bar (single row in the layout)
        const hiddenCount = fold.hiddenEnd - fold.hiddenStart + 1;
        out.push(
          <div
            key={`fold-${fold.key}`}
            ref={el => { rowRefs.current[idx] = el; }}
            className="dv-fold-bar"
            onClick={() => {
              setExpandedFolds(prev => {
                const n = new Set(prev);
                n.add(fold.key);
                return n;
              });
            }}
            title={`Expand ${hiddenCount} unchanged line${hiddenCount === 1 ? '' : 's'}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 13 12 18 17 13"></polyline>
              <polyline points="7 6 12 11 17 6"></polyline>
            </svg>
            <span className="dv-fold-text">
              {hiddenCount} unchanged line{hiddenCount === 1 ? '' : 's'}
            </span>
            <span className="dv-fold-hint">click to expand</span>
          </div>
        );
        idx = fold.hiddenEnd + 1;
        continue;
      }

      const r = rows[idx];
      const segs = r.kind === 'modify' && r.leftText != null && r.rightText != null
        ? inlineDiff(r.leftText, r.rightText)
        : null;

      const isCurrentChunkStart =
        currentChunkIdx >= 0 &&
        currentChunkIdx < chunks.length &&
        chunks[currentChunkIdx].start === idx;

      const rowIdx = idx;
      out.push(
        <div
          key={rowIdx}
          ref={el => { rowRefs.current[rowIdx] = el; }}
          style={{
            display: 'flex', minHeight: lineHeight, width: '100%',
            position: 'relative'
          }}
        >
          {isCurrentChunkStart && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0,
              height: 2, background: colors.accent, zIndex: 2,
              boxShadow: `0 0 8px ${colors.accent}`
            }} />
          )}

          {/* LEFT TEXT */}
          <div style={{
            flex: 1, minWidth: 0, padding: '0 12px',
            background: rowBgFor(r.kind, 'left'),
            whiteSpace: 'pre', lineHeight: `${lineHeight}px`,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize, color: colors.text,
            textAlign: 'left'
          }}>
            {renderInline(r.leftText, segs?.aSegs ?? null, 'left', r.kind)}
          </div>

          {/* CENTER GUTTER */}
          <div style={{
            width: centerGutterWidth, flexShrink: 0,
            display: 'flex', alignItems: 'stretch',
            background: centerGutterBgFor(r.kind),
            borderLeft: `1px solid ${colors.border}`,
            borderRight: `1px solid ${colors.border}`,
            userSelect: 'none',
            fontVariantNumeric: 'tabular-nums'
          }}>
            <div style={{
              width: numCol, padding: '0 8px', textAlign: 'right',
              color: r.kind === 'remove' || r.kind === 'modify' ? markerColorFor(r.kind === 'modify' ? 'modify' : 'remove') : colors.gutterText,
              fontSize: gutterFontSize, lineHeight: `${lineHeight}px`,
              fontWeight: r.kind !== 'equal' ? 700 : 500
            }}>{r.leftNum ?? ''}</div>
            <div style={{
              width: markerCol, textAlign: 'center',
              color: markerColorFor(r.kind),
              fontSize: gutterFontSize, lineHeight: `${lineHeight}px`,
              fontWeight: 800
            }}>{markerFor(r.kind)}</div>
            <div style={{
              width: numCol, padding: '0 8px', textAlign: 'left',
              color: r.kind === 'add' || r.kind === 'modify' ? markerColorFor(r.kind === 'modify' ? 'modify' : 'add') : colors.gutterText,
              fontSize: gutterFontSize, lineHeight: `${lineHeight}px`,
              fontWeight: r.kind !== 'equal' ? 700 : 500
            }}>{r.rightNum ?? ''}</div>
          </div>

          {/* RIGHT TEXT */}
          <div style={{
            flex: 1, minWidth: 0, padding: '0 12px',
            background: rowBgFor(r.kind, 'right'),
            whiteSpace: 'pre', lineHeight: `${lineHeight}px`,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize, color: colors.text,
            textAlign: 'left'
          }}>
            {renderInline(r.rightText, segs?.bSegs ?? null, 'right', r.kind)}
          </div>
        </div>
      );
      idx++;
    }
    return out;
  };

  const fileChip = (side: Side) => {
    const src = side === 'left' ? leftSrc : rightSrc;
    const title = side === 'left' ? leftTitle : rightTitle;
    const isNote = src.kind === 'note';
    const dot = side === 'left' ? '#ef4444' : '#22c55e';
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
            color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.12)'
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
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
          color: #ef4444; border-color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }
        .dv-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .dv-scroll::-webkit-scrollbar-track { background: transparent; }
        .dv-scroll::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? '#334155' : '#cbd5e1'}; border-radius: 10px; border: 2px solid ${colors.bg}; }
        .dv-scroll::-webkit-scrollbar-thumb:hover { background: ${theme === 'dark' ? '#475569' : '#94a3b8'}; }
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
        .dv-picker-search {
          width: 100%; height: 38px; padding: 0 14px;
          border: none; outline: none; background: transparent;
          border-bottom: 1px solid ${colors.border};
          color: ${colors.text}; font-size: 13px; font-weight: 600;
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
        .dv-edit-area {
          width: 100%; flex: 1; resize: none; outline: none;
          border: none; padding: 14px 16px;
          background: ${colors.panelBg}; color: ${colors.text};
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: ${fontSize}px; line-height: ${lineHeight}px;
          tab-size: 2;
        }
        .dv-tab {
          height: 24px; padding: 0 10px; font-size: 11px; font-weight: 700;
          border: none; border-radius: 6px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 5px;
          transition: all 0.15s;
        }
        .dv-toggle-btn {
          height: 28px; padding: 0 10px; border-radius: 7px;
          border: 1px solid ${colors.border};
          background: transparent; color: ${colors.textSec};
          font-size: 11px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
          transition: all 0.15s; outline: none;
        }
        .dv-toggle-btn:hover {
          color: ${colors.accent}; border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.10)' : 'rgba(59, 130, 246, 0.06)'};
        }
        .dv-toggle-btn.active {
          color: ${colors.accent}; border-color: ${colors.accent};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.14)' : 'rgba(59, 130, 246, 0.08)'};
        }
        .dv-fold-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 14px; cursor: pointer;
          border-top: 1px dashed ${colors.border};
          border-bottom: 1px dashed ${colors.border};
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.04)' : 'rgba(59, 130, 246, 0.03)'};
          color: ${colors.textSec};
          font-size: 11px; font-weight: 700;
          transition: background 0.15s;
          user-select: none;
        }
        .dv-fold-bar:hover {
          background: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.08)'};
          color: ${colors.accent};
        }
        .dv-fold-text {
          letter-spacing: 0.02em;
        }
        .dv-fold-hint {
          margin-left: auto;
          font-size: 10px; font-weight: 600;
          color: ${colors.textDim};
          letter-spacing: 0.04em; text-transform: uppercase;
        }
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
          {/* Collapse unchanged toggle */}
          <button
            className={`dv-toggle-btn ${collapseUnchanged ? 'active' : ''}`}
            onClick={() => {
              if (collapseUnchanged) {
                setCollapseUnchanged(false);
                setExpandedFolds(new Set());
              } else {
                setCollapseUnchanged(true);
                setExpandedFolds(new Set()); // reset to fresh collapsed state
              }
            }}
            title={collapseUnchanged ? 'Show all unchanged lines' : 'Collapse unchanged fragments'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {collapseUnchanged ? (
                <>
                  <polyline points="7 13 12 18 17 13"></polyline>
                  <polyline points="7 6 12 11 17 6"></polyline>
                </>
              ) : (
                <>
                  <polyline points="17 11 12 6 7 11"></polyline>
                  <polyline points="17 18 12 13 7 18"></polyline>
                </>
              )}
            </svg>
            {collapseUnchanged ? 'Collapsed' : 'Expanded'}
          </button>

          {/* Diff navigation */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 3, borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
          }}>
            <button
              className="dv-nav-btn"
              onClick={goPrevDiff}
              disabled={chunks.length === 0}
              title="Previous difference (Shift+F7)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <span className="dv-nav-counter">
              {chunks.length === 0 ? '0 / 0' : `${currentChunkIdx + 1} / ${chunks.length}`}
            </span>
            <button
              className="dv-nav-btn"
              onClick={goNextDiff}
              disabled={chunks.length === 0}
              title="Next difference (F7)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dv-chip" style={{ background: colors.removeBg, color: '#ef4444' }}>
              −{stats.removed}
            </span>
            <span className="dv-chip" style={{ background: colors.modifyBg, color: '#eab308' }}>
              ~{stats.modified}
            </span>
            <span className="dv-chip" style={{ background: colors.addBg, color: '#22c55e' }}>
              +{stats.added}
            </span>
          </div>

          <div style={{ width: 1, height: 22, background: colors.border, margin: '0 2px' }} />

          <div style={{
            display: 'inline-flex', padding: 3, borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
          }}>
            <button
              className="dv-tab"
              onClick={() => setMode('diff')}
              style={{
                background: mode === 'diff' ? (theme === 'dark' ? 'rgba(96,165,250,0.18)' : 'rgba(59,130,246,0.12)') : 'transparent',
                color: mode === 'diff' ? colors.accent : colors.textSec
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"></line>
                <circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <path d="M18 9a9 9 0 0 1-9 9"></path>
              </svg>
              Diff
            </button>
            <button
              className="dv-tab"
              onClick={() => setMode('edit')}
              style={{
                background: mode === 'edit' ? (theme === 'dark' ? 'rgba(96,165,250,0.18)' : 'rgba(59,130,246,0.12)') : 'transparent',
                color: mode === 'edit' ? colors.accent : colors.textSec
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path>
              </svg>
              Edit
            </button>
          </div>

          <button className="dv-icon-btn" onClick={onClose} title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex' }}>
        {mode === 'diff' ? (
          <div
            ref={diffScrollRef}
            className="dv-scroll"
            style={{ flex: 1, overflow: 'auto', background: colors.panelBg, position: 'relative' }}
          >
            {renderRows()}
            <div style={{ height: 80 }} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: colors.panelBg, borderRight: `1px solid ${colors.border}` }}>
              {editToolbar('left')}
              <textarea
                className="dv-edit-area"
                value={leftText}
                onChange={e => setLeftText(e.target.value)}
                placeholder="Left side — type or pick a file…"
                spellCheck={false}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: colors.panelBg }}>
              {editToolbar('right')}
              <textarea
                className="dv-edit-area"
                value={rightText}
                onChange={e => setRightText(e.target.value)}
                placeholder="Right side — type or pick a file…"
                spellCheck={false}
                autoFocus
              />
            </div>
          </>
        )}

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
              <input
                autoFocus
                className="dv-picker-search"
                placeholder="Search files by name or content…"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
              />
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
