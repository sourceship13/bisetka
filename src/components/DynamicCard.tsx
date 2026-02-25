import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ImageBackground} from 'react-native';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type CardFont = 'classic' | 'modern' | 'bold' | 'elegant' | 'playful';

export interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
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
  // rankSize / cornerSuit = corner label sizes; pip = center pip symbol size
  const sizes = {
    small:  { width: 50,  height: 70,  rankSize: 8,  cornerSuit: 7,  pip: 7  },
    medium: { width: 70,  height: 98,  rankSize: 11, cornerSuit: 9,  pip: 9  },
    large:  { width: 90,  height: 126, rankSize: 14, cornerSuit: 11, pip: 12 },
  };

  const cardSize = sizes[size];
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const color = isRed ? '#DC143C' : '#1a1a1a';

  const suitSymbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };

  // Font configurations
  const fontStyles: Record<CardFont, any> = {
    classic:  { fontFamily: 'System', fontWeight: '700' as const, letterSpacing: 0    },
    modern:   { fontFamily: 'System', fontWeight: '600' as const, letterSpacing: 0.5  },
    bold:     { fontFamily: 'System', fontWeight: '900' as const, letterSpacing: -0.5 },
    elegant:  { fontFamily: 'System', fontWeight: '300' as const, letterSpacing: 1    },
    playful:  { fontFamily: 'System', fontWeight: '800' as const, letterSpacing: 0    },
  };

  const selectedFont = theme?.font || 'classic';
  const fontStyle = fontStyles[selectedFont];

  // Default backgrounds
  const defaultBackground = require('../../assets/cards/default-card-background.png');
  const defaultCardBack = require('../../assets/cards/default-card-back.png');

  const backgroundSource = theme?.backgroundImage
    ? { uri: theme.backgroundImage }
    : defaultBackground;

  const cardBackSource = theme?.cardBackImage
    ? { uri: theme.cardBackImage }
    : defaultCardBack;

  // Height consumed by each corner label (rank + suit text + padding)
  const cornerH = cardSize.rankSize + cardSize.cornerSuit + 10;

  // FACE DOWN
  if (faceDown) {
    return (
      <TouchableOpacity
        disabled={!isPlayable || !onPress}
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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

  // FACE UP
  const content = (
    <ImageBackground
      source={backgroundSource}
      style={[styles.card, { width: cardSize.width, height: cardSize.height }]}
      imageStyle={{ borderRadius: 8 }}
      resizeMode="cover">

      {/* Top-left corner */}
      <View style={styles.cornerTopLeft}>
        <Text style={[styles.cornerRank, { fontSize: cardSize.rankSize, color }, fontStyle]}>
          {card.rank}
        </Text>
        <Text style={[styles.cornerSuit, { fontSize: cardSize.cornerSuit, color }]}>
          {suitSymbols[card.suit]}
        </Text>
      </View>

      {/* Center pip area — absolutely positioned between the two corners */}
      <View
        style={[
          styles.centerArea,
          { top: cornerH, bottom: cornerH, left: 4, right: 4 },
        ]}>
        {renderPips(card.rank, suitSymbols[card.suit], color, cardSize.pip)}
      </View>

      {/* Bottom-right corner (rotated 180°) */}
      <View style={styles.cornerBottomRight}>
        <Text style={[styles.cornerRank, { fontSize: cardSize.rankSize, color }, fontStyle]}>
          {card.rank}
        </Text>
        <Text style={[styles.cornerSuit, { fontSize: cardSize.cornerSuit, color }]}>
          {suitSymbols[card.suit]}
        </Text>
      </View>
    </ImageBackground>
  );

  if (onPress && isPlayable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.cardContainer, !isPlayable && styles.cardDisabled]}>{content}</View>;
};

// ---------------------------------------------------------------------------
// Pip layout helper — renders suit symbols in the center of the card.
// Each rank uses the correct count & grid pattern.
// The parent <View> (centerArea) is absolutely positioned between corners
// and uses justifyContent:'space-evenly' to distribute rows evenly.
// ---------------------------------------------------------------------------
function renderPips(rank: Rank, sym: string, color: string, pip: number) {
  const s = { fontSize: pip, color, lineHeight: pip * 1.25 };

  // A row of N horizontally-distributed pips
  const Row = ({ n }: { n: number }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: '100%' }}>
      {Array.from({ length: n }).map((_, i) => (
        <Text key={i} style={s}>{sym}</Text>
      ))}
    </View>
  );

  switch (rank) {
    // ── Ace ──────────────────────────────────────────────────────────────────
    case 'A':
      return (
        <View style={pipGrid}>
          <Text style={{ fontSize: pip * 2.2, color, textAlign: 'center' }}>{sym}</Text>
        </View>
      );

    // ── 2 ────────────────────────────────────────────────────────────────────
    case '2':
      return (
        <View style={pipGrid}>
          <Row n={1} />
          <Row n={1} />
        </View>
      );

    // ── 3 ────────────────────────────────────────────────────────────────────
    case '3':
      return (
        <View style={pipGrid}>
          <Row n={1} />
          <Row n={1} />
          <Row n={1} />
        </View>
      );

    // ── 4 ────────────────────────────────────────────────────────────────────
    case '4':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={2} />
        </View>
      );

    // ── 5 ────────────────────────────────────────────────────────────────────
    case '5':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={1} />
          <Row n={2} />
        </View>
      );

    // ── 6 ────────────────────────────────────────────────────────────────────
    case '6':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={2} />
          <Row n={2} />
        </View>
      );

    // ── 7 ────────────────────────────────────────────────────────────────────
    case '7':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={1} />
          <Row n={2} />
          <Row n={2} />
        </View>
      );

    // ── 8 ────────────────────────────────────────────────────────────────────
    case '8':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={2} />
          <Row n={2} />
          <Row n={2} />
        </View>
      );

    // ── 9 ────────────────────────────────────────────────────────────────────
    case '9':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={2} />
          <Row n={1} />
          <Row n={2} />
          <Row n={2} />
        </View>
      );

    // ── 10 ───────────────────────────────────────────────────────────────────
    case '10':
      return (
        <View style={pipGrid}>
          <Row n={2} />
          <Row n={1} />
          <Row n={2} />
          <Row n={2} />
          <Row n={1} />
          <Row n={2} />
        </View>
      );

    // ── Face cards ────────────────────────────────────────────────────────────
    case 'J':
    case 'Q':
    case 'K':
      return (
        <View style={pipGrid}>
          <Text style={{ fontSize: pip * 2, color, fontWeight: '700', textAlign: 'center' }}>
            {rank}
          </Text>
          <Text style={{ fontSize: pip * 1.2, color, textAlign: 'center' }}>{sym}</Text>
        </View>
      );

    default:
      return (
        <View style={pipGrid}>
          <Text style={{ fontSize: pip, color }}>{sym}</Text>
        </View>
      );
  }
}

// Shared style object for the pip wrapper inside centerArea
const pipGrid: import('react-native').ViewStyle = {
  flex: 1,
  width: '100%',
  justifyContent: 'space-evenly',
  alignItems: 'center',
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
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
    backgroundColor: '#fff',
    position: 'relative',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 3,
    left: 4,
    alignItems: 'center',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontWeight: '700',
    lineHeight: undefined,
  },
  cornerSuit: {
    lineHeight: undefined,
  },
  // Pip area: absolutely fills the space between the two corner labels
  centerArea: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

export default DynamicCard;
