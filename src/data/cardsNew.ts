/**
 * cardsNew — unified registry for the new high-quality card assets that live
 * under `bisetka/assets/cards_new/`.
 *
 *   • `getCardImage({rank, suit})`       → 2D Image `source` (require'd JPG)
 *   • `getCardBackImage(color?)`         → 2D Image `source` for the card back
 *   • `getCardGlbPath({rank, suit})`     → string path consumed by AR3DOverlay
 *                                          (the matching GLB is registered in
 *                                          AR3DOverlay's GLB_ASSET_MAP).
 *
 * Suit values mirror the rest of the codebase: 'spades' | 'hearts' | 'diamonds' | 'clubs'.
 * Rank values: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

// ─── 2D image registry (JPG faces) ────────────────────────────────────────────
// Filenames are `<suit>_<lowercase_rank>.jpg` inside assets/cards_new/tex/.
const IMAGES: Record<string, any> = {
  // Spades
  'A-spades': require('../../assets/cards_new/tex/spades_a.jpg'),
  '2-spades': require('../../assets/cards_new/tex/spades_2.jpg'),
  '3-spades': require('../../assets/cards_new/tex/spades_3.jpg'),
  '4-spades': require('../../assets/cards_new/tex/spades_4.jpg'),
  '5-spades': require('../../assets/cards_new/tex/spades_5.jpg'),
  '6-spades': require('../../assets/cards_new/tex/spades_6.jpg'),
  '7-spades': require('../../assets/cards_new/tex/spades_7.jpg'),
  '8-spades': require('../../assets/cards_new/tex/spades_8.jpg'),
  '9-spades': require('../../assets/cards_new/tex/spades_9.jpg'),
  '10-spades': require('../../assets/cards_new/tex/spades_10.jpg'),
  'J-spades': require('../../assets/cards_new/tex/spades_j.jpg'),
  'Q-spades': require('../../assets/cards_new/tex/spades_q.jpg'),
  'K-spades': require('../../assets/cards_new/tex/spades_k.jpg'),
  // Hearts
  'A-hearts': require('../../assets/cards_new/tex/hearts_a.jpg'),
  '2-hearts': require('../../assets/cards_new/tex/hearts_2.jpg'),
  '3-hearts': require('../../assets/cards_new/tex/hearts_3.jpg'),
  '4-hearts': require('../../assets/cards_new/tex/hearts_4.jpg'),
  '5-hearts': require('../../assets/cards_new/tex/hearts_5.jpg'),
  '6-hearts': require('../../assets/cards_new/tex/hearts_6.jpg'),
  '7-hearts': require('../../assets/cards_new/tex/hearts_7.jpg'),
  '8-hearts': require('../../assets/cards_new/tex/hearts_8.jpg'),
  '9-hearts': require('../../assets/cards_new/tex/hearts_9.jpg'),
  '10-hearts': require('../../assets/cards_new/tex/hearts_10.jpg'),
  'J-hearts': require('../../assets/cards_new/tex/hearts_j.jpg'),
  'Q-hearts': require('../../assets/cards_new/tex/hearts_q.jpg'),
  'K-hearts': require('../../assets/cards_new/tex/hearts_k.jpg'),
  // Diamonds
  'A-diamonds': require('../../assets/cards_new/tex/diamonds_a.jpg'),
  '2-diamonds': require('../../assets/cards_new/tex/diamonds_2.jpg'),
  '3-diamonds': require('../../assets/cards_new/tex/diamonds_3.jpg'),
  '4-diamonds': require('../../assets/cards_new/tex/diamonds_4.jpg'),
  '5-diamonds': require('../../assets/cards_new/tex/diamonds_5.jpg'),
  '6-diamonds': require('../../assets/cards_new/tex/diamonds_6.jpg'),
  '7-diamonds': require('../../assets/cards_new/tex/diamonds_7.jpg'),
  '8-diamonds': require('../../assets/cards_new/tex/diamonds_8.jpg'),
  '9-diamonds': require('../../assets/cards_new/tex/diamonds_9.jpg'),
  '10-diamonds': require('../../assets/cards_new/tex/diamonds_10.jpg'),
  'J-diamonds': require('../../assets/cards_new/tex/diamonds_j.jpg'),
  'Q-diamonds': require('../../assets/cards_new/tex/diamonds_q.jpg'),
  'K-diamonds': require('../../assets/cards_new/tex/diamonds_k.jpg'),
  // Clubs
  'A-clubs': require('../../assets/cards_new/tex/clubs_a.jpg'),
  '2-clubs': require('../../assets/cards_new/tex/clubs_2.jpg'),
  '3-clubs': require('../../assets/cards_new/tex/clubs_3.jpg'),
  '4-clubs': require('../../assets/cards_new/tex/clubs_4.jpg'),
  '5-clubs': require('../../assets/cards_new/tex/clubs_5.jpg'),
  '6-clubs': require('../../assets/cards_new/tex/clubs_6.jpg'),
  '7-clubs': require('../../assets/cards_new/tex/clubs_7.jpg'),
  '8-clubs': require('../../assets/cards_new/tex/clubs_8.jpg'),
  '9-clubs': require('../../assets/cards_new/tex/clubs_9.jpg'),
  '10-clubs': require('../../assets/cards_new/tex/clubs_10.jpg'),
  'J-clubs': require('../../assets/cards_new/tex/clubs_j.jpg'),
  'Q-clubs': require('../../assets/cards_new/tex/clubs_q.jpg'),
  'K-clubs': require('../../assets/cards_new/tex/clubs_k.jpg'),
};

const BACK_RED = require('../../assets/cards_new/tex/back_red.jpg');
const BACK_BLACK = require('../../assets/cards_new/tex/back_black.jpg');

// ─── 3D GLB path registry (filenames inside assets/cards_new/) ───────────────
// These paths match the keys in AR3DOverlay's GLB_ASSET_MAP.
const SUIT_TITLE: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export function getCardImage(card: { rank: string; suit: string }): any {
  return IMAGES[`${card.rank}-${card.suit}`];
}

export function getCardBackImage(color: 'red' | 'black' = 'red'): any {
  return color === 'black' ? BACK_BLACK : BACK_RED;
}

export function getCardGlbPath(card: { rank: Rank | string; suit: Suit | string }): string {
  const suit = SUIT_TITLE[(card.suit as Suit)] ?? card.suit;
  return `glb/cards_new/${suit}_${card.rank}.glb`;
}

export const CARD_IMAGES = IMAGES;
export const CARD_BACK_RED = BACK_RED;
export const CARD_BACK_BLACK = BACK_BLACK;
