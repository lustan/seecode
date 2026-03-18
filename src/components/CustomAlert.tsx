
import React from 'react';

interface Props {
  visible: boolean;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel'
}: Props) {
  
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          color: '#ff9500',
          backgroundColor: '#fff5e6',
          borderColor: '#ffcc80',
          icon: '!',
          title: 'Warning'
        };
      case 'error':
        return {
          color: '#ff3b30',
          backgroundColor: '#ffe6e6',
          borderColor: '#ffb3b3',
          icon: '✕',
          title: 'Error'
        };
      case 'success':
        return {
          color: '#34c759',
          backgroundColor: '#e6f7ea',
          borderColor: '#99d6a6',
          icon: '✓',
          title: 'Success'
        };
      default:
        return {
          color: '#007aff',
          backgroundColor: '#e6f3ff',
          borderColor: '#99ccff',
          icon: 'i',
          title: 'Info'
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Dismiss simple alerts on backdrop click
    if (!onCancel && onConfirm) {
      onConfirm();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: visible ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
      display: visible ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      backdropFilter: visible ? 'blur(2px)' : 'none',
      WebkitBackdropFilter: visible ? 'blur(2px)' : 'none',
      transition: 'all 0.2s ease'
    }}
    onClick={handleBackdropClick}
    >
      <div style={{
        backgroundColor: '#ffffff',
        border: 'none',
        borderRadius: '16px',
        minWidth: '340px',
        maxWidth: '440px',
        maxHeight: '80vh',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        <button
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '28px',
            height: '28px',
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            transition: 'all 0.2s ease',
            zIndex: 1,
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={() => onConfirm?.()}
        >
          ×
        </button>

        <div style={{
          padding: onCancel ? '24px 24px 20px 24px' : '24px 24px 32px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: typeConfig.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0,
            marginTop: '2px'
          }}>
            {typeConfig.icon}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '6px'
            }}>
              {title || typeConfig.title}
            </div>

            <div style={{
              fontSize: '14px',
              color: '#475569',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {message}
            </div>
          </div>
        </div>
        
        {onCancel && (
          <div style={{
            padding: '0 24px 24px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}>
            <button
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease'
              }}
              onClick={onCancel}
            >
              {cancelText}
            </button>
            
            <button
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                borderRadius: '8px',
                border: 'none',
                background: typeConfig.color,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'all 0.15s ease',
                boxShadow: `0 4px 12px ${typeConfig.color}40`
              }}
              onClick={() => onConfirm?.()}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
