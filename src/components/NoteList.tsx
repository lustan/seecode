import React, { useEffect, useRef, useState } from 'react';
import { Note } from '../App';
import { LanguageIcon } from './LanguageIcons';
import { BRAND_FONT_FAMILY, BRAND_NAME, getBrandStyle } from './brandStyles.mjs';

interface Props {
  notes: Note[];
  activeId: string;
  theme: 'dark' | 'light';
  onAdd: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  isPopup?: boolean;
  style?: React.CSSProperties;
  onOpenFloatingSticky?: (id: string, pos?: { x: number; y: number }) => void;
}

const Icons = {
  // Directly reference the public icon.svg
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
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
  )
};

export default function NoteList({ notes, activeId, theme, onAdd, onDelete, onRename, onSelect, onReorder, isPopup, style }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingId) return;
    editingInputRef.current?.focus();
    editingInputRef.current?.select();
  }, [editingId]);

  const colors = theme === 'dark' ? {
    sidebarBg: '#090b10',
    itemActive: 'rgba(59, 130, 246, 0.15)',
    itemHover: 'rgba(255,255,255,0.03)',
    text: '#f8fafc',
    textSec: '#64748b',
    border: 'rgba(255,255,255,0.05)',
    plusBtnBg: 'rgba(59, 130, 246, 0.12)',
    plusBtnText: '#60a5fa'
  } : {
    sidebarBg: '#ffffff',
    itemActive: 'rgba(59, 130, 246, 0.08)',
    itemHover: 'rgba(0,0,0,0.02)',
    text: '#0f172a',
    textSec: '#64748b',
    border: '#f1f5f9',
    plusBtnBg: 'rgba(59, 130, 246, 0.08)',
    plusBtnText: '#3b82f6'
  };
  const brandStyle = getBrandStyle(theme);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null) onReorder(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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

  return (
    <div style={{ ...style, background: colors.sidebarBg, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      <div style={{ 
        height: 40,
        padding: '0 12px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`
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
        <button 
          onClick={onAdd}
          className="add-note-btn"
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
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Icons.Plus />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 20px' }} onDragLeave={() => setDragOverIndex(null)}>
        {notes.map((note, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const isActive = activeId === note.id;
          
          return (
            <div
              key={note.id}
              draggable={editingId !== note.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
              onMouseEnter={() => setHoveredId(note.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(note.id)}
              onDoubleClick={() => beginRename(note)}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isActive ? colors.itemActive : (isDragOver ? colors.itemHover : 'transparent'),
                color: isActive ? '#60a5fa' : (hoveredId === note.id ? colors.text : colors.textSec),
                transition: 'all 0.15s ease',
                opacity: isDragging ? 0.2 : 1,
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                fontWeight: isActive ? '700' : '500'
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
              
              {hoveredId === note.id && !isDragging && (
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
        })}
      </div>
      <style>{`
        .sidebar-btn-subtle:hover { opacity: 1 !important; background: rgba(239, 68, 68, 0.12); }
        .add-note-btn:hover { 
          background: #3b82f6 !important; 
          color: white !important; 
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .add-note-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}
