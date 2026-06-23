import React, { useEffect, useRef, useState } from 'react';
import { Note, Folder } from '../App';
import { LanguageIcon } from './LanguageIcons';
import { BRAND_FONT_FAMILY, BRAND_NAME, getBrandStyle } from './brandStyles.mjs';
import { SupportedLanguage, getLanguageDisplayName } from '../utils/languageDetector';

interface AddNoteOptions {
  folderId?: string;
  language?: SupportedLanguage;
  title?: string;
}

interface Props {
  notes: Note[];
  folders: Folder[];
  activeId: string;
  theme: 'dark' | 'light';
  onAdd: (options?: AddNoteOptions) => void;
  onAddFolder: () => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  isPopup?: boolean;
  style?: React.CSSProperties;
  onOpenFloatingSticky?: (id: string, pos?: { x: number; y: number }) => void;
}

const Icons = {
  Code: () => (
    <img
      src="/icon.svg"
      alt="Seecode Logo"
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        marginRight: 8,
        display: 'block',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
      }}
    />
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
  ),
  Folder: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
  ),
  FolderOpen: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"></path></svg>
  ),
  FolderMenu: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
  ),
  Chevron: ({ expanded }: { expanded: boolean }) => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease'
      }}
    >
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
  )
};

// File types shown in the "New" dropdown — kept in a natural author-friendly order.
const FILE_TYPES: Array<{ language: SupportedLanguage; label: string; ext: string }> = [
  { language: 'plaintext', label: 'Text', ext: '.txt' },
  { language: 'markdown',  label: 'Markdown', ext: '.md' },
  { language: 'json',      label: 'JSON', ext: '.json' },
  { language: 'javascript',label: 'JavaScript', ext: '.js' },
  { language: 'python',    label: 'Python', ext: '.py' },
  { language: 'java',      label: 'Java', ext: '.java' },
  { language: 'sql',       label: 'SQL', ext: '.sql' }
];

export default function NoteList({
  notes,
  folders,
  activeId,
  theme,
  onAdd,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleFolder,
  onMoveNote,
  onDelete,
  onRename,
  onSelect,
  onReorder,
  isPopup,
  style
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);
  const editingFolderInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editingId) return;
    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    if (!editingFolderId) return;
    editingFolderInputRef.current?.focus();
    editingFolderInputRef.current?.select();
  }, [editingFolderId]);

  useEffect(() => {
    if (!showAddMenu) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addMenuRef.current && addMenuRef.current.contains(target)) return;
      if (addBtnRef.current && addBtnRef.current.contains(target)) return;
      setShowAddMenu(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddMenu(false);
    };
    const handleReposition = () => setShowAddMenu(false);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [showAddMenu]);

  const MENU_WIDTH = 188;
  const MENU_GAP = 6;
  const VIEWPORT_MARGIN = 8;

  const openAddMenu = () => {
    const btn = addBtnRef.current;
    if (!btn) {
      setShowAddMenu(true);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + MENU_GAP;
    // Right-align the menu to the button, then clamp inside the viewport so popup mode never clips it.
    let left = rect.right - MENU_WIDTH;
    const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
    if (left > maxLeft) left = maxLeft;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    setAddMenuPos({ top, left });
    setShowAddMenu(true);
  };

  const toggleAddMenu = () => {
    if (showAddMenu) setShowAddMenu(false);
    else openAddMenu();
  };

  const colors = theme === 'dark' ? {
    sidebarBg: '#090b10',
    itemActive: 'rgba(59, 130, 246, 0.15)',
    itemHover: 'rgba(255,255,255,0.03)',
    text: '#f8fafc',
    textSec: '#64748b',
    border: 'rgba(255,255,255,0.05)',
    plusBtnBg: 'rgba(59, 130, 246, 0.12)',
    plusBtnText: '#60a5fa',
    folderHeaderHover: 'rgba(255,255,255,0.05)',
    folderAccent: '#fbbf24',
    dropTargetBg: 'rgba(59, 130, 246, 0.12)',
    dropTargetBorder: 'rgba(59, 130, 246, 0.5)',
    menuBg: 'rgba(13, 15, 20, 0.96)',
    menuBorder: 'rgba(255,255,255,0.08)',
    menuItemHover: 'rgba(59, 130, 246, 0.12)',
    menuDivider: 'rgba(255,255,255,0.06)',
    menuShortcut: '#475569'
  } : {
    sidebarBg: '#ffffff',
    itemActive: 'rgba(59, 130, 246, 0.08)',
    itemHover: 'rgba(0,0,0,0.02)',
    text: '#0f172a',
    textSec: '#64748b',
    border: '#f1f5f9',
    plusBtnBg: 'rgba(59, 130, 246, 0.08)',
    plusBtnText: '#3b82f6',
    folderHeaderHover: 'rgba(0,0,0,0.04)',
    folderAccent: '#f59e0b',
    dropTargetBg: 'rgba(59, 130, 246, 0.08)',
    dropTargetBorder: 'rgba(59, 130, 246, 0.4)',
    menuBg: 'rgba(255, 255, 255, 0.98)',
    menuBorder: 'rgba(0,0,0,0.08)',
    menuItemHover: 'rgba(59, 130, 246, 0.08)',
    menuDivider: '#f1f5f9',
    menuShortcut: '#94a3b8'
  };
  const brandStyle = getBrandStyle(theme);

  const beginRename = (note: Note) => {
    setEditingId(note.id);
    setEditingTitle(note.title);
  };

  const commitRename = (id: string) => {
    const next = editingTitle.trim() || 'Untitled';
    onRename(id, next);
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const beginRenameFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const commitRenameFolder = (id: string) => {
    onRenameFolder(id, editingFolderName.trim() || 'Untitled');
    setEditingFolderId(null);
  };

  const cancelRenameFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleNoteDragStart = (e: React.DragEvent, noteId: string) => {
    setDraggedNoteId(noteId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', noteId);
  };

  const handleNoteDragEnd = () => {
    setDraggedNoteId(null);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    if (!draggedNoteId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
    setIsDragOverRoot(false);
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNoteId) onMoveNote(draggedNoteId, folderId);
    setDraggedNoteId(null);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (!draggedNoteId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverFolderId) setIsDragOverRoot(true);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedNoteId && !dragOverFolderId) onMoveNote(draggedNoteId, undefined);
    setDraggedNoteId(null);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
  };

  const handleCreateFile = (type: typeof FILE_TYPES[number]) => {
    const sameLangCount = notes.filter(n => (n.language || 'plaintext') === type.language).length;
    const baseLabel = type.label;
    const title = `${baseLabel} ${sameLangCount + 1}${type.ext}`;
    onAdd({ language: type.language, title });
    setShowAddMenu(false);
  };

  const handleCreateFolder = () => {
    onAddFolder();
    setShowAddMenu(false);
  };

  const renderNoteItem = (note: Note, indent: boolean = false) => {
    const isActive = activeId === note.id;
    const isDragging = draggedNoteId === note.id;
    return (
      <div
        key={note.id}
        draggable={editingId !== note.id}
        onDragStart={(e) => handleNoteDragStart(e, note.id)}
        onDragEnd={handleNoteDragEnd}
        onMouseEnter={() => setHoveredId(note.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => onSelect(note.id)}
        onDoubleClick={() => beginRename(note)}
        style={{
          padding: '7px 10px',
          paddingLeft: indent ? '26px' : '10px',
          borderTopLeftRadius: isActive ? 0 : 8,
          borderBottomLeftRadius: isActive ? 0 : 8,
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
          marginBottom: '3px',
          cursor: 'pointer',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isActive ? colors.itemActive : 'transparent',
          color: isActive ? '#60a5fa' : (hoveredId === note.id ? colors.text : colors.textSec),
          transition: 'background 0.15s ease, color 0.15s ease',
          opacity: isDragging ? 0.35 : 1,
          borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
          fontWeight: isActive ? 700 : 500
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, overflow: 'hidden' }}>
          <LanguageIcon language={note.language} content={note.content} size={14} />
          {editingId === note.id ? (
            <input
              ref={editingInputRef}
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              onBlur={() => commitRename(note.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(note.id);
                if (e.key === 'Escape') cancelRename();
              }}
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1,
                minWidth: 0,
                background: theme === 'dark' ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? 'rgba(96, 165, 250, 0.6)' : '#93c5fd'}`,
                color: colors.text,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 6px',
                outline: 'none'
              }}
            />
          ) : (
            <span title="Double-click to rename" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {note.title}
            </span>
          )}
        </div>

        {hoveredId === note.id && !isDragging && editingId !== note.id && (
          <div
            style={{ display: 'flex', gap: 4, marginLeft: 6 }}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => onDelete(note.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', color: '#ef4444', opacity: 0.6 }}
              className="sidebar-btn-subtle"
            ><Icons.Trash /></button>
          </div>
        )}
      </div>
    );
  };

  const rootNotes = notes.filter(n => !n.folderId || !folders.some(f => f.id === n.folderId));

  return (
    <div style={{ ...style, background: colors.sidebarBg, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <div style={{
        height: 40,
        padding: '0 10px 0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Icons.Code />
          <span
            className="brand-badge"
            style={{
              fontSize: '13px',
              fontWeight: '700',
              color: brandStyle.text,
              letterSpacing: brandStyle.letterSpacing,
              textTransform: 'none',
              opacity: 1,
              fontFamily: BRAND_FONT_FAMILY,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              textShadow: brandStyle.glow
            }}>
            <span style={{ color: brandStyle.accent }}>{BRAND_NAME.slice(0, 3)}</span>{BRAND_NAME.slice(3)}
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            ref={addBtnRef}
            onClick={(e) => { e.stopPropagation(); toggleAddMenu(); }}
            className={`add-note-btn ${showAddMenu ? 'is-open' : ''}`}
            title="New…"
            style={{
              width: '26px',
              height: '26px',
              background: colors.plusBtnBg,
              color: colors.plusBtnText,
              border: 'none',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Icons.Plus />
          </button>

          {showAddMenu && addMenuPos && (
            <div
              ref={addMenuRef}
              className="add-menu"
              style={{
                position: 'fixed',
                top: addMenuPos.top,
                left: addMenuPos.left,
                width: MENU_WIDTH,
                background: colors.menuBg,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${colors.menuBorder}`,
                borderRadius: 10,
                boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
                padding: 5,
                zIndex: 2000
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="menu-row"
                onClick={handleCreateFolder}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '7px 10px',
                  border: 'none',
                  background: 'transparent',
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRadius: 6,
                  textAlign: 'left',
                  transition: 'background 0.12s ease'
                }}
              >
                <span style={{ color: colors.folderAccent, display: 'flex' }}><Icons.FolderMenu /></span>
                <span style={{ flex: 1 }}>New folder</span>
              </button>

              <div style={{ height: 1, background: colors.menuDivider, margin: '4px 6px' }} />

              <div style={{
                padding: '4px 10px 2px',
                fontSize: 9,
                fontWeight: 800,
                color: colors.textSec,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.7
              }}>
                New file
              </div>

              {FILE_TYPES.map(type => (
                <button
                  key={type.language}
                  className="menu-row"
                  onClick={() => handleCreateFile(type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    borderRadius: 6,
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                >
                  <LanguageIcon language={type.language} size={14} />
                  <span style={{ flex: 1 }}>{type.label}</span>
                  <span style={{
                    fontSize: 10,
                    color: colors.menuShortcut,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontWeight: 600
                  }}>{type.ext}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 8px 20px',
          outline: isDragOverRoot && !dragOverFolderId
            ? `1px dashed ${colors.dropTargetBorder}`
            : 'none',
          outlineOffset: -4,
          borderRadius: 4,
          transition: 'outline 0.15s ease'
        }}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDragOverRoot(false);
        }}
      >
        {folders.map(folder => {
          const folderNotes = notes.filter(n => n.folderId === folder.id);
          const isExpanded = folder.expanded !== false;
          const isDropTarget = dragOverFolderId === folder.id;
          const isHovered = hoveredFolderId === folder.id;
          return (
            <div key={folder.id} style={{ marginBottom: 4 }}>
              <div
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={() => setDragOverFolderId(prev => prev === folder.id ? null : prev)}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                onMouseEnter={() => setHoveredFolderId(folder.id)}
                onMouseLeave={() => setHoveredFolderId(null)}
                onClick={() => onToggleFolder(folder.id)}
                onDoubleClick={(e) => { e.stopPropagation(); beginRenameFolder(folder); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  background: isDropTarget
                    ? colors.dropTargetBg
                    : (isHovered ? colors.folderHeaderHover : 'transparent'),
                  border: isDropTarget
                    ? `1px dashed ${colors.dropTargetBorder}`
                    : '1px solid transparent',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.text
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: colors.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 12 }}>
                    <Icons.Chevron expanded={isExpanded} />
                  </div>
                  <div style={{ color: colors.folderAccent, display: 'flex' }}>
                    {isExpanded ? <Icons.FolderOpen /> : <Icons.Folder />}
                  </div>
                  {editingFolderId === folder.id ? (
                    <input
                      ref={editingFolderInputRef}
                      value={editingFolderName}
                      onChange={e => setEditingFolderName(e.target.value)}
                      onBlur={() => commitRenameFolder(folder.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRenameFolder(folder.id);
                        if (e.key === 'Escape') cancelRenameFolder();
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: theme === 'dark' ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(96, 165, 250, 0.6)' : '#93c5fd'}`,
                        color: colors.text,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 6px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span
                      title="Double-click to rename"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                    >
                      {folder.name}
                    </span>
                  )}
                </div>

                {isHovered && editingFolderId !== folder.id && (
                  <div
                    style={{ display: 'flex', gap: 2, marginLeft: 6 }}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onAdd({ folderId: folder.id })}
                      title="New file in this folder"
                      className="folder-action-btn"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 5, display: 'flex', color: colors.textSec }}
                    ><Icons.Plus /></button>
                    <button
                      onClick={() => onDeleteFolder(folder.id)}
                      title="Delete folder (files move to root)"
                      className="sidebar-btn-subtle"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 5, display: 'flex', color: '#ef4444', opacity: 0.6 }}
                    ><Icons.Trash /></button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: 2 }}>
                  {folderNotes.length === 0 ? (
                    <div style={{
                      marginLeft: 26,
                      marginRight: 4,
                      padding: '6px 8px',
                      fontSize: 11,
                      color: colors.textSec,
                      opacity: 0.6,
                      fontStyle: 'italic'
                    }}>
                      Empty — drop files here
                    </div>
                  ) : (
                    folderNotes.map(note => renderNoteItem(note, true))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {folders.length > 0 && rootNotes.length > 0 && (
          <div style={{
            height: 1,
            background: colors.border,
            margin: '8px 4px 8px'
          }} />
        )}

        {rootNotes.map(note => renderNoteItem(note, false))}

        {folders.length === 0 && rootNotes.length === 0 && (
          <div style={{
            padding: '32px 12px',
            textAlign: 'center',
            fontSize: 11,
            color: colors.textSec,
            opacity: 0.5,
            lineHeight: 1.6
          }}>
            No files yet.<br />
            Click <strong style={{ color: colors.plusBtnText }}>+</strong> to create one.
          </div>
        )}
      </div>

      <style>{`
        .sidebar-btn-subtle:hover { opacity: 1 !important; background: rgba(239, 68, 68, 0.12); }
        .folder-action-btn:hover { color: #3b82f6 !important; background: rgba(59, 130, 246, 0.1); }
        .add-note-btn:hover {
          background: #3b82f6 !important;
          color: white !important;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .add-note-btn:active { transform: scale(0.95); }
        .add-note-btn.is-open {
          background: #3b82f6 !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .add-menu { animation: addMenuIn 0.14s ease-out; transform-origin: top center; }
        @keyframes addMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .menu-row:hover { background: ${colors.menuItemHover} !important; color: #3b82f6 !important; }
      `}</style>
    </div>
  );
}
