import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';

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
  },
});
