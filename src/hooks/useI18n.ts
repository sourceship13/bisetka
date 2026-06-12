import { useState, useEffect } from 'react';
import { i18n, Language } from '../i18n';

interface UseI18nResult {
  translate: typeof i18n.translate;
  translateWithParams: typeof i18n.translateWithParams;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  supportedLanguages: Language[];
}

/**
 * Hook to use translations in React components
 * Automatically re-renders when language changes
 *
 * Usage:
 * const { translate, translateWithParams, language, setLanguage } = useI18n();
 *
 * // Simple translation
 * <Text>{translate('common.ok')}</Text>
 *
 * // With parameters
 * <Text>{translateWithParams('achievements.earnedPoints', { points: 100 })}</Text>
 *
 * // Change language
 * <Button onPress={() => setLanguage('ru')} />
 */
export const useI18n = (): UseI18nResult => {
  const [language, setLanguageState] = useState<Language>(i18n.getLanguage());

  useEffect(() => {
    // Subscribe to language changes
    const unsubscribe = i18n.subscribe((newLanguage) => {
      setLanguageState(newLanguage);
    });

    return unsubscribe;
  }, []);

  return {
    translate: i18n.translate,
    translateWithParams: i18n.translateWithParams,
    language,
    setLanguage: i18n.setLanguage,
    supportedLanguages: i18n.getSupportedLanguages(),
  };
};
