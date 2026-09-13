import { en } from './en';
import { zhCN } from './zh-CN';

export const translations = { 'zh-CN': zhCN, en } as const;
export type Locale = keyof typeof translations;

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'en' ? 'en' : 'zh-CN';
}

export function message(locale: Locale, key: string) {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current)
      return (current as Record<string, unknown>)[part];
    return undefined;
  }, translations[locale]);
  return typeof value === 'string' ? value : key;
}
