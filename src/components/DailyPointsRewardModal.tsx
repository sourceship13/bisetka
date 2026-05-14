/**
 * DailyPointsRewardModal
 *
 * Shown when a "daily_points" push notification is opened. Tells the user how
 * many free points were awarded; tapping Claim closes the modal which (via
 * DailyPointsContext) credits the balance, plays coin_drop.mp3 and triggers
 * the toolbar flash.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDailyPoints } from '../contexts/DailyPointsContext';

const DailyPointsRewardModal: React.FC = () => {
  const { pendingReward, dismissReward } = useDailyPoints();
  const visible = pendingReward != null;

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scale, opacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissReward}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { opacity, transform: [{ scale }] },
          ]}
        >
          <Text style={styles.coin}>🪙</Text>
          <Text style={styles.title}>Random Reward!</Text>
          <Text style={styles.amount}>
            +{(pendingReward ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.subtitle}>
            Tap Claim to add them to your balance.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={dismissReward}
            style={styles.claimButton}
          >
            <Text style={styles.claimButtonText}>Claim</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1C1917',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  coin: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  amount: {
    color: '#fbbf24',
    fontSize: 56,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 19,
  },
  claimButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 160,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default DailyPointsRewardModal;
