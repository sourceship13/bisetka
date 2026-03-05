/**
 * Poker Game Adapter
 * 
 * Texas Hold'em poker (6-player tables)
 * NOTE: Poker uses custom socket events (not the standard multiplayer protocol)
 * This adapter exists for type safety but the screen needs PokerMultiplayerController
 */

import type { GameAdapter, PlayerColor } from '../types';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

export interface PokerPlayer {
  id: number;
  name: string;
  chips: number;
  currentBet: number;
  cards: Card[];
  folded: boolean;
  isDealer: boolean;
  isActive: boolean;
  hasActed: boolean;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PokerGameState {
  players: PokerPlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  phase: GamePhase;
  activeSeat: number; // Index of current player
  mySeat: number; // This player's seat index
}

export interface PokerMove {
  action: 'fold' | 'call' | 'raise' | 'check';
  amount?: number;
}

/**
 * NOTE: Poker uses a custom multiplayer system (socketService.onPokerXXX events)
 * because of its complex 6-player lobby, turn timers, and betting rounds.
 * 
 * This adapter is provided for consistency but the screen should NOT use
 * useMultiplayerGame hook — it needs direct socket management.
 */
export const pokerAdapter: GameAdapter<PokerGameState, PokerMove> = {
  /**
   * Initialize poker game state
   */
  initializeGame(serverData: any): PokerGameState {
    return {
      players: serverData.players || [],
      communityCards: serverData.communityCards || [],
      pot: serverData.pot || 0,
      currentBet: serverData.currentBet || 0,
      phase: serverData.phase || 'waiting',
      activeSeat: serverData.activeSeat || 0,
      mySeat: serverData.mySeat || 0,
    };
  },

  /**
   * Apply poker move (server-authoritative)
   */
  applyMove(currentState: PokerGameState, move: PokerMove): PokerGameState {
    // Poker state is fully server-managed
    return currentState;
  },

  /**
   * Get current turn (returns seat index)
   */
  getCurrentTurn(gameState: PokerGameState): number {
    return gameState.activeSeat;
  },

  /**
   * Check if game/hand is over
   */
  isGameOver(gameState: PokerGameState): boolean {
    return gameState.phase === 'showdown';
  },

  /**
   * Winner is determined server-side for poker
   */
  getWinner(gameState: PokerGameState): string | null {
    // Poker hands have multiple winners per hand, determined server-side
    return null;
  },
};
