/**
 * Enterprise Multiplayer Game Hook
 * 
 * Single hook that handles ALL multiplayer logic for game screens.
 * Reduces screen code from 1000+ lines to ~200 lines.
 * 
 * @example
 * ```tsx
 * const {
 *   gameState,
 *   isMyTurn,
 *   makeMove,
 *   status,
 *   myPlayer,
 *   room,
 * } = useMultiplayerGame({
 *   gameType: 'chess',
 *   userId: session.user.id,
 *   mode: route.params.mode,
 *   adapter: chessAdapter,
 *   onGameStart: (data) => {
 *     // Initialize chess board
 *   },
 *   onGameEnd: (result) => {
 *     // Show winner modal
 *   },
 * });
 * 
 * // Then in render:
 * if (status === 'matchmaking') return <MatchmakingScreen />;
 * if (status === 'playing') return <GameBoard gameState={gameState} onMove={makeMove} />;
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MultiplayerGameController } from './MultiplayerGameController';
import type {
  UseMultiplayerGameConfig,
  UseMultiplayerGameReturn,
  MultiplayerState,
  MultiplayerStatus,
} from './types';

export function useMultiplayerGame<TGameState = any, TMove = any>(
  config: UseMultiplayerGameConfig<TGameState, TMove>
): UseMultiplayerGameReturn<TGameState, TMove> {
  
  // ───────────────────────────────────────────────────────────────────────────
  // CONTROLLER SETUP
  // ───────────────────────────────────────────────────────────────────────────
  
  const controllerRef = useRef<MultiplayerGameController<TGameState, TMove> | null>(null);
  const [state, setState] = useState<MultiplayerState<TGameState>>(() => ({
    status: 'disconnected',
    error: null,
    socket: {
      connected: false,
      userId: config.userId,
      token: null,
    },
    room: null,
    myPlayer: null,
    opponent: null,
    gameState: null,
    currentTurn: 'white',
    isMyTurn: false,
    canMove: false,
  }));
  
  // Initialize controller once
  useEffect(() => {
    const controller = new MultiplayerGameController(config);
    controllerRef.current = controller;
    
    // Subscribe to state changes
    const unsubscribe = controller.subscribe((newState) => {
      setState(newState);
    });
    
    // Auto-connect and auto-start if enabled
    const autoInitialize = async () => {
      if (config.autoConnect !== false) {
        try {
          await controller.connect();
          
          // Auto-start based on mode
          if (config.autoStart !== false && config.mode) {
            if (config.mode === 'random') {
              await controller.findMatch();
            } else if (config.mode === 'private-create') {
              await controller.createPrivateRoom(config.joinCode);
            } else if (config.mode === 'private-join' && config.joinCode) {
              await controller.joinPrivateRoom(config.joinCode);
            }
          }
        } catch (error) {
          console.error('Auto-initialize failed:', error);
        }
      }
    };
    
    autoInitialize();
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      controller.destroy();
    };
  }, []); // Empty deps - controller is stable
  
  // ───────────────────────────────────────────────────────────────────────────
  // ACTIONS (Wrapped with useCallback for stable references)
  // ───────────────────────────────────────────────────────────────────────────
  
  const connect = useCallback(async () => {
    await controllerRef.current?.connect();
  }, []);
  
  const disconnect = useCallback(() => {
    controllerRef.current?.disconnect();
  }, []);
  
  const findMatch = useCallback(async () => {
    await controllerRef.current?.findMatch();
  }, []);
  
  const createPrivateRoom = useCallback(async (desiredCode?: string) => {
    await controllerRef.current?.createPrivateRoom(desiredCode);
  }, []);
  
  const joinPrivateRoom = useCallback(async (code: string) => {
    await controllerRef.current?.joinPrivateRoom(code);
  }, []);
  
  const cancelMatchmaking = useCallback(() => {
    controllerRef.current?.cancelMatchmaking();
  }, []);
  
  const makeMove = useCallback((move: TMove) => {
    controllerRef.current?.makeMove(move);
  }, []);
  
  const sendReady = useCallback(() => {
    controllerRef.current?.sendReady();
  }, []);
  
  const resign = useCallback(() => {
    controllerRef.current?.resign();
  }, []);
  
  const setRoomName = useCallback((name: string) => {
    controllerRef.current?.setRoomName(name);
  }, []);
  
  // ───────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ───────────────────────────────────────────────────────────────────────────
  
  const isConnected = state.socket.connected;
  const isPlaying = state.status === 'playing';
  const isWaiting = [
    'matchmaking',
    'creating_room',
    'joining_room',
    'waiting_for_opponent',
    'waiting_for_ready',
  ].includes(state.status);
  
  // ───────────────────────────────────────────────────────────────────────────
  // RETURN INTERFACE
  // ───────────────────────────────────────────────────────────────────────────
  
  return {
    // Connection
    connect,
    disconnect,
    isConnected,
    
    // Matchmaking
    findMatch,
    createPrivateRoom,
    joinPrivateRoom,
    cancelMatchmaking,
    
    // Game Actions
    makeMove,
    sendReady,
    resign,
    setRoomName,
    
    // State
    state,
    gameState: state.gameState,
    myPlayer: state.myPlayer,
    opponent: state.opponent,
    room: state.room,
    status: state.status,
    error: state.error,
    
    // Computed
    isMyTurn: state.isMyTurn,
    canMove: state.canMove,
    isPlaying,
    isWaiting,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPER HOOKS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Hook for managing room name editing
 */
export function useRoomName(
  roomId: string | null,
  initialName: string = 'Game Room'
) {
  const [roomName, setRoomNameLocal] = useState(initialName);
  const [showModal, setShowModal] = useState(false);
  
  const handleSaveRoomName = useCallback((newName: string) => {
    setRoomNameLocal(newName);
    setShowModal(false);
  }, []);
  
  return {
    roomName,
    setRoomName: setRoomNameLocal,
    showModal,
    setShowModal,
    handleSaveRoomName,
  };
}

/**
 * Hook for managing matchmaking UI state
 */
export function useMatchmakingUI(status: MultiplayerStatus) {
  const showMenu = status === 'disconnected' || status === 'connected';
  const showMatchmaking = status === 'matchmaking';
  const showWaitingRoom = [
    'creating_room',
    'joining_room',
    'waiting_for_opponent',
    'waiting_for_ready',
  ].includes(status);
  const showGame = status === 'playing';
  const showGameEnd = status === 'game_ended';
  const showError = status === 'error';
  
  return {
    showMenu,
    showMatchmaking,
    showWaitingRoom,
    showGame,
    showGameEnd,
    showError,
  };
}
