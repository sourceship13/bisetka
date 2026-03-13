import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground} from 'react-native';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type CardFont = string;

export interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
  trumpValue: number;
}

export interface CardTheme {
  id: string;
  name: string;
  backgroundImage?: string; // URI to custom background for card face
  cardBackImage?: string; // URI to custom card back
  font: CardFont; // Selected font for rank numbers
  createdAt: number;
}

interface CardProps {
  card: CardType;
  onPress?: () => void;
  isPlayable?: boolean;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  theme?: CardTheme;
}

const DynamicCard: React.FC<CardProps> = ({
  card,
  onPress,
  isPlayable = true,
  size = 'medium',
  faceDown = false,
  theme,
}) => {
  // Match BlotScreen dimensions
  const sizes = {
    small:  { width: 90,  height: 120, rankSize: 24, suitSize: 32, valueSize: 12 },
    medium: { width: 80,  height: 110, rankSize: 22, suitSize: 28, valueSize: 11 },
    large:  { width: 100, height: 135, rankSize: 28, suitSize: 36, valueSize: 14 },
  };

  const cardSize = sizes[size];
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? '#DC143C' : '#1a1a1a';

  // Apply the font family from the theme (fonts are linked natively via react-native.config.js)
  const cardFontStyle = theme?.font ? { fontFamily: theme.font } : {};

  const suitSymbols: Record<Suit, string> = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️',
  };

  // FACE DOWN
  if (faceDown) {
    const cardBackSource = theme?.cardBackImage
      ? { uri: theme.cardBackImage }
      : require('../../assets/cards/default-card-back.png');

    return (
      <TouchableOpacity
        disabled={!isPlayable || !onPress}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        <ImageBackground
          source={cardBackSource}
          style={[styles.card, { width: cardSize.width, height: cardSize.height }]}
          imageStyle={{ borderRadius: 8 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  // FACE UP - Simple BlotScreen-style layout
  const cardContent = (
    <>
      <Text style={[styles.cardRank, { fontSize: cardSize.rankSize, color: suitColor }, cardFontStyle]}>
        {card.rank}
      </Text>
      <Text style={[styles.cardSuit, { fontSize: cardSize.suitSize }, cardFontStyle]}>
        {suitSymbols[card.suit]}
      </Text>
      <Text style={[styles.cardValue, { fontSize: cardSize.valueSize, color: '#666' }, cardFontStyle]}>
        {card.value}
      </Text>
    </>
  );

  const content = theme?.backgroundImage ? (
    <ImageBackground
      source={{ uri: theme.backgroundImage }}
      style={[styles.card, { width: cardSize.width, height: cardSize.height }]}
      imageStyle={{ borderRadius: 8 }}
      resizeMode="cover">
      {cardContent}
    </ImageBackground>
  ) : (
    <View style={[styles.card, { width: cardSize.width, height: cardSize.height }]}>
      {cardContent}
    </View>
  );

  if (onPress && isPlayable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>{content}</View>;
};


const styles = StyleSheet.create({
  cardContainer: {
    margin: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardRank: {
    fontWeight: 'bold',
  },
  cardSuit: {
    lineHeight: undefined,
  },
  cardValue: {
    textAlign: 'center',
  },
});

export default DynamicCard;
