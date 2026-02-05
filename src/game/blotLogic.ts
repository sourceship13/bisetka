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
  currentTrick: Trick;
  completedTricks: Trick[];
  scores: { team1: number; team2: number };
  gameScore: { team1: number; team2: number };
  phase: 'bidding' | 'playing' | 'roundEnd' | 'gameEnd';
  dealer: number;
  lastTrickWinner: number | null;
}

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

// Trump card ranking
const trumpRanking: Rank[] = ['J', '9', 'A', '10', 'K', 'Q', '8', '7'];
const normalRanking: Rank[] = ['A', '10', 'K', 'Q', 'J', '9', '8', '7'];

export const getCardRank = (card: CardType, trump: Suit | null): number => {
  const ranking = card.suit === trump ? trumpRanking : normalRanking;
  return ranking.indexOf(card.rank);
};

// Create and shuffle deck
export const createDeck = (): CardType[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: CardType[] = [];

  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`,
      });
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

// Deal cards to players
export const dealCards = (players: Player[]): Player[] => {
  const deck = createDeck();
  const dealtPlayers = players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * 8, (index + 1) * 8),
  }));
  return dealtPlayers;
};

// Determine trick winner
export const determineTrickWinner = (trick: Trick, trump: Suit | null, leadSuit: Suit): number => {
  let winningCard = trick.cards[0];
  
  trick.cards.forEach(cardPlay => {
    const currentWinner = winningCard.card;
    const challenger = cardPlay.card;
    
    // Trump beats everything
    if (challenger.suit === trump && currentWinner.suit !== trump) {
      winningCard = cardPlay;
    } else if (challenger.suit === trump && currentWinner.suit === trump) {
      // Both trump - compare rank
      if (getCardRank(challenger, trump) < getCardRank(currentWinner, trump)) {
        winningCard = cardPlay;
      }
    } else if (currentWinner.suit !== trump && challenger.suit === leadSuit && currentWinner.suit !== leadSuit) {
      // Following lead suit beats non-lead
      winningCard = cardPlay;
    } else if (challenger.suit === leadSuit && currentWinner.suit === leadSuit) {
      // Both following lead - compare rank
      if (getCardRank(challenger, trump) < getCardRank(currentWinner, trump)) {
        winningCard = cardPlay;
      }
    }
  });
  
  return winningCard.playerId;
};

// Check if a card can be played
export const canPlayCard = (
  card: CardType,
  hand: CardType[],
  currentTrick: Trick,
  trump: Suit | null
): boolean => {
  // First card of trick - can play anything
  if (currentTrick.cards.length === 0) {
    return true;
  }

  const leadCard = currentTrick.cards[0].card;
  const leadSuit = leadCard.suit;
  
  // Must follow suit if possible
  const hasSuit = hand.some(c => c.suit === leadSuit);
  if (hasSuit) {
    return card.suit === leadSuit;
  }
  
  // If no lead suit, must play trump if available
  const hasTrump = hand.some(c => c.suit === trump);
  if (hasTrump) {
    return card.suit === trump;
  }
  
  // Can play any card if no lead suit or trump
  return true;
};

// Calculate round score
export const calculateRoundScore = (
  tricks: Trick[],
  players: Player[],
  trump: Suit | null
): { team1: number; team2: number } => {
  let team1Score = 0;
  let team2Score = 0;

  tricks.forEach((trick, index) => {
    const winner = players.find(p => p.id === trick.winner);
    if (!winner) return;

    let trickPoints = 0;
    trick.cards.forEach(cardPlay => {
      trickPoints += getCardPoints(cardPlay.card, trump);
    });

    // Last trick bonus
    if (index === tricks.length - 1) {
      trickPoints += 10;
    }

    if (winner.team === 1) {
      team1Score += trickPoints;
    } else {
      team2Score += trickPoints;
    }
  });

  return { team1: team1Score, team2: team2Score };
};

// Initialize game
export const initializeGame = (): GameState => {
  const players: Player[] = [
    { id: 0, name: 'Player 1', hand: [], team: 1 },
    { id: 1, name: 'Player 2', hand: [], team: 2 },
    { id: 2, name: 'Player 3', hand: [], team: 1 },
    { id: 3, name: 'Player 4', hand: [], team: 2 },
  ];

  const dealtPlayers = dealCards(players);

  return {
    players: dealtPlayers,
    currentPlayer: 0,
    trump: null,
    currentTrick: { cards: [], winner: null },
    completedTricks: [],
    scores: { team1: 0, team2: 0 },
    gameScore: { team1: 0, team2: 0 },
    phase: 'bidding',
    dealer: 0,
    lastTrickWinner: null,
  };
};
