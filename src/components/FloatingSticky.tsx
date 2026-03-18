
import React, { useState, useCallback, memo } from 'react';
import MultiLanguageEditor from './MultiLanguageEditor';
import { Note } from '../App';

interface Props {
  note: Note;
  visible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  theme?: 'dark' | 'light';
  fontSize?: number;
  onClose: () => void;
  onToggle: () => void;
  onContentChange: (content: string) => void;
  onUpdatePosition: (pos: { x: number; y: number }) => void;
  onUpdateSize: (sz: { width: number; height: number }) => void;
  onBringToFront: () => void;
  isMinimized: boolean;
  showAlert?: (o: any) => void;
}

const FloatingSticky = memo(function FloatingSticky({ 
  note, visible, position, size, zIndex, theme = 'dark', fontSize = 13,
  onClose, onToggle, onContentChange, onUpdatePosition, onUpdateSize, onBringToFront, isMinimized, showAlert
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onBringToFront();
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  React.useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging) return;
      onUpdatePosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const handleUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, offset, onUpdatePosition]);

  if (!visible) return null;

  const colors = theme === 'dark' ? {
    bg: 'rgba(30, 30, 30, 0.85)',
    border: '#444',
    title: '#252526'
  } : {
    bg: 'rgba(255, 255, 255, 0.9)',
    border: '#ccc',
    title: '#f0f0f0'
  };

  return (
    <div style={{
      position: 'fixed', top: position.y, left: position.x, width: size.width, height: isMinimized ? 36 : size.height,
      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
    }}>
      <div 
        onMouseDown={handleMouseDown}
        style={{
          height: 36, background: colors.title, padding: '0 12px', display: 'flex', 
          alignItems: 'center', justifyContent: 'space-between', cursor: 'move', userSelect: 'none'
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>{note.title}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>{isMinimized ? '□' : '—'}</button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4444' }}>✕</button>
        </div>
      </div>
      {!isMinimized && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <MultiLanguageEditor 
            value={note.content}
            onChange={onContentChange}
            isPopup={true}
            isSticky={true}
            theme={theme}
            fontSize={fontSize}
            showAlert={showAlert}
          />
        </div>
      )}
    </div>
  );
});

export default FloatingSticky;
