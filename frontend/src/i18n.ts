import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../shared/locales/en.json';
import it from '../../shared/locales/it.json';
import es from '../../shared/locales/es.json';
import ko from '../../shared/locales/ko.json';
import zh from '../../shared/locales/zh-Hans.json';
import yue from '../../shared/locales/yue-Hant.json';
import de from '../../shared/locales/de.json';
import { readSetting, resolveLocale } from './domain';

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries({ en, it, es, ko, 'zh-Hans': zh, 'yue-Hant': yue, de }).map(([key, translation]) => [key, { translation }])),
  lng: resolveLocale(readSetting('locale') ?? navigator.language), fallbackLng: 'en',
  interpolation: { escapeValue: false }, returnNull: false,
});
export default i18n;
