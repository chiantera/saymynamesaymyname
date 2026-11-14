export const locales = ['en', 'it', 'es', 'ko', 'zh-Hans', 'yue-Hant', 'de'] as const;
export type Locale = typeof locales[number];
export const localeNames: Record<Locale, string> = {
  en: 'English', it: 'Italiano', es: 'Español', ko: '한국어',
  'zh-Hans': '普通话 · 简体', 'yue-Hant': '廣東話 · 繁體', de: 'Deutsch',
};
export function resolveLocale(value: string | null | undefined): Locale {
  if (locales.includes(value as Locale)) return value as Locale;
  const candidate = (value ?? '').toLowerCase();
  if (candidate.startsWith('yue') || candidate === 'zh-hk' || candidate === 'zh-mo') return 'yue-Hant';
  if (candidate === 'zh' || candidate === 'zh-cn' || candidate.startsWith('zh-hans')) return 'zh-Hans';
  const language = candidate.split('-')[0];
  return locales.includes(language as Locale) ? language as Locale : 'en';
}
export function readSetting(key: string): string | null {
  try { return localStorage.getItem(`companion:demo:${key}`); } catch { return null; }
}
export function saveSetting(key: string, value: string) {
  try { localStorage.setItem(`companion:demo:${key}`, value); } catch { /* Storage is optional. */ }
}
export function canGenerate(statuses: string[], jobStates: string[]) {
  return !statuses.some(s => s === 'pending' || s === 'deferred') &&
    !jobStates.some(s => s === 'queued' || s === 'processing');
}
