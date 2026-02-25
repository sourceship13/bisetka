import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type FaceStyle = 'modern' | 'vintage' | 'retro' | 'cyberpunk' | 'minimal';

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
  faceStyle?: FaceStyle;
}

const Card: React.FC<CardProps> = ({
  card,
  onPress,
  isPlayable = true,
  size = 'medium',
  faceDown = false,
  faceStyle = 'modern',
}) => {
  const sizes = {
    small: { width: 50, height: 70 },
    medium: { width: 70, height: 98 },
    large: { width: 120, height: 166 },
  };

  const cardSize = sizes[size];

  // Per-style overlay and border config
  const faceStyleConfig: Record<FaceStyle, {
    borderColor: string;
    borderWidth: number;
    shadowColor: string;
    shadowOpacity: number;
    overlayColor?: string;
    overlayOpacity?: number;
    borderRadius: number;
  }> = {
    modern:    { borderColor: '#ddd',    borderWidth: 1,   shadowColor: '#000', shadowOpacity: 0.25, borderRadius: 8 },
    vintage:   { borderColor: '#c8960c', borderWidth: 2,   shadowColor: '#a0700a', shadowOpacity: 0.5, overlayColor: '#8B6914', overlayOpacity: 0.18, borderRadius: 4 },
    retro:     { borderColor: '#ff00cc', borderWidth: 3,   shadowColor: '#ff00cc', shadowOpacity: 0.7, overlayColor: '#220033', overlayOpacity: 0.15, borderRadius: 6 },
    cyberpunk: { borderColor: '#00ffe7', borderWidth: 2.5, shadowColor: '#00ffe7', shadowOpacity: 0.8, overlayColor: '#001133', overlayOpacity: 0.2,  borderRadius: 3 },
    minimal:   { borderColor: '#bbb',    borderWidth: 0.5, shadowColor: '#000', shadowOpacity: 0.05, borderRadius: 10 },
  };

  const cfg = faceStyleConfig[faceStyle];

  // Map card to image asset
  const cardImages: Record<string, any> = {
    // Spades
    'A-spades': require('../../assets/cards/A-spades.png'),
    '2-spades': require('../../assets/cards/2-spades.png'),
    '3-spades': require('../../assets/cards/3-spades.png'),
    '4-spades': require('../../assets/cards/4-spades.png'),
    '5-spades': require('../../assets/cards/5-spades.png'),
    '6-spades': require('../../assets/cards/6-spades.png'),
    '7-spades': require('../../assets/cards/7-spades.png'),
    '8-spades': require('../../assets/cards/8-spades.png'),
    '9-spades': require('../../assets/cards/9-spades.png'),
    '10-spades': require('../../assets/cards/10-spades.png'),
    'J-spades': require('../../assets/cards/J-spades.png'),
    'Q-spades': require('../../assets/cards/Q-spades.png'),
    'K-spades': require('../../assets/cards/K-spades.png'),
    // Hearts
    'A-hearts': require('../../assets/cards/A-hearts.png'),
    '2-hearts': require('../../assets/cards/2-hearts.png'),
    '3-hearts': require('../../assets/cards/3-hearts.png'),
    '4-hearts': require('../../assets/cards/4-hearts.png'),
    '5-hearts': require('../../assets/cards/5-hearts.png'),
    '6-hearts': require('../../assets/cards/6-hearts.png'),
    '7-hearts': require('../../assets/cards/7-hearts.png'),
    '8-hearts': require('../../assets/cards/8-hearts.png'),
    '9-hearts': require('../../assets/cards/9-hearts.png'),
    '10-hearts': require('../../assets/cards/10-hearts.png'),
    'J-hearts': require('../../assets/cards/J-hearts.png'),
    'Q-hearts': require('../../assets/cards/Q-hearts.png'),
    'K-hearts': require('../../assets/cards/K-hearts.png'),
    // Diamonds
    'A-diamonds': require('../../assets/cards/A-diamonds.png'),
    '2-diamonds': require('../../assets/cards/2-diamonds.png'),
    '3-diamonds': require('../../assets/cards/3-diamonds.png'),
    '4-diamonds': require('../../assets/cards/4-diamonds.png'),
    '5-diamonds': require('../../assets/cards/5-diamonds.png'),
    '6-diamonds': require('../../assets/cards/6-diamonds.png'),
    '7-diamonds': require('../../assets/cards/7-diamonds.png'),
    '8-diamonds': require('../../assets/cards/8-diamonds.png'),
    '9-diamonds': require('../../assets/cards/9-diamonds.png'),
    '10-diamonds': require('../../assets/cards/10-diamonds.png'),
    'J-diamonds': require('../../assets/cards/J-diamonds.png'),
    'Q-diamonds': require('../../assets/cards/Q-diamonds.png'),
    'K-diamonds': require('../../assets/cards/K-diamonds.png'),
    // Clubs
    'A-clubs': require('../../assets/cards/A-clubs.png'),
    '2-clubs': require('../../assets/cards/2-clubs.png'),
    '3-clubs': require('../../assets/cards/3-clubs.png'),
    '4-clubs': require('../../assets/cards/4-clubs.png'),
    '5-clubs': require('../../assets/cards/5-clubs.png'),
    '6-clubs': require('../../assets/cards/6-clubs.png'),
    '7-clubs': require('../../assets/cards/7-clubs.png'),
    '8-clubs': require('../../assets/cards/8-clubs.png'),
    '9-clubs': require('../../assets/cards/9-clubs.png'),
    '10-clubs': require('../../assets/cards/10-clubs.png'),
    'J-clubs': require('../../assets/cards/J-clubs.png'),
    'Q-clubs': require('../../assets/cards/Q-clubs.png'),
    'K-clubs': require('../../assets/cards/K-clubs.png'),
  };

  if (faceDown) {
    return (
      <View style={[styles.card, { width: cardSize.width, height: cardSize.height }, styles.cardBack]}>
        <Text style={styles.cardBackPattern}>🎴</Text>
      </View>
    );
  }

  const cardKey = `${card.rank}-${card.suit}`;
  const cardImage = cardImages[cardKey];

  const content = (
    <View style={[
      styles.cardContainer,
      !isPlayable && styles.cardDisabled,
      {
        borderRadius: cfg.borderRadius,
        borderWidth: cfg.borderWidth,
        borderColor: cfg.borderColor,
        shadowColor: cfg.shadowColor,
        shadowOpacity: cfg.shadowOpacity,
        shadowOffset: { width: 0, height: faceStyle === 'retro' || faceStyle === 'cyberpunk' ? 4 : 2 },
        shadowRadius: faceStyle === 'minimal' ? 1 : 6,
        elevation: faceStyle === 'minimal' ? 1 : 5,
      },
    ]}>
      <Image
        source={cardImage}
        style={[styles.cardImage, { width: cardSize.width, height: cardSize.height, borderRadius: cfg.borderRadius }]}
        resizeMode="contain"
      />
      {cfg.overlayColor && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: cfg.borderRadius,
              backgroundColor: cfg.overlayColor,
              opacity: cfg.overlayOpacity,
            },
          ]}
        />
      )}
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
  cardContainer: {
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardImage: {
    borderRadius: 8,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  card: {
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBack: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E3A8A',
    justifyContent: 'center',
  },
  cardBackPattern: {
    fontSize: 40,
  },
});

export default Card;
