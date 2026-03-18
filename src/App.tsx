import React, { useEffect, useState, useRef } from 'react';
import NoteList from './components/NoteList';
import Editor from './components/Editor';
import CustomAlert from './components/CustomAlert';
import Toast from './components/Toast';
import { SupportedLanguage, getSupportedLanguages } from './utils/languageDetector';
import { LanguageIcon } from './components/LanguageIcons';
import { CONFIG } from './config';
import { resolveFeedbackPresentation } from './utils/feedbackRouting.mjs';
import { getSidebarWidth } from './utils/layout.mjs';

declare const chrome: any;

export interface Note {
  id: string;
  title: string;
  content: string;
  language?: SupportedLanguage;
}

const STORAGE_KEY = 'plexcodeeditor_notes';
const SETTINGS_KEY = 'plexcodeeditor_settings';
const ACTIVE_NOTE_KEY = 'plexcodeeditor_active_note_id';

const Icons = {
  Edit: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>,
  Sun: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line></svg>,
  Moon: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
  Maximize: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>,
  ChevronDown: () => <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  Github: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7a3.37 3.37 0 0 0-.94 2.58V22"></path></svg>,
  Message: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
};

function loadNotes(): Promise<Note[]> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => resolve(result[STORAGE_KEY] || []));
  });
}

function saveNotes(notes: Note[]) {
  chrome.storage.local.set({ [STORAGE_KEY]: notes });
}

function loadSettings(): Promise<{ theme: 'dark' | 'light'; fontSize: number }> {
  return new Promise(resolve => {
    chrome.storage.local.get([SETTINGS_KEY], result => resolve(result[SETTINGS_KEY] || { theme: 'dark', fontSize: 13 }));
  });
}

function saveSettings(settings: { theme: 'dark' | 'light'; fontSize: number }) {
  chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

function loadActiveNoteId(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([ACTIVE_NOTE_KEY], result => resolve(result[ACTIVE_NOTE_KEY] || null));
  });
}

function saveActiveNoteId(activeId: string | null) {
  if (!activeId) {
    chrome.storage.local.remove(ACTIVE_NOTE_KEY);
    return;
  }
  chrome.storage.local.set({ [ACTIVE_NOTE_KEY]: activeId });
}

function getActiveIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('activeId');
}

export default function App({ isPopup = false }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<number>(13);
  const [alertState, setAlertState] = useState<any>(null);
  const [toastState, setToastState] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const closeAlert = () => setAlertState(prev => prev ? { ...prev, visible: false } : null);
  const closeToast = () => setToastState(prev => prev ? { ...prev, visible: false } : null);

  const showAlert = (options: any) => {
    if (resolveFeedbackPresentation(options) === 'toast') {
      setToastState({
        visible: true,
        message: options.message,
        type: options.type || 'info',
        theme,
        duration: options.duration || 1500
      });
      return;
    }

    const originalConfirm = options.onConfirm;
    const originalCancel = options.onCancel;

    setAlertState({
      ...options,
      visible: true,
      onConfirm: () => {
        if (originalConfirm) originalConfirm();
        closeAlert();
      },
      onCancel: originalCancel ? () => {
        originalCancel();
        closeAlert();
      } : undefined
    });
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveSettings({ theme: next, fontSize });
  };

  const updateFontSize = (delta: number) => {
    const next = Math.max(10, Math.min(20, fontSize + delta));
    setFontSize(next);
    saveSettings({ theme, fontSize: next });
  };

  useEffect(() => {
    loadSettings().then(s => {
      setTheme(s.theme);
      setFontSize(s.fontSize);
    });

    Promise.all([loadNotes(), loadActiveNoteId()]).then(([n, storedActiveId]) => {
      setNotes(n);
      const queryActiveId = getActiveIdFromQuery();
      const candidateIds = [queryActiveId, storedActiveId];
      const restoredActiveId = candidateIds.find(id => id && n.some(note => note.id === id)) || null;
      setActiveId(restoredActiveId || (n[0]?.id ?? null));
    });

    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => { saveNotes(notes); }, [notes]);
  useEffect(() => { saveActiveNoteId(activeId); }, [activeId]);

  useEffect(() => {
    if (notes.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId && notes.some(n => n.id === activeId)) return;
    setActiveId(notes[0].id);
  }, [notes, activeId]);

  const activeNote = notes.find(n => n.id === activeId);

  const handleAdd = () => {
    const id = Date.now().toString();
    const newNote: Note = { id, title: `Note ${notes.length + 1}`, content: '' };
    setNotes([...notes, newNote]);
    setActiveId(id);
    setEditingId(id);
  };

  const handleRename = (id: string, newTitle: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, title: newTitle.trim() || 'Untitled' } : n));
    setEditingId(null);
  };

  const setNoteLanguage = (id: string, lang: SupportedLanguage | 'auto') => {
    setNotes(notes.map(n => n.id === id ? { ...n, language: lang === 'auto' ? undefined : lang } : n));
  };

  const colors = theme === 'dark' ? {
    bg: '#0f111a',
    header: '#0d0f14',
    border: 'rgba(255,255,255,0.05)',
    text: '#f8fafc',
    textSec: '#94a3b8',
    inputBg: 'rgba(255,255,255,0.05)',
    sbTrack: '#0f111a',
    sbThumb: '#334155',
    sbHover: '#475569',
    badge: 'rgba(255,255,255,0.03)',
    badgeHover: 'rgba(59, 130, 246, 0.1)',
    dropdownBg: 'rgba(13, 15, 20, 0.95)',
    dropdownItemHover: 'rgba(255,255,255,0.05)'
  } : {
    bg: '#ffffff',
    header: '#f8fafc',
    border: '#f1f5f9',
    text: '#0f172a',
    textSec: '#64748b',
    inputBg: 'rgba(0,0,0,0.03)',
    sbTrack: '#f8fafc',
    sbThumb: '#cbd5e1',
    sbHover: '#94a3b8',
    badge: '#f1f5f9',
    badgeHover: '#e2e8f0',
    dropdownBg: 'rgba(255, 255, 255, 0.98)',
    dropdownItemHover: 'rgba(0,0,0,0.03)'
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw', 
      background: colors.bg,
      fontFamily: '"Inter", sans-serif',
      color: colors.text,
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${colors.sbTrack}; }
        ::-webkit-scrollbar-thumb { background: ${colors.sbThumb}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${colors.sbHover}; }

        .util-btn { padding: 4px; border-radius: 6px; border: none; background: transparent; color: #64748b; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; }
        .util-btn:hover { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .util-btn.active { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
        
        .open-btn { background: transparent; color: #64748b; border: none; padding: 4px; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
        .open-btn:hover { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

        .title-input { background: ${colors.inputBg}; border: 1px solid #3b82f6; color: ${colors.text}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; outline: none; width: 140px; }
        
        .header-context { display: flex; align-items: center; padding: 0; transition: all 0.2s; }
        .note-title-trigger { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .note-title-trigger:hover { background: ${colors.badgeHover}; }

        .settings-menu {
          position: absolute; top: 32px; right: 8px; width: 185px;
          background: ${colors.dropdownBg}; backdrop-filter: blur(20px);
          border: 1px solid ${colors.border}; border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 1000;
          padding: 5px; animation: slideDown 0.15s ease-out;
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        
        .menu-item {
          display: flex; align-items: center; gap: 8px; padding: 6px 10px;
          border-radius: 6px; cursor: pointer; color: ${colors.textSec};
          font-size: 11px; font-weight: 600; transition: all 0.15s;
          text-decoration: none;
        }
        .menu-item:hover { background: ${colors.dropdownItemHover}; color: #3b82f6; }
        
        .control-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 4px 6px; margin-bottom: 2px; border-bottom: 1px solid ${colors.border};
        }
        .control-group { display: flex; align-items: center; gap: 2px; background: ${colors.badge}; padding: 1px; border-radius: 5px; }
      `}</style>

      <NoteList
        notes={notes}
        activeId={activeId || ''}
        theme={theme}
        onAdd={handleAdd}
        onDelete={(id) => setNotes(notes.filter(n => n.id !== id))}
        onRename={handleRename}
        onSelect={setActiveId}
        onReorder={(f, t) => {
          const arr = [...notes];
          const [moved] = arr.splice(f, 1);
          arr.splice(t, 0, moved);
          setNotes(arr);
        }}
        isPopup={isPopup}
        style={{ width: getSidebarWidth(isPopup), borderRight: `1px solid ${colors.border}`, flexShrink: 0 }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <div style={{ 
          height: 40, 
          background: colors.header, 
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 12px',
          flexShrink: 0,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {editingId === activeId ? (
              <input
                ref={titleInputRef}
                className="title-input"
                defaultValue={activeNote?.title}
                autoFocus
                onFocus={(e) => e.target.select()}
                onBlur={(e) => handleRename(activeId!, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(activeId!, (e.target as HTMLInputElement).value);
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <div className="header-context">
                <div className="note-title-trigger" onClick={() => activeId && setEditingId(activeId)}>
                   <span style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '-0.01em' }}>
                     {activeNote?.title || 'No active note'}
                   </span>
                   <div style={{ opacity: 0.3 }}><Icons.Edit /></div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} ref={settingsRef}>
            {isPopup && activeNote && (
               <>
                 <button className="open-btn" title="Open Full Editor" onClick={() => {
                   chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') + `?activeId=${activeNote.id}` });
                   window.close();
                 }}><Icons.Maximize /></button>
                 <div style={{ width: 1, height: 14, background: colors.border, margin: '0 2px' }} />
               </>
            )}
            
            <button 
              className={`util-btn ${showSettings ? 'active' : ''}`} 
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Icons.Settings />
            </button>

            {showSettings && (
              <div className="settings-menu">
                <div className="control-row">
                  <div className="control-group">
                    <button className="util-btn" onClick={toggleTheme} style={{padding: '3px'}}>
                      {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
                    </button>
                  </div>
                  <div style={{ width: 1, height: 12, background: colors.border }} />
                  <div className="control-group">
                    <button className="util-btn" onClick={() => updateFontSize(-1)} style={{fontSize: 10, padding: '2px 6px'}}>-</button>
                    <span style={{fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'center'}}>{fontSize}</span>
                    <button className="util-btn" onClick={() => updateFontSize(1)} style={{fontSize: 10, padding: '2px 6px'}}>+</button>
                  </div>
                </div>

                <a href={CONFIG.GITHUB_URL} target="_blank" className="menu-item">
                  <Icons.Github /> GitHub Repository
                </a>
                <a href={CONFIG.FEEDBACK_URL} target="_blank" className="menu-item">
                  <Icons.Message /> Send Feedback
                </a>

                <div style={{ 
                  marginTop: 4, paddingTop: 4, borderTop: `1px solid ${colors.border}`, 
                  textAlign: 'center', fontSize: '8px', color: colors.textSec, fontWeight: 800, opacity: 0.4 
                }}>
                  VERSION {CONFIG.VERSION}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {activeNote ? (
            <Editor 
              key={activeId}
              value={activeNote.content} 
              onChange={(c) => setNotes(notes.map(n => n.id === activeId ? { ...n, content: c } : n))}
              isPopup={isPopup}
              theme={theme}
              fontSize={fontSize}
              language={activeNote.language}
              onLanguageChange={(lang) => setNoteLanguage(activeId!, lang)}
              showAlert={showAlert}
            />
          ) : (
            <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
               <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
               <p style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>Select a note</p>
            </div>
          )}
          {toastState && <Toast {...toastState} onDone={closeToast} />}
        </div>
      </div>

      {alertState && <CustomAlert {...alertState} />}
    </div>
  );
}
