import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../libs/hooks/useAuth';

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
  const balance = Math.floor(user?.balance ?? 0);

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
          <Text style={styles.pointsAmount}>{balance.toLocaleString()}</Text>
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
