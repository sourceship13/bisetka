import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
}

interface CardProps {
  card: CardType;
  onPress?: () => void;
  isPlayable?: boolean;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
}

const Card: React.FC<CardProps> = ({
  card,
  onPress,
  isPlayable = true,
  size = 'medium',
  faceDown = false,
}) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };

  const sizes = {
    small: { width: 50, height: 70, fontSize: 16 },
    medium: { width: 70, height: 98, fontSize: 22 },
    large: { width: 90, height: 126, fontSize: 28 },
  };

  const cardSize = sizes[size];

  if (faceDown) {
    return (
      <View style={[styles.card, { width: cardSize.width, height: cardSize.height }, styles.cardBack]}>
        <Text style={styles.cardBackPattern}>🎴</Text>
      </View>
    );
  }

  const content = (
    <View
      style={[
        styles.card,
        { width: cardSize.width, height: cardSize.height },
        !isPlayable && styles.cardDisabled,
      ]}>
      <Text style={[styles.rank, { fontSize: cardSize.fontSize, color: isRed ? '#DC143C' : '#000' }]}>
        {card.rank}
      </Text>
      <Text style={[styles.suit, { fontSize: cardSize.fontSize * 1.2, color: isRed ? '#DC143C' : '#000' }]}>
        {suitSymbols[card.suit]}
      </Text>
      <Text
        style={[
          styles.rankBottom,
          { fontSize: cardSize.fontSize, color: isRed ? '#DC143C' : '#000' },
        ]}>
        {card.rank}
      </Text>
    </View>
  );

  if (onPress && isPlayable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    padding: 8,
    margin: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardBack: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E3A8A',
    justifyContent: 'center',
  },
  cardBackPattern: {
    fontSize: 40,
  },
  rank: {
    fontWeight: 'bold',
  },
  suit: {
    fontWeight: 'bold',
  },
  rankBottom: {
    fontWeight: 'bold',
    transform: [{ rotate: '180deg' }],
  },
});

export default Card;
