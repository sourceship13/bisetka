import React, { useEffect } from 'react';
import BootSplash from 'react-native-bootsplash';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/libs/hooks/useAuth';
import { AchievementProvider } from './src/contexts/AchievementContext';
import { BisetkaAlertContainer } from './src/utils/BisetkaAlert';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import AppVersionFooter from './src/components/global/AppVersionFooter';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import Config from 'react-native-config';

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
          <AppVersionFooter mode="floating" showBrand={false} />
        </AchievementProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
