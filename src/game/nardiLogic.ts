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
    // Short Nardi - REVERSED positions (player=white sees pieces at top)
    points[0].checkers = ['black', 'black'];
    points[5].checkers = ['white', 'white', 'white', 'white', 'white'];
    points[7].checkers = ['white', 'white', 'white'];
    points[11].checkers = ['black', 'black', 'black', 'black', 'black'];
    points[12].checkers = ['white', 'white', 'white', 'white', 'white'];
    points[16].checkers = ['black', 'black', 'black'];
    points[18].checkers = ['black', 'black', 'black', 'black', 'black'];
    points[23].checkers = ['white', 'white'];
  } else {
    // Long Nardi - REVERSED positions (player=white at position 12, AI=black at 0)
    points[0].checkers = Array(15).fill('black');
    points[12].checkers = Array(15).fill('white');
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

  // Build the list of available die face-values. For non-doubles we keep both
  // values individually; for doubles every remaining move uses the same face.
  // We deduplicate only within each fromPos so we don't generate the same
  // (from, to) move twice when both dice happen to show the same face value.
  let diceValues: number[] = [];
  if (dice.die1 === dice.die2 && dice.die1 > 0) {
    // Doubles – one face value, movesRemaining tells us how many moves are left
    diceValues = [dice.die1];
  } else {
    if (dice.die1 > 0) diceValues.push(dice.die1);
    if (dice.die2 > 0) diceValues.push(dice.die2);
    // Deduplicate so we don't emit the same (from,to) move twice when die1===die2
    diceValues = [...new Set(diceValues)];
  }
  console.log('🎲 Dice values to use:', diceValues);

  // Track (from, to) pairs already added to avoid exact duplicates
  const seen = new Set<string>();

  points.forEach((point, fromPos) => {
    if (point.checkers.length > 0 && point.checkers[point.checkers.length - 1] === currentPlayer) {
      diceValues.forEach(dieValue => {
        const toPos = currentPlayer === 'white' 
          ? fromPos - dieValue  // White moves anticlockwise (decreasing)
          : fromPos + dieValue; // Black moves clockwise (increasing)

        if (isValidMove(fromPos, toPos, currentPlayer, points, mode)) {
          const key = `${fromPos}-${toPos}`;
          if (!seen.has(key)) {
            seen.add(key);
            moves.push({ from: fromPos, to: toPos, checker: currentPlayer });
          }
        }
      });

      // Check for bearing off
      if (canBearOff(state, fromPos)) {
        // White bears off to -1 (below index 0, ptNum 1 edge)
        // Black bears off to 24 (above index 23, ptNum 24 edge)
        const bearOffPos = currentPlayer === 'white' ? -1 : 24;

        diceValues.forEach(dieValue => {
          const targetPos = currentPlayer === 'white' ? fromPos - dieValue : fromPos + dieValue;

          if (currentPlayer === 'white' && targetPos < 0) {
            if (targetPos === -1) {
              // Exact bear-off: die value exactly equals distance to exit (fromPos + 1)
              const key = `${fromPos}-${bearOffPos}`;
              if (!seen.has(key)) { seen.add(key); moves.push({ from: fromPos, to: bearOffPos, checker: currentPlayer }); }
            } else {
              // High-roll bear-off: only the highest-occupied point in home board (0-5) may use it.
              // "Highest index" = furthest from exit edge (ptNum 1 = index 0 is closest to exit).
              let isFurthest = true;
              for (let i = fromPos + 1; i < 6; i++) {
                if (points[i].checkers.some(c => c === currentPlayer)) {
                  isFurthest = false;
                  break;
                }
              }
              if (isFurthest) {
                const key = `${fromPos}-${bearOffPos}`;
                if (!seen.has(key)) { seen.add(key); moves.push({ from: fromPos, to: bearOffPos, checker: currentPlayer }); }
              }
            }
          } else if (currentPlayer === 'black' && targetPos >= 24) {
            if (targetPos === 24) {
              // Exact bear-off
              const key = `${fromPos}-${bearOffPos}`;
              if (!seen.has(key)) { seen.add(key); moves.push({ from: fromPos, to: bearOffPos, checker: currentPlayer }); }
            } else {
              // High-roll bear-off: only the lowest-occupied point in home board (18-23) may use it.
              // "Lowest index" = furthest from exit edge (ptNum 24 = index 23 is closest to exit).
              let isFurthest = true;
              for (let i = 18; i < fromPos; i++) {
                if (points[i].checkers.some(c => c === currentPlayer)) {
                  isFurthest = false;
                  break;
                }
              }
              if (isFurthest) {
                const key = `${fromPos}-${bearOffPos}`;
                if (!seen.has(key)) { seen.add(key); moves.push({ from: fromPos, to: bearOffPos, checker: currentPlayer }); }
              }
            }
          }
        });
      }
    }
  });

  console.log('✅ Generated', moves.length, 'possible moves for', currentPlayer);
  return moves;
};

const getBarEntryMoves = (state: NardiGameState): Move[] => {
  const { dice, currentPlayer, points, movesRemaining } = state;

  // For doubles both dice have the same face; one entry per face value is enough
  // (movesRemaining tracks how many of those moves are still available).
  // For non-doubles collect each non-zero die value once.
  let diceValues: number[];
  if (dice.die1 === dice.die2 && dice.die1 > 0) {
    diceValues = [dice.die1];
  } else {
    diceValues = [dice.die1, dice.die2].filter(v => v > 0);
    diceValues = [...new Set(diceValues)]; // deduplicate in case both happen to be equal
  }

  const seen = new Set<number>();
  const moves: Move[] = [];
  diceValues.forEach(dieValue => {
    // White enters opponent's home (indices 18-23); Black enters White's home (indices 0-5)
    const entryPoint = currentPlayer === 'white' ? 24 - dieValue : dieValue - 1;
    if (!seen.has(entryPoint) && canEnterFromBar(entryPoint, currentPlayer, points, state.mode)) {
      seen.add(entryPoint);
      moves.push({ from: -1, to: entryPoint, checker: currentPlayer });
    }
  });

  return moves;
};

const canEnterFromBar = (point: number, player: PlayerColor, points: Point[], mode: GameMode): boolean => {
  if (point < 0 || point >= 24) return false;
  const targetPoint = points[point];
  if (targetPoint.checkers.length === 0) return true;
  if (targetPoint.checkers[0] === player) return true;
  // Hit a single opponent piece — only allowed in short (backgammon-style) mode
  return mode === 'short' && targetPoint.checkers.length === 1;
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
  const { currentPlayer, points, bar } = state;
  
  // Can't bear off if any checkers are on the bar
  if (bar[currentPlayer] > 0) return false;
  
  // REVERSED: White moves anticlockwise (23→0), bears off from 0-5
  // Black moves clockwise (0→23), bears off from 18-23
  const homeStart = currentPlayer === 'white' ? 0 : 18;
  const homeEnd = currentPlayer === 'white' ? 6 : 24;

  // Check all points outside home board
  for (let i = 0; i < 24; i++) {
    if (i >= homeStart && i < homeEnd) continue;
    const point = points[i];
    if (point.checkers.some(c => c === currentPlayer)) {
      console.log(`❌ Cannot bear off: found ${currentPlayer} checker on point ${i} (outside home ${homeStart}-${homeEnd})`);
      return false; // Found checker outside home board
    }
  }

  // Check if this point is in home board
  const result = from >= homeStart && from < homeEnd;
  if (result) {
    console.log(`✅ Point ${from} is in ${currentPlayer} home board (${homeStart}-${homeEnd})`);
  }
  return result;
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
    const entryPoint = newState.points[move.to];
    // Hit a blot (single opponent checker) if landing on it
    if (entryPoint.checkers.length === 1 && entryPoint.checkers[0] !== move.checker) {
      newState.bar[entryPoint.checkers[0]]++;
      entryPoint.checkers = [];
    }
    entryPoint.checkers.push(move.checker);
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
    currentPlayer: 'white', // Player is white
    dice: { die1: 0, die2: 0, rolled: false },
    possibleMoves: [],
    selectedPoint: null,
    winner: null,
    phase: 'setup', // Start with setup phase for opening roll
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
