import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './libs/hooks/useAuth';
import { AchievementProvider } from './contexts/AchievementContext';
import { DailyPointsProvider, useDailyPoints } from './contexts/DailyPointsContext';
import { I18nProvider } from './contexts/I18nContext';
import InAppNotificationBanner from './components/InAppNotificationBanner';
import DailyPointsRewardModal from './components/DailyPointsRewardModal';
import pushNotificationService from './services/pushNotification.service';
import 'react-native-gesture-handler';

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
      const expiresAt = parseInt(data.expiresAt ?? '0', 10);
      // Drop stale taps. If the push has been sitting in the tray past its
      // 5-hour window the user shouldn't be credited.
      if (expiresAt && Date.now() > expiresAt) {
        console.log('[NotificationTapBridge] reward expired, ignoring tap');
        return;
      }
      if (Number.isFinite(points) && points > 0) {
        triggerReward(points, expiresAt || undefined);
      }
    });
    return unsubscribe;
  }, [triggerReward]);

  return null;
};

function App(): React.JSX.Element {
  return (
    <View style={styles.root}>
      <I18nProvider>
        <AuthProvider>
          <AchievementProvider>
            <DailyPointsProvider>
              <AppNavigator />
              {/* Renders above everything — shows push banners when app is foregrounded */}
              <InAppNotificationBanner />
              <DailyPointsRewardModal />
              <NotificationTapBridge />
            </DailyPointsProvider>
          </AchievementProvider>
        </AuthProvider>
      </I18nProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
