import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, Animated, PanResponder, Easing } from 'react-native';
import Dice3DSimple from './Dice3DSimple';

const { width } = Dimensions.get('window');
const DICE_SIZE = Math.floor((width / 6) * 1.15);
// Maximum pixels the dice container slides during a throw
const MAX_SLIDE = 220;

interface NardiDiceProps {
  onRollComplete?: (die1: number, die2: number) => void;
  enabled?: boolean;
}

export const NardiDice: React.FC<NardiDiceProps> = ({
  onRollComplete,
  enabled = true,
}) => {
  const [dice1Value, setDice1Value] = useState(1);
  const [dice2Value, setDice2Value] = useState(1);
  const [isRolling, setIsRolling] = useState(false);

  const rollCompleteCount = useRef(0);
  const dice1Ref = useRef(1);
  const dice2Ref = useRef(1);
  // Refs so PanResponder (created once) can always read the latest values
  const isRollingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const onRollCompleteRef = useRef(onRollComplete);
  enabledRef.current = enabled;
  onRollCompleteRef.current = onRollComplete;

  // Animated values for the throw slide — supports native driver (pure transform)
  const slideX = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;

  // Updated each render so PanResponder callbacks always call the latest logic
  const triggerRollRef = useRef<(vx: number, vy: number) => void>(() => {});
  triggerRollRef.current = (vx: number, vy: number) => {
    if (!enabledRef.current || isRollingRef.current) return;

    const newDie1 = Math.floor(Math.random() * 6) + 1;
    const newDie2 = Math.floor(Math.random() * 6) + 1;
    dice1Ref.current = newDie1;
    dice2Ref.current = newDie2;
    isRollingRef.current = true;
    setDice1Value(newDie1);
    setDice2Value(newDie2);
    setIsRolling(true);
    rollCompleteCount.current = 0;

    // Slide distance scales with swipe speed (min 70px, max MAX_SLIDE)
    const speed = Math.sqrt(vx * vx + vy * vy);
    const dist = Math.min(Math.max(speed * 150, 70), MAX_SLIDE);
    const nx = speed > 0.001 ? vx / speed : 0;
    const ny = speed > 0.001 ? vy / speed : -1; // default throw upward

    Animated.sequence([
      // Phase 1: fly outward fast (throw)
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: nx * dist,
          duration: Math.max(120, 220 - speed * 30),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: ny * dist,
          duration: Math.max(120, 220 - speed * 30),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: drift back to home while WebGL spin completes
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const snapBackRef = useRef<() => void>(() => {});
  snapBackRef.current = () => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  // Created once — references triggerRollRef / snapBackRef / enabledRef so no stale closures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gs) => {
        if (!enabledRef.current || isRollingRef.current) {
          snapBackRef.current();
          return;
        }
        const { vx, vy, dx, dy } = gs;
        const speed = Math.sqrt(vx * vx + vy * vy);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (speed >= 0.15 || dist >= 20) {
          triggerRollRef.current(vx, vy);
        } else {
          snapBackRef.current();
        }
      },
      onPanResponderTerminate: () => { snapBackRef.current(); },
    })
  ).current;

  const handleDiceRollComplete = () => {
    rollCompleteCount.current += 1;
    if (rollCompleteCount.current >= 2) {
      isRollingRef.current = false;
      setIsRolling(false);
      rollCompleteCount.current = 0;
      onRollCompleteRef.current?.(dice1Ref.current, dice2Ref.current);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>
        {!enabled ? '⏳ Waiting...' : isRolling ? '🎲 Rolling...' : '↗ Swipe dice to roll'}
      </Text>
      <Animated.View
        style={[
          styles.diceContainer,
          { transform: [{ translateX: slideX }, { translateY: slideY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Dice3DSimple
          value={dice1Value}
          isRolling={isRolling}
          index={0}
          onRollComplete={handleDiceRollComplete}
        />
        <Dice3DSimple
          value={dice2Value}
          isRolling={isRolling}
          index={1}
          onRollComplete={handleDiceRollComplete}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  instruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  diceContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NardiDice;
