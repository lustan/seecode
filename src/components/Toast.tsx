import React, { useEffect } from 'react';
import { getToastTheme } from '../utils/toastTheme.mjs';

interface Props {
  visible: boolean;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  theme?: 'dark' | 'light';
  duration?: number;
  onDone: () => void;
}

export default function Toast({ visible, message, type = 'info', theme = 'dark', duration = 1500, onDone }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [visible, duration, onDone]);

  const colors = getToastTheme(theme, type);

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 44,
        zIndex: 200,
        pointerEvents: 'none',
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
          maxWidth: 260,
          padding: '8px 10px',
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
            letterSpacing: '0.01em'
          }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
