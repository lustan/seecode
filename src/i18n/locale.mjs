export const DEFAULT_LOCALE = 'en';

export function matchSupportedLocale(locale, supported = ['en', 'zh-CN']) {
  const normalized = String(locale || '').replace('_', '-').toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-')) return supported.includes('zh-CN') ? 'zh-CN' : DEFAULT_LOCALE;
  if (normalized === 'en' || normalized.startsWith('en-')) return supported.includes('en') ? 'en' : DEFAULT_LOCALE;
  return supported.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : supported[0];
}

export function resolveLocale(preference, systemLocales = [], supported = ['en', 'zh-CN']) {
  if (preference && preference !== 'system' && supported.includes(preference)) return preference;
  for (const locale of systemLocales) {
    const match = matchSupportedLocale(locale, supported);
    if (match !== DEFAULT_LOCALE || String(locale).toLowerCase().startsWith('en')) return match;
  }
  return DEFAULT_LOCALE;
}
