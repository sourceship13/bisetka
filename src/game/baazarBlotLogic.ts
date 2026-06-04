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

// Display order for a player's hand: group by suit, ascending rank within suit
const DISPLAY_SUIT_ORDER: Suit[] = ['clubs', 'diamonds', 'spades', 'hearts'];
const DISPLAY_RANK_ORDER: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const sortHandForDisplay = <T extends { suit: Suit; rank: Rank }>(
  hand: readonly T[],
): T[] => {
  return [...hand].sort((a, b) => {
    const suitDiff =
      DISPLAY_SUIT_ORDER.indexOf(a.suit) - DISPLAY_SUIT_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return (
      DISPLAY_RANK_ORDER.indexOf(a.rank as Rank) -
      DISPLAY_RANK_ORDER.indexOf(b.rank as Rank)
    );
  });
};

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

// ---------------------------------------------------------------------------
// Card-counting context. Built from completed + current tricks so the AI
// knows which cards are still live and which opponents are known void in
// which suits (via the forced-follow / forced-trump rules).
// ---------------------------------------------------------------------------

export interface BaazarAIContext {
  playedCards: CardType[];
  knownVoids: Record<number, Set<Suit>>;
}

export const buildAIContext = (state: BaazarGameState): BaazarAIContext => {
  const playedCards: CardType[] = [];
  const knownVoids: Record<number, Set<Suit>> = {
    0: new Set(), 1: new Set(), 2: new Set(), 3: new Set(),
  };
  const allTricks: Trick[] = [...state.completedTricks];
  if (state.currentTrick?.cards?.length) allTricks.push(state.currentTrick);

  for (const trick of allTricks) {
    if (!trick.cards.length) continue;
    const leadSuit = trick.cards[0].card.suit;
    for (const cp of trick.cards) {
      if (!cp?.card) continue;
      playedCards.push(cp.card);
      if (cp.card.suit !== leadSuit) {
        knownVoids[cp.playerId]?.add(leadSuit);
        // Didn't follow non-trump and didn't trump → also void in trump.
        if (state.trump && leadSuit !== state.trump && cp.card.suit !== state.trump) {
          knownVoids[cp.playerId]?.add(state.trump);
        }
      }
    }
  }
  return { playedCards, knownVoids };
};

const isMasterCard = (
  card: CardType,
  played: CardType[],
  myHand: CardType[],
  trump: Suit | null,
): boolean => {
  const order = card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER;
  const idx = order.indexOf(card.rank as Rank);
  if (idx < 0) return false;
  const seen = new Set<string>();
  played.forEach(c => seen.add(`${c.suit}-${c.rank}`));
  myHand.forEach(c => seen.add(`${c.suit}-${c.rank}`));
  for (let i = 0; i < idx; i++) {
    if (!seen.has(`${card.suit}-${order[i]}`)) return false;
  }
  return true;
};

const remainingOpponentTrumps = (
  trump: Suit | null,
  played: CardType[],
  myHand: CardType[],
  partnerHand: CardType[] | null,
): number => {
  if (!trump) return 0;
  const seen = new Set<string>();
  played.forEach(c => { if (c.suit === trump) seen.add(c.rank); });
  myHand.forEach(c => { if (c.suit === trump) seen.add(c.rank); });
  (partnerHand ?? []).forEach(c => { if (c.suit === trump) seen.add(c.rank); });
  let count = 0;
  RANKS.forEach(r => { if (!seen.has(r)) count++; });
  return count;
};

const opponentsCouldBeat = (
  winningCard: CardType,
  remainingOpps: Player[],
  trump: Suit | null,
  leadSuit: Suit,
  ctx: BaazarAIContext,
  myHand: CardType[],
  partnerHand: CardType[] | null,
): boolean => {
  const taken = new Set<string>();
  myHand.forEach(c => taken.add(`${c.suit}-${c.rank}`));
  (partnerHand ?? []).forEach(c => taken.add(`${c.suit}-${c.rank}`));
  ctx.playedCards.forEach(c => taken.add(`${c.suit}-${c.rank}`));

  const winIsTrump = winningCard.suit === trump;
  const winStrength = getCardStrength(winningCard, trump);

  for (const opp of remainingOpps) {
    const voids = ctx.knownVoids[opp.id] ?? new Set<Suit>();
    for (const suit of SUITS) {
      if (voids.has(suit)) continue;
      const order = suit === trump ? TRUMP_ORDER : PLAIN_ORDER;
      for (const rank of order) {
        if (taken.has(`${suit}-${rank}`)) continue;
        const cIsTrump = suit === trump;

        if (cIsTrump && !winIsTrump) {
          if (leadSuit === trump) {
            if (getCardStrength({ suit, rank, id: '' } as CardType, trump) < winStrength) {
              return true;
            }
          } else if (voids.has(leadSuit)) {
            return true;
          }
          continue;
        }
        if (cIsTrump && winIsTrump) {
          if (getCardStrength({ suit, rank, id: '' } as CardType, trump) < winStrength) return true;
          continue;
        }
        if (!cIsTrump && !winIsTrump) {
          if (suit !== leadSuit) continue;
          if (getCardStrength({ suit, rank, id: '' } as CardType, trump) < winStrength) return true;
        }
      }
    }
  }
  return false;
};

const trickPointValue = (trick: Trick, trump: Suit | null): number =>
  trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);

// ---------------------------------------------------------------------------
// chooseAICard — strong heuristic AI:
//   • Card counting & known-void inference.
//   • Throws A/10/K on partner's win when win is provably safe.
//   • Leads master cards; as bidder, pulls trumps when long; avoids leading
//     into suits where opponents are void and still hold trumps.
//   • Refuses to win small tricks the next opponent will just over-trump.
// ---------------------------------------------------------------------------

export const chooseAICard = (
  player: Player,
  currentTrick: Trick,
  trump: Suit | null,
  players: Player[],
  state?: BaazarGameState,
  bidderTeam?: 1 | 2 | null,
): CardType => {
  const hand = player.hand.filter(c => c && c.suit && c.rank);
  if (hand.length === 0) {
    console.warn('AI has no valid cards in hand');
    return player.hand[0] || { suit: 'hearts', rank: 'A', id: 'fallback' };
  }

  const legal = hand.filter(c => canPlayCard(c, hand, currentTrick, trump));
  if (legal.length === 0) {
    console.warn('AI has no legal cards, playing first card');
    return hand[0];
  }
  if (legal.length === 1) return legal[0];

  const ctx: BaazarAIContext = state
    ? buildAIContext(state)
    : {
        playedCards: currentTrick.cards.map(cp => cp.card).filter(Boolean) as CardType[],
        knownVoids: { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() },
      };

  const partner = players.find(p => p.team === player.team && p.id !== player.id);
  const partnerHand = partner?.hand?.filter(c => c && c.suit && c.rank) ?? null;
  const opponents = players.filter(p => p.team !== player.team);

  const cheapestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump))[0];
  const richestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardPoints(b, trump) - getCardPoints(a, trump))[0];
  const strongestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardStrength(a, trump) - getCardStrength(b, trump))[0];

  // -----------------------------------------------------------------------
  // LEADING
  // -----------------------------------------------------------------------
  if (currentTrick.cards.length === 0) {
    const myTrumps = legal.filter(c => c.suit === trump);
    const nonTrumps = legal.filter(c => c.suit !== trump);
    const oppTrumpsLeft = remainingOpponentTrumps(trump, ctx.playedCards, hand, partnerHand);

    // 1) Master non-trump cards — cash them in.
    const masters = nonTrumps.filter(c => isMasterCard(c, ctx.playedCards, hand, trump));
    const safeMasters = masters.filter(c =>
      oppTrumpsLeft === 0 || !opponents.some(o => ctx.knownVoids[o.id]?.has(c.suit)),
    );
    if (safeMasters.length > 0) return richestOf(safeMasters);

    // 2) Bidder team with long trumps → pull opposing trumps.
    const iAmBidder = bidderTeam !== undefined && bidderTeam === player.team;
    if (iAmBidder && myTrumps.length >= 4 && oppTrumpsLeft > 0) {
      return strongestOf(myTrumps);
    }

    // 3) Lead low card of longest non-trump suit (penalise suits opponents
    //    are known void in while they still have trumps).
    if (nonTrumps.length > 0) {
      const bySuit = new Map<Suit, CardType[]>();
      nonTrumps.forEach(c => {
        if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
        bySuit.get(c.suit)!.push(c);
      });
      let bestSuit: Suit | null = null;
      let bestAdj = -Infinity;
      bySuit.forEach((cards, s) => {
        const oppVoid = opponents.some(o => ctx.knownVoids[o.id]?.has(s));
        const adj = cards.length - (oppVoid && oppTrumpsLeft > 0 ? 3 : 0);
        if (adj > bestAdj) { bestAdj = adj; bestSuit = s; }
      });
      if (bestSuit) {
        const pool = bySuit.get(bestSuit)!;
        return cheapestOf(pool);
      }
    }

    // 4) Only trumps left — lead lowest.
    return cheapestOf(legal);
  }

  // -----------------------------------------------------------------------
  // FOLLOWING
  // -----------------------------------------------------------------------
  const leadSuit = currentTrick.cards[0].card.suit;
  const winningPlay = currentTrick.cards.reduce((best, play) => {
    const b = best.card; const c = play.card;
    if (c.suit === trump && b.suit !== trump) return play;
    if (c.suit === trump && b.suit === trump)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    if (c.suit === leadSuit && b.suit === leadSuit)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    return best;
  }, currentTrick.cards[0]);

  const winnerPlayer = players.find(p => p.id === winningPlay.playerId);
  const partnerWinning = !!winnerPlayer && winnerPlayer.team === player.team
                                         && winnerPlayer.id !== player.id;

  const playedIds = new Set(currentTrick.cards.map(c => c.playerId));
  playedIds.add(player.id);
  const remainingOpps = players.filter(p => p.team !== player.team && !playedIds.has(p.id));

  // Partner winning → throw points if safe, else shed low.
  if (partnerWinning) {
    const partnerSafe = !opponentsCouldBeat(
      winningPlay.card, remainingOpps, trump, leadSuit, ctx, hand, partnerHand,
    );
    if (partnerSafe) return richestOf(legal);
    return cheapestOf(legal);
  }

  // Opponent winning → look for cheapest winner that survives.
  const winners = legal.filter(c => {
    const b = winningPlay.card;
    if (c.suit === trump && b.suit !== trump) return true;
    if (c.suit === trump && b.suit === trump)
      return getCardStrength(c, trump) < getCardStrength(b, trump);
    if (c.suit === leadSuit && b.suit === leadSuit)
      return getCardStrength(c, trump) < getCardStrength(b, trump);
    return false;
  });

  if (winners.length > 0) {
    const candidate = cheapestOf(winners);
    const trickPts = trickPointValue(currentTrick, trump) + getCardPoints(candidate, trump);
    const ourWinSafe = !opponentsCouldBeat(
      candidate, remainingOpps, trump, leadSuit, ctx, hand, partnerHand,
    );
    if (ourWinSafe) return candidate;
    // Risky win — only commit if trick is already worth grabbing.
    if (trickPts >= 14) return candidate;
    return cheapestOf(legal);
  }

  // Can't win — shed non-trump first to preserve trumps.
  const sheds = legal.filter(c => c.suit !== trump);
  return cheapestOf(sheds.length > 0 ? sheds : legal);
};

// ---------------------------------------------------------------------------
// Bidding AI — far more accurate hand evaluation. Scores:
//   • Real trump card points (J=20, 9=14, A=11, 10=10, K=4, Q=3)
//   • Trump length bonus (each trump beyond 3 = +10 extra trick equity)
//   • Trump quality (J+9 combo, J+9+A combo)
//   • Side aces (each ≈ 11 pts captured)
//   • Side 10s with K-support or short suit (likely captured)
//   • Sequences in the hand (20 / 50 / 100)
//   • Belote K+Q of trump (+20)
//   • Voids/singletons in non-trump (ruffing potential)
// Returns expected total raw points for the round under that trump.
// ---------------------------------------------------------------------------

const findHandSequenceBonus = (hand: CardType[]): number => {
  const seqs = findSequences(hand, 1);
  return seqs.reduce((s, q) => s + q.points, 0);
};

export const estimateHandPoints = (hand: CardType[], trump: Suit): number => {
  let trumpCount = 0;
  let trumpRawPts = 0;
  let hasJ = false, has9 = false, hasA = false, hasK = false, hasQ = false;

  for (const c of hand) {
    if (c.suit === trump) {
      trumpCount++;
      trumpRawPts += getCardPoints(c, trump);
      if (c.rank === 'J') hasJ = true;
      if (c.rank === '9') has9 = true;
      if (c.rank === 'A') hasA = true;
      if (c.rank === 'K') hasK = true;
      if (c.rank === 'Q') hasQ = true;
    }
  }

  let est = trumpRawPts;

  // Length / quality bonuses for trumps (each extra trump = ~9 pts of ruffs).
  if (trumpCount >= 4) est += (trumpCount - 3) * 9;
  if (hasJ && has9) est += 8;          // dominant trump pair
  if (hasJ && has9 && hasA) est += 6;  // crushing top three
  if (hasK && hasQ) est += 20;         // Belote bonus

  // Side suits: aces, 10s, voids/singletons.
  const sideSuits: Suit[] = SUITS.filter(s => s !== trump);
  let voidCount = 0;
  let singletonCount = 0;

  for (const s of sideSuits) {
    const cards = hand.filter(c => c.suit === s);
    if (cards.length === 0) { voidCount++; continue; }
    if (cards.length === 1) singletonCount++;
    const hasAceS = cards.some(c => c.rank === 'A');
    const has10S = cards.some(c => c.rank === '10');
    const hasKS  = cards.some(c => c.rank === 'K');

    if (hasAceS) est += 13;                            // ace + likely follow points
    if (has10S && (hasKS || hasAceS || cards.length <= 2)) est += 9;
    if (hasKS && cards.length <= 3 && hasAceS) est += 3;
  }

  // Ruff potential — only useful if we have trumps to ruff with.
  if (trumpCount >= 3) {
    est += voidCount * 10;
    est += singletonCount * 5;
  }

  // Sequences in hand are worth their full bonus value (provided we win them
  // — bidder team usually does because they control trumps).
  est += findHandSequenceBonus(hand);

  // Floor when trump is too short — risky bid.
  if (trumpCount <= 2) est = Math.max(0, est - 25);
  if (trumpCount === 0) est = Math.max(0, est - 60);

  return est;
};

// Backwards-compatible export, now using the stronger model.
export const evaluateAIBid = (
  hand: CardType[],
  suit: Suit,
  currentBid: BidLevel,
): BidLevel | 0 => {
  const est = estimateHandPoints(hand, suit);
  // Aggressive conversion: a hand worth ~95 raw should bid 10 (target 100),
  // accepting it must squeeze the last 5 from play. Round to nearest 10
  // instead of floor.
  let level = Math.round(est / 10);
  if (level < 8) return 0;
  if (level > 16) level = 16;
  const min = (currentBid + 1) as BidLevel;
  if (level < min) return 0;
  return level as BidLevel;
};

export const chooseAIBid = (
  player: Player,
  currentBid: BidLevel,
  passedPlayers: number[],
  opts?: { bidderTeam?: 1 | 2 | null; bidderPlayer?: number | null },
): { bid: BidLevel; suit: Suit } | null => {
  // Pick the trump suit with the highest expected score.
  let bestSuit: Suit = 'hearts';
  let bestEst = -Infinity;
  for (const suit of SUITS) {
    const est = estimateHandPoints(player.hand, suit);
    if (est > bestEst) { bestEst = est; bestSuit = suit; }
  }

  const min = (currentBid + 1) as BidLevel;
  const target = min * 10;
  const isCounter =
    !!opts?.bidderTeam && opts.bidderTeam !== player.team;

  // Strong: estimate ≥ target → bid at our estimate level.
  if (bestEst >= target) {
    let level = Math.round(bestEst / 10);
    if (level > 16) level = 16;
    if (level < min) level = min;
    return { bid: level as BidLevel, suit: bestSuit };
  }

  // Counter-bid: if the opposing team currently holds the contract, push
  // harder so the AI actively contests instead of passing.
  if (isCounter) {
    if (bestEst >= target - 12 && min <= 12) {
      return { bid: min, suit: bestSuit };
    }
    if (bestEst >= target - 18 && min <= 11) {
      return { bid: min, suit: bestSuit };
    }
    // Last-ditch sabotage when we still have meaningful trump shape.
    if (bestEst >= 60 && min <= 10) {
      return { bid: min, suit: bestSuit };
    }
  }

  // Pushy open: estimate within 5 of target → still take the contract.
  if (bestEst >= target - 5 && min <= 11) {
    return { bid: min, suit: bestSuit };
  }

  // Competitive open: nobody has bid yet and we have a workable hand.
  if (currentBid === 8 && bestEst >= 60) {
    return { bid: 8 as BidLevel, suit: bestSuit };
  }

  return null;
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
