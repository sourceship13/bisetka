/**
 * BlotCard — native card visual matching the Blot game.
 * Used by Blot, Baazar Blot, and their multiplayer variants
 * so all blot-family games share the exact same card look.
 *
 * Renders the high-quality cards_new pack via getCardImage().
 */
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { getCardImage, getCardBackImage } from '../data/cardsNew';

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
  const radius = Math.max(4, Math.round(size * 0.1));

  const source = faceDown ? getCardBackImage('red') : getCardImage({ rank, suit });

  return (
    <View style={[styles.card, { width, height, borderRadius: radius }]}>
      <Image
        source={source}
        style={{ width, height, borderRadius: radius }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
});
