import React from 'react';
import { View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/libs/hooks/useAuth';
import { BisetkaAlertContainer } from './src/utils/BisetkaAlert';
import 'react-native-gesture-handler';
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
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <AppNavigator />
        <BisetkaAlertContainer />
      </View>
    </AuthProvider>
  );
}

export default Sentry.wrap(App);
