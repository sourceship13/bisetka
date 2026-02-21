export type GameMode = 'short' | 'long';
export type PlayerColor = 'white' | 'black';

export interface Point {
  checkers: PlayerColor[];
  position: number;
}

export interface Dice {
  die1: number;
  die2: number;
  rolled: boolean;
}

export interface Move {
  from: number;
  to: number;
  checker: PlayerColor;
}

export interface NardiGameState {
  mode: GameMode;
  points: Point[];
  bar: { white: number; black: number }; // Checkers that were hit
  home: { white: number; black: number }; // Checkers borne off
  currentPlayer: PlayerColor;
  dice: Dice;
  possibleMoves: Move[];
  selectedPoint: number | null;
  winner: PlayerColor | null;
  phase: 'setup' | 'rolling' | 'moving' | 'gameOver';
  movesRemaining: number; // Track remaining moves (2 for normal, 4 for doubles)
}

// Initialize board based on mode
export const initializeBoard = (mode: GameMode): Point[] => {
  const points: Point[] = Array.from({ length: 24 }, (_, i) => ({
    checkers: [],
    position: i,
  }));

  if (mode === 'short') {
    // Short Nardi - standard backgammon starting position
    points[0].checkers = ['white', 'white'];
    points[5].checkers = ['black', 'black', 'black', 'black', 'black'];
    points[7].checkers = ['black', 'black', 'black'];
    points[11].checkers = ['white', 'white', 'white', 'white', 'white'];
    points[12].checkers = ['black', 'black', 'black', 'black', 'black'];
    points[16].checkers = ['white', 'white', 'white'];
    points[18].checkers = ['white', 'white', 'white', 'white', 'white'];
    points[23].checkers = ['black', 'black'];
  } else {
    // Long Nardi - all pieces start at home (position 0 for white, 12 for black)
    points[0].checkers = Array(15).fill('white');
    points[12].checkers = Array(15).fill('black');
  }

  return points;
};

// Roll dice
export const rollDice = (): Dice => {
  return {
    die1: Math.floor(Math.random() * 6) + 1,
    die2: Math.floor(Math.random() * 6) + 1,
    rolled: true,
  };
};

// Calculate possible moves for current player
export const calculatePossibleMoves = (
  state: NardiGameState
): Move[] => {
  const moves: Move[] = [];
  const { points, dice, currentPlayer, mode, bar, movesRemaining } = state;

  console.log('🔍 Calculating moves for', currentPlayer, '| dice:', dice, '| movesRemaining:', movesRemaining);

  if (!dice.rolled || movesRemaining === 0) {
    console.log('⚠️ Cannot calculate moves:', { rolled: dice.rolled, movesRemaining });
    return moves;
  }

  // Check if player has checkers on bar (short mode only)
  if (mode === 'short' && bar[currentPlayer] > 0) {
    const enterMoves = getBarEntryMoves(state);
    console.log('📍 Player has', bar[currentPlayer], 'checkers on bar, returning', enterMoves.length, 'entry moves');
    return enterMoves;
  }

  // Use dice values based on what's still available
  let diceValues: number[] = [];
  if (dice.die1 === dice.die2 && dice.die1 > 0) {
    // Doubles - use the same value for remaining moves
    for (let i = 0; i < movesRemaining; i++) {
      diceValues.push(dice.die1);
    }
  } else {
    if (dice.die1 > 0) diceValues.push(dice.die1);
    if (dice.die2 > 0) diceValues.push(dice.die2);
  }

  // Remove duplicate die values to avoid duplicate moves
  const uniqueDiceValues = [...new Set(diceValues)];
  console.log('🎲 Dice values to use:', uniqueDiceValues);

  points.forEach((point, fromPos) => {
    if (point.checkers.length > 0 && point.checkers[point.checkers.length - 1] === currentPlayer) {
      uniqueDiceValues.forEach(dieValue => {
        const toPos = currentPlayer === 'white' 
          ? fromPos + dieValue 
          : fromPos - dieValue;

        if (isValidMove(fromPos, toPos, currentPlayer, points, mode)) {
          moves.push({ from: fromPos, to: toPos, checker: currentPlayer });
        }
      });

      // Check for bearing off
      if (canBearOff(state, fromPos)) {
        const bearOffPos = currentPlayer === 'white' ? 24 : -1;
        uniqueDiceValues.forEach(dieValue => {
          const exactPos = currentPlayer === 'white' ? fromPos + dieValue : fromPos - dieValue;
          if (exactPos >= 24 || exactPos < 0) {
            moves.push({ from: fromPos, to: bearOffPos, checker: currentPlayer });
          }
        });
      }
    }
  });

  console.log('✅ Generated', moves.length, 'possible moves for', currentPlayer);
  return moves;
};

const getBarEntryMoves = (state: NardiGameState): Move[] => {
  const moves: Move[] = [];
  const { dice, currentPlayer, points } = state;
  const diceValues = [dice.die1, dice.die2];

  diceValues.forEach(dieValue => {
    const entryPoint = currentPlayer === 'white' ? dieValue - 1 : 24 - dieValue;
    if (canEnterFromBar(entryPoint, currentPlayer, points)) {
      moves.push({ from: -1, to: entryPoint, checker: currentPlayer });
    }
  });

  return moves;
};

const canEnterFromBar = (point: number, player: PlayerColor, points: Point[]): boolean => {
  if (point < 0 || point >= 24) return false;
  const targetPoint = points[point];
  if (targetPoint.checkers.length === 0) return true;
  if (targetPoint.checkers[0] === player) return true;
  return targetPoint.checkers.length === 1; // Can hit single opponent
};

// Check if move is valid
const isValidMove = (
  from: number,
  to: number,
  player: PlayerColor,
  points: Point[],
  mode: GameMode
): boolean => {
  if (to < 0 || to >= 24) return false;

  const targetPoint = points[to];

  if (mode === 'long') {
    // Long Nardi: No hitting, can't move to opponent's point
    if (targetPoint.checkers.length > 0 && targetPoint.checkers[0] !== player) {
      return false;
    }
  } else {
    // Short Nardi: Can hit single opponent checker
    if (targetPoint.checkers.length > 1 && targetPoint.checkers[0] !== player) {
      return false;
    }
  }

  return true;
};

// Check if player can bear off
const canBearOff = (state: NardiGameState, from: number): boolean => {
  const { currentPlayer, points } = state;
  
  // Check if all checkers are in home board
  const homeStart = currentPlayer === 'white' ? 18 : 0;
  const homeEnd = currentPlayer === 'white' ? 24 : 6;

  for (let i = 0; i < 24; i++) {
    if (i >= homeStart && i < homeEnd) continue;
    const point = points[i];
    if (point.checkers.some(c => c === currentPlayer)) {
      return false;
    }
  }

  // Check if this is in home board
  return from >= homeStart && from < homeEnd;
};

// Execute move
export const executeMove = (
  state: NardiGameState,
  move: Move
): NardiGameState => {
  const newState = JSON.parse(JSON.stringify(state)) as NardiGameState;
  
  // Handle bar entry
  if (move.from === -1) {
    newState.bar[move.checker]--;
    newState.points[move.to].checkers.push(move.checker);
    return newState;
  }

  // Handle bearing off
  if (move.to >= 24 || move.to < 0) {
    const fromPoint = newState.points[move.from];
    fromPoint.checkers.pop();
    newState.home[move.checker]++;
    
    // Check for win
    if (newState.home[move.checker] === 15) {
      newState.winner = move.checker;
      newState.phase = 'gameOver';
    }
    return newState;
  }

  // Normal move
  const fromPoint = newState.points[move.from];
  const toPoint = newState.points[move.to];

  // Handle hitting (short mode only)
  if (newState.mode === 'short' && toPoint.checkers.length === 1 && toPoint.checkers[0] !== move.checker) {
    const hitChecker = toPoint.checkers[0];
    newState.bar[hitChecker]++;
    toPoint.checkers = [];
  }

  fromPoint.checkers.pop();
  toPoint.checkers.push(move.checker);

  return newState;
};

// Initialize game
export const initializeNardiGame = (mode: GameMode): NardiGameState => {
  return {
    mode,
    points: initializeBoard(mode),
    bar: { white: 0, black: 0 },
    home: { white: 0, black: 0 },
    currentPlayer: 'white',
    dice: { die1: 0, die2: 0, rolled: false },
    possibleMoves: [],
    selectedPoint: null,
    winner: null,
    phase: 'rolling',
    movesRemaining: 0,
  };
};

// Switch player
export const switchPlayer = (state: NardiGameState): NardiGameState => {
  return {
    ...state,
    currentPlayer: state.currentPlayer === 'white' ? 'black' : 'white',
    dice: { die1: 0, die2: 0, rolled: false },
    possibleMoves: [],
    selectedPoint: null,
    phase: 'rolling',
    movesRemaining: 0,
  };
};
