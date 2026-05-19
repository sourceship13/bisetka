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

export const chooseAICard = (
  player: Player,
  currentTrick: Trick,
  trump: Suit | null,
  players: Player[],
): CardType => {
  const hand = player.hand;
  const legal = hand.filter(c => canPlayCard(c, hand, currentTrick, trump));
  if (legal.length === 1) return legal[0];

  const teammate = isTeammateWinning(currentTrick, player.id, players, trump);

  // Teammate is winning — shed the least valuable card
  if (teammate) {
    return legal.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump))[0];
  }

  // Leading — play strongest non-trump; only lead trump as last resort
  if (currentTrick.cards.length === 0) {
    const nonTrump = legal.filter(c => c.suit !== trump);
    const pool = nonTrump.length > 0 ? nonTrump : legal;
    return pool.sort((a, b) => getCardStrength(a, trump) - getCardStrength(b, trump))[0];
  }

  const leadSuit = currentTrick.cards[0].card.suit;

  // Find current best play in the trick
  const bestPlay = currentTrick.cards.reduce((best, play) => {
    const b = best.card; const c = play.card;
    if (c.suit === trump && b.suit !== trump) return play;
    if (c.suit === trump && b.suit === trump)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    if (c.suit === leadSuit && b.suit === leadSuit)
      return getCardStrength(c, trump) < getCardStrength(b, trump) ? play : best;
    return best;
  }, currentTrick.cards[0]);

  // Cards that can beat current best
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
    // Win with cheapest winning card — save high-value cards
    return winning.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump))[0];
  }

  // Cannot win — shed cheapest card
  return legal.sort((a, b) => getCardPoints(a, trump) - getCardPoints(b, trump))[0];
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
