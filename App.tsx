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
import { startAvatarSync } from './src/services/avatarSync';
import { initIAP, endIAP } from './src/services/iap.service';
import { seedDefaultOutfitIfMissing } from './src/utils/seedDefaultOutfit';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

  // Initialise the StoreKit / Play Billing connection at app start so the
  // store screens can fetch localised prices instantly. Tear it down on
  // unmount.
  useEffect(() => {
    initIAP();
    return () => {
      endIAP();
    };
  }, []);

  // Push the local avatar appearance to the backend on boot and on every
  // `bisetka:avatarUpdated` event so opponents can render this user's avatar.
  useEffect(() => {
    // Make sure the user is wearing the starter wardrobe (idempotent — only
    // fills slots that are empty). Must run BEFORE startAvatarSync so the
    // first sync includes the seeded items.
    seedDefaultOutfitIfMissing();
    return startAvatarSync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
