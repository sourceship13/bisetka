import React, { useEffect } from 'react';
import BootSplash from 'react-native-bootsplash';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/libs/hooks/useAuth';
import { AchievementProvider } from './src/contexts/AchievementContext';
import { DailyPointsProvider, useDailyPoints } from './src/contexts/DailyPointsContext';
import { BisetkaAlertContainer } from './src/utils/BisetkaAlert';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import DailyPointsRewardModal from './src/components/DailyPointsRewardModal';
import AppVersionFooter from './src/components/global/AppVersionFooter';
import pushNotificationService from './src/services/pushNotification.service';
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

/**
 * Bridges push-notification taps → DailyPointsContext.
 * Lives inside the providers so it can call `triggerReward`.
 */
const NotificationTapBridge: React.FC = () => {
  const { triggerReward } = useDailyPoints();

  useEffect(() => {
    const unsubscribe = pushNotificationService.onNotificationTap(data => {
      if (data?.type !== 'daily_points') return;
      const points = parseInt(data.points ?? '0', 10);
      if (Number.isFinite(points) && points > 0) {
        triggerReward(points);
      }
    });
    return unsubscribe;
  }, [triggerReward]);

  return null;
};

function App(): React.JSX.Element {
  useEffect(() => {
    BootSplash.hide({ fade: true });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AchievementProvider>
          <DailyPointsProvider>
            <AppNavigator />
            <InAppNotificationBanner />
            <DailyPointsRewardModal />
            <NotificationTapBridge />
            <BisetkaAlertContainer />
            <AppVersionFooter mode="floating" showBrand={false} />
          </DailyPointsProvider>
        </AchievementProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
