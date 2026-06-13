import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './translations/en.json';
import ru from './translations/ru.json';
import hy from './translations/hy.json';
import hyLatin from './translations/hy-latin.json';

export type Language = 'en' | 'ru' | 'hy' | 'hy-latin';

interface Translations {
  [key: string]: any;
}

const translations: { [key in Language]: Translations } = {
  en,
  ru,
  hy,
  'hy-latin': hyLatin,
};

const LANGUAGE_KEY = '@bisetka_language';
const SCRIPT_KEY = '@bisetka_script'; // Track if user wants Armenian script (hy) or Latin (hy-latin)
const SUPPORTED_LANGUAGES: Language[] = ['en', 'ru', 'hy', 'hy-latin'];

class I18n {
  private currentLanguage: Language = 'en';
  private listeners: ((language: Language) => void)[] = [];

  async initialize(): Promise<Language> {
    try {
      // First, check if user has a saved language preference
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage && this.isSupportedLanguage(savedLanguage)) {
        this.currentLanguage = savedLanguage as Language;
        return this.currentLanguage;
      }

      // Get device language
      const deviceLanguage = this.getDeviceLanguage();
      if (this.isSupportedLanguage(deviceLanguage)) {
        this.currentLanguage = deviceLanguage as Language;
      } else {
        this.currentLanguage = 'en'; // fallback
      }

      // If device language is Armenian, check user's preferred script (native vs latin)
      if (this.currentLanguage === 'hy') {
        const scriptPreference = await AsyncStorage.getItem(SCRIPT_KEY);
        if (scriptPreference === 'latin') {
          this.currentLanguage = 'hy-latin';
        }
      }

      return this.currentLanguage;
    } catch (error) {
      console.error('Error initializing i18n:', error);
      this.currentLanguage = 'en';
      return 'en';
    }
  }

  private getDeviceLanguage(): string {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
          'en'
        : NativeModules.I18nManager?.localeIdentifier || 'en';

    // Extract language code (e.g., 'en' from 'en-US', 'hy' from 'hy_AM')
    const langCode = locale.split(/[-_]/)[0].toLowerCase();
    
    // Map device language codes to supported languages
    // hy = Armenian (ISO 639-1)
    return langCode;
  }

  private isSupportedLanguage(language: string): boolean {
    return SUPPORTED_LANGUAGES.includes(language as Language);
  }

  setLanguage = async (language: Language): Promise<void> => {
    if (!this.isSupportedLanguage(language)) {
      console.warn(`Language ${language} is not supported`);
      return;
    }

    this.currentLanguage = language;
    
    // Store the base language (en/ru/hy) in LANGUAGE_KEY
    const baseLanguage = language.split('-')[0]; // 'hy-latin' → 'hy'
    await AsyncStorage.setItem(LANGUAGE_KEY, baseLanguage);
    
    // If switching to Armenian variant, track script preference
    if (language === 'hy-latin') {
      await AsyncStorage.setItem(SCRIPT_KEY, 'latin');
    } else if (language === 'hy') {
      await AsyncStorage.setItem(SCRIPT_KEY, 'native');
    }
    
    this.notifyListeners();
  };

  // Get base language (for comparison/filtering)
  getBaseLanguage = (): string => {
    return this.currentLanguage.split('-')[0];
  };

  // Check if current language uses Latin script
  isLatinScript = (): boolean => {
    return this.currentLanguage === 'hy-latin';
  };

  // Get all language variants (useful for Settings display)
  getLanguageVariants = (baseLanguage: string): Language[] => {
    if (baseLanguage === 'hy') {
      return ['hy', 'hy-latin'];
    }
    return [baseLanguage as Language];
  };

  getLanguage = (): Language => {
    return this.currentLanguage;
  };

  getSupportedLanguages = (): Language[] => {
    return SUPPORTED_LANGUAGES;
  };

  getLanguageName = (language: Language): string => {
    const names: { [key in Language]: string } = {
      en: 'English',
      ru: 'Русский',
      hy: 'Հայերեն',
    };
    return names[language] || language;
  };

  translate = (key: string, defaultValue?: string): string => {
    const keys = key.split('.');
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue || key;
      }
    }

    return typeof value === 'string' ? value : (defaultValue || key);
  };

  /**
   * Translate with variable interpolation
   * Example: translateWithParams('achievements.earnedPoints', { points: 100 })
   */
  translateWithParams = (
    key: string,
    params: { [key: string]: string | number } = {},
    defaultValue?: string
  ): string => {
    let text = this.translate(key, defaultValue);

    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(`{${paramKey}}`, String(paramValue));
    }

    return text;
  };

  /**
   * Get native language name in that language
   * e.g., 'hy' → 'Հայերեն'
   */
  getNativeLanguageName = (language: Language): string => {
    const nativeNames: { [key in Language]: string } = {
      en: 'English',
      ru: 'Русский',
      hy: 'Հայերեն',
    };
    return nativeNames[language] || language;
  };

  // Subscribe to language changes
  subscribe = (callback: (language: Language) => void): (() => void) => {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  };

  private notifyListeners = (): void => {
    this.listeners.forEach((listener) => listener(this.currentLanguage));
  };
}

export const i18n = new I18n();
