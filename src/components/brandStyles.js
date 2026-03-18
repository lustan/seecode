const BRAND_NAME = 'Seecode';
const BRAND_FONT_FAMILY = '"Space Grotesk", "Inter", "Segoe UI", sans-serif';

function getBrandStyle(theme) {
  if (theme === 'dark') {
    return {
      text: '#f8fbff',
      accent: '#7dd3fc',
      border: 'rgba(125, 211, 252, 0.45)',
      background: 'linear-gradient(135deg, rgba(8, 47, 73, 0.92), rgba(15, 23, 42, 0.96))',
      shadow: '0 8px 18px rgba(14, 165, 233, 0.18), inset 0 0 0 1px rgba(186, 230, 253, 0.12)',
      glow: '0 0 22px rgba(56, 189, 248, 0.35)',
      letterSpacing: '0.08em'
    };
  }

  return {
    text: '#0f172a',
    accent: '#0284c7',
    border: 'rgba(2, 132, 199, 0.18)',
    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.92), rgba(255, 255, 255, 0.98))',
    shadow: '0 10px 18px rgba(14, 165, 233, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.75)',
    glow: '0 0 18px rgba(14, 165, 233, 0.12)',
    letterSpacing: '0.06em'
  };
}

module.exports = {
  BRAND_NAME,
  BRAND_FONT_FAMILY,
  getBrandStyle
};
