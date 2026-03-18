export const BRAND_NAME = 'Seecode';
export const BRAND_FONT_FAMILY = '"Space Grotesk", "Inter", "Segoe UI", sans-serif';

export function getBrandStyle(theme) {
  if (theme === 'dark') {
    return {
      text: '#e2e8f0',
      accent: '#7dd3fc',
      glow: '0 0 18px rgba(56, 189, 248, 0.22)',
      letterSpacing: '0.02em'
    };
  }

  return {
    text: '#0f172a',
    accent: '#0ea5e9',
    glow: '0 1px 0 rgba(255, 255, 255, 0.85)',
    letterSpacing: '0.01em'
  };
}
