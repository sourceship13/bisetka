import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Easing,
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
}

const GameToolbar: React.FC<GameToolbarProps> = ({
  title,
  onBack,
  rightElement,
  backgroundColor = '#1C1917',
  style,
}) => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { flashCounter } = useDailyPoints();
  const balance = Math.floor(user?.balance ?? 0);

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
        onPress={onBack}
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
});
