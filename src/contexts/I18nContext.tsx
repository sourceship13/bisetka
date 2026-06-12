import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { i18n } from '../i18n';

interface I18nContextType {
  isInitialized: boolean;
}

export const I18nContext = React.createContext<I18nContextType>({
  isInitialized: false,
});

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeI18n = async () => {
      try {
        await i18n.initialize();
        console.log(`[I18n] Initialized with language: ${i18n.getLanguage()}`);
        setIsInitialized(true);
      } catch (error) {
        console.error('[I18n] Initialization error:', error);
        setIsInitialized(true); // Still set to true to avoid infinite loading
      }
    };

    initializeI18n();
  }, []);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <I18nContext.Provider value={{ isInitialized }}>
      {children}
    </I18nContext.Provider>
  );
};
