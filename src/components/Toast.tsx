import React, { useEffect } from 'react';
import { getToastTheme } from '../utils/toastTheme.mjs';

interface Props {
  visible: boolean;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  theme?: 'dark' | 'light';
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDone: () => void;
}

export default function Toast({ visible, message, type = 'info', theme = 'dark', duration = 1500, actionLabel, onAction, onDone }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [visible, duration, onDone]);

  const colors = getToastTheme(theme, type);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 44,
        zIndex: 200,
        pointerEvents: visible && actionLabel ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 160,
          maxWidth: 320,
          padding: '8px 12px',
          borderRadius: 10,
          color: colors.text,
          background: colors.background,
          border: `1px solid ${colors.border}`,
          boxShadow: colors.shadow,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            flexShrink: 0,
            borderRadius: 999,
            background: colors.dot,
            boxShadow: `0 0 8px ${colors.dot}`
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '0.01em',
            flex: 1
          }}
        >
          {message}
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={() => {
              onAction();
              onDone();
            }}
            style={{
              border: 'none',
              background: 'rgba(59, 130, 246, 0.16)',
              color: '#60a5fa',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
