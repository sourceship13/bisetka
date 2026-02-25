import React from 'react';
import {View, TouchableOpacity, StyleSheet, Image, ImageBackground} from 'react-native';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface CardTheme {
  backgroundImage?: string; // URI to custom background texture
  cardBackImage?: string; // URI to custom card back
}

interface CardProps {
  card: CardType;
  onPress?: () => void;
  isPlayable?: boolean;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  theme?: CardTheme; // Custom theme
}

const CardWithCustomBackground: React.FC<CardProps> = ({
  card,
  onPress,
  isPlayable = true,
  size = 'medium',
  faceDown = false,
  theme,
}) => {
  const sizes = {
    small: { width: 50, height: 70 },
    medium: { width: 70, height: 98 },
    large: { width: 90, height: 126 },
  };

  const cardSize = sizes[size];

  // Map card to transparent overlay (rank + suit symbols only)
  const overlayImages: Record<string, any> = {
    // Spades
    'A-spades': require('../../assets/cards/overlays/A-spades.png'),
    '2-spades': require('../../assets/cards/overlays/2-spades.png'),
    '3-spades': require('../../assets/cards/overlays/3-spades.png'),
    '4-spades': require('../../assets/cards/overlays/4-spades.png'),
    '5-spades': require('../../assets/cards/overlays/5-spades.png'),
    '6-spades': require('../../assets/cards/overlays/6-spades.png'),
    '7-spades': require('../../assets/cards/overlays/7-spades.png'),
    '8-spades': require('../../assets/cards/overlays/8-spades.png'),
    '9-spades': require('../../assets/cards/overlays/9-spades.png'),
    '10-spades': require('../../assets/cards/overlays/10-spades.png'),
    'J-spades': require('../../assets/cards/overlays/J-spades.png'),
    'Q-spades': require('../../assets/cards/overlays/Q-spades.png'),
    'K-spades': require('../../assets/cards/overlays/K-spades.png'),
    // Hearts
    'A-hearts': require('../../assets/cards/overlays/A-hearts.png'),
    '2-hearts': require('../../assets/cards/overlays/2-hearts.png'),
    '3-hearts': require('../../assets/cards/overlays/3-hearts.png'),
    '4-hearts': require('../../assets/cards/overlays/4-hearts.png'),
    '5-hearts': require('../../assets/cards/overlays/5-hearts.png'),
    '6-hearts': require('../../assets/cards/overlays/6-hearts.png'),
    '7-hearts': require('../../assets/cards/overlays/7-hearts.png'),
    '8-hearts': require('../../assets/cards/overlays/8-hearts.png'),
    '9-hearts': require('../../assets/cards/overlays/9-hearts.png'),
    '10-hearts': require('../../assets/cards/overlays/10-hearts.png'),
    'J-hearts': require('../../assets/cards/overlays/J-hearts.png'),
    'Q-hearts': require('../../assets/cards/overlays/Q-hearts.png'),
    'K-hearts': require('../../assets/cards/overlays/K-hearts.png'),
    // Diamonds
    'A-diamonds': require('../../assets/cards/overlays/A-diamonds.png'),
    '2-diamonds': require('../../assets/cards/overlays/2-diamonds.png'),
    '3-diamonds': require('../../assets/cards/overlays/3-diamonds.png'),
    '4-diamonds': require('../../assets/cards/overlays/4-diamonds.png'),
    '5-diamonds': require('../../assets/cards/overlays/5-diamonds.png'),
    '6-diamonds': require('../../assets/cards/overlays/6-diamonds.png'),
    '7-diamonds': require('../../assets/cards/overlays/7-diamonds.png'),
    '8-diamonds': require('../../assets/cards/overlays/8-diamonds.png'),
    '9-diamonds': require('../../assets/cards/overlays/9-diamonds.png'),
    '10-diamonds': require('../../assets/cards/overlays/10-diamonds.png'),
    'J-diamonds': require('../../assets/cards/overlays/J-diamonds.png'),
    'Q-diamonds': require('../../assets/cards/overlays/Q-diamonds.png'),
    'K-diamonds': require('../../assets/cards/overlays/K-diamonds.png'),
    // Clubs
    'A-clubs': require('../../assets/cards/overlays/A-clubs.png'),
    '2-clubs': require('../../assets/cards/overlays/2-clubs.png'),
    '3-clubs': require('../../assets/cards/overlays/3-clubs.png'),
    '4-clubs': require('../../assets/cards/overlays/4-clubs.png'),
    '5-clubs': require('../../assets/cards/overlays/5-clubs.png'),
    '6-clubs': require('../../assets/cards/overlays/6-clubs.png'),
    '7-clubs': require('../../assets/cards/overlays/7-clubs.png'),
    '8-clubs': require('../../assets/cards/overlays/8-clubs.png'),
    '9-clubs': require('../../assets/cards/overlays/9-clubs.png'),
    '10-clubs': require('../../assets/cards/overlays/10-clubs.png'),
    'J-clubs': require('../../assets/cards/overlays/J-clubs.png'),
    'Q-clubs': require('../../assets/cards/overlays/Q-clubs.png'),
    'K-clubs': require('../../assets/cards/overlays/K-clubs.png'),
  };

  // Face down - show custom card back if available
  if (faceDown) {
    const cardBackSource = theme?.cardBackImage 
      ? { uri: theme.cardBackImage }
      : require('../../assets/cards/default-card-back.png'); // Fallback

    return (
      <View style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        <Image
          source={cardBackSource}
          style={[styles.cardImage, { width: cardSize.width, height: cardSize.height }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Face up - composite custom background + overlay
  const cardKey = `${card.rank}-${card.suit}`;
  const overlayImage = overlayImages[cardKey];
  
  // Default white background if no theme
  const backgroundSource = theme?.backgroundImage
    ? { uri: theme.backgroundImage }
    : require('../../assets/cards/default-card-background.png'); // White card

  const content = (
    <View style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
      {/* Background layer */}
      <ImageBackground
        source={backgroundSource}
        style={[styles.cardImage, { width: cardSize.width, height: cardSize.height }]}
        imageStyle={{ borderRadius: 8 }}
        resizeMode="cover">
        {/* Overlay layer (rank + suit) */}
        <Image
          source={overlayImage}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 8 }]}
          resizeMode="contain"
        />
      </ImageBackground>
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
    borderRadius: 8,
  },
  cardImage: {
    borderRadius: 8,
  },
  cardDisabled: {
    opacity: 0.5,
  },
});

export default CardWithCustomBackground;
