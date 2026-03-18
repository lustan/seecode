import React from 'react';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export default function UserManual({ visible, onClose, theme = 'dark' }: Props) {
  if (!visible) return null;

  const themeColors = {
    dark: {
      background: 'rgba(43, 43, 43, 0.95)',
      modalBg: '#3c3f41',
      border: '#515658',
      text: '#a9b7c6',
      textSecondary: '#808080',
      headerBg: '#2b2b2b',
      keyboardBg: '#515658',
      keyboardText: '#ffffff',
      scrollbar: '#6c6c6c',
      scrollbarTrack: '#3c3f41',
      tipBg: '#454749'
    },
    light: {
      background: 'rgba(255, 255, 255, 0.95)',
      modalBg: '#ffffff',
      border: '#e1e4e8',
      text: '#24292e',
      textSecondary: '#6a737d',
      headerBg: '#f6f8fa',
      keyboardBg: '#e1e4e8',
      keyboardText: '#24292e',
      scrollbar: '#c1c1c1',
      scrollbarTrack: '#f1f1f1',
      tipBg: '#f8f9fa'
    }
  };

  const colors = themeColors[theme];

  const KeyboardKey = ({ children }: { children: React.ReactNode }) => (
    <kbd style={{
      display: 'inline-block',
      padding: '1px 4px',
      margin: '0 1px',
      background: colors.keyboardBg,
      color: colors.keyboardText,
      border: `1px solid ${colors.border}`,
      borderRadius: '2px',
      fontSize: '9px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      boxShadow: '0 1px 1px rgba(0, 0, 0, 0.1)'
    }}>
      {children}
    </kbd>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'transparent',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
      onClick={onClose}
    >
      {/* 气泡框 */}
      <div
        style={{
          position: 'absolute',
          bottom: '35px', // 从60px改为35px，更贴近按钮
          right: '10px', 
          width: '380px',
          maxHeight: '500px',
          background: colors.modalBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          boxShadow: theme === 'dark' 
            ? '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
            : '0 12px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
          pointerEvents: 'auto',
          transform: 'translateY(0)',
          opacity: 1,
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: 'bubbleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>
          {`
            @keyframes bubbleIn {
              0% {
                transform: translateY(10px) scale(0.95);
                opacity: 0;
              }
              100% {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
            }
            
            .manual-bubble::-webkit-scrollbar {
              width: 4px;
            }
            .manual-bubble::-webkit-scrollbar-track {
              background: ${colors.scrollbarTrack};
            }
            .manual-bubble::-webkit-scrollbar-thumb {
              background: ${colors.scrollbar};
              border-radius: 2px;
            }
            .manual-bubble::-webkit-scrollbar-thumb:hover {
              background: ${theme === 'dark' ? '#8c8c8c' : '#a8a8a8'};
            }
          `}
        </style>

        {/* 小三角箭头指示器 - 指向操作手册按钮（下方） */}
        <div style={{
          position: 'absolute',
          top: '100%', // 改为top: 100%，让箭头在气泡框下方
          right: '50px', // 调整位置对准操作手册按钮
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `8px solid ${colors.modalBg}`, // 箭头向下
          filter: `drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))`
        }} />

        {/* 标题栏 */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.headerBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '12px 12px 0 0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              background: '#6897bb',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: '#fff',
              fontWeight: 'bold'
            }}>?</div>
            <h3 style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: '600',
              color: colors.text
            }}>User Manual</h3>
          </div>
          
          <button
            onClick={onClose}
            style={{
              width: '20px',
              height: '20px',
              border: 'none',
              borderRadius: '3px',
              background: 'transparent',
              color: colors.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = colors.border;
              e.currentTarget.style.color = colors.text;
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.textSecondary;
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="manual-bubble" style={{
          maxHeight: '440px',
          overflow: 'auto',
          padding: '12px 16px 16px'
        }}>
          {/* 快捷键操作 */}
          <section style={{ marginBottom: '12px' }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              fontWeight: '600',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>⌨️</span>
              Shortcuts
            </h4>
            
            <div style={{ fontSize: '10px', color: colors.text, lineHeight: '1.4' }}>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Search</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>F</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Replace</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>R</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Close Search</span>
                <KeyboardKey>Esc</KeyboardKey>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Format Code</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>J</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Compress Code</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>K</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Duplicate Line Up</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>↑</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Duplicate Line Down</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>↓</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Delete Line</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <KeyboardKey>Ctrl</KeyboardKey>
                  <span style={{ margin: '0 2px', fontSize: '8px' }}>+</span>
                  <KeyboardKey>Y</KeyboardKey>
                </div>
              </div>
              <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Complete Edit</span>
                <KeyboardKey>Enter</KeyboardKey>
              </div>
            </div>
          </section>

          {/* 基础操作 */}
          <section style={{ marginBottom: '12px' }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              fontWeight: '600',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>📝</span>
              Basic Operations
            </h4>
            
            <div style={{ fontSize: '10px', color: colors.text, lineHeight: '1.4' }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Create:</strong> Click the <span style={{ background: colors.tipBg, padding: '1px 3px', borderRadius: '2px', fontSize: '9px' }}>+</span> button
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Edit Title:</strong> Click ✏️ or double-click the title
              </div>
            </div>
          </section>

          {/* 拖拽操作 */}
          <section style={{ marginBottom: '12px' }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              fontWeight: '600',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>🖱️</span>
              Drag Operations
            </h4>
            
            <div style={{ fontSize: '10px', color: colors.text, lineHeight: '1.4' }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>Floating Note:</strong> Drag to the editor
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Move Note:</strong> Drag the title bar
              </div>
            </div>
          </section>

          {/* 工具提示 */}
          <section style={{ marginBottom: '8px' }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '11px',
              fontWeight: '600',
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>💡</span>
              Tooltips
            </h4>
            
            <div style={{ fontSize: '10px', color: colors.text, lineHeight: '1.4' }}>
              <div style={{ 
                marginBottom: '6px', 
                padding: '6px 8px', 
                background: colors.tipBg, 
                borderRadius: '6px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ fontWeight: '600', marginBottom: '2px', color: colors.text }}>
                  🔧 Edit Tools
                </div>
                <div style={{ fontSize: '9px', color: colors.textSecondary }}>
                  Hover editor toolbar: Format (Ctrl+J), Compress (Ctrl+K), Copy, Clear, Wrap. Line ops: Duplicate (Ctrl+D), Delete (Ctrl+Y)
                </div>
              </div>
              
              <div style={{ 
                marginBottom: '6px', 
                padding: '6px 8px', 
                background: colors.tipBg, 
                borderRadius: '6px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ fontWeight: '600', marginBottom: '2px', color: colors.text }}>
                  📌 Note Management
                </div>
                <div style={{ fontSize: '9px', color: colors.textSecondary }}>
                  Right sidebar: Smart Arrange 📊⚏, Layout 📊⚏, Close ✕
                </div>
              </div>

              <div style={{ 
                padding: '6px 8px', 
                background: colors.tipBg, 
                borderRadius: '6px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{ fontWeight: '600', marginBottom: '2px', color: colors.text }}>
                  ⭐ Tips
                </div>
                <div style={{ fontSize: '9px', color: colors.textSecondary }}>
                  Multi-window sync, Theme toggle 🌞/🌙, Font size A±
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 