import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';
import {PlayerColor} from '../game/nardiLogic';

interface CheckerProps {
  color: PlayerColor;
  count?: number;
  onPress?: () => void;
  size?: 'small' | 'medium';
  highlighted?: boolean;
}

const Checker: React.FC<CheckerProps> = ({
  color,
  count = 1,
  onPress,
  size = 'medium',
  highlighted = false,
}) => {
  const checkerSize = size === 'small' ? 28 : 36;
  const maxDisplay = 5;
  const checkersToShow = Math.min(count, maxDisplay);

  const content = (
    <View style={styles.checkerStack}>
      {Array.from({ length: checkersToShow }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.checker,
            {
              width: checkerSize,
              height: checkerSize,
              borderRadius: checkerSize / 2,
              backgroundColor: color === 'white' ? '#F5F5DC' : '#2C1810',
              borderColor: color === 'white' ? '#8B7355' : '#000',
              marginTop: index > 0 ? -checkerSize * 0.6 : 0,
            },
            highlighted && styles.checkerHighlighted,
          ]}
        />
      ))}
      {count > maxDisplay && (
        <View style={[styles.countBadge, { top: checkerSize * 0.15 }]}>
          <View style={styles.countBadgeInner}>
            <View style={styles.countBadgeText}>
              {/* Using a simple approach for count display */}
            </View>
          </View>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  checkerStack: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  checker: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  checkerHighlighted: {
    borderColor: '#FFD700',
    borderWidth: 3,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
  },
  countBadge: {
    position: 'absolute',
    right: -8,
  },
  countBadgeInner: {
    backgroundColor: '#DC143C',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default Checker;
