import React, { useEffect, useState, useRef } from 'react';
import NoteList from './components/NoteList';
import Editor from './components/Editor';
import CustomAlert from './components/CustomAlert';
import Toast from './components/Toast';
import { SupportedLanguage, detectLanguage } from './utils/languageDetector';
import { CONFIG } from './config';
import { resolveFeedbackPresentation } from './utils/feedbackRouting.mjs';
import { getSidebarWidth } from './utils/layout.mjs';
import { exportBackupPayload, parseBackupPayload, getSampleWorkspace } from './utils/noteBackup.mjs';
import { useI18n, LocalePreference } from './i18n';

declare const chrome: any;

export interface Note {
  id: string;
  title: string;
  content: string;
  language?: SupportedLanguage;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  expanded?: boolean;
}

const STORAGE_KEY = 'plexcodeeditor_notes';
const FOLDERS_KEY = 'plexcodeeditor_folders';
const SETTINGS_KEY = 'plexcodeeditor_settings';
const ACTIVE_NOTE_KEY = 'plexcodeeditor_active_note_id';
const PENDING_IMPORT_KEY = 'seecode_pending_import';

const Icons = {
  Edit: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>,
  Sun: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line></svg>,
  Moon: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
  Maximize: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>,
  Compare: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>,
  Download: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  Upload: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
  FileCode: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="10 13 8 15 10 17"></polyline><polyline points="14 13 16 15 14 17"></polyline></svg>,
  ChevronDown: () => <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  Github: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7a3.37 3.37 0 0 0-.94 2.58V22"></path></svg>,
  Message: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
};

function getChromeStorage() {
  return typeof chrome !== 'undefined' && chrome?.storage?.local ? chrome.storage.local : null;
}

function storageGet<T>(key: string, fallback: T): Promise<T> {
  const store = getChromeStorage();
  if (store) {
    return new Promise(resolve => {
      store.get([key], (result: Record<string, any>) => resolve(result[key] ?? fallback));
    });
  }
  try {
    const raw = window.localStorage.getItem(key);
    return Promise.resolve(raw !== null ? (JSON.parse(raw) as T) : fallback);
  } catch {
    return Promise.resolve(fallback);
  }
}

function storageSet(key: string, value: unknown) {
  const store = getChromeStorage();
  if (store) {
    store.set({ [key]: value });
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function storageRemove(key: string) {
  const store = getChromeStorage();
  if (store) {
    store.remove(key);
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function loadNotes(): Promise<Note[]> {
  return storageGet<Note[]>(STORAGE_KEY, []);
}

function saveNotes(notes: Note[]) {
  storageSet(STORAGE_KEY, notes);
}

function loadFolders(): Promise<Folder[]> {
  return storageGet<Folder[]>(FOLDERS_KEY, []);
}

function saveFolders(folders: Folder[]) {
  storageSet(FOLDERS_KEY, folders);
}

function loadSettings(): Promise<{ theme: 'dark' | 'light'; fontSize: number }> {
  return storageGet<{ theme: 'dark' | 'light'; fontSize: number }>(SETTINGS_KEY, { theme: 'dark', fontSize: 13 });
}

function saveSettings(settings: { theme: 'dark' | 'light'; fontSize: number }) {
  storageSet(SETTINGS_KEY, settings);
}

function loadActiveNoteId(): Promise<string | null> {
  return storageGet<string | null>(ACTIVE_NOTE_KEY, null);
}

function saveActiveNoteId(activeId: string | null) {
  if (!activeId) {
    storageRemove(ACTIVE_NOTE_KEY);
    return;
  }
  storageSet(ACTIVE_NOTE_KEY, activeId);
}

function getActiveIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('activeId');
}

function getCompareFromQuery(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('compare') === '1';
}

export default function App({ isPopup = false }) {
  const { t, preference, options: localeOptions, setPreference } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<number>(13);
  const [alertState, setAlertState] = useState<any>(null);
  const [toastState, setToastState] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingCompare, setPendingCompare] = useState<{ rightNoteId?: string; rightText?: string } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);

  const closeAlert = () => setAlertState(prev => prev ? { ...prev, visible: false } : null);
  const closeToast = () => setToastState(prev => prev ? { ...prev, visible: false } : null);

  const showAlert = (options: any) => {
    if (resolveFeedbackPresentation(options) === 'toast') {
      setToastState({
        visible: true,
        message: options.message,
        type: options.type || 'info',
        theme,
        duration: options.duration || (options.actionLabel ? 4500 : 1500),
        actionLabel: options.actionLabel,
        onAction: options.onAction
      });
      return;
    }

    const originalConfirm = options.onConfirm;
    const originalCancel = options.onCancel;

    setAlertState({
      ...options,
      theme,
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

    Promise.all([
      loadNotes(),
      loadActiveNoteId(),
      loadFolders(),
      storageGet<{ text?: string; compare?: boolean; createdAt?: number } | null>(PENDING_IMPORT_KEY, null)
    ]).then(([n, storedActiveId, f, pendingImport]) => {
      hydratedRef.current = true;
      let nextNotes = n;
      let nextActiveId: string | null = null;

      if (!isPopup && pendingImport?.text) {
        storageRemove(PENDING_IMPORT_KEY);
        const importedText = pendingImport.text;
        const queryActiveId = getActiveIdFromQuery();
        const baseActiveId =
          [queryActiveId, storedActiveId].find(id => id && n.some(note => note.id === id)) || (n[0]?.id ?? null);

        if (pendingImport.compare && baseActiveId) {
          nextActiveId = baseActiveId;
          setPendingCompare({ rightText: importedText });
        } else {
          const newId = `clip-${Date.now()}`;
          const newNote: Note = {
            id: newId,
            title: `Clip ${n.length + 1}`,
            content: importedText,
            language: detectLanguage(importedText)
          };
          nextNotes = [...n, newNote];
          nextActiveId = newId;
          if (pendingImport.compare) {
            setPendingCompare({});
          }
        }
      } else {
        const queryActiveId = getActiveIdFromQuery();
        const candidateIds = [queryActiveId, storedActiveId];
        const restoredActiveId = candidateIds.find(id => id && n.some(note => note.id === id)) || null;
        nextActiveId = restoredActiveId || (n[0]?.id ?? null);
      }

      setNotes(nextNotes);
      setFolders(f);
      setActiveId(nextActiveId);

      if (!isPopup && getCompareFromQuery()) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('compare');
          window.history.replaceState({}, '', url.toString());
        } catch {}
        setPendingCompare({});
      }
    });

    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPopup]);

  useEffect(() => {
    if (isPopup) return;
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        if (notes.length === 0) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('seecode:open-compare'));
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isPopup, notes.length]);

  useEffect(() => { if (hydratedRef.current) saveNotes(notes); }, [notes]);
  useEffect(() => { if (hydratedRef.current) saveFolders(folders); }, [folders]);
  useEffect(() => { if (hydratedRef.current) saveActiveNoteId(activeId); }, [activeId]);

  useEffect(() => {
    if (notes.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId && notes.some(n => n.id === activeId)) return;
    setActiveId(notes[0].id);
  }, [notes, activeId]);

  const activeNote = notes.find(n => n.id === activeId);

  useEffect(() => {
    if (isPopup || !pendingCompare || !activeNote) return;
    const detail = pendingCompare;
    setPendingCompare(null);
    window.dispatchEvent(new CustomEvent('seecode:open-compare', { detail }));
  }, [isPopup, pendingCompare, activeNote]);

  const handleAdd = (options: { folderId?: string; language?: SupportedLanguage; title?: string } = {}) => {
    const { folderId, language, title } = options;
    const id = Date.now().toString();
    const newNote: Note = {
      id,
      title: title || t('note.default', { number: notes.length + 1 }),
      content: '',
      folderId,
      language
    };
    setNotes([...notes, newNote]);
    setActiveId(id);
    setEditingId(id);
    if (folderId) {
      setFolders(folders.map(f => f.id === folderId ? { ...f, expanded: true } : f));
    }
  };

  const handleAddFolder = () => {
    const id = `folder-${Date.now()}`;
    const newFolder: Folder = { id, name: t('folder.default', { number: folders.length + 1 }), expanded: true };
    setFolders([...folders, newFolder]);
  };

  const handleRenameFolder = (id: string, newName: string) => {
    setFolders(folders.map(f => f.id === id ? { ...f, name: newName.trim() || t('note.untitled') } : f));
  };

  const handleDeleteFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    const noteCount = notes.filter(n => n.folderId === id).length;
    const deleteFolder = () => {
      // Keep the files: removing a folder moves its contents back to the root.
      setNotes(current => current.map(n => n.folderId === id ? { ...n, folderId: undefined } : n));
      setFolders(current => current.filter(f => f.id !== id));
    };

    if (noteCount === 0) {
      deleteFolder();
      return;
    }

    showAlert({
      type: 'warning',
      title: t('folder.deleteTitle', { name: folder.name }),
      message: t('folder.deleteMessage', { count: noteCount, files: t(noteCount === 1 ? 'files.one' : 'files.many') }),
      confirmText: t('folder.deleteConfirm'),
      cancelText: t('common.cancel'),
      onConfirm: deleteFolder,
      onCancel: () => {}
    });
  };

  const handleToggleFolder = (id: string) => {
    setFolders(folders.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
  };

  const handleMoveNote = (noteId: string, folderId: string | undefined) => {
    setNotes(notes.map(n => n.id === noteId ? { ...n, folderId } : n));
    if (folderId) {
      setFolders(folders.map(f => f.id === folderId ? { ...f, expanded: true } : f));
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    setNotes(notes.map(n => n.id === id ? { ...n, title: newTitle.trim() || t('note.untitled') } : n));
    setEditingId(null);
  };

  const handleDeleteNote = (id: string) => {
    const idx = notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    const deleted = notes[idx];
    setNotes(prev => prev.filter(n => n.id !== id));
    showAlert({
      type: 'info',
      presentation: 'toast',
      duration: 4500,
      message: t('note.deletedToast', { title: deleted.title }),
      actionLabel: t('diff.undo'),
      onAction: () => {
        setNotes(prev => {
          if (prev.some(n => n.id === deleted.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(idx, next.length), 0, deleted);
          return next;
        });
        setActiveId(deleted.id);
      }
    });
  };

  const handleCreateNoteFromDiff = (title: string, content: string, language?: SupportedLanguage) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNote: Note = {
      id,
      title,
      content,
      language: language || detectLanguage(content)
    };
    setNotes(prev => [...prev, newNote]);
    return id;
  };

  const handleLoadSampleDiff = () => {
    const [left, right] = getSampleWorkspace();
    const leftNote: Note = { ...left };
    const rightNote: Note = { ...right };
    setNotes(prev => [...prev, leftNote, rightNote]);
    setActiveId(leftNote.id);
    if (isPopup) {
      try {
        if (typeof chrome !== 'undefined' && chrome?.tabs?.create && chrome?.runtime?.getURL) {
          chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') + `?compare=1&activeId=${leftNote.id}` });
          window.close();
          return;
        }
      } catch {}
    }
    setPendingCompare({ rightNoteId: rightNote.id });
  };

  const triggerDownload = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportBackup = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const payload = exportBackupPayload(notes, folders, CONFIG.VERSION);
    triggerDownload(`diffpad-backup-${dateStamp}.json`, payload, 'application/json;charset=utf-8');
    setShowSettings(false);
    showAlert({ type: 'success', presentation: 'toast', message: t('settings.backupExported') });
  };

  const handleDownloadActiveNote = () => {
    if (!activeNote) return;
    const extMap: Record<SupportedLanguage, string> = {
      plaintext: 'txt',
      json: 'json',
      javascript: 'js',
      python: 'py',
      java: 'java',
      sql: 'sql',
      markdown: 'md'
    };
    const lang = activeNote.language || detectLanguage(activeNote.content);
    const ext = extMap[lang] || 'txt';
    const rawName = (activeNote.title || 'snippet').replace(/[\\/:*?"<>|]/g, '_');
    const filename = rawName.includes('.') ? rawName : `${rawName}.${ext}`;
    triggerDownload(filename, activeNote.content);
    setShowSettings(false);
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === 'string' ? reader.result : '';
        const parsed = parseBackupPayload(raw);
        if (parsed.notes.length === 0 && parsed.folders.length === 0) {
          showAlert({ type: 'error', presentation: 'toast', message: t('settings.backupInvalid') });
          return;
        }
        const suffix = Date.now().toString(36);
        const existingFolderIds = new Set(folders.map(f => f.id));
        const folderIdMap = new Map<string, string>();
        const nextFolders = parsed.folders.map((f: Folder, i: number) => {
          const id = existingFolderIds.has(f.id) ? `${f.id}-${suffix}-${i}` : f.id;
          folderIdMap.set(f.id, id);
          return { ...f, id };
        });

        const existingNoteIds = new Set(notes.map(n => n.id));
        const nextNotes = parsed.notes.map((n: Note, i: number) => {
          const id = existingNoteIds.has(n.id) ? `${n.id}-${suffix}-${i}` : n.id;
          const mappedFolderId = n.folderId ? (folderIdMap.get(n.folderId) || n.folderId) : undefined;
          return { ...n, id, folderId: mappedFolderId };
        });

        setFolders(prev => [...prev, ...nextFolders]);
        setNotes(prev => [...prev, ...nextNotes]);
        if (!activeId && nextNotes.length > 0) {
          setActiveId(nextNotes[0].id);
        }
        setShowSettings(false);
        showAlert({
          type: 'success',
          presentation: 'toast',
          message: t('settings.backupImported', {
            count: nextNotes.length,
            files: t(nextNotes.length === 1 ? 'files.one' : 'files.many')
          })
        });
      } catch {
        showAlert({ type: 'error', presentation: 'toast', message: t('settings.backupInvalid') });
      }
    };
    reader.readAsText(file);
  };

  const openCompareView = () => {
    if (!activeNote) return;
    if (isPopup) {
      if (typeof chrome !== 'undefined' && chrome?.tabs?.create && chrome?.runtime?.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') + `?compare=1&activeId=${activeNote.id}` });
        window.close();
      } else {
        window.location.href = `editor.html?compare=1&activeId=${activeNote.id}`;
      }
      return;
    }
    window.dispatchEvent(new CustomEvent('seecode:open-compare'));
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
        
        .header-context { display: flex; align-items: center; padding: 0; }
        .note-title-trigger {
          display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px;
          cursor: pointer; transition: background 0.15s ease; border: none; background: transparent; color: ${colors.text};
        }
        .note-title-trigger:hover { background: ${colors.badgeHover}; }

        .header-compare-btn {
          display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
          border-radius: 7px; border: 1px solid ${theme === 'dark' ? 'rgba(96, 165, 250, 0.28)' : 'rgba(59, 130, 246, 0.28)'};
          background: ${theme === 'dark' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)'};
          color: ${theme === 'dark' ? '#93c5fd' : '#2563eb'};
          font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;
        }
        .header-compare-btn:hover {
          background: #3b82f6; color: #ffffff; border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .empty-state-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          height: 34px; padding: 0 14px; border-radius: 8px;
          font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;
          border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'};
          background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc'};
          color: ${colors.text};
        }
        .empty-state-btn:hover {
          border-color: #3b82f6;
          background: ${theme === 'dark' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(59, 130, 246, 0.08)'};
          color: ${theme === 'dark' ? '#93c5fd' : '#2563eb'};
        }
        .empty-state-btn.primary {
          background: #3b82f6; border-color: #3b82f6; color: #ffffff;
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.28);
        }
        .empty-state-btn.primary:hover {
          background: #2563eb; border-color: #2563eb; color: #ffffff;
        }

        .settings-menu {
          position: absolute; top: 34px; right: 8px; width: 224px;
          background: ${colors.dropdownBg}; backdrop-filter: blur(20px);
          border: 1px solid ${colors.border}; border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.18); z-index: 1000;
          padding: 5px; animation: slideDown 0.15s ease-out;
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        
        .menu-item {
          display: flex; align-items: center; gap: 8px; padding: 6px 10px;
          border-radius: 6px; cursor: pointer; color: ${colors.textSec};
          font-size: 11px; font-weight: 600; transition: all 0.15s;
          text-decoration: none; border: none; background: transparent; width: 100%; text-align: left;
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
        folders={folders}
        activeId={activeId || ''}
        theme={theme}
        onAdd={handleAdd}
        onAddFolder={handleAddFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onToggleFolder={handleToggleFolder}
        onMoveNote={handleMoveNote}
        onDelete={handleDeleteNote}
        onRename={handleRename}
        onSelect={(id) => { setEditingId(null); setActiveId(id); }}
        onReorder={(f, t) => {
          setNotes(prev => {
            const arr = [...prev];
            const [moved] = arr.splice(f, 1);
            arr.splice(t, 0, moved);
            return arr;
          });
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
            {activeNote && editingId === activeId ? (
              <input
                ref={titleInputRef}
                className="title-input"
                defaultValue={activeNote.title}
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
                <button
                  type="button"
                  className="note-title-trigger"
                  onClick={() => activeId && setEditingId(activeId)}
                  disabled={!activeId}
                  aria-label={activeNote?.title || t('note.noActive')}
                >
                  <span style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '-0.01em' }}>
                    {activeNote?.title || t('note.noActive')}
                  </span>
                  {activeNote && <div style={{ opacity: 0.35, display: 'flex' }}><Icons.Edit /></div>}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} ref={settingsRef}>
            {activeNote && (
              <button
                type="button"
                className="header-compare-btn"
                onClick={openCompareView}
                title={t('header.compareTitle')}
              >
                <Icons.Compare />
                <span>{t('header.compare')}</span>
              </button>
            )}

            {isPopup && activeNote && (
               <>
                 <button
                   type="button"
                   className="open-btn"
                   title={t('settings.openFullEditor')}
                   aria-label={t('settings.openFullEditor')}
                   onClick={() => {
                     if (typeof chrome !== 'undefined' && chrome?.tabs?.create && chrome?.runtime?.getURL) {
                       chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') + `?activeId=${activeNote.id}` });
                       window.close();
                     } else {
                       window.location.href = `editor.html?activeId=${activeNote.id}`;
                     }
                   }}
                 ><Icons.Maximize /></button>
                 <div style={{ width: 1, height: 14, background: colors.border, margin: '0 2px' }} />
               </>
            )}
            
            <button
              type="button"
              className={`util-btn ${showSettings ? 'active' : ''}`} 
              onClick={() => setShowSettings(!showSettings)}
              title={t('settings.title')}
              aria-label={t('settings.title')}
            >
              <Icons.Settings />
            </button>

            {showSettings && (
              <div className="settings-menu">
                <div className="control-row">
                  <div className="control-group">
                    <button
                      type="button"
                      className="util-btn"
                      onClick={toggleTheme}
                      style={{ padding: '3px' }}
                      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    >
                      {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
                    </button>
                  </div>
                  <div style={{ width: 1, height: 12, background: colors.border }} />
                  <div className="control-group">
                    <button type="button" className="util-btn" onClick={() => updateFontSize(-1)} style={{fontSize: 10, padding: '2px 6px'}} aria-label="Decrease font size">-</button>
                    <span style={{fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'center'}}>{fontSize}</span>
                    <button type="button" className="util-btn" onClick={() => updateFontSize(1)} style={{fontSize: 10, padding: '2px 6px'}} aria-label="Increase font size">+</button>
                  </div>
                </div>

                <label className="menu-item" style={{ cursor: 'default' }}>
                  <span style={{ flex: 1 }}>{t('settings.language')}</span>
                  <select
                    aria-label={t('settings.language')}
                    value={preference}
                    onChange={e => setPreference(e.target.value as LocalePreference)}
                    style={{
                      maxWidth: 112, border: `1px solid ${colors.border}`, borderRadius: 5,
                      background: colors.badge, color: colors.text, fontSize: 10, padding: '3px 4px'
                    }}
                  >
                    {localeOptions.map(option => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
                  </select>
                </label>

                {activeNote && (
                  <button type="button" className="menu-item" onClick={handleDownloadActiveNote}>
                    <Icons.Download /> {t('settings.downloadFile')}
                  </button>
                )}
                <button type="button" className="menu-item" onClick={handleExportBackup}>
                  <Icons.Download /> {t('settings.exportBackup')}
                </button>
                <button type="button" className="menu-item" onClick={() => backupInputRef.current?.click()}>
                  <Icons.Upload /> {t('settings.importBackup')}
                </button>

                <div style={{ height: 1, background: colors.border, margin: '4px 6px' }} />

                <a href={CONFIG.GITHUB_URL} target="_blank" rel="noreferrer" className="menu-item">
                  <Icons.Github /> {t('settings.github')}
                </a>
                <a href={CONFIG.FEEDBACK_URL} target="_blank" rel="noreferrer" className="menu-item">
                  <Icons.Message /> {t('settings.feedback')}
                </a>

                <div style={{ 
                  marginTop: 4, paddingTop: 4, borderTop: `1px solid ${colors.border}`, 
                  textAlign: 'center', fontSize: '8px', color: colors.textSec, fontWeight: 800, opacity: 0.45 
                }}>
                  {t('settings.version', { version: CONFIG.VERSION })}
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
              onChange={(c) => setNotes(prev => prev.map(n => n.id === activeId ? { ...n, content: c } : n))}
              isPopup={isPopup}
              theme={theme}
              fontSize={fontSize}
              language={activeNote.language}
              onLanguageChange={(lang) => setNoteLanguage(activeId!, lang)}
              allNotes={notes}
              activeNoteId={activeId}
              activeNoteTitle={activeNote.title}
              onSaveNote={(noteId, content) =>
                setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content } : n))}
              onCreateNote={handleCreateNoteFromDiff}
              showAlert={showAlert}
            />
          ) : (
            <div style={{
              flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center'
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: theme === 'dark' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(59, 130, 246, 0.08)',
                border: `1px solid ${theme === 'dark' ? 'rgba(96, 165, 250, 0.25)' : 'rgba(59, 130, 246, 0.2)'}`,
                color: '#3b82f6', marginBottom: 16
              }}>
                <img src="/icon.svg" alt="DiffPad" style={{ width: 28, height: 28 }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.text, letterSpacing: '-0.02em' }}>
                {t('note.emptyTitle')}
              </h2>
              <p style={{
                margin: '8px 0 22px', maxWidth: 380, fontSize: 12, lineHeight: 1.6,
                color: colors.textSec, fontWeight: 500
              }}>
                {t('note.emptySubtitle')}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <button
                  type="button"
                  className="empty-state-btn primary"
                  onClick={() => handleAdd({ language: 'json', title: `JSON ${notes.length + 1}` })}
                >
                  <Icons.FileCode />
                  {t('note.createJson')}
                </button>
                <button
                  type="button"
                  className="empty-state-btn"
                  onClick={handleLoadSampleDiff}
                >
                  <Icons.Compare />
                  {t('note.loadSampleDiff')}
                </button>
                <button
                  type="button"
                  className="empty-state-btn"
                  onClick={() => backupInputRef.current?.click()}
                >
                  <Icons.Upload />
                  {t('note.importBackup')}
                </button>
              </div>
            </div>
          )}
          {toastState && <Toast {...toastState} onDone={closeToast} />}
        </div>
      </div>

      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportBackupFile}
      />

      {alertState && <CustomAlert {...alertState} />}
    </div>
  );
}
