import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Dice3DSimple from './Dice3DSimple';

const { width } = Dimensions.get('window');
const DICE_SIZE = Math.floor(width / 6);

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

  const handleRoll = () => {
    if (!enabled || isRolling) return;

    // Generate random values
    const newDice1 = Math.floor(Math.random() * 6) + 1;
    const newDice2 = Math.floor(Math.random() * 6) + 1;

    dice1Ref.current = newDice1;
    dice2Ref.current = newDice2;
    setDice1Value(newDice1);
    setDice2Value(newDice2);
    setIsRolling(true);
    rollCompleteCount.current = 0;
  };

  const handleDiceRollComplete = () => {
    rollCompleteCount.current += 1;
    
    // Wait for both dice to complete
    if (rollCompleteCount.current >= 2) {
      setIsRolling(false);
      rollCompleteCount.current = 0;
      onRollComplete?.(dice1Ref.current, dice2Ref.current);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>
        {enabled ? '👆 Tap dice to roll' : '⏳ Waiting...'}
      </Text>
      <View style={styles.diceContainer} onTouchEnd={enabled ? handleRoll : undefined}>
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
      </View>
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
