export function getToastTheme(theme = 'dark', type = 'info') {
  const darkThemes = {
    success: {
      background: 'rgba(15, 23, 42, 0.94)',
      border: 'rgba(56, 189, 248, 0.26)',
      dot: '#38bdf8',
      text: '#e2e8f0',
      shadow: '0 14px 32px rgba(2, 6, 23, 0.28)'
    },
    error: {
      background: 'rgba(127, 29, 29, 0.94)',
      border: 'rgba(248, 113, 113, 0.28)',
      dot: '#f87171',
      text: '#fee2e2',
      shadow: '0 14px 32px rgba(69, 10, 10, 0.24)'
    },
    warning: {
      background: 'rgba(120, 53, 15, 0.94)',
      border: 'rgba(251, 191, 36, 0.28)',
      dot: '#fbbf24',
      text: '#fef3c7',
      shadow: '0 14px 32px rgba(120, 53, 15, 0.22)'
    },
    info: {
      background: 'rgba(15, 23, 42, 0.94)',
      border: 'rgba(148, 163, 184, 0.24)',
      dot: '#94a3b8',
      text: '#e2e8f0',
      shadow: '0 14px 32px rgba(2, 6, 23, 0.28)'
    }
  };

  const lightThemes = {
    success: {
      background: 'rgba(255, 255, 255, 0.96)',
      border: 'rgba(186, 230, 253, 0.95)',
      dot: '#0ea5e9',
      text: '#0f172a',
      shadow: '0 12px 24px rgba(15, 23, 42, 0.10)'
    },
    error: {
      background: 'rgba(255, 255, 255, 0.96)',
      border: 'rgba(254, 205, 211, 0.95)',
      dot: '#ef4444',
      text: '#0f172a',
      shadow: '0 12px 24px rgba(15, 23, 42, 0.10)'
    },
    warning: {
      background: 'rgba(255, 255, 255, 0.96)',
      border: 'rgba(254, 240, 138, 0.95)',
      dot: '#f59e0b',
      text: '#0f172a',
      shadow: '0 12px 24px rgba(15, 23, 42, 0.10)'
    },
    info: {
      background: 'rgba(255, 255, 255, 0.96)',
      border: 'rgba(226, 232, 240, 0.98)',
      dot: '#64748b',
      text: '#0f172a',
      shadow: '0 12px 24px rgba(15, 23, 42, 0.10)'
    }
  };

  const palette = theme === 'light' ? lightThemes : darkThemes;
  return palette[type] || palette.info;
}
