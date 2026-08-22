import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en, { TranslationKey } from './locales/en';
import zhCN from './locales/zh-CN';
import { resolveLocale } from './locale.mjs';

declare const chrome: any;

export const localeCatalogs = { en, 'zh-CN': zhCN } as const;
export type AppLocale = keyof typeof localeCatalogs;
export type LocalePreference = 'system' | AppLocale;
const STORAGE_KEY = 'seecode_locale_preference';

const localeOptions: ReadonlyArray<{ value: LocalePreference; labelKey: TranslationKey }> = [
  { value: 'system', labelKey: 'locale.system' },
  { value: 'en', labelKey: 'locale.en' },
  { value: 'zh-CN', labelKey: 'locale.zh-CN' }
];

function getSystemLocales(): string[] {
  const chromeLocale = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.();
  return [chromeLocale, ...(navigator.languages || []), navigator.language].filter(Boolean);
}

function interpolate(value: string, params?: Record<string, string | number>) {
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

interface I18nContextValue {
  locale: AppLocale;
  preference: LocalePreference;
  options: typeof localeOptions;
  setPreference: (preference: LocalePreference) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [systemLocales, setSystemLocales] = useState(getSystemLocales);
  const locale = resolveLocale(preference, systemLocales, Object.keys(localeCatalogs)) as AppLocale;

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY], (result: Record<string, LocalePreference>) => {
      const stored = result[STORAGE_KEY];
      if (stored === 'system' || stored in localeCatalogs) setPreferenceState(stored);
    });
    const onLanguageChange = () => setSystemLocales(getSystemLocales());
    const onStorageChange = (changes: Record<string, { newValue?: LocalePreference }>, area: string) => {
      const next = changes[STORAGE_KEY]?.newValue;
      if (area === 'local' && next && (next === 'system' || next in localeCatalogs)) setPreferenceState(next);
    };
    window.addEventListener('languagechange', onLanguageChange);
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => {
      window.removeEventListener('languagechange', onLanguageChange);
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    chrome.storage.local.set({ [STORAGE_KEY]: next });
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    return interpolate(localeCatalogs[locale][key] || en[key], params);
  }, [locale]);

  const value = useMemo(() => ({ locale, preference, options: localeOptions, setPreference, t }), [locale, preference, setPreference, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
