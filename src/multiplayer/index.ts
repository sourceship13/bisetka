/**
 * Enterprise Multiplayer System - Main Exports
 * 
 * Import everything you need for multiplayer games from here:
 * 
 * ```ts
 * import { useMultiplayerGame, chessAdapter } from '../multiplayer';
 * ```
 */

// Core Hook
export { useMultiplayerGame, useRoomName, useMatchmakingUI } from './useMultiplayerGame';

// Controller (for advanced use cases)
export { MultiplayerGameController } from './MultiplayerGameController';

// Types
export type {
  GameType,
  PlayerColor,
  MultiplayerStatus,
  MultiplayerState,
  PlayerInfo,
  OpponentInfo,
  RoomInfo,
  GameAdapter,
  UseMultiplayerGameConfig,
  UseMultiplayerGameReturn,
  BaseGameEvents,
} from './types';

// Game Adapters
export * from './adapters';
