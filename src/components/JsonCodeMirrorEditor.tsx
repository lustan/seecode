import React, { useState, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, Decoration, DecorationSet } from '@codemirror/view';
import { placeholder as placeholderExt } from '@codemirror/view';
import { search, highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { defaultKeymap } from '@codemirror/commands';
import { Extension, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

const addHighlights = StateEffect.define<{ from: number; to: number }[]>();
const clearHighlights = StateEffect.define();

const searchHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (let effect of tr.effects) {
      if (effect.is(addHighlights)) {
        const builder = new RangeSetBuilder<Decoration>();
        effect.value.forEach(({ from, to }) => {
          builder.add(from, to, Decoration.mark({ class: 'cm-search-highlight' }));
        });
        highlights = builder.finish();
      } else if (effect.is(clearHighlights)) {
        highlights = Decoration.none;
      }
    }
    return highlights;
  },
  provide: f => EditorView.decorations.from(f)
});

const Icons = {
  ChevronDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  ChevronUp: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>,
  Close: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  CaseSensitive: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 15 4-8 4 8"></path><path d="M4 13h6"></path><circle cx="18" cy="12" r="3"></circle><path d="M21 9v6"></path></svg>,
  Regex: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"></circle><path d="M12 12h9"></path><path d="M12 5v14"></path></svg>,
  Replace: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h7v7"></path><path d="M21 4l-9 9"></path><path d="M15 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h5"></path></svg>,
  ReplaceAll: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h7v7"></path><path d="M21 4l-9 9"></path><path d="M3 13V5a2 2 0 0 1 2-2h8"></path><path d="M13 21h5a2 2 0 0 0 2-2v-5"></path></svg>
};

interface Props {
  value: any;
  onChange: any;
  isPopup?: boolean;
  isSticky?: boolean;
  theme?: 'dark' | 'light';
  fontSize?: number;
  showAlert?: (options: any) => void;
}

export default function JsonCodeMirrorEditor({ value, onChange, isPopup = false, isSticky = false, theme = 'dark', fontSize = 13, showAlert }: Props) {
  const [wrap, setWrap] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const editorRef = useRef<any>(null);

  const getEditorView = useCallback((): EditorView | null => editorRef.current?.view || null, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setShowReplace(false);
    const view = getEditorView();
    if (view) view.dispatch({ effects: clearHighlights.of(null) });
    setCurrentMatch(0);
    setTotalMatches(0);
  }, [getEditorView]);

  const performSearch = useCallback((searchTerm: string, caseSensitive: boolean, isRegex: boolean, direction: 'next' | 'prev' = 'next') => {
    const view = getEditorView();
    if (!view || !searchTerm.trim()) {
      if (view) view.dispatch({ effects: clearHighlights.of(null) });
      setCurrentMatch(0);
      setTotalMatches(0);
      return;
    }

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = isRegex ? new RegExp(searchTerm, flags) : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      const text = view.state.doc.toString();
      const matches: { from: number, to: number }[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
        if (match[0].length === 0) regex.lastIndex++;
      }

      setTotalMatches(matches.length);
      if (matches.length === 0) {
        setCurrentMatch(0);
        view.dispatch({ effects: clearHighlights.of(null) });
        return;
      }

      view.dispatch({ effects: addHighlights.of(matches) });
      const currentPos = view.state.selection.main.head;
      let targetIndex = direction === 'next' 
        ? matches.findIndex(m => m.from > currentPos) 
        : matches.reverse().findIndex(m => m.from < currentPos);
      
      if (targetIndex === -1) targetIndex = 0;
      const actualIndex = direction === 'next' ? targetIndex : (matches.length - 1 - targetIndex);
      const finalMatch = (direction === 'next' ? matches : matches.reverse())[targetIndex];
      
      setCurrentMatch(actualIndex + 1);
      view.dispatch({
        selection: { anchor: finalMatch.from, head: finalMatch.to },
        effects: EditorView.scrollIntoView(finalMatch.from, { y: 'center' })
      });
    } catch (e) { console.error(e); }
  }, [getEditorView]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch (e) { showAlert?.({ type: 'error', message: 'Invalid JSON format' }); }
  }, [value, onChange, showAlert]);

  const colors = theme === 'dark' ? {
    panelBg: 'rgba(30, 32, 45, 0.85)',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#f8fafc',
    textDim: '#94a3b8',
    accent: '#3b82f6'
  } : {
    panelBg: 'rgba(255, 255, 255, 0.95)',
    inputBg: 'rgba(0, 0, 0, 0.03)',
    border: '#e2e8f0',
    text: '#0f172a',
    textDim: '#64748b',
    accent: '#3b82f6'
  };

  return (
    <div 
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme === 'dark' ? '#0f111a' : '#fff', height: '100%', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        .plex-search-panel {
          position: absolute; top: 10px; right: 20px; z-index: 1000;
          background: ${colors.panelBg}; backdrop-filter: blur(20px);
          border: 1px solid ${colors.border}; padding: 10px;
          display: flex; flex-direction: column; gap: 8px;
          border-radius: 12px; width: 320px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          animation: plexFadeIn 0.2s cubic-bezier(0, 0, 0.2, 1);
        }
        @keyframes plexFadeIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .plex-search-row { display: flex; align-items: center; gap: 6px; }
        .plex-search-input-wrapper {
          flex: 1; display: flex; align-items: center; 
          background: ${colors.inputBg}; border: 1px solid ${colors.border};
          border-radius: 6px; padding: 0 10px; height: 32px; transition: all 0.2s;
        }
        .plex-search-input-wrapper:focus-within { border-color: ${colors.accent}; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        .plex-search-input {
          flex: 1; background: transparent; border: none; color: ${colors.text};
          font-size: 13px; outline: none; font-family: inherit; width: 100%;
        }
        .plex-search-count { font-size: 10px; color: ${colors.accent}; font-weight: 800; white-space: nowrap; margin: 0 6px; opacity: 0.8; }
        
        .plex-tool-btn {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: 6px; border: none; background: transparent; color: ${colors.textDim};
          cursor: pointer; transition: all 0.15s;
        }
        .plex-tool-btn:hover { background: rgba(59,130,246,0.1); color: ${colors.accent}; }
        .plex-tool-btn.active { background: ${colors.accent}; color: white; opacity: 1; }
        
        .plex-action-btn {
          padding: 0 8px; height: 28px; border-radius: 6px; border: 1px solid ${colors.border};
          background: ${colors.inputBg}; color: ${colors.text}; font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;
        }
        .plex-action-btn:hover { border-color: ${colors.accent}; color: ${colors.accent}; }

        .cm-search-highlight { background: rgba(250, 204, 21, 0.2) !important; border-bottom: 2px solid #facc15; }
      `}</style>

      {showSearch && (
        <div className="plex-search-panel" onClick={e => e.stopPropagation()}>
          <div className="plex-search-row">
            <div className="plex-search-input-wrapper">
              <input 
                autoFocus
                className="plex-search-input" 
                placeholder="Find"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && performSearch(searchText, searchCaseSensitive, searchRegex, e.shiftKey ? 'prev' : 'next')}
              />
              <span className="plex-search-count">{totalMatches > 0 ? `${currentMatch}/${totalMatches}` : ''}</span>
              <button className="plex-tool-btn" onClick={() => performSearch(searchText, searchCaseSensitive, searchRegex, 'prev')} title="Previous"><Icons.ChevronUp /></button>
              <button className="plex-tool-btn" onClick={() => performSearch(searchText, searchCaseSensitive, searchRegex, 'next')} title="Next"><Icons.ChevronDown /></button>
            </div>
            <button className={`plex-tool-btn ${searchCaseSensitive ? 'active' : ''}`} onClick={() => setSearchCaseSensitive(!searchCaseSensitive)} title="Match Case"><Icons.CaseSensitive /></button>
            <button className={`plex-tool-btn ${searchRegex ? 'active' : ''}`} onClick={() => setSearchRegex(!searchRegex)} title="Use Regex"><Icons.Regex /></button>
            <div style={{ width: 1, height: 20, background: colors.border, margin: '0 2px' }} />
            <button className="plex-tool-btn" onClick={closeSearch} title="Close"><Icons.Close /></button>
          </div>
          
          {showReplace && (
            <div className="plex-search-row">
              <div className="plex-search-input-wrapper">
                <input 
                  className="plex-search-input" 
                  placeholder="Replace" 
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                />
              </div>
              <button className="plex-action-btn" onClick={() => {
                 const view = getEditorView();
                 if (view) {
                   const { from, to } = view.state.selection.main;
                   view.dispatch({ changes: { from, to, insert: replaceText }, selection: { anchor: from + replaceText.length } });
                   performSearch(searchText, searchCaseSensitive, searchRegex, 'next');
                 }
              }} title="Replace Current"><Icons.Replace /> Replace</button>
              <button className="plex-action-btn" onClick={() => {
                const view = getEditorView();
                if (view && searchText) {
                  const text = view.state.doc.toString();
                  const flags = searchCaseSensitive ? 'g' : 'gi';
                  const regex = searchRegex ? new RegExp(searchText, flags) : new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                  onChange(text.replace(regex, replaceText));
                }
              }} title="Replace All"><Icons.ReplaceAll /> All</button>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeMirror
          value={value}
          onChange={onChange}
          theme={theme === 'dark' ? oneDark : undefined}
          extensions={[
            json(),
            placeholderExt('Start typing JSON...'),
            wrap ? EditorView.lineWrapping : [],
            searchHighlightField,
            EditorView.theme({
              '&': { fontSize: `${fontSize}px`, height: '100%', backgroundColor: 'transparent' },
              '.cm-scroller': { scrollbarWidth: 'thin' },
              '.cm-gutters': { background: 'transparent', border: 'none', color: colors.textDim },
              '.cm-activeLine': { background: 'rgba(59, 130, 246, 0.04)' },
              '.cm-selectionBackground': { background: 'rgba(59, 130, 246, 0.2) !important' }
            }),
            keymap.of([
              { key: 'Mod-f', run: () => { setShowSearch(true); return true; } },
              { key: 'Mod-r', run: () => { setShowSearch(true); setShowReplace(true); return true; } },
              { key: 'Escape', run: () => { closeSearch(); return true; } },
              { key: 'Mod-j', run: () => { handleFormat(); return true; } }
            ])
          ]}
          ref={editorRef}
        />
      </div>
    </div>
  );
}
