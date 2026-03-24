import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/libs/hooks/useAuth';
import { AchievementProvider } from './src/contexts/AchievementContext';
import { BisetkaAlertContainer } from './src/utils/BisetkaAlert';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import Config from 'react-native-config';
import { version } from './package.json';

Sentry.init({
  dsn: Config.SENTRY_DSN,
  environment: Config.SENTRY_ENVIRONMENT || 'development',
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],
});

function App(): React.JSX.Element {
  useEffect(() => {
    BootSplash.hide({ fade: true });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AchievementProvider>
          <AppNavigator />
          <InAppNotificationBanner />
          <BisetkaAlertContainer />
          <Text style={styles.versionFooter}>v{version}</Text>
        </AchievementProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  versionFooter: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
  },
});
