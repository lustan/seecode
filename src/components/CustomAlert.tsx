import React, { useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  theme?: 'dark' | 'light';
}

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  theme = 'light'
}: Props) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!visible) return;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        (onCancel || onConfirm)?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onCancel, onConfirm]);

  const config = {
    info: { color: '#3b82f6', icon: 'i', defaultTitle: 'Info' },
    warning: { color: '#f59e0b', icon: '!', defaultTitle: 'Warning' },
    error: { color: '#ef4444', icon: '×', defaultTitle: 'Error' },
    success: { color: '#22c55e', icon: '✓', defaultTitle: 'Success' }
  }[type];
  const actionColor = type === 'warning' ? '#ef4444' : config.color;
  const palette = isDark ? {
    surface: '#171a23', border: 'rgba(255,255,255,0.09)', title: '#f8fafc', text: '#a8b3c7',
    secondaryBg: 'rgba(255,255,255,0.05)', secondaryHover: 'rgba(255,255,255,0.09)', secondaryBorder: 'rgba(255,255,255,0.10)'
  } : {
    surface: '#ffffff', border: 'rgba(15,23,42,0.08)', title: '#0f172a', text: '#64748b',
    secondaryBg: '#ffffff', secondaryHover: '#f8fafc', secondaryBorder: '#e2e8f0'
  };

  const dismiss = () => (onCancel || onConfirm)?.();

  return (
    <div
      role="presentation"
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, display: visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)'
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="custom-alert-title"
        aria-describedby="custom-alert-message"
        onClick={event => event.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 420, overflow: 'hidden', background: palette.surface,
          border: `1px solid ${palette.border}`, borderRadius: 14,
          boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.55)' : '0 24px 64px rgba(15,23,42,0.20)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          animation: 'customAlertIn 0.16s ease-out'
        }}
      >
        <style>{`
          @keyframes customAlertIn { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }
          .custom-alert-button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
        `}</style>
        <button
          className="custom-alert-button"
          aria-label="Close dialog"
          onClick={dismiss}
          style={{
            position: 'absolute', top: 13, right: 13, width: 28, height: 28, border: 0, borderRadius: 7,
            background: 'transparent', color: palette.text, cursor: 'pointer', fontSize: 19, lineHeight: 1
          }}
        >×</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '24px 48px 18px 24px' }}>
          <div style={{
            width: 26, height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, background: `${config.color}1f`, color: config.color, fontSize: 15, fontWeight: 800
          }}>{config.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div id="custom-alert-title" style={{ marginBottom: 7, color: palette.title, fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>
              {title || config.defaultTitle}
            </div>
            <div id="custom-alert-message" style={{ color: palette.text, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message}
            </div>
          </div>
        </div>

        {onCancel && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '0 24px 22px' }}>
            <button
              ref={cancelButtonRef}
              className="custom-alert-button"
              onClick={onCancel}
              onMouseOver={event => event.currentTarget.style.background = palette.secondaryHover}
              onMouseOut={event => event.currentTarget.style.background = palette.secondaryBg}
              style={{
                minWidth: 76, padding: '8px 14px', border: `1px solid ${palette.secondaryBorder}`, borderRadius: 8,
                background: palette.secondaryBg, color: palette.title, cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >{cancelText}</button>
            <button
              className="custom-alert-button"
              onClick={onConfirm}
              style={{
                minWidth: 108, padding: '8px 16px', border: 0, borderRadius: 8, background: actionColor,
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: `0 4px 12px ${actionColor}38`
              }}
            >{confirmText}</button>
          </div>
        )}
      </div>
    </div>
  );
}
