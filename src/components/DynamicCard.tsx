import React, { useEffect, useRef } from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground, Animated, Dimensions} from 'react-native';

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
  cardBackImage?: string; // URI to custom card back (required for proper display)
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
  // Animation support
  animatedOpacity?: Animated.Value;
  animatedScale?: Animated.Value;
  animatedPosition?: { x?: Animated.Value; y?: Animated.Value };
  // Fade-in animation on mount
  enableFadeIn?: boolean;
  fadeInDuration?: number;
}

const DynamicCard: React.FC<CardProps> = ({
  card,
  onPress,
  isPlayable = true,
  size = 'medium',
  faceDown = false,
  theme,
  animatedOpacity,
  animatedScale,
  animatedPosition,
  enableFadeIn = false,
  fadeInDuration = 400,
}) => {
  const fadeInOpacity = useRef(new Animated.Value(enableFadeIn ? 0 : 1)).current;

  // Fade in animation on mount
  useEffect(() => {
    if (enableFadeIn) {
      Animated.timing(fadeInOpacity, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true,
      }).start();
    }
  }, [enableFadeIn, fadeInDuration]);

  // Get responsive card dimensions based on screen
  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 400;

  // Match BlotScreen dimensions and scale for small screens
  const baseSizes = {
    small:  { width: 90,  height: 120, rankSize: 24, suitSize: 32, valueSize: 12 },
    medium: { width: 80,  height: 110, rankSize: 22, suitSize: 28, valueSize: 11 },
    large:  { width: 100, height: 135, rankSize: 28, suitSize: 36, valueSize: 14 },
  };

  const cardSize = isSmallScreen
    ? {
        ...baseSizes[size],
        width: baseSizes[size].width * 0.9,
        height: baseSizes[size].height * 0.9,
        rankSize: baseSizes[size].rankSize * 0.9,
        suitSize: baseSizes[size].suitSize * 0.9,
        valueSize: baseSizes[size].valueSize * 0.9,
      }
    : baseSizes[size];

  // Apply the font family from the theme (fonts are linked natively via react-native.config.js)
  const cardFontStyle = theme?.font ? { fontFamily: theme.font } : {};

  // Combine fade-in with other animations
  const finalOpacity = animatedOpacity
    ? Animated.multiply(fadeInOpacity, animatedOpacity)
    : fadeInOpacity;

  // Build animated style with proper transform handling
  const animatedStyle = {
    opacity: finalOpacity,
    transform: [
      { scale: animatedScale || 1 },
      { translateX: animatedPosition?.x || 0 },
      { translateY: animatedPosition?.y || 0 },
    ] as any,
  };

  const suitSymbols: Record<Suit, string> = {
    hearts: '♥️',
    diamonds: '♦️',
    clubs: '♣️',
    spades: '♠️',
  };

  // FACE DOWN - Show card back image
  if (faceDown) {
    // Use theme card back if available, otherwise try default asset
    let cardBackSource: any = require('../../assets/cards/default-card-back.png');
    try {
      if (theme?.cardBackImage) {
        cardBackSource = { uri: theme.cardBackImage };
      }
    } catch (e) {
      // Fallback to require if URI fails
      console.warn('Card back image not available, using default');
    }

    const cardContent = (
      <ImageBackground
        source={cardBackSource}
        style={[styles.card, { width: cardSize.width, height: cardSize.height }]}
        imageStyle={{ borderRadius: 8 }}
        resizeMode="cover"
      />
    );

    if (animatedOpacity || animatedScale) {
      return (
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            disabled={!isPlayable || !onPress}
            onPress={onPress}
            activeOpacity={0.7}
            style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
            {cardContent}
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <TouchableOpacity
        disabled={!isPlayable || !onPress}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  // FACE UP - Simple BlotScreen-style layout
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? '#DC143C' : '#1a1a1a';
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

  // With animations
  if (animatedOpacity || animatedScale || animatedPosition) {
    const touchableContent = (
      <TouchableOpacity
        disabled={!isPlayable || !onPress}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        {content}
      </TouchableOpacity>
    );

    return (
      <Animated.View style={animatedStyle}>
        {touchableContent}
      </Animated.View>
    );
  }

  // Without animations
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
