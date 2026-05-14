// Coin-drop SFX is now served from the shared `nardiSound` cache so it uses
// the same audio session, prewarm and stop/play sequence that already works
// for piece_move, dice_roll, etc. Keeping this file as a thin re-export so
// existing call sites (DailyPointsContext) don't have to change.
export { playCoinDropSound } from './nardiSound';
