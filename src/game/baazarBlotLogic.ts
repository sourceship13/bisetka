/**
 * Bazaar Blot (Bazaar Belot) — game logic
 *
 * Rules overview:
 *  • 32-card deck: 7 8 9 10 J Q K A in each of 4 suits (8 cards/player)
 *  • Trump ranking:     J > 9 > A > 10 > K > Q > 8 > 7
 *  • Non-trump ranking: A > 10 > K > Q > J > 9 > 8 > 7
 *  • Auction: any player bids (number 8-16) + suit; each bid must be higher
 *    than the previous; pass doesn't eliminate; all-pass → redeal
 *  • Contra: opponent doubles stakes; only Rekurenti can respond
 *  • Kapuyt: declare all 8 tricks → 250 flat points
 *  • Sequences: Terz(3)=20 / Quart(4)=50 / Quint(5)=100 same suit, consecutive
 *    Highest team's sequences score; equal rank → neither scores
 *  • Belote: K+Q of trump = +20 (announced during play)
 *  • Scoring: bidTarget = bid × 10;
 *      bidder ≥ bidTarget → both teams keep their card points
 *      bidder < bidTarget → bidder=0, opponent gets 162(+10 last trick=172)
 *  • Last trick: +10 ("der")
 *  • Game target: 101 / 201 / 301 (selected before match)
 */

import { CardType, Suit } from '../components/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Player {
  id: number;
  name: string;
  hand: CardType[];
  team: 1 | 2;
}

export interface TrickPlay {
  playerId: number;
  card: CardType;
}

export interface Trick {
  cards: TrickPlay[];
  winner: number | null;
}

export type BidLevel = 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
export type GameTarget = 101 | 201 | 301;

export interface BaazarGameState {
  players: Player[];
  currentPlayer: number;
  dealer: number;
  trump: Suit | null;
  phase: 'setup' | 'dealing' | 'bidding' | 'selectingTrump' | 'playing' | 'roundEnd' | 'gameEnd';

  // Auction
  currentBid: BidLevel;       // current winning bid (8 = floor / no bid yet)
  bidderPlayer: number | null; // player who made the current highest bid
  bidderTeam: 1 | 2 | null;
  passedPlayers: number[];     // players who passed THIS round (reset on new bids)
  contracted: boolean;         // Contra was called
  recontracted: boolean;       // Rekurenti was called
  kapuyt: boolean;             // all-8-tricks declaration

  // Playing
  currentTrick: Trick;
  completedTricks: Trick[];
  lastTrickWinner: number | null;
  takerTeam: 1 | 2 | null;
  beloteTeam: 1 | 2 | null;

  // Scores
  scores: { team1: number; team2: number };   // current round running total
  gameScore: { team1: number; team2: number }; // cumulative game score
  targetScore: GameTarget;

  // Round-end messaging
  roundMessage: string;
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

const RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export const createBaazarDeck = (): CardType[] => {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: CardType[]): CardType[] => {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
};

export const dealCards = (players: Player[]): Player[] => {
  const deck = shuffleDeck(createBaazarDeck());
  return players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * 8, (i + 1) * 8),
  }));
};

// ---------------------------------------------------------------------------
// Card strength (lower = stronger)
// ---------------------------------------------------------------------------

const TRUMP_ORDER: Rank[] = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const PLAIN_ORDER: Rank[] = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];

export const getCardStrength = (card: CardType, trump: Suit | null): number => {
  const order = card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER;
  return order.indexOf(card.rank as Rank);
};

// ---------------------------------------------------------------------------
// Card points (same as classic Blot)
// ---------------------------------------------------------------------------

export const getCardPoints = (card: CardType, trump: Suit | null): number => {
  const isTrump = card.suit === trump;
  switch (card.rank) {
    case 'J':  return isTrump ? 20 : 2;
    case '9':  return isTrump ? 14 : 0;
    case 'A':  return 11;
    case '10': return 10;
    case 'K':  return 4;
    case 'Q':  return 3;
    case '8':  return 0;
    case '7':  return 0;
    default:   return 0;
  }
};

// ---------------------------------------------------------------------------
// Trick rules
// ---------------------------------------------------------------------------

export const determineTrickWinner = (
  trick: Trick,
  trump: Suit | null,
  leadSuit: Suit,
): number => {
  let best = trick.cards[0];
  for (const play of trick.cards.slice(1)) {
    const b = best.card; const c = play.card;
    if (c.suit === trump && b.suit !== trump) { best = play; continue; }
    if (c.suit === trump && b.suit === trump) {
      if (getCardStrength(c, trump) < getCardStrength(b, trump)) best = play;
      continue;
    }
    if (c.suit === leadSuit && b.suit === leadSuit) {
      if (getCardStrength(c, trump) < getCardStrength(b, trump)) best = play;
    }
  }
  return best.playerId;
};

export const canPlayCard = (
  card: CardType,
  hand: CardType[],
  currentTrick: Trick,
  trump: Suit | null,
): boolean => {
  // Safety check: if card is invalid, it cannot be played
  if (!card || !card.suit || !card.rank) return false;

  if (currentTrick.cards.length === 0) return true;

  // Filter out any undefined/null cards defensively
  const validHand = hand.filter(c => c && c.suit && c.rank);
  const leadSuit = currentTrick.cards[0].card.suit;
  const hasLead = validHand.some(c => c.suit === leadSuit);

  if (leadSuit !== trump) {
    if (hasLead) return card.suit === leadSuit;
    // No lead suit — must over-trump if possible
    const trumpCards = validHand.filter(c => c.suit === trump);
    if (trumpCards.length > 0) {
      const trumpsInTrick = currentTrick.cards
        .filter(p => p && p.card && p.card.suit === trump)
        .map(p => getCardStrength(p.card, trump));
      const bestTrump = trumpsInTrick.length > 0 ? Math.min(...trumpsInTrick) : 999;
      const canBeat = trumpCards.some(c => getCardStrength(c, trump) < bestTrump);
      if (canBeat) return card.suit === trump && getCardStrength(card, trump) < bestTrump;
      return card.suit === trump;
    }
    return true;
  }

  // Lead is trump: must follow trump AND over-trump if possible
  const hasTrump = validHand.some(c => c.suit === trump);
  if (!hasTrump) return true; // No trump cards — free to play anything

  const trumpsInTrick = currentTrick.cards
    .filter(p => p && p.card && p.card.suit === trump)
    .map(p => getCardStrength(p.card, trump));
  const currentBest = trumpsInTrick.length > 0 ? Math.min(...trumpsInTrick) : 999;
  const canBeat = validHand.some(c => c.suit === trump && getCardStrength(c, trump) < currentBest);
  if (canBeat) return card.suit === trump && getCardStrength(card, trump) < currentBest;
  return card.suit === trump;
};

// ---------------------------------------------------------------------------
// Belote detection
// ---------------------------------------------------------------------------

export const detectBeloteTeam = (
  players: Player[],
  trump: Suit | null,
): 1 | 2 | null => {
  if (!trump) return null;
  for (const p of players) {
    const hasK = p.hand.some(c => c.suit === trump && c.rank === 'K');
    const hasQ = p.hand.some(c => c.suit === trump && c.rank === 'Q');
    if (hasK && hasQ) return p.team;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Sequence (Terz/Quart/Quint) detection
// ---------------------------------------------------------------------------

export interface Sequence {
  suit: Suit;
  length: number; // 3, 4, or 5+
  highRank: Rank;
  points: number; // 20, 50, or 100+
  team: 1 | 2;
}

const RANK_VALUE: Record<Rank, number> = {
  '7': 0, '8': 1, '9': 2, '10': 3, 'J': 4, 'Q': 5, 'K': 6, 'A': 7,
};

const sequencePoints = (len: number): number => {
  if (len >= 5) return 100;
  if (len === 4) return 50;
  return 20;
};

export const findSequences = (hand: CardType[], team: 1 | 2): Sequence[] => {
  const sequences: Sequence[] = [];
  for (const suit of SUITS) {
    const suits = hand
      .filter(c => c.suit === suit)
      .map(c => RANK_VALUE[c.rank as Rank])
      .sort((a, b) => a - b);
    if (suits.length < 3) continue;
    let start = 0;
    while (start < suits.length) {
      let end = start;
      while (end + 1 < suits.length && suits[end + 1] === suits[end] + 1) end++;
      const len = end - start + 1;
      if (len >= 3) {
        const highVal = suits[end];
        const highRank = (Object.keys(RANK_VALUE) as Rank[]).find(
          r => RANK_VALUE[r] === highVal,
        )!;
        sequences.push({ suit, length: len, highRank, points: sequencePoints(len), team });
      }
      start = end + 1;
    }
  }
  return sequences;
};

/**
 * Returns which team's sequences score.
 * Highest sequence wins all; tie → neither team scores sequences.
 */
export const resolveSequences = (
  team1Seqs: Sequence[],
  team2Seqs: Sequence[],
): { team1: number; team2: number } => {
  const bestFor = (seqs: Sequence[]): { pts: number; highVal: number } => {
    if (seqs.length === 0) return { pts: 0, highVal: -1 };
    const best = seqs.reduce((b, s) =>
      s.points > b.points || (s.points === b.points && RANK_VALUE[s.highRank] > RANK_VALUE[b.highRank])
        ? s : b,
    );
    return { pts: best.points, highVal: RANK_VALUE[best.highRank] };
  };

  const b1 = bestFor(team1Seqs);
  const b2 = bestFor(team2Seqs);

  if (b1.pts === 0 && b2.pts === 0) return { team1: 0, team2: 0 };
  if (b1.pts > b2.pts) return { team1: team1Seqs.reduce((s, q) => s + q.points, 0), team2: 0 };
  if (b2.pts > b1.pts) return { team1: 0, team2: team2Seqs.reduce((s, q) => s + q.points, 0) };
  // Equal best sequence → compare high card
  if (b1.highVal > b2.highVal) return { team1: team1Seqs.reduce((s, q) => s + q.points, 0), team2: 0 };
  if (b2.highVal > b1.highVal) return { team1: 0, team2: team2Seqs.reduce((s, q) => s + q.points, 0) };
  // Perfect tie → neither scores
  return { team1: 0, team2: 0 };
};

// ---------------------------------------------------------------------------
// Round scoring
// ---------------------------------------------------------------------------

export interface BaazarRoundResult {
  team1: number;
  team2: number;
  bidderFell: boolean;
  kapuyt: boolean;
  beloteBonus: 0 | 20;
  seqBonus: { team1: number; team2: number };
  message: string;
}

export const calculateBaazarRound = (
  tricks: Trick[],
  players: Player[],
  trump: Suit | null,
  bidderTeam: 1 | 2 | null,
  currentBid: BidLevel,
  contracted: boolean,
  recontracted: boolean,
  kapuyt: boolean,
  beloteTeam: 1 | 2 | null,
  /** Pass the DEALT hands (before tricks) for sequence detection */
  originalHands: { team: 1 | 2; hand: CardType[] }[],
): BaazarRoundResult => {
  // Kapuyt: all 8 tricks to one team → 250 flat
  const t1Tricks = tricks.filter(
    t => players.find(p => p.id === t.winner)?.team === 1,
  ).length;
  const isKapuyt = t1Tricks === 8 || t1Tricks === 0;

  if (kapuyt || isKapuyt) {
    const winTeam = t1Tricks === 8 ? 1 : 2;
    const beloteBonus: 0 | 20 = beloteTeam ? 20 : 0;
    return {
      team1: winTeam === 1 ? 250 + (beloteTeam === 1 ? 20 : 0) : 0,
      team2: winTeam === 2 ? 250 + (beloteTeam === 2 ? 20 : 0) : 0,
      bidderFell: false,
      kapuyt: true,
      beloteBonus,
      seqBonus: { team1: 0, team2: 0 },
      message: `Kapuyt! Team ${winTeam} wins all tricks — 250 pts!`,
    };
  }

  // Normal scoring: accumulate card points + last trick
  let raw1 = 0;
  let raw2 = 0;
  tricks.forEach((trick, idx) => {
    const winner = players.find(p => p.id === trick.winner);
    if (!winner) return;
    let pts = trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);
    if (idx === tricks.length - 1) pts += 10; // last trick +10
    if (winner.team === 1) raw1 += pts; else raw2 += pts;
  });

  // Sequences
  const t1Hands = originalHands.filter(h => h.team === 1).flatMap(h => h.hand);
  const t2Hands = originalHands.filter(h => h.team === 2).flatMap(h => h.hand);
  const t1Seqs = findSequences(t1Hands, 1);
  const t2Seqs = findSequences(t2Hands, 2);
  const seqBonus = resolveSequences(t1Seqs, t2Seqs);
  raw1 += seqBonus.team1;
  raw2 += seqBonus.team2;

  const bidTarget = currentBid * 10;
  let multiplier = contracted ? (recontracted ? 4 : 2) : 1;

  // Belote
  const beloteBonus: 0 | 20 = beloteTeam ? 20 : 0;

  let team1 = raw1;
  let team2 = raw2;
  let bidderFell = false;
  let message = '';

  if (bidderTeam) {
    const bidderScore = bidderTeam === 1 ? raw1 : raw2;
    if (bidderScore < bidTarget) {
      // Bidder fell
      bidderFell = true;
      team1 = bidderTeam === 1 ? 0 : (raw1 + raw2) * multiplier;
      team2 = bidderTeam === 2 ? 0 : (raw1 + raw2) * multiplier;
      message = `Team ${bidderTeam} fell! (needed ${bidTarget}, got ${bidderScore}) — opponent scores ${(raw1 + raw2) * multiplier}`;
    } else {
      team1 = raw1 * multiplier;
      team2 = raw2 * multiplier;
      message = `Team ${bidderTeam} made bid! (${bidderScore}/${bidTarget})`;
    }
  }

  // Belote applied last  
  if (beloteTeam === 1) team1 += beloteBonus;
  if (beloteTeam === 2) team2 += beloteBonus;

  return { team1, team2, bidderFell, kapuyt: false, beloteBonus, seqBonus, message };
};

// ---------------------------------------------------------------------------
// Running score (mid-round live tally)
// ---------------------------------------------------------------------------

export const calculateRunningScore = (
  tricks: Trick[],
  players: Player[],
  trump: Suit | null,
): { team1: number; team2: number } => {
  let team1 = 0;
  let team2 = 0;
  const allDone = players.every(p => p.hand.length === 0);
  tricks.forEach((trick, idx) => {
    const winner = players.find(p => p.id === trick.winner);
    if (!winner) return;
    let pts = trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);
    if (idx === tricks.length - 1 && allDone) pts += 10;
    if (winner.team === 1) team1 += pts; else team2 += pts;
  });
  return { team1, team2 };
};

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

const isTeammateWinning = (
  trick: Trick,
  playerId: number,
  players: Player[],
  trump: Suit | null,
): boolean => {
  if (trick.cards.length === 0) return false;
  const leadSuit = trick.cards[0].card.suit;
  const winnerId = determineTrickWinner({ ...trick }, trump, leadSuit);
  const winner = players.find(p => p.id === winnerId);
  const me = players.find(p => p.id === playerId);
  return !!winner && !!me && winner.team === me.team && winnerId !== playerId;
};

export const chooseAICard = (
  player: Player,
  currentTrick: Trick,
  trump: Suit | null,
  players: Player[],
): CardType => {
  // Filter out any invalid cards first
  const hand = player.hand.filter(c => c && c.suit && c.rank);
  
  // Safety: if no valid cards, return first available card
  if (hand.length === 0) {
    console.warn('AI has no valid cards in hand');
    return player.hand[0] || { suit: 'hearts', rank: 'A', id: 'fallback' };
  }
  
  const legal = hand.filter(c => canPlayCard(c, hand, currentTrick, trump));
  
  // If no legal moves, just play first card (shouldn't happen)
  if (legal.length === 0) {
    console.warn('AI has no legal cards, playing first card');
    return hand[0];
  }
  
  if (legal.length === 1) return legal[0];

  const teammate = isTeammateWinning(currentTrick, player.id, players, trump);

  if (teammate) {
    const sorted = legal.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump));
    return sorted[0] || legal[0];
  }

  if (currentTrick.cards.length === 0) {
    const nonTrump = legal.filter(c => c.suit !== trump);
    const pool = nonTrump.length > 0 ? nonTrump : legal;
    const sorted = pool.sort((a, b) => getCardStrength(a, trump) - getCardStrength(b, trump));
    return sorted[0] || legal[0];
  }

  const leadSuit = currentTrick.cards[0].card.suit;
  const bestPlay = currentTrick.cards.reduce((best, play) => {
    const b = best.card; const c = play.card;
    if (c.suit === trump && b.suit !== trump) return play;
    if (c.suit === trump && b.suit === trump)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    if (c.suit === leadSuit && b.suit === leadSuit)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    return best;
  }, currentTrick.cards[0]);

  const winning = legal.filter(c => {
    const b = bestPlay.card;
    if (c.suit === trump && b.suit !== trump) return true;
    if (c.suit === trump && b.suit === trump)
      return getCardStrength(c, trump) < getCardStrength(b, trump);
    if (c.suit === leadSuit && b.suit === leadSuit)
      return getCardStrength(c, trump) < getCardStrength(b, trump);
    return false;
  });

  if (winning.length > 0) {
    const sorted = winning.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump));
    return sorted[0] || legal[0];
  }
  
  const sorted = legal.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump));
  return sorted[0] || legal[0];
};

/**
 * AI bid evaluation: estimate how many points this hand can take with a given trump.
 * Returns a bid level (8-16) or 0 if it should pass.
 */
export const evaluateAIBid = (
  hand: CardType[],
  suit: Suit,
  currentBid: BidLevel,
): BidLevel | 0 => {
  const estimatedPoints = hand.reduce((total, card) => {
    let pts = 0;
    if (card.suit === suit) {
      // Trump cards are strong
      if (card.rank === 'J') pts = 20;
      else if (card.rank === '9') pts = 14;
      else if (card.rank === 'A') pts = 11;
      else if (card.rank === '10') pts = 10;
      else pts = 3;
    } else {
      if (card.rank === 'A') pts = 9;
      else if (card.rank === '10') pts = 7;
      else if (card.rank === 'K') pts = 3;
      else if (card.rank === 'Q') pts = 2;
    }
    return total + pts;
  }, 0);

  // Convert estimated card points to a bid level with some conservatism
  const estimatedBid = Math.floor(estimatedPoints / 10) as BidLevel;
  const minBid = (currentBid + 1) as BidLevel;
  if (estimatedBid >= minBid && estimatedBid <= 16) return estimatedBid;
  return 0;
};

/**
 * AI decides whether to bid and at what level/suit.
 * Tries all suits and picks the best.
 */
export const chooseAIBid = (
  player: Player,
  currentBid: BidLevel,
  passedPlayers: number[],
): { bid: BidLevel; suit: Suit } | null => {
  let bestBid: BidLevel | null = null;
  let bestSuit: Suit = 'hearts';

  for (const suit of SUITS) {
    const bid = evaluateAIBid(player.hand, suit, currentBid);
    if (bid !== 0 && (bestBid === null || bid > bestBid)) {
      bestBid = bid;
      bestSuit = suit;
    }
  }

  if (bestBid === null) return null; // pass
  return { bid: bestBid, suit: bestSuit };
};

// ---------------------------------------------------------------------------
// Initialize game
// ---------------------------------------------------------------------------

export const initializeBaazarGame = (targetScore: GameTarget = 101): BaazarGameState => {
  const rawPlayers: Player[] = [
    { id: 0, name: 'You',     hand: [], team: 1 },
    { id: 1, name: 'CPU 2',   hand: [], team: 2 },
    { id: 2, name: 'Partner', hand: [], team: 1 },
    { id: 3, name: 'CPU 4',   hand: [], team: 2 },
  ];

  const dealtPlayers = dealCards(rawPlayers);

  return {
    players: dealtPlayers,
    currentPlayer: 1, // player after dealer bids first
    dealer: 0,
    trump: null,
    phase: 'dealing',

    currentBid: 8 as BidLevel,
    bidderPlayer: null,
    bidderTeam: null,
    passedPlayers: [],
    contracted: false,
    recontracted: false,
    kapuyt: false,

    currentTrick: { cards: [], winner: null },
    completedTricks: [],
    lastTrickWinner: null,
    takerTeam: null,
    beloteTeam: null,

    scores: { team1: 0, team2: 0 },
    gameScore: { team1: 0, team2: 0 },
    targetScore,
    roundMessage: '',
  };
};

export const startNewRound = (prev: BaazarGameState): BaazarGameState => {
  const newDealer = (prev.dealer + 1) % 4;
  const rawPlayers: Player[] = prev.players.map(p => ({ ...p, hand: [] }));
  const dealtPlayers = dealCards(rawPlayers);

  return {
    ...prev,
    players: dealtPlayers,
    currentPlayer: (newDealer + 1) % 4,
    dealer: newDealer,
    trump: null,
    phase: 'dealing',
    currentBid: 8 as BidLevel,
    bidderPlayer: null,
    bidderTeam: null,
    passedPlayers: [],
    contracted: false,
    recontracted: false,
    kapuyt: false,
    currentTrick: { cards: [], winner: null },
    completedTricks: [],
    lastTrickWinner: null,
    takerTeam: null,
    beloteTeam: null,
    scores: { team1: 0, team2: 0 },
    roundMessage: '',
  };
};
