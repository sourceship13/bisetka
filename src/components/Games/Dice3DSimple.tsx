import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DICE_SIZE = SCREEN_WIDTH / 7;

interface Dice3DSimpleProps {
  value: number; // 1-6
  isRolling: boolean;
  index: number; // 0-4 for positioning
  onRollComplete?: () => void;
}

// Dice dot patterns for each face (percentage positions)
const DOT_PATTERNS: { [key: number]: number[][] } = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

const Dice3DSimple: React.FC<Dice3DSimpleProps> = ({ value, isRolling, index, onRollComplete }) => {
  const rotateZ = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const displayValue = useRef(value);

  useEffect(() => {
    displayValue.current = value;
  }, [value]);

  useEffect(() => {
    if (isRolling) {
      const duration = 1200 + index * 80;

      Animated.parallel([
        // Spin
        Animated.timing(rotateZ, {
          toValue: 360 * (3 + Math.floor(Math.random() * 3)),
          duration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        // Bounce up then down
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: -60 - Math.random() * 30,
            duration: duration * 0.3,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: duration * 0.7,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
        ]),
        // Slight horizontal drift
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: (Math.random() - 0.5) * 30,
            duration: duration * 0.6,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: duration * 0.4,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        // Scale pulse
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.15,
            duration: duration * 0.15,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: duration * 0.85,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Settle with a spring
        Animated.spring(rotateZ, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }).start(() => {
          if (index === 4 && onRollComplete) {
            onRollComplete();
          }
        });
      });
    } else {
      rotateZ.setValue(0);
      translateY.setValue(0);
      translateX.setValue(0);
      scale.setValue(1);
    }
  }, [isRolling, value]);

  const rotateZInterp = rotateZ.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const dots = DOT_PATTERNS[value] || DOT_PATTERNS[1];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX },
            { translateY },
            { rotate: rotateZInterp },
            { scale },
          ],
        },
      ]}
    >
      <View style={styles.face}>
        {dots.map((pos, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: `${pos[0]}%`,
                top: `${pos[1]}%`,
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: DICE_SIZE,
    height: DICE_SIZE,
  },
  face: {
    width: DICE_SIZE,
    height: DICE_SIZE,
    backgroundColor: '#FFFACD',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
  },
  dot: {
    position: 'absolute',
    width: DICE_SIZE * 0.15,
    height: DICE_SIZE * 0.15,
    borderRadius: DICE_SIZE * 0.075,
    backgroundColor: '#000',
    marginLeft: -DICE_SIZE * 0.075,
    marginTop: -DICE_SIZE * 0.075,
  },
});

export default Dice3DSimple;
