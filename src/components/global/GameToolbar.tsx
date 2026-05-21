import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Easing,
  Modal,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../libs/hooks/useAuth';
import { useDailyPoints } from '../../contexts/DailyPointsContext';

interface GameToolbarProps {
  title: string;
  onBack: () => void;
  /** Optional element rendered on the right side (e.g. a "New Game" button) */
  rightElement?: React.ReactNode;
  /** Override the toolbar background colour. Defaults to '#1C1917'. */
  backgroundColor?: string;
  style?: object;
  /** When true (default) tapping Back shows a confirmation modal before invoking onBack. */
  confirmBack?: boolean;
  /** Optional override for the confirmation title. */
  confirmTitle?: string;
  /** Optional override for the confirmation message. */
  confirmMessage?: string;
}

const GameToolbar: React.FC<GameToolbarProps> = ({
  title,
  onBack,
  rightElement,
  backgroundColor = '#1C1917',
  style,
  confirmBack = true,
  confirmTitle = 'Leave Game?',
  confirmMessage = 'Are you sure you want to close this game? Your progress will be lost.',
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { flashCounter } = useDailyPoints();
  const balance = Math.floor(user?.balance ?? 0);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleBackPress = () => {
    if (confirmBack) {
      setConfirmVisible(true);
    } else {
      onBack();
    }
  };

  const handleConfirmLeave = () => {
    setConfirmVisible(false);
    onBack();
  };

  // 0 = yellow (#fbbf24), 1 = white. Animated between them when flashCounter
  // increments (i.e. points were just credited).
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (flashCounter === 0) return;
    const oneCycle = () =>
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 1,
          duration: 140,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: 140,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]);
    Animated.sequence([oneCycle(), oneCycle(), oneCycle(), oneCycle()]).start();
  }, [flashCounter, flash]);

  const animatedColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fbbf24', '#ffffff'],
  });

  return (
    <View style={[styles.toolbar, { backgroundColor }, style]}>
      <TouchableOpacity
        onPress={handleBackPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      <View style={styles.right}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PointsShop')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.pointsPill}>
          <Text style={styles.pointsCoin}>🪙</Text>
          <Animated.Text style={[styles.pointsAmount, { color: animatedColor }]}>{balance.toLocaleString()}</Animated.Text>
          <View style={styles.pointsPlus}>
            <Text style={styles.pointsPlusText}>+ Get Points</Text>
          </View>
        </TouchableOpacity>
        {rightElement ?? null}
      </View>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{confirmTitle}</Text>
            <Text style={styles.modalMessage}>{confirmMessage}</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setConfirmVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalLeaveButton]}
                onPress={handleConfirmLeave}>
                <Text style={styles.modalLeaveText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default GameToolbar;

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop:
      Platform.OS === 'android'
        ? (StatusBar.currentHeight ?? 0) + 12
        : 12,
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  right: {
    minWidth: 60,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  pointsCoin: {
    fontSize: 14,
  },
  pointsAmount: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
  pointsPlus: {
    backgroundColor: '#f59e0b',
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1C1917',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalLeaveButton: {
    backgroundColor: '#dc2626',
  },
  modalLeaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
