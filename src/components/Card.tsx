import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {getCardImage, getCardBackImage} from '../data/cardsNew';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type FaceStyle = 'modern' | 'vintage' | 'retro' | 'cyberpunk' | 'minimal';

export interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
  trumpValue: number;
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

  // Map card to image asset (high-quality cards_new pack)
  const cardImages: Record<string, any> = {};

  if (faceDown) {
    return (
      <View style={[styles.card, { width: cardSize.width, height: cardSize.height, overflow: 'hidden', borderRadius: cfg.borderRadius }]}>
        <Image
          source={getCardBackImage('red')}
          style={{ width: cardSize.width, height: cardSize.height, borderRadius: cfg.borderRadius }}
          resizeMode="cover"
        />
      </View>
    );
  }

  const cardKey = `${card.rank}-${card.suit}`;
  const cardImage = cardImages[cardKey] ?? getCardImage(card);

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
