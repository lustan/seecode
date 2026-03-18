import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorView, keymap, Decoration, DecorationSet } from '@codemirror/view';
import { placeholder as placeholderExt } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { linter, Diagnostic, lintGutter } from '@codemirror/lint';
import { Extension, StateEffect, StateField, RangeSetBuilder, Prec } from '@codemirror/state';
import { SupportedLanguage, detectLanguage, getSupportedLanguages, getLanguageDisplayName } from '../utils/languageDetector';

const Icons = {
  Clear: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
  ),
  Format: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
  ),
  Copy: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
  ),
  Wrap: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
  ),
  ChevronDown: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
  ),
  ChevronUp: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
  ),
  Alert: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"></line><line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"></line></svg>
  ),
  Close: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  ),
  CaseSensitive: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 15 4-8 4 8"></path><path d="M4 13h6"></path><circle cx="18" cy="12" r="3"></circle><path d="M21 9v6"></path></svg>
  ),
  Regex: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2"></circle><path d="M12 12h9"></path><path d="M12 5v14"></path></svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
  )
};

const addHighlights = StateEffect.define<{ from: number; to: number }[]>();
const clearHighlights = StateEffect.define<void>();

const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);
    for (const effect of tr.effects) {
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

interface Props {
  value: string;
  onChange: (value: string) => void;
  isPopup?: boolean;
  isSticky?: boolean;
  theme?: 'dark' | 'light';
  fontSize?: number;
  language?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage | 'auto') => void;
  autoDetectLanguage?: boolean;
  showAlert?: (o: any) => void;
}

export default function MultiLanguageEditor({ value, onChange, theme = 'dark', fontSize = 13, language, onLanguageChange, autoDetectLanguage = true, showAlert }: Props) {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(language || 'plaintext');
  const [wrap, setWrap] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const getEditorView = useCallback((): EditorView | null => editorRef.current?.view || null, []);

  useEffect(() => {
    if (language) {
      setCurrentLanguage(language);
    } else if (autoDetectLanguage && value) {
      setCurrentLanguage(detectLanguage(value));
    }
  }, [value, autoDetectLanguage, language]);

  // IDEA Style JSON Linter
  const ideaJsonLinter = useMemo(() => linter(view => {
    let diagnostics: Diagnostic[] = [];
    if (currentLanguage !== 'json') return diagnostics;

    syntaxTree(view.state).iterate({
      enter: (node) => {
        if (node.type.isError) {
          diagnostics.push({
            from: node.from,
            to: node.to,
            severity: "error",
            message: "JSON Syntax Error: Unexpected token or malformed structure"
          });
        }
      }
    });

    // Update error count for UI
    setErrorCount(diagnostics.length);
    return diagnostics;
  }), [currentLanguage]);

  const getLanguageExt = (lang: SupportedLanguage) => {
    switch(lang) {
      case 'json': return [json(), ideaJsonLinter, lintGutter()];
      case 'javascript': return [javascript()];
      case 'python': return [python()];
      case 'java': return [java()];
      case 'sql': return [sql()];
      case 'markdown': return [markdown()];
      default: return [];
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    showAlert?.({ type: 'success', message: 'Copied to clipboard', presentation: 'toast' });
  };

  const handleClear = () => {
    onChange('');
    showAlert?.({ type: 'info', message: 'Editor cleared' });
  };

  const handleFormat = () => {
    if (currentLanguage === 'json') {
      try { 
        onChange(JSON.stringify(JSON.parse(value), null, 2)); 
      } catch(e) { 
        showAlert?.({ type: 'error', message: 'Invalid JSON' }); 
      }
    }
  };

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setShowReplace(false);
    const view = getEditorView();
    if (view) view.dispatch({ effects: clearHighlights.of() });
    setCurrentMatch(0);
    setTotalMatches(0);
  }, [getEditorView]);

  const performSearch = useCallback((searchTerm: string, caseSensitive: boolean, isRegex: boolean, direction: 'next' | 'prev' = 'next') => {
    const view = getEditorView();
    if (!view || !searchTerm.trim()) {
      if (view) view.dispatch({ effects: clearHighlights.of() });
      setCurrentMatch(0);
      setTotalMatches(0);
      return;
    }

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const pattern = isRegex ? searchTerm : searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(pattern, flags);
      const text = view.state.doc.toString();
      const matches: { from: number; to: number }[] = [];
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
        if (match[0].length === 0) regex.lastIndex++;
      }

      setTotalMatches(matches.length);
      if (matches.length === 0) {
        setCurrentMatch(0);
        view.dispatch({ effects: clearHighlights.of() });
        return;
      }

      view.dispatch({ effects: addHighlights.of(matches) });

      const currentPos = view.state.selection.main.head;
      let actualIndex = 0;
      if (direction === 'next') {
        const nextIdx = matches.findIndex(m => m.from > currentPos);
        actualIndex = nextIdx === -1 ? 0 : nextIdx;
      } else {
        const prevIdx = [...matches].reverse().findIndex(m => m.from < currentPos);
        actualIndex = prevIdx === -1 ? matches.length - 1 : matches.length - 1 - prevIdx;
      }

      const finalMatch = matches[actualIndex];
      setCurrentMatch(actualIndex + 1);
      view.dispatch({
        selection: { anchor: finalMatch.from, head: finalMatch.to },
        effects: EditorView.scrollIntoView(finalMatch.from, { y: 'center' })
      });
    } catch {
      setCurrentMatch(0);
      setTotalMatches(0);
    }
  }, [getEditorView]);

  const handleReplaceAll = useCallback(() => {
    const view = getEditorView();
    if (!view || !searchText) return;
    try {
      const text = view.state.doc.toString();
      const flags = searchCaseSensitive ? 'g' : 'gi';
      const pattern = searchRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(pattern, flags);
      onChange(text.replace(regex, replaceText));
      performSearch(searchText, searchCaseSensitive, searchRegex, 'next');
    } catch {
      showAlert?.({ type: 'error', message: 'Invalid search pattern' });
    }
  }, [getEditorView, searchText, searchCaseSensitive, searchRegex, onChange, replaceText, performSearch, showAlert]);

  const searchKeyBindings = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          { key: 'Mod-f', run: () => { setShowSearch(true); return true; } },
          { key: 'Mod-r', run: () => { setShowSearch(true); setShowReplace(true); return true; } },
          { key: 'Escape', run: () => { if (showSearch) { closeSearch(); return true; } return false; } }
        ])
      ),
    [showSearch, closeSearch]
  );

  useEffect(() => {
    if (!showSearch) return;
    performSearch(searchText, searchCaseSensitive, searchRegex, 'next');
  }, [showSearch, searchText, searchCaseSensitive, searchRegex, performSearch]);

  useEffect(() => {
    const onGlobalKeydown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== 'f' && key !== 'r') return;

      const root = containerRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      const active = document.activeElement;
      const inEditor = (target && root.contains(target)) || (active && root.contains(active));
      if (!inEditor) return;

      e.preventDefault();
      if (key === 'f') {
        setShowSearch(true);
      } else {
        setShowSearch(true);
        setShowReplace(true);
      }
    };

    window.addEventListener('keydown', onGlobalKeydown, true);
    return () => window.removeEventListener('keydown', onGlobalKeydown, true);
  }, []);

  useEffect(() => {
    if (!showLanguageMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showLanguageMenu]);

  const btnStyle = {
    background: 'none',
    border: 'none',
    color: theme === 'dark' ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center'
  };

  const colors = theme === 'dark' ? {
    sbTrack: '#0f111a',
    sbThumb: '#334155',
    sbHover: '#475569',
    footerBg: '#090b10',
    footerBorder: 'rgba(255,255,255,0.03)',
    pillBg: 'rgba(255,255,255,0.03)',
    pillHover: 'rgba(59, 130, 246, 0.12)',
    textDim: '#64748b',
    textActive: '#60a5fa'
  } : {
    sbTrack: '#f8fafc',
    sbThumb: '#cbd5e1',
    sbHover: '#94a3b8',
    footerBg: '#f8fafc',
    footerBorder: '#f1f5f9',
    pillBg: 'rgba(0,0,0,0.03)',
    pillHover: 'rgba(59, 130, 246, 0.08)',
    textDim: '#64748b',
    textActive: '#3b82f6'
  };

  return (
    <div ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: theme === 'dark' ? '#0f111a' : '#fff', overflow: 'hidden' }}>
      <style>{`
        .editor-glass-pill { opacity: 0.3; transform: translateY(0); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .editor-glass-pill:hover { opacity: 1; transform: translateY(-1px); }
        .ed-btn:hover { background: rgba(59, 130, 246, 0.15); color: #60a5fa !important; }
        .ed-btn-danger:hover { background: rgba(239, 68, 68, 0.1); color: #ef4444 !important; }
        
        .cm-editor { outline: none !important; height: 100% !important; }
        .cm-scroller { overflow: auto !important; height: 100% !important; }
        .cm-scroller::-webkit-scrollbar { width: 6px; }
        .cm-scroller::-webkit-scrollbar-track { background: ${colors.sbTrack}; }
        .cm-scroller::-webkit-scrollbar-thumb { background: ${colors.sbThumb}; border-radius: 10px; }
        .cm-scroller::-webkit-scrollbar-thumb:hover { background: ${colors.sbHover}; }

        .error-badge {
          position: absolute;
          top: 12px;
          right: 180px;
          z-index: 120;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 4px;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .footer-lang-group {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          min-width: 138px;
          justify-content: flex-end;
        }

        .footer-lang-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 138px;
          padding: 5px 10px;
          border-radius: 8px;
          background: transparent;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          box-shadow: none;
          color: inherit;
          cursor: pointer;
          outline: none;
        }
        .footer-lang-trigger:hover { 
          background: ${theme === 'dark'
            ? 'rgba(37, 99, 235, 0.18)'
            : 'rgba(59, 130, 246, 0.08)'};
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.4)' : 'rgba(59, 130, 246, 0.3)'};
          box-shadow: ${theme === 'dark' ? '0 6px 14px rgba(37, 99, 235, 0.16)' : '0 4px 10px rgba(59, 130, 246, 0.12)'};
        }
        .footer-lang-trigger.active {
          background: ${theme === 'dark' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(59, 130, 246, 0.1)'};
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.5)' : 'rgba(59, 130, 246, 0.4)'};
          box-shadow: 0 0 0 2px ${theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.16)'};
        }
        .footer-lang-group:hover .lang-label { color: ${colors.textActive}; }
        .footer-lang-group:hover .chevron-icon { color: ${colors.textActive}; transform: translateY(1px); }

        .lang-menu {
          position: absolute;
          right: 0;
          bottom: calc(100% + 8px);
          min-width: 170px;
          max-height: 220px;
          overflow: auto;
          border-radius: 10px;
          border: 1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.26)' : '#dbe5f3'};
          background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.97)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(18px);
          box-shadow: ${theme === 'dark' ? '0 14px 30px rgba(2, 6, 23, 0.42)' : '0 12px 24px rgba(15, 23, 42, 0.15)'};
          padding: 6px;
          z-index: 220;
        }

        .lang-menu-item {
          width: 100%;
          height: 30px;
          border: none;
          outline: none;
          background: transparent;
          color: ${theme === 'dark' ? '#cbd5e1' : '#334155'};
          border-radius: 7px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          padding: 0 10px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .lang-menu-item:hover {
          background: ${theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)'};
          color: ${theme === 'dark' ? '#dbeafe' : '#1d4ed8'};
        }

        .lang-menu-item.active {
          background: ${theme === 'dark' ? 'rgba(37, 99, 235, 0.32)' : 'rgba(37, 99, 235, 0.15)'};
          color: ${theme === 'dark' ? '#dbeafe' : '#1d4ed8'};
          font-weight: 700;
        }

        .lang-menu::-webkit-scrollbar { width: 6px; }
        .lang-menu::-webkit-scrollbar-thumb {
          background: ${theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.6)'};
          border-radius: 8px;
        }

        .lang-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: ${colors.textDim};
          transition: all 0.2s;
          white-space: nowrap;
        }

        .chevron-icon {
          color: ${colors.textDim};
          opacity: 0.6;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .footer-lang-select { display: none; }

        .plex-search-panel {
          position: relative;
          z-index: 20;
          margin: 6px 12px 0 12px;
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .plex-search-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .plex-search-input-wrap {
          flex: 1;
          height: 34px;
          display: flex;
          align-items: center;
          border-radius: 7px;
          border: 1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : '#dbe3ef'};
          background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.78)' : '#ffffff'};
          padding: 0 9px;
        }

        .plex-search-input-wrap:focus-within {
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.7)' : '#73a2e8'};
          box-shadow: 0 0 0 2px ${theme === 'dark' ? 'rgba(96, 165, 250, 0.18)' : 'rgba(115, 162, 232, 0.2)'};
        }

        .plex-search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: ${theme === 'dark' ? '#e2e8f0' : '#334155'};
          font-size: 13px;
          min-width: 0;
        }

        .plex-search-input::placeholder {
          color: ${theme === 'dark' ? '#7f8ba1' : '#9aa9bf'};
          font-weight: 600;
        }

        .plex-search-count {
          font-size: 11px;
          font-weight: 600;
          color: ${theme === 'dark' ? '#94a3b8' : '#64748b'};
          margin: 0 7px 0 5px;
        }

        .plex-tool-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.28)' : '#dbe3ef'};
          border-radius: 7px;
          cursor: pointer;
          color: ${theme === 'dark' ? '#9fb0c8' : '#64748b'};
          background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.72)' : '#ffffff'};
          transition: all 0.15s;
        }

        .plex-tool-btn.ghost {
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: ${theme === 'dark' ? '#8ea0bb' : '#71839d'};
        }

        .plex-tool-btn.ghost:hover {
          border: none;
          background: ${theme === 'dark' ? 'rgba(59, 130, 246, 0.18)' : '#f3f7ff'};
          color: ${theme === 'dark' ? '#93c5fd' : '#3b82f6'};
        }

        .plex-tool-btn:hover {
          border-color: ${theme === 'dark' ? 'rgba(148, 163, 184, 0.45)' : '#c3d0e4'};
          color: ${theme === 'dark' ? '#e2e8f0' : '#334155'};
          background: ${theme === 'dark' ? 'rgba(30, 41, 59, 0.72)' : '#f8fbff'};
        }

        .plex-tool-btn.active {
          color: ${theme === 'dark' ? '#bfdbfe' : '#1d4ed8'};
          background: ${theme === 'dark' ? 'rgba(37, 99, 235, 0.25)' : '#f4f8ff'};
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.6)' : '#b7cdf7'};
        }

        .plex-action-btn {
          height: 34px;
          border: 1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.28)' : '#dbe3ef'};
          border-radius: 7px;
          background: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.72)' : '#ffffff'};
          color: ${theme === 'dark' ? '#cbd5e1' : '#475569'};
          font-size: 12px;
          font-weight: 700;
          padding: 0 12px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .plex-action-btn:hover {
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.65)' : '#73a2e8'};
          color: ${theme === 'dark' ? '#bfdbfe' : '#1d4ed8'};
          background: ${theme === 'dark' ? 'rgba(30, 41, 59, 0.72)' : '#f8fbff'};
        }

        .plex-action-btn.primary {
          border-color: ${theme === 'dark' ? 'rgba(96, 165, 250, 0.55)' : '#2d5fc6'};
          background: ${theme === 'dark' ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)' : '#3b73d9'};
          color: #ffffff;
          min-width: 104px;
          justify-content: center;
        }

        .plex-action-btn.primary:hover {
          border-color: ${theme === 'dark' ? 'rgba(147, 197, 253, 0.7)' : '#2854af'};
          background: ${theme === 'dark' ? 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' : '#3469c8'};
          color: #ffffff;
        }

        .cm-search-highlight {
          background: rgba(250, 204, 21, 0.22) !important;
          border-bottom: 2px solid #facc15;
        }

        .plex-find-icon {
          color: ${theme === 'dark' ? '#8ea0bb' : '#71839d'};
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 7px;
          flex-shrink: 0;
        }

      `}</style>
      
      {errorCount > 0 && (
        <div className="error-badge">
          <Icons.Alert /> {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
        </div>
      )}

      {!showSearch && (
        <div className="editor-glass-pill" style={{
          position: 'absolute', top: 8, right: 16, zIndex: 100, display: 'flex', gap: 2, 
          background: theme === 'dark' ? 'rgba(15, 17, 26, 0.7)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)', padding: '4px', borderRadius: '8px', 
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
        }}>
          <button className="ed-btn" style={btnStyle} onClick={handleFormat} title="Format JSON"><Icons.Format /></button>
          <button className="ed-btn" style={btnStyle} onClick={handleCopy} title="Copy All"><Icons.Copy /></button>
          <button className="ed-btn" style={btnStyle} onClick={() => setWrap(!wrap)} title="Toggle Wrap"><Icons.Wrap /></button>
          <button className="ed-btn-danger" style={btnStyle} onClick={handleClear} title="Clear All"><Icons.Clear /></button>
        </div>
      )}

      {showSearch && (
        <div className="plex-search-panel" onClick={e => e.stopPropagation()}>
          <div className="plex-search-row">
            <div className="plex-search-input-wrap">
              <span className="plex-find-icon"><Icons.Search /></span>
              <input
                autoFocus
                className="plex-search-input"
                placeholder="Find"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    performSearch(searchText, searchCaseSensitive, searchRegex, e.shiftKey ? 'prev' : 'next');
                  }
                }}
              />
              <span className="plex-search-count">{totalMatches > 0 ? `${currentMatch}/${totalMatches}` : ''}</span>
              <button className="plex-tool-btn ghost" onClick={() => performSearch(searchText, searchCaseSensitive, searchRegex, 'prev')} title="Previous">
                <Icons.ChevronUp />
              </button>
              <button className="plex-tool-btn ghost" onClick={() => performSearch(searchText, searchCaseSensitive, searchRegex, 'next')} title="Next">
                <Icons.ChevronDown />
              </button>
            </div>
            <button className={`plex-tool-btn ${searchCaseSensitive ? 'active' : ''}`} onClick={() => setSearchCaseSensitive(!searchCaseSensitive)} title="Match Case">
              <Icons.CaseSensitive />
            </button>
            <button className={`plex-tool-btn ${searchRegex ? 'active' : ''}`} onClick={() => setSearchRegex(!searchRegex)} title="Use Regex">
              <Icons.Regex />
            </button>
            <button className="plex-tool-btn ghost" onClick={closeSearch} title="Close">
              <Icons.Close />
            </button>
          </div>

          {showReplace && (
            <div className="plex-search-row">
              <div className="plex-search-input-wrap">
                <span className="plex-find-icon"><Icons.Search /></span>
                <input
                  className="plex-search-input"
                  placeholder="Replace"
                  value={replaceText}
                  onChange={e => setReplaceText(e.target.value)}
                />
              </div>
              <button className="plex-action-btn primary" onClick={handleReplaceAll}>Replace All</button>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: showSearch ? 0 : 0 }}>
        <CodeMirror
          ref={editorRef}
          value={value}
          height="100%"
          onChange={onChange}
          theme={theme === 'dark' ? oneDark : githubLight}
          extensions={[
            ...getLanguageExt(currentLanguage),
            ...(wrap ? [EditorView.lineWrapping] : []),
            searchHighlightField as Extension,
            searchKeyBindings as Extension,
            placeholderExt('Start typing...'),
            EditorView.theme({
              '&': { fontSize: `${fontSize}px`, height: '100%', background: 'transparent' },
              '.cm-scroller': { overflow: 'auto' },
              '.cm-content': { padding: '16px 0' },
              '.cm-gutters': { background: 'transparent', border: 'none', color: '#334155' },
              '.cm-activeLine': { background: theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)' },
              '.cm-selectionBackground': { background: '#1e3a8a !important' },
              '.cm-lint-point': { background: 'rgba(239, 68, 68, 0.1)' }
            })
          ]}
          basicSetup={{ searchKeymap: false }}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      
      <div style={{ 
        height: 32, padding: '0 12px', fontSize: '10px', display: 'flex', alignItems: 'center', 
        justifyContent: 'flex-end',
        borderTop: `1px solid ${colors.footerBorder}`,
        background: colors.footerBg,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: '9px', fontWeight: '700', color: colors.textDim, opacity: 0.85, letterSpacing: '0.04em' }}>
            {value.length.toLocaleString()} CHR
          </span>
          <div style={{ width: 1, height: 12, background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
          <div className="footer-lang-group" ref={languageMenuRef}>
            <button
              type="button"
              className={`footer-lang-trigger ${showLanguageMenu ? 'active' : ''}`}
              onClick={() => setShowLanguageMenu(v => !v)}
            >
              <span className="lang-label">
              {language
                ? getLanguageDisplayName(currentLanguage)
                : (autoDetectLanguage
                  ? `Auto · ${getLanguageDisplayName(currentLanguage)}`
                  : getLanguageDisplayName(currentLanguage))}
              </span>
              <span className="chevron-icon">
                <Icons.ChevronDown />
              </span>
            </button>
            {showLanguageMenu && (
              <div className="lang-menu">
                <button
                  type="button"
                  className={`lang-menu-item ${!language ? 'active' : ''}`}
                  onClick={() => {
                    onLanguageChange?.('auto');
                    setShowLanguageMenu(false);
                  }}
                >
                  Auto-detect
                </button>
                {getSupportedLanguages().map(l => (
                  <button
                    key={l.value}
                    type="button"
                    className={`lang-menu-item ${language === l.value ? 'active' : ''}`}
                    onClick={() => {
                      onLanguageChange?.(l.value as SupportedLanguage);
                      setShowLanguageMenu(false);
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
