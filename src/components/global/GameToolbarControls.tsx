import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export interface GameToolbarButton {
  icon: string;
  onPress: () => void;
}

interface GameToolbarControlsProps {
  buttons: GameToolbarButton[];
}

const GameToolbarControls: React.FC<GameToolbarControlsProps> = ({ buttons }) => (
  <View style={styles.toolbarControls}>
    {buttons.map((btn, i) => (
      <TouchableOpacity
        key={i}
        onPress={btn.onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.button}
      >
        <Text style={styles.icon}>{btn.icon}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  toolbarControls: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
    flexWrap: 'wrap',
    alignSelf: 'flex-end',
  },
  button: {
    padding: 6,
    borderRadius: 8,
  },
  icon: {
    fontSize: 32,
    color: '#FFD700',
  },
});

export default GameToolbarControls;
