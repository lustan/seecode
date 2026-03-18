
import React, { useEffect, useState } from 'react';
import MultiLanguageEditor from './MultiLanguageEditor';
import { Note } from '../App';

// Fix: Declare chrome global for extension environment
declare const chrome: any;

const STORAGE_KEY = 'loojsoneditor_notes';

function loadNotes(): Promise<Note[]> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

function saveNotes(notes: Note[]) {
  chrome.storage.local.set({ [STORAGE_KEY]: notes });
}

export default function StickyNote() {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从URL参数获取noteId
    const urlParams = new URLSearchParams(window.location.search);
    const noteId = urlParams.get('noteId');
    
    if (noteId) {
      loadNotes().then(notes => {
        const targetNote = notes.find(n => n.id === noteId);
        setNote(targetNote || null);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleContentChange = (content: string) => {
    if (note) {
      const updatedNote = { ...note, content };
      setNote(updatedNote);
      
      // 更新存储
      loadNotes().then(notes => {
        const updatedNotes = notes.map(n => 
          n.id === note.id ? updatedNote : n
        );
        saveNotes(updatedNotes);
      });
    }
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#2b2b2b',
        color: '#a9b7c6'
      }}>
        Loading...
      </div>
    );
  }

  if (!note) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#2b2b2b',
        color: '#a9b7c6'
      }}>
        Note not found
      </div>
    );
  }

  return (
    <div className="sticky-window">
      {/* 便签标题栏 */}
      <div className="sticky-header">
        <div className="sticky-title" title={note.title}>
          📌 {note.title}
        </div>
        
        {/* 便签工具按钮 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginRight: 8
        }}>
          {/* 格式化按钮 */}
          <button
            style={{
              width: 24,
              height: 24,
              border: 'none',
              background: 'transparent',
              color: '#6897bb',
              cursor: 'pointer',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(104, 151, 187, 0.2)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent';
            }}
            onClick={() => {
              // 触发格式化
              if (note.content.trim()) {
                try {
                  const parsed = JSON.parse(note.content);
                  const formatted = JSON.stringify(parsed, null, 2);
                  handleContentChange(formatted);
                } catch (error) {
                  // 静默处理格式化失败
                }
              }
            }}
            title="Format JSON"
          >
            🔧
          </button>
          
          {/* 复制按钮 */}
          <button
            style={{
              width: 24,
              height: 24,
              border: 'none',
              background: 'transparent',
              color: '#629755',
              cursor: 'pointer',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(98, 151, 85, 0.2)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent';
            }}
            onClick={async (e) => {
              try {
                await navigator.clipboard.writeText(note.content);
                // 简单的视觉反馈
                const btn = e.currentTarget as HTMLButtonElement;
                const original = btn.textContent;
                btn.textContent = '✅';
                setTimeout(() => {
                  btn.textContent = original;
                }, 1000);
              } catch (error) {
                // 静默处理复制失败
              }
            }}
            title="Copy content"
          >
            📋
          </button>
        </div>
        
        <button 
          className="sticky-close"
          onClick={handleClose}
          title="Close sticky note"
        >
          ×
        </button>
      </div>
      
      {/* 便签内容区域 */}
      <div className="sticky-content">
        <MultiLanguageEditor 
          value={note.content}
          onChange={handleContentChange}
          isPopup={true}
          isSticky={true}
          theme="dark" // 便签默认使用深色主题
          fontSize={13}
          autoDetectLanguage={true} // 启用自动语言检测
        />
      </div>
    </div>
  );
}
