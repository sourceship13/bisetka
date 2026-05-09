import {
  NardiGameState,
  Move,
  PlayerColor,
  Dice,
  executeMove,
  calculatePossibleMoves,
} from './nardiLogic';

// ---------------------------------------------------------------------------
// AI for Long / Short Nardi.
// Strategy: enumerate every legal *sequence* of moves the AI can play with
// the current dice roll, score the resulting board with a positional
// heuristic, and pick the best sequence.
// ---------------------------------------------------------------------------

const LEAF_LIMIT = 6000;          // hard cap on terminal states examined
const BEAM_BY_DEPTH = [25, 18, 14, 10, 8]; // children kept at each depth

const opp = (c: PlayerColor): PlayerColor => (c === 'white' ? 'black' : 'white');

// Pips remaining for one player (lower = closer to bearing off all 15).
function pipCount(state: NardiGameState, color: PlayerColor): number {
  let total = 0;
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    let n = 0;
    for (const c of pt.checkers) if (c === color) n++;
    if (n === 0) continue;
    // White bears off at -1 (needs i+1 pips). Black bears off at 24 (needs 24-i pips).
    const dist = color === 'white' ? i + 1 : 24 - i;
    total += n * dist;
  }
  total += state.bar[color] * 25; // checker on bar must re-enter
  return total;
}

// Detect a "blot" (single checker exposed to a hit) in short Nardi.
function isBlot(state: NardiGameState, idx: number, color: PlayerColor): boolean {
  if (state.mode !== 'short') return false;
  const pt = state.points[idx];
  return pt.checkers.length === 1 && pt.checkers[0] === color;
}

// Approximate hit probability against a blot at index `idx` for AI color `color`.
// Computes the chance the opponent rolls dice that can land on `idx` from any
// of their existing checkers (single die or sum of both, ignoring blockers).
function blotHitProbability(
  state: NardiGameState,
  idx: number,
  color: PlayerColor,
): number {
  if (state.mode !== 'short') return 0;
  const enemy = opp(color);
  const dir = enemy === 'white' ? -1 : 1; // direction enemy moves
  // Distance enemy needs to reach `idx` from each of their checkers
  const distances: number[] = [];
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    if (pt.checkers.length === 0 || pt.checkers[0] !== enemy) continue;
    const d = (idx - i) * dir;
    if (d > 0 && d <= 12) distances.push(d);
  }
  if (distances.length === 0) return 0;
  // 36 dice combos
  let hits = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const set = new Set<number>([a, b, a + b]);
      if (a === b) {
        set.add(a * 3);
        set.add(a * 4);
      }
      for (const d of distances) {
        if (set.has(d)) {
          hits++;
          break;
        }
      }
    }
  }
  return hits / 36;
}

// Positional score from `aiColor`'s perspective. Higher is better.
function evaluate(state: NardiGameState, aiColor: PlayerColor): number {
  const enemy = opp(aiColor);
  let score = 0;

  // 1) Borne-off pieces dominate everything else.
  score += state.home[aiColor] * 120;
  score -= state.home[enemy] * 120;

  // Instant terminal reward / penalty.
  if (state.winner === aiColor) score += 5000;
  if (state.winner === enemy) score -= 5000;

  // 2) Pip race.
  const aiPip = pipCount(state, aiColor);
  const enemyPip = pipCount(state, enemy);
  score -= aiPip * 1.0;
  score += enemyPip * 1.0;

  // 3) Built points (anchors / blocks). Reward stacks of 2+ owned by AI,
  //    bigger reward for points sitting in front of opponent's checkers.
  let aiRun = 0;
  let aiBlockMaxRun = 0;
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    const owned = pt.checkers.length > 0 && pt.checkers[0] === aiColor;
    const stacked = pt.checkers.length >= 2 && owned;

    if (stacked) {
      score += 4;
      // Bonus for stacks deep in the AI's outer board / opponent's path.
      // (Long Nardi: AI=black moves 0→23, so points 6..17 are mid/blocking zone
      //  in front of the white starting head at 12. Short: opponent's home is
      //  18-23 for black, so blocking 6..11 hurts white most.)
      const blockingZone =
        aiColor === 'black' ? i >= 4 && i <= 11 : i >= 12 && i <= 19;
      if (blockingZone) score += 3;
    }

    // Detect maximum consecutive run of AI-held points (a "prime" up to 6 wide
    // is devastating because opponent can't jump it).
    if (stacked) {
      aiRun++;
      if (aiRun > aiBlockMaxRun) aiBlockMaxRun = aiRun;
    } else {
      aiRun = 0;
    }
  }
  // Quadratic prime bonus: 6-prime ≈ +22, 5-prime ≈ +15.
  score += aiBlockMaxRun * aiBlockMaxRun * 0.6;

  // 4) Blot exposure (short Nardi only).
  if (state.mode === 'short') {
    for (let i = 0; i < 24; i++) {
      if (isBlot(state, i, aiColor)) {
        const p = blotHitProbability(state, i, aiColor);
        score -= 6 + p * 30; // bigger penalty if likely to be hit
      }
      if (isBlot(state, i, enemy)) {
        score += 4; // opponent blots are good for us
      }
    }
    score -= state.bar[aiColor] * 25;
    score += state.bar[enemy] * 25;
  }

  // 5) Tall-stack penalty (>5 wastes material that could be racing or blocking).
  for (let i = 0; i < 24; i++) {
    const pt = state.points[i];
    if (pt.checkers.length > 5 && pt.checkers[0] === aiColor) {
      score -= (pt.checkers.length - 5) * 0.6;
    }
  }

  // 6) Bear-off readiness: reward checkers already in home board.
  if (aiColor === 'black') {
    for (let i = 18; i < 24; i++) {
      const pt = state.points[i];
      for (const c of pt.checkers) if (c === aiColor) score += 0.4;
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const pt = state.points[i];
      for (const c of pt.checkers) if (c === aiColor) score += 0.4;
    }
  }

  return score;
}

// Apply a move for AI search. Mirrors NardiScreen.applyMove logic so the
// search produces states identical to what the screen will reach.
function applyMoveForSearch(state: NardiGameState, move: Move): NardiGameState {
  const newBoard = executeMove(state, move);

  const isCombined =
    move.from >= 0 &&
    move.to >= 0 &&
    move.to < 24 &&
    state.dice.die1 > 0 &&
    state.dice.die2 > 0 &&
    state.dice.die1 !== state.dice.die2 &&
    state.movesRemaining >= 2 &&
    Math.abs(move.to - move.from) === state.dice.die1 + state.dice.die2;

  const newDice: Dice = { ...state.dice };
  let movesRemaining: number;

  if (isCombined) {
    newDice.die1 = 0;
    newDice.die2 = 0;
    movesRemaining = Math.max(0, state.movesRemaining - 2);
  } else {
    movesRemaining = Math.max(0, state.movesRemaining - 1);
    if (state.dice.die1 === state.dice.die2 && state.dice.die1 > 0) {
      // Doubles — leave dice face values as-is, movesRemaining drives end-of-turn.
    } else {
      const usedDie = pickUsedDieValue(move, state);
      if (newDice.die1 === usedDie && newDice.die1 > 0) newDice.die1 = 0;
      else if (newDice.die2 === usedDie && newDice.die2 > 0) newDice.die2 = 0;
      else if (newDice.die1 > 0) newDice.die1 = 0;
      else if (newDice.die2 > 0) newDice.die2 = 0;
    }
  }

  const next: NardiGameState = {
    ...newBoard,
    dice: newDice,
    movesRemaining,
    possibleMoves: [],
  };
  if (movesRemaining > 0) {
    next.possibleMoves = calculatePossibleMoves(next);
  }
  return next;
}

function pickUsedDieValue(move: Move, state: NardiGameState): number {
  const { dice, currentPlayer } = state;
  if (move.from === -1) {
    const dist = currentPlayer === 'white' ? 24 - move.to : move.to + 1;
    if (dice.die1 === dist && dice.die1 > 0) return dice.die1;
    if (dice.die2 === dist && dice.die2 > 0) return dice.die2;
    return dice.die1 > 0 ? dice.die1 : dice.die2;
  }
  if (move.to === 24 || move.to === -1) {
    const dist = currentPlayer === 'white' ? move.from + 1 : 24 - move.from;
    if (dice.die1 === dist && dice.die1 > 0) return dice.die1;
    if (dice.die2 === dist && dice.die2 > 0) return dice.die2;
    const candidates = [dice.die1, dice.die2].filter(d => d >= dist && d > 0);
    if (candidates.length > 0) return Math.min(...candidates);
    return dice.die1 > 0 ? dice.die1 : dice.die2;
  }
  return Math.abs(move.to - move.from);
}

interface SearchCtx {
  aiColor: PlayerColor;
  bestScore: number;
  bestPath: Move[];
  bestDiceUsed: number;
  leaves: number;
}

function dfs(
  state: NardiGameState,
  path: Move[],
  ctx: SearchCtx,
  depth: number,
): void {
  if (ctx.leaves >= LEAF_LIMIT) return;

  // Terminal: no moves left or none possible.
  if (state.movesRemaining === 0 || state.possibleMoves.length === 0) {
    ctx.leaves++;
    const sc = evaluate(state, ctx.aiColor);
    const used = path.length;
    // Strongly prefer sequences that consume more dice (Nardi rule: must play
    // as many dice as possible). +200 per move played > all heuristic deltas.
    const adjusted = sc + used * 200;
    if (
      used > ctx.bestDiceUsed ||
      (used === ctx.bestDiceUsed && adjusted > ctx.bestScore)
    ) {
      ctx.bestScore = adjusted;
      ctx.bestDiceUsed = used;
      ctx.bestPath = path.slice();
    }
    return;
  }

  const beam = BEAM_BY_DEPTH[Math.min(depth, BEAM_BY_DEPTH.length - 1)];
  // Quick-rank child moves to drive beam search.
  const ranked = state.possibleMoves
    .map(m => {
      const ns = applyMoveForSearch(state, m);
      return { m, ns, sc: evaluate(ns, ctx.aiColor) };
    })
    .sort((a, b) => b.sc - a.sc)
    .slice(0, beam);

  for (const r of ranked) {
    if (ctx.leaves >= LEAF_LIMIT) return;
    path.push(r.m);
    dfs(r.ns, path, ctx, depth + 1);
    path.pop();
  }
}

/**
 * Choose the best sequence of moves the AI should play this turn.
 * `state` must already have dice rolled and `possibleMoves` computed.
 * Returns an ordered list of moves (possibly empty if no legal play exists).
 */
export function chooseBestAiSequence(
  state: NardiGameState,
  aiColor: PlayerColor,
): Move[] {
  if (state.possibleMoves.length === 0) return [];
  const ctx: SearchCtx = {
    aiColor,
    bestScore: -Infinity,
    bestPath: [],
    bestDiceUsed: -1,
    leaves: 0,
  };
  dfs(state, [], ctx, 0);
  return ctx.bestPath;
}
