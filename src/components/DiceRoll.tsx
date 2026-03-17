import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Easing,
  PanResponder,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

interface DiceRollProps {
  onRollComplete?: (dice1: number, dice2: number) => void;
  enabled?: boolean;
}

export const DiceRoll: React.FC<DiceRollProps> = ({
  onRollComplete,
  enabled = true,
}) => {
  const [dice1Value, setDice1Value] = useState(1);
  const [dice2Value, setDice2Value] = useState(1);
  const [isRolling, setIsRolling] = useState(false);

  // Animation values
  const dice1Rotation = useRef(new Animated.Value(0)).current;
  const dice2Rotation = useRef(new Animated.Value(0)).current;
  const dice1Scale = useRef(new Animated.Value(1)).current;
  const dice2Scale = useRef(new Animated.Value(1)).current;
  const dice1TranslateX = useRef(new Animated.Value(0)).current;
  const dice2TranslateX = useRef(new Animated.Value(0)).current;
  const dice1TranslateY = useRef(new Animated.Value(0)).current;
  const dice2TranslateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled && !isRolling,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return enabled && !isRolling && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const swipeVelocity = Math.sqrt(dx * dx + dy * dy);
        
        if (swipeVelocity > 50 && enabled && !isRolling) {
          rollDice();
        }
      },
    })
  ).current;

  const rollDice = () => {
    if (!enabled || isRolling) return;

    setIsRolling(true);

    // Generate final values
    const finalDice1 = Math.floor(Math.random() * 6) + 1;
    const finalDice2 = Math.floor(Math.random() * 6) + 1;

    // Reset animations
    dice1Rotation.setValue(0);
    dice2Rotation.setValue(0);
    dice1Scale.setValue(1);
    dice2Scale.setValue(1);

    // Create rolling animation sequence
    const duration = 800;
    const rotations = 5;

    // Update values during animation for visual variety
    const updateInterval = setInterval(() => {
      setDice1Value(Math.floor(Math.random() * 6) + 1);
      setDice2Value(Math.floor(Math.random() * 6) + 1);
    }, 60);

    Animated.parallel([
      // Dice 1 animations
      Animated.timing(dice1Rotation, {
        toValue: rotations * 360,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(dice1Scale, {
          toValue: 1.2,
          duration: duration / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dice1Scale, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(dice1TranslateX, {
        toValue: -25,
        duration: duration / 2,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(dice1TranslateY, {
          toValue: -60,
          duration: duration / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dice1TranslateY, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.in(Easing.bounce),
          useNativeDriver: true,
        }),
      ]),

      // Dice 2 animations
      Animated.timing(dice2Rotation, {
        toValue: rotations * 360 + 90,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(dice2Scale, {
          toValue: 1.2,
          duration: duration / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dice2Scale, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(dice2TranslateX, {
        toValue: 25,
        duration: duration / 2,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(dice2TranslateY, {
          toValue: -70,
          duration: duration / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dice2TranslateY, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.in(Easing.bounce),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      clearInterval(updateInterval);
      setDice1Value(finalDice1);
      setDice2Value(finalDice2);
      
      // Reset positions
      Animated.parallel([
        Animated.timing(dice1TranslateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dice2TranslateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setIsRolling(false);
      onRollComplete?.(finalDice1, finalDice2);
    });
  };

  const renderDiceFace = (value: number, isLeft: boolean) => {
    const rotation = isLeft ? dice1Rotation : dice2Rotation;
    const scale = isLeft ? dice1Scale : dice2Scale;
    const translateX = isLeft ? dice1TranslateX : dice2TranslateX;
    const translateY = isLeft ? dice1TranslateY : dice2TranslateY;

    return (
      <Animated.View
        style={[
          styles.dice,
          {
            transform: [
              { perspective: 1000 },
              { translateX },
              { translateY },
              { scale },
              {
                rotateX: rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg'],
                }),
              },
              {
                rotateY: rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', isLeft ? '360deg' : '-360deg'],
                }),
              },
              {
                rotateZ: rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', isLeft ? '180deg' : '-180deg'],
                }),
              },
            ],
          },
        ]}
      >
        {renderDots(value)}
      </Animated.View>
    );
  };

  const renderDots = (value: number) => {
    const dots = [];
    
    // Center dot (1, 3, 5)
    if (value === 1 || value === 3 || value === 5) {
      dots.push(<View key="center" style={[styles.dot, styles.dotCenter]} />);
    }

    // Top-left and bottom-right (2, 3, 4, 5, 6)
    if (value >= 2) {
      dots.push(<View key="tl" style={[styles.dot, styles.dotTopLeft]} />);
      dots.push(<View key="br" style={[styles.dot, styles.dotBottomRight]} />);
    }

    // Top-right and bottom-left (4, 5, 6)
    if (value >= 4) {
      dots.push(<View key="tr" style={[styles.dot, styles.dotTopRight]} />);
      dots.push(<View key="bl" style={[styles.dot, styles.dotBottomLeft]} />);
    }

    // Middle-left and middle-right (6)
    if (value === 6) {
      dots.push(<View key="ml" style={[styles.dot, styles.dotMiddleLeft]} />);
      dots.push(<View key="mr" style={[styles.dot, styles.dotMiddleRight]} />);
    }

    return dots;
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.diceContainer}>
        {renderDiceFace(dice1Value, true)}
        {renderDiceFace(dice2Value, false)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  diceContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  dice: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    backfaceVisibility: 'hidden',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  dotCenter: {
    top: 25,
    left: 25,
  },
  dotTopLeft: {
    top: 10,
    left: 10,
  },
  dotTopRight: {
    top: 10,
    right: 10,
  },
  dotBottomLeft: {
    bottom: 10,
    left: 10,
  },
  dotBottomRight: {
    bottom: 10,
    right: 10,
  },
  dotMiddleLeft: {
    top: 25,
    left: 10,
  },
  dotMiddleRight: {
    top: 25,
    right: 10,
  },
});

export default DiceRoll;
