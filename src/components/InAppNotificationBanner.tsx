/**
 * InAppNotificationBanner
 *
 * Shows a slide-down banner when a push notification arrives while the app
 * is in the foreground (the OS does NOT display a banner in that case).
 *
 * Usage: render once at the root of the app tree, e.g. in App.tsx / src/App.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { colors } from '../theme/colors';
import { pushNotificationService } from '../services/pushNotification.service';

interface NotifPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 4500;

const InAppNotificationBanner: React.FC = () => {
  const [payload, setPayload] = useState<NotifPayload | null>(null);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 60)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (title: string, body: string, data?: Record<string, string>) => {
    // Cancel any existing auto-dismiss
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    setPayload({ title, body, data });

    // Slide down
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();

    // Auto-dismiss
    dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT - 60,
      duration: 280,
      useNativeDriver: true,
    }).start(() => setPayload(null));
  };

  const handlePress = () => {
    // If this is a special payload (e.g. daily-points reward), forward the
    // tap so the global handler can open the right modal/screen.
    const data = payload?.data;
    if (data) pushNotificationService.emitNotificationTap(data);
    dismiss();
  };

  useEffect(() => {
    const unsubscribe = pushNotificationService.onForegroundMessage(show);
    return () => {
      unsubscribe();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!payload) return null;

  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: statusBarHeight, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={styles.inner}
      >
        <View style={styles.iconPlaceholder}>
          <Text style={styles.iconText}>💬</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {payload.title}
          </Text>
          {!!payload.body && (
            <Text style={styles.body} numberOfLines={2}>
              {payload.body}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20, // Android
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.4)', // primary with alpha
  },
  iconPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 17,
  },
});

export default InAppNotificationBanner;
