/**
 * BlotCard — native card visual matching the Blot game.
 * Used by Blot, Baazar Blot, and their multiplayer variants
 * so all blot-family games share the exact same card look.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SUIT_ICON: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLOR: Record<string, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#1a1a1a',
  spades: '#1a1a1a',
};

type Props = {
  suit: string;
  rank: string;
  /** Card width in dp. Height auto-scales with the same aspect ratio (~1.39). */
  size?: number;
  /** Render the back of the card (face-down). */
  faceDown?: boolean;
};

export default function BlotCard({ suit, rank, size = 72, faceDown = false }: Props) {
  const width = size;
  const height = Math.round(size * (100 / 72)); // matches Blot's 72x100 native card
  const suitColor = SUIT_COLOR[suit] ?? '#000';
  const suitIcon = SUIT_ICON[suit] ?? suit;

  // Scale interior text proportionally to card width (base 72px).
  const scale = size / 72;
  const rankSize = Math.max(10, Math.round(16 * scale));
  const cornerSuitSize = Math.max(8, Math.round(12 * scale));
  const centerSuitSize = Math.max(14, Math.round(28 * scale));
  const padding = Math.max(3, Math.round(6 * scale));

  if (faceDown) {
    return (
      <View
        style={[
          styles.card,
          styles.cardBack,
          { width, height, padding },
        ]}
      />
    );
  }

  return (
    <View style={[styles.card, { width, height, paddingVertical: padding, paddingHorizontal: padding }]}>
      {/* Top-left */}
      <View style={styles.corner}>
        <Text style={[styles.rank, { color: suitColor, fontSize: rankSize, lineHeight: rankSize + 2 }]}>{rank}</Text>
        <Text style={[styles.suit, { color: suitColor, fontSize: cornerSuitSize, lineHeight: cornerSuitSize + 2 }]}>{suitIcon}</Text>
      </View>
      {/* Center suit */}
      <Text style={[styles.center, { color: suitColor, fontSize: centerSuitSize }]}>{suitIcon}</Text>
      {/* Bottom-right (rotated) */}
      <View style={[styles.corner, styles.cornerBottom, { transform: [{ rotate: '180deg' }] }]}>
        <Text style={[styles.rank, { color: suitColor, fontSize: rankSize, lineHeight: rankSize + 2 }]}>{rank}</Text>
        <Text style={[styles.suit, { color: suitColor, fontSize: cornerSuitSize, lineHeight: cornerSuitSize + 2 }]}>{suitIcon}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cccccc',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  cardBack: {
    backgroundColor: '#1f3a8a',
    borderColor: '#0f1f4d',
  },
  corner: {
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  cornerBottom: {
    alignSelf: 'flex-end',
  },
  rank: {
    fontWeight: 'bold',
  },
  suit: {},
  center: {},
});
