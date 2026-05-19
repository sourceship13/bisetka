import { CardType, Suit, Rank } from '../components/Card';

export interface Player {
  id: number;
  name: string;
  hand: CardType[];
  team: 1 | 2;
}

export interface Trick {
  cards: { playerId: number; card: CardType }[];
  winner: number | null;
}

export interface GameState {
  players: Player[];
  currentPlayer: number;
  trump: Suit | null;
  /** Face-up card whose suit is proposed as trump during bidding */
  proposalCard: CardType | null;
  /** Team that accepted/declared trump — must score ≥82 raw points */
  takerTeam: 1 | 2 | null;
  /** 1 = accept proposed suit or pass; 2 = declare any suit or redeal */
  bidRound: 1 | 2;
  /** Players who have passed in the current bid round */
  bidPassCount: number;
  currentTrick: Trick;
  completedTricks: Trick[];
  scores: { team1: number; team2: number };
  gameScore: { team1: number; team2: number };
  phase: 'bidding' | 'playing' | 'roundEnd' | 'gameEnd';
  dealer: number;
  lastTrickWinner: number | null;
  /** Team that holds K+Q of trump (Belote) — earns +20 bonus */
  beloteTeam: 1 | 2 | null;
  roundMessage?: string;
}

// ---------------------------------------------------------------------------
// Deck — 24 cards, 9 through Ace (Armenian Classic Blot)
// ---------------------------------------------------------------------------

// Card point values
export const getCardPoints = (card: CardType, trump: Suit | null): number => {
  if (card.suit === trump) {
    switch (card.rank) {
      case 'J': return 20;
      case '9': return 14;
      case 'A': return 11;
      case '10': return 10;
      case 'K': return 4;
      case 'Q': return 3;
      default: return 0;
    }
  } else {
    switch (card.rank) {
      case 'A': return 11;
      case '10': return 10;
      case 'K': return 4;
      case 'Q': return 3;
      case 'J': return 2;
      default: return 0;
    }
  }
};

// Trump: J(0) > 9(1) > A(2) > 10(3) > K(4) > Q(5)   — lower index = stronger
// Normal: A(0) > 10(1) > K(2) > Q(3) > J(4) > 9(5)
const TRUMP_RANKING: Rank[]  = ['J', '9', 'A', '10', 'K', 'Q'];
const NORMAL_RANKING: Rank[] = ['A', '10', 'K', 'Q', 'J', '9'];

export const getCardStrength = (card: CardType, trump: Suit | null): number => {
  const ranking = card.suit === trump ? TRUMP_RANKING : NORMAL_RANKING;
  const idx = ranking.indexOf(card.rank as Rank);
  return idx === -1 ? 999 : idx;
};

// Legacy alias
export const getCardRank = getCardStrength;

// ---------------------------------------------------------------------------
// Hand display sort
// ---------------------------------------------------------------------------
// Order cards in a player's hand from smallest → greatest within each suit so
// the hand reads naturally left-to-right. Suits are grouped together. We use
// the standard non-trump rank order (9 < 10 < J < Q < K < A) because the
// trump suit is a per-round concept and players want a stable visual order.
const DISPLAY_SUIT_ORDER: Suit[] = ['clubs', 'diamonds', 'spades', 'hearts'];
const DISPLAY_RANK_ORDER: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

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

// Create and shuffle the 24-card Armenian Blot deck (9–Ace only)
export const createDeck = (): CardType[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: { rank: Rank; value: number; trumpValue: number }[] = [
    { rank: '9',  value: 0,  trumpValue: 14 },
    { rank: '10', value: 10, trumpValue: 10 },
    { rank: 'J',  value: 2,  trumpValue: 20 },
    { rank: 'Q',  value: 3,  trumpValue: 3  },
    { rank: 'K',  value: 4,  trumpValue: 4  },
    { rank: 'A',  value: 11, trumpValue: 11 },
  ];
  const deck: CardType[] = [];

  suits.forEach(suit => {
    ranks.forEach(({ rank, value, trumpValue }) => {
      deck.push({ suit, rank, id: `${suit}-${rank}`, value, trumpValue });
    });
  });

  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: CardType[]): CardType[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Deal 6 cards each from a 24-card deck. First card is the "proposal" suit hint.
export const dealCards = (
  players: Player[],
): { players: Player[]; proposalCard: CardType } => {
  const deck = createDeck();
  const dealtPlayers = players.map((player, i) => ({
    ...player,
    hand: deck.slice(i * 6, (i + 1) * 6),
  }));
  return { players: dealtPlayers, proposalCard: deck[0] };
};

// Determine trick winner
export const determineTrickWinner = (
  trick: Trick,
  trump: Suit | null,
  leadSuit: Suit,
): number => {
  let best = trick.cards[0];

  trick.cards.slice(1).forEach(play => {
    const b = best.card;
    const c = play.card;
    const bT = b.suit === trump;
    const cT = c.suit === trump;

    if (cT && !bT) {
      best = play; // trump beats non-trump
    } else if (cT && bT) {
      if (getCardStrength(c, trump) < getCardStrength(b, trump)) best = play;
    } else if (!bT && c.suit === leadSuit && b.suit !== leadSuit) {
      best = play; // lead-suit beats off-suit non-trump
    } else if (c.suit === leadSuit && b.suit === leadSuit) {
      if (getCardStrength(c, trump) < getCardStrength(b, trump)) best = play;
    }
  });

  return best.playerId;
};

// Validate a card play against all Armenian Blot following rules
export const canPlayCard = (
  card: CardType,
  hand: CardType[],
  currentTrick: Trick,
  trump: Suit | null,
): boolean => {
  if (currentTrick.cards.length === 0) return true; // leading — anything legal

  const leadSuit = currentTrick.cards[0].card.suit;
  const trumpIsLed = leadSuit === trump;
  const hasSuit = hand.some(c => c.suit === leadSuit);

  if (hasSuit) {
    if (!trumpIsLed) return card.suit === leadSuit; // simple follow-suit

    // Trump was led: must follow trump AND must over-trump if you can
    const suits = currentTrick.cards
      .filter(p => p.card.suit === trump)
      .map(p => getCardStrength(p.card, trump));
    const currentBest = suits.length > 0 ? Math.min(...suits) : 999;
    const canBeat = hand.some(
      c => c.suit === trump && getCardStrength(c, trump) < currentBest,
    );
    if (canBeat) {
      return card.suit === trump && getCardStrength(card, trump) < currentBest;
    }
    return card.suit === trump; // can't beat but must still play trump
  }

  // No lead suit — must trump if possible
  const hasTrump = hand.some(c => c.suit === trump);
  if (hasTrump) return card.suit === trump;

  return true; // no lead suit and no trump — free choice
};

// Belote: team holding K+Q of trump earns +20
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

export interface RoundResult {
  team1: number;
  team2: number;
  takerFell: boolean;   // taker scored <82 raw pts
  capot: boolean;       // one team won all tricks → 250 pts
  beloteBonus: 0 | 20;
}

// Running score for the current round (no fall/capot — mid-round tally).
// Call after each completed trick to update the live scoreboard.
export const calculateRunningScore = (
  tricks: Trick[],
  players: Player[],
  trump: Suit | null,
): { team1: number; team2: number } => {
  let team1 = 0;
  let team2 = 0;
  tricks.forEach((trick, idx) => {
    const winner = players.find(p => p.id === trick.winner);
    if (!winner) return;
    let pts = trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);
    // Include last-trick bonus when we're showing all completed tricks
    if (idx === tricks.length - 1 && players.every(p => p.hand.length === 0)) pts += 10;
    if (winner.team === 1) team1 += pts;
    else team2 += pts;
  });
  return { team1, team2 };
};

// Full Armenian Blot scoring:
//   • Taker must score ≥82 raw card pts; if they fall: taker=0, opponent=162.
//   • Last trick = +10 ("der").
//   • Capot (all tricks) = 250 flat for winning team.
//   • Belote = +20 to declaring team (applied after fall/capot).
export const calculateRoundScore = (
  tricks: Trick[],
  players: Player[],
  trump: Suit | null,
  takerTeam: 1 | 2 | null,
  beloteTeam: 1 | 2 | null,
): RoundResult => {
  let team1 = 0;
  let team2 = 0;

  tricks.forEach((trick, idx) => {
    const winner = players.find(p => p.id === trick.winner);
    if (!winner) return;
    let pts = trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);
    if (idx === tricks.length - 1) pts += 10; // last trick (+10)
    if (winner.team === 1) team1 += pts; else team2 += pts;
  });

  // Capot check
  const t1Wins = tricks.filter(
    t => players.find(p => p.id === t.winner)?.team === 1,
  ).length;
  const capot = t1Wins === tricks.length || t1Wins === 0;
  if (capot) {
    team1 = t1Wins === tricks.length ? 250 : 0;
    team2 = t1Wins === 0 ? 250 : 0;
  }

  const beloteBonus: 0 | 20 = beloteTeam ? 20 : 0;

  // Taker-fall check (uses raw card points, not including last-trick bonus)
  let takerFell = false;
  if (takerTeam && !capot) {
    let raw1 = 0; let raw2 = 0;
    tricks.forEach(trick => {
      const winner = players.find(p => p.id === trick.winner);
      if (!winner) return;
      const pts = trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);
      if (winner.team === 1) raw1 += pts; else raw2 += pts;
    });
    if ((takerTeam === 1 ? raw1 : raw2) < 82) {
      takerFell = true;
      team1 = takerTeam === 1 ? 0 : 162;
      team2 = takerTeam === 2 ? 0 : 162;
    }
  }

  // Belote bonus applied last (declarer gets it even when they fell)
  if (beloteTeam === 1) team1 += beloteBonus;
  if (beloteTeam === 2) team2 += beloteBonus;

  return { team1, team2, takerFell, capot, beloteBonus };
};

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

export const isTeammateWinning = (
  currentTrick: Trick,
  playerId: number,
  players: Player[],
  trump: Suit | null,
): boolean => {
  if (currentTrick.cards.length === 0) return false;
  const leadSuit = currentTrick.cards[0].card.suit;
  const winnerId = determineTrickWinner({ ...currentTrick }, trump, leadSuit);
  const winner = players.find(p => p.id === winnerId);
  const me = players.find(p => p.id === playerId);
  return !!winner && !!me && winner.team === me.team && winnerId !== playerId;
};

// ---------------------------------------------------------------------------
// Card counting / inference context. Built from completed + current tricks.
// The AI uses this to know what cards are still in play and which opponents
// are void in which suits, dramatically improving its decision quality.
// ---------------------------------------------------------------------------

const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export interface AIContext {
  playedCards: CardType[];
  knownVoids: Record<number, Set<Suit>>;
}

export const buildAIContext = (state: GameState): AIContext => {
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
      playedCards.push(cp.card);
      if (cp.card.suit !== leadSuit) {
        knownVoids[cp.playerId]?.add(leadSuit);
        // When a non-trump suit was led and a player neither followed nor
        // trumped, they must be void in trump too (forced trump rule).
        if (state.trump && leadSuit !== state.trump && cp.card.suit !== state.trump) {
          knownVoids[cp.playerId]?.add(state.trump);
        }
      }
    }
  }
  return { playedCards, knownVoids };
};

// Highest unplayed card of suit (master). Returns true if no higher-ranked
// card of the same suit exists outside our hand + already played.
const isMasterCard = (
  card: CardType,
  played: CardType[],
  myHand: CardType[],
  trump: Suit | null,
): boolean => {
  const ranking = card.suit === trump ? TRUMP_RANKING : NORMAL_RANKING;
  const idx = ranking.indexOf(card.rank as Rank);
  if (idx < 0) return false;
  const known = new Set<string>();
  played.forEach(c => known.add(`${c.suit}-${c.rank}`));
  myHand.forEach(c => known.add(`${c.suit}-${c.rank}`));
  for (let i = 0; i < idx; i++) {
    if (!known.has(`${card.suit}-${ranking[i]}`)) return false;
  }
  return true;
};

// Count remaining unplayed trumps held by opponents (not me, not played).
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
  DISPLAY_RANK_ORDER.forEach(r => { if (!seen.has(r)) count++; });
  return count;
};

// Could any opponent still to play in this trick beat `winningCard`?
// We don't see their hands but we use played cards + voids to be conservative.
const opponentsCouldBeat = (
  winningCard: CardType,
  remainingOpponents: Player[],
  trump: Suit | null,
  leadSuit: Suit,
  ctx: AIContext,
  myHand: CardType[],
  partnerHand: CardType[] | null,
): boolean => {
  // Enumerate every card not in my hand, not in partner's hand (if known),
  // and not yet played — that is the pool the opponents might still hold.
  const taken = new Set<string>();
  myHand.forEach(c => taken.add(`${c.suit}-${c.rank}`));
  (partnerHand ?? []).forEach(c => taken.add(`${c.suit}-${c.rank}`));
  ctx.playedCards.forEach(c => taken.add(`${c.suit}-${c.rank}`));

  const winIsTrump = winningCard.suit === trump;

  for (const opp of remainingOpponents) {
    const voids = ctx.knownVoids[opp.id] ?? new Set<Suit>();

    for (const suit of ALL_SUITS) {
      if (voids.has(suit)) continue;
      const ranking = suit === trump ? TRUMP_RANKING : NORMAL_RANKING;
      for (const rank of ranking) {
        if (taken.has(`${suit}-${rank}`)) continue;
        const cIsTrump = suit === trump;

        // Trump beats non-trump only if opponent is void in lead-suit
        // (otherwise they'd be forced to follow suit, not trump).
        if (cIsTrump && !winIsTrump) {
          if (leadSuit === trump) {
            // Trump led: they will follow trump if they have any. Any higher
            // trump beats. They're "void in trump" check already excluded above.
            if (getCardStrength({ suit, rank } as CardType, trump) <
                getCardStrength(winningCard, trump)) {
              return true;
            }
          } else {
            // Non-trump led: they can only trump if void in leadSuit.
            if (voids.has(leadSuit)) return true;
          }
          continue;
        }
        if (cIsTrump && winIsTrump) {
          if (getCardStrength({ suit, rank } as CardType, trump) <
              getCardStrength(winningCard, trump)) return true;
          continue;
        }
        if (!cIsTrump && !winIsTrump) {
          if (suit !== leadSuit) continue;       // can't beat off-suit
          if (getCardStrength({ suit, rank } as CardType, trump) <
              getCardStrength(winningCard, trump)) return true;
        }
      }
    }
  }
  return false;
};

// Total raw card points already in the trick (a "fat" trick is worth fighting for).
const trickPointValue = (trick: Trick, trump: Suit | null): number =>
  trick.cards.reduce((s, cp) => s + getCardPoints(cp.card, trump), 0);

// Rough hand strength when `suit` is trump. Used for bidding decisions.
export const evaluateHandForTrump = (hand: CardType[], suit: Suit): number => {
  let score = 0;
  let trumpCount = 0;
  let hasJTrump = false, has9Trump = false;
  let kTrump = false, qTrump = false;

  for (const c of hand) {
    if (c.suit === suit) {
      trumpCount++;
      if (c.rank === 'J') { score += 22; hasJTrump = true; }
      else if (c.rank === '9') { score += 16; has9Trump = true; }
      else if (c.rank === 'A') score += 12;
      else if (c.rank === '10') score += 10;
      else if (c.rank === 'K') { score += 5; kTrump = true; }
      else if (c.rank === 'Q') { score += 4; qTrump = true; }
    } else {
      if (c.rank === 'A') score += 9;
      else if (c.rank === '10') score += 4;
      else if (c.rank === 'K') score += 2;
    }
  }
  // Bonuses
  if (trumpCount >= 4) score += 8;
  if (trumpCount >= 5) score += 8;
  if (hasJTrump && has9Trump) score += 6;
  if (kTrump && qTrump) score += 12; // belote (+20 actual, but only counts if held all round)
  if (trumpCount <= 1) score -= 15;  // too short — likely to fall
  return score;
};

// Pick the best suit to declare and an accept/pass recommendation.
// Used by both round 1 (suit forced to proposalSuit) and round 2 (any suit).
export const chooseAIBid = (
  hand: CardType[],
  proposalSuit: Suit | null,
  round: 1 | 2,
): { action: 'accept' | 'pass'; suit?: Suit } => {
  if (round === 1 && proposalSuit) {
    const s = evaluateHandForTrump(hand, proposalSuit);
    // Round 1 accept threshold — bidding the proposed suit means partner
    // hasn't volunteered, so we need a real hand.
    return s >= 48 ? { action: 'accept', suit: proposalSuit } : { action: 'pass' };
  }
  // Round 2: any suit allowed. Pick best.
  let bestSuit: Suit | null = null;
  let bestScore = -Infinity;
  for (const s of ALL_SUITS) {
    if (proposalSuit && s === proposalSuit) continue; // proposed suit was already refused
    const sc = evaluateHandForTrump(hand, s);
    if (sc > bestScore) { bestScore = sc; bestSuit = s; }
  }
  // Round 2 declare threshold — slightly lower because passing forces re-deal.
  if (bestSuit && bestScore >= 42) return { action: 'accept', suit: bestSuit };
  return { action: 'pass' };
};

// ---------------------------------------------------------------------------
// chooseAICard — the brain. Far stronger than a "shed lowest" heuristic:
//   • Knows which cards have been played and which opponents are void in
//     which suits.
//   • Throws points on partner's win only when the win is provably safe.
//   • Leads master cards, draws trumps as taker, avoids leading into voids.
//   • Refuses to win a fat trick when the next opponent can over-trump.
// ---------------------------------------------------------------------------

export const chooseAICard = (
  player: Player,
  currentTrick: Trick,
  trump: Suit | null,
  players: Player[],
  state?: GameState,
  takerTeam?: 1 | 2 | null,
): CardType => {
  const hand = player.hand;
  const legal = hand.filter(c => canPlayCard(c, hand, currentTrick, trump));
  if (legal.length === 1) return legal[0];

  // Build context from observed play.
  const ctx: AIContext = state
    ? buildAIContext(state)
    : {
        playedCards: currentTrick.cards.map(cp => cp.card),
        knownVoids: { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set() },
      };

  // Identify partner (same team, different id).
  const partner = players.find(p => p.team === player.team && p.id !== player.id);

  // We never get to see opponent hands but if we're an AI in single-player
  // mode the partner's hand is in `players` and counts as known to us — most
  // partnership trick games assume implicit signaling anyway.
  const partnerHand = partner?.hand ?? null;

  const cheapestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump))[0];
  const richestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardPoints(b, trump) - getCardPoints(a, trump))[0];
  const strongestOf = (cards: CardType[]): CardType =>
    [...cards].sort((a, b) => getCardStrength(a, trump) - getCardStrength(b, trump))[0];

  // -----------------------------------------------------------------------
  // LEADING the trick.
  // -----------------------------------------------------------------------
  if (currentTrick.cards.length === 0) {
    const myTrumps = legal.filter(c => c.suit === trump);
    const nonTrumps = legal.filter(c => c.suit !== trump);

    // 1) If we have a master non-trump card AND opponents could still be
    //    forced to follow (i.e. both opponents not known-void), lead it for
    //    a guaranteed win + points.
    const opponents = players.filter(p => p.team !== player.team);
    const masters = nonTrumps.filter(c => isMasterCard(c, ctx.playedCards, hand, trump));
    const safeMasters = masters.filter(c => {
      // Avoid leading a suit where any opponent is void AND has trumps left.
      const remTrumps = remainingOpponentTrumps(trump, ctx.playedCards, hand, partnerHand);
      if (remTrumps === 0) return true;
      return !opponents.some(o => ctx.knownVoids[o.id]?.has(c.suit));
    });
    if (safeMasters.length > 0) {
      // Prefer the highest-value master (cash in A/10 first).
      return richestOf(safeMasters);
    }

    // 2) Taker team with long trumps → draw opponent trumps with our biggest.
    const iAmTaker = takerTeam !== undefined && takerTeam === player.team;
    const oppTrumpsLeft = remainingOpponentTrumps(trump, ctx.playedCards, hand, partnerHand);
    if (iAmTaker && myTrumps.length >= 3 && oppTrumpsLeft > 0) {
      return strongestOf(myTrumps); // pull opposing trumps
    }

    // 3) Avoid leading trumps if we don't have to. Pick our longest non-trump
    //    suit and lead its low card (preserves high cards as later winners).
    if (nonTrumps.length > 0) {
      const bySuitCount = new Map<Suit, CardType[]>();
      nonTrumps.forEach(c => {
        if (!bySuitCount.has(c.suit)) bySuitCount.set(c.suit, []);
        bySuitCount.get(c.suit)!.push(c);
      });
      let bestSuit: Suit | null = null;
      let bestLen = -1;
      bySuitCount.forEach((cards, s) => {
        // Penalise suits where an opponent is known void & has trumps.
        const oppVoid = opponents.some(o => ctx.knownVoids[o.id]?.has(s));
        const adj = cards.length - (oppVoid && oppTrumpsLeft > 0 ? 2 : 0);
        if (adj > bestLen) { bestLen = adj; bestSuit = s; }
      });
      if (bestSuit) {
        const pool = bySuitCount.get(bestSuit)!;
        return cheapestOf(pool); // small card of long suit
      }
    }

    // 4) Only trumps left — lead lowest.
    return cheapestOf(legal);
  }

  // -----------------------------------------------------------------------
  // FOLLOWING — first determine the play currently winning the trick.
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

  // Remaining opponents who will play AFTER us this trick.
  const playedIds = new Set(currentTrick.cards.map(c => c.playerId));
  playedIds.add(player.id);
  const remainingOpps = players.filter(p => p.team !== player.team && !playedIds.has(p.id));

  // -----------------------------------------------------------------------
  // PARTNER is winning.
  // -----------------------------------------------------------------------
  if (partnerWinning) {
    const partnerSafe = !opponentsCouldBeat(
      winningPlay.card, remainingOpps, trump, leadSuit, ctx, hand, partnerHand,
    );
    if (partnerSafe) {
      // Dump A/10/K for points — but only the most expensive legal card.
      return richestOf(legal);
    }
    // Partner could still be beaten — shed cheapest safe card and don't
    // waste high points on a trick we might lose.
    return cheapestOf(legal);
  }

  // -----------------------------------------------------------------------
  // OPPONENT is winning — find our cards that beat their best play.
  // -----------------------------------------------------------------------
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
    // Cheapest winner — but verify our win wouldn't just get over-trumped
    // by the next opponent. If it would, only fight if trick is fat enough.
    const candidate = cheapestOf(winners);
    const trickPts = trickPointValue(currentTrick, trump)
                   + getCardPoints(candidate, trump);
    const ourWinSafe = !opponentsCouldBeat(
      candidate, remainingOpps, trump, leadSuit, ctx, hand, partnerHand,
    );
    if (ourWinSafe) return candidate;
    // Risky win — only commit if trick already holds real value.
    if (trickPts >= 14) return candidate;
    // Otherwise duck and shed a junk card.
    return cheapestOf(legal);
  }

  // Can't win — shed the cheapest card. Prefer dumping a non-trump first so
  // we keep trumps for future tricks where we can actually use them.
  const sheds = legal.filter(c => c.suit !== trump);
  return cheapestOf(sheds.length > 0 ? sheds : legal);
};

// ---------------------------------------------------------------------------
// Initialize game
// ---------------------------------------------------------------------------

export const initializeGame = (): GameState => {
  const rawPlayers: Player[] = [
    { id: 0, name: 'You',     hand: [], team: 1 },
    { id: 1, name: 'CPU 2',   hand: [], team: 2 },
    { id: 2, name: 'Partner', hand: [], team: 1 },
    { id: 3, name: 'CPU 4',   hand: [], team: 2 },
  ];

  const { players: dealtPlayers, proposalCard } = dealCards(rawPlayers);

  return {
    players: dealtPlayers,
    currentPlayer: 1, // non-dealer (player 1) bids first
    trump: null,
    proposalCard,
    takerTeam: null,
    bidRound: 1,
    bidPassCount: 0,
    currentTrick: { cards: [], winner: null },
    completedTricks: [],
    scores: { team1: 0, team2: 0 },
    gameScore: { team1: 0, team2: 0 },
    phase: 'bidding',
    dealer: 0,
    lastTrickWinner: null,
    beloteTeam: null,
  };
};
