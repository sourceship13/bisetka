/**
 * Enterprise Multiplayer Game Controller
 * 
 * Handles all socket lifecycle, state management, and event coordination
 * for multiplayer games. Eliminates 90% of boilerplate from game screens.
 * 
 * @example
 * ```ts
 * const controller = new MultiplayerGameController({
 *   gameType: 'chess',
 *   userId: 'user123',
 *   adapter: chessAdapter,
 *   onGameStart: (data) => console.log('Game started!', data),
 * });
 * 
 * await controller.connect(token);
 * await controller.findMatch();
 * controller.makeMove(myMove);
 * ```
 */

import { socketService } from '../services/SocketService';
import tokenService from '../services/token.service';
import type {
  GameType,
  PlayerColor,
  MultiplayerState,
  MultiplayerStatus,
  GameAdapter,
  PlayerInfo,
  OpponentInfo,
  RoomInfo,
  BaseGameEvents,
  UseMultiplayerGameConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class MultiplayerGameController<TGameState = any, TMove = any> {
  private config: UseMultiplayerGameConfig<TGameState, TMove>;
  private state: MultiplayerState<TGameState>;
  private listeners: Set<(state: MultiplayerState<TGameState>) => void> = new Set();
  private eventHandlers: Map<string, Function> = new Map();
  
  // Refs to avoid stale closures (same pattern as current screens)
  private roomIdRef: string | null = null;
  private myColorRef: PlayerColor | null = null;
  private myPositionRef: number | null = null;
  
  constructor(config: UseMultiplayerGameConfig<TGameState, TMove>) {
    this.config = config;
    this.state = this.getInitialState();
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────────
  
  private getInitialState(): MultiplayerState<TGameState> {
    return {
      status: 'disconnected',
      error: null,
      socket: {
        connected: false,
        userId: this.config.userId,
        token: null,
      },
      room: null,
      myPlayer: null,
      opponent: null,
      gameState: null,
      currentTurn: 'white',
      isMyTurn: false,
      canMove: false,
    };
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // CONNECTION
  // ───────────────────────────────────────────────────────────────────────────
  
  async connect(): Promise<void> {
    this.setState({ status: 'connecting' });
    
    try {
      const token = this.config.token || await tokenService.getAccessToken() || '';
      
      await socketService.connect(this.config.userId, token);
      
      this.setState({
        status: 'connected',
        socket: {
          connected: true,
          userId: this.config.userId,
          token,
        },
      });
      
      this.setupEventHandlers();
      
    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error.message || 'Failed to connect',
      });
      this.config.onError?.(error.message);
      throw error;
    }
  }
  
  disconnect(): void {
    this.cleanupEventHandlers();
    socketService.disconnect();
    this.setState({ status: 'disconnected', socket: { ...this.state.socket, connected: false } });
  }
  
  isConnected(): boolean {
    return this.state.socket.connected;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // EVENT HANDLER SETUP
  // ───────────────────────────────────────────────────────────────────────────
  
  private setupEventHandlers(): void {
    // Matchmaking
    this.registerHandler('matchmaking_status', this.handleMatchmakingStatus);
    this.registerHandler('match_found', this.handleMatchFound);
    
    // Room
    this.registerHandler('room_created', this.handleRoomCreated);
    this.registerHandler('room_joined', this.handleRoomJoined);
    this.registerHandler('opponent_joined', this.handleOpponentJoined);
    
    // Game
    this.registerHandler('game_started', this.handleGameStarted);
    this.registerHandler('move_made', this.handleMoveMade);
    this.registerHandler('game_ended', this.handleGameEnded);
    
    // Connection
    this.registerHandler('opponent_disconnected', this.handleOpponentDisconnected);
    
    // Room Management
    this.registerHandler('room_name_updated', this.handleRoomNameUpdated);
    
    // Error
    this.registerHandler('error', this.handleError);
  }
  
  private registerHandler(event: string, handler: Function): void {
    const boundHandler = handler.bind(this);
    this.eventHandlers.set(event, boundHandler);
    socketService.getSocket()?.on(event, boundHandler);
  }
  
  private cleanupEventHandlers(): void {
    for (const [event, handler] of this.eventHandlers) {
      socketService.getSocket()?.off(event, handler);
    }
    this.eventHandlers.clear();
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ───────────────────────────────────────────────────────────────────────────
  
  private handleMatchmakingStatus = (data: BaseGameEvents['matchmaking_status']): void => {
    if (data.status === 'searching') {
      this.setState({ status: 'matchmaking' });
    }
  };
  
  private handleMatchFound = (data: BaseGameEvents['match_found']): void => {
    this.roomIdRef = data.roomId;
    this.myColorRef = data.color;
    
    this.setState({
      status: 'waiting_for_ready',
      room: {
        id: data.roomId,
        code: null,
        name: `${this.config.gameType} Match`,
        gameType: this.config.gameType,
        playerCount: 2,
        maxPlayers: 2,
      },
      myPlayer: {
        id: this.config.userId,
        color: data.color,
        isReady: false,
      },
      opponent: {
        id: data.opponent.id,
        name: data.opponent.name,
        connected: true,
      },
    });
    
    // Auto-send ready
    this.sendReady();
  };
  
  private handleRoomCreated = (data: BaseGameEvents['room_created']): void => {
    this.roomIdRef = data.roomId;
    this.myColorRef = 'white'; // Room creator is always white
    
    this.setState({
      status: 'waiting_for_opponent',
      room: {
        id: data.roomId,
        code: data.roomCode,
        name: `${this.config.gameType} Room`,
        gameType: this.config.gameType,
        playerCount: 1,
        maxPlayers: 2,
      },
      myPlayer: {
        id: this.config.userId,
        color: 'white',
        isReady: false,
      },
    });
  };
  
  private handleRoomJoined = (data: BaseGameEvents['room_joined']): void => {
    this.roomIdRef = data.roomId;
    this.myColorRef = data.color;
    
    this.setState({
      status: data.opponent ? 'waiting_for_ready' : 'waiting_for_opponent',
      room: {
        id: data.roomId,
        code: data.roomCode || null,
        name: `${this.config.gameType} Room`,
        gameType: this.config.gameType,
        playerCount: data.opponent ? 2 : 1,
        maxPlayers: 2,
      },
      myPlayer: {
        id: this.config.userId,
        color: data.color,
        isReady: false,
      },
      opponent: data.opponent ? {
        id: data.opponent.id,
        name: data.opponent.name,
        connected: true,
      } : null,
    });
    
    // Auto-send ready if opponent present
    if (data.opponent) {
      this.sendReady();
    }
  };
  
  private handleOpponentJoined = (data: BaseGameEvents['opponent_joined']): void => {
    this.setState({
      status: 'waiting_for_ready',
      opponent: {
        id: data.opponent.id,
        name: data.opponent.name,
        connected: true,
      },
      room: this.state.room ? {
        ...this.state.room,
        playerCount: 2,
      } : null,
    });
    
    // Auto-send ready
    this.sendReady();
  };
  
  private handleGameStarted = (data: BaseGameEvents<TGameState>['game_started']): void => {
    // Update refs with server-assigned values
    this.roomIdRef = data.roomId;
    this.myColorRef = data.myColor;
    this.myPositionRef = data.myPosition ?? null;
    
    // Initialize game state using adapter
    const initialGameState = this.config.adapter.initializeGame(data.gameState || data);
    
    // Determine turn
    const currentTurn = this.config.adapter.getCurrentTurn(initialGameState);
    const isMyTurn = this.isMyTurnCheck(currentTurn);
    
    this.setState({
      status: 'playing',
      gameState: initialGameState,
      currentTurn,
      isMyTurn,
      canMove: isMyTurn,
      myPlayer: {
        id: this.config.userId,
        color: data.myColor,
        position: data.myPosition,
        isReady: true,
      },
    });
    
    // Call lifecycle hook
    this.config.onGameStart?.(data);
  };
  
  private handleMoveMade = (data: BaseGameEvents<TGameState, TMove>['move_made']): void => {
    // Apply move using adapter
    const newGameState = this.config.adapter.applyMove(
      this.state.gameState!,
      data.move
    );
    
    const currentTurn = data.currentTurn ?? this.config.adapter.getCurrentTurn(newGameState);
    const isMyTurn = this.isMyTurnCheck(currentTurn);
    
    this.setState({
      gameState: newGameState,
      currentTurn,
      isMyTurn,
      canMove: isMyTurn && !this.config.adapter.isGameOver(newGameState),
    });
    
    // Call lifecycle hook
    this.config.onMoveMade?.(data);
  };
  
  private handleGameEnded = (data: BaseGameEvents['game_ended']): void => {
    this.setState({
      status: 'game_ended',
      isMyTurn: false,
      canMove: false,
    });
    
    // Call lifecycle hook
    this.config.onGameEnd?.(data);
  };
  
  private handleOpponentDisconnected = (data: BaseGameEvents['opponent_disconnected']): void => {
    this.setState({
      opponent: this.state.opponent ? {
        ...this.state.opponent,
        connected: false,
      } : null,
    });
    
    this.config.onOpponentDisconnected?.();
  };
  
  private handleRoomNameUpdated = (data: { roomId: string; roomName: string }): void => {
    if (this.state.room?.id === data.roomId) {
      this.setState({
        room: {
          ...this.state.room,
          name: data.roomName,
        },
      });
    }
  };
  
  private handleError = (data: BaseGameEvents['error']): void => {
    this.setState({
      status: 'error',
      error: data.message,
    });
    
    this.config.onError?.(data.message);
  };
  
  // ───────────────────────────────────────────────────────────────────────────
  // MATCHMAKING ACTIONS
  // ───────────────────────────────────────────────────────────────────────────
  
  async findMatch(): Promise<void> {
    this.setState({ status: 'matchmaking' });
    
    try {
      // The socket service will trigger match_found event which we handle above
      await socketService.findMatch(this.config.gameType, this.config.userId);
    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error.message || 'Matchmaking failed',
      });
      throw error;
    }
  }
  
  async createPrivateRoom(desiredCode?: string): Promise<void> {
    this.setState({ status: 'creating_room' });
    
    try {
      // The socket service will trigger room_created event
      await socketService.createPrivateRoom(
        this.config.gameType,
        this.config.userId,
        desiredCode
      );
    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error.message || 'Failed to create room',
      });
      throw error;
    }
  }
  
  async joinPrivateRoom(code: string): Promise<void> {
    this.setState({ status: 'joining_room' });
    
    try {
      // The socket service will trigger room_joined event
      await socketService.joinPrivateRoom(code, this.config.userId);
    } catch (error: any) {
      this.setState({
        status: 'error',
        error: error.message || 'Failed to join room',
      });
      throw error;
    }
  }
  
  cancelMatchmaking(): void {
    socketService.cancelMatchmaking(this.config.userId);
    this.setState({ status: 'connected' });
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // GAME ACTIONS
  // ───────────────────────────────────────────────────────────────────────────
  
  makeMove(move: TMove): void {
    if (!this.state.isMyTurn || !this.state.canMove || !this.roomIdRef) {
      console.warn('Cannot make move:', {
        isMyTurn: this.state.isMyTurn,
        canMove: this.state.canMove,
        hasRoom: !!this.roomIdRef,
      });
      return;
    }
    
    // Client-side validation (optional)
    if (this.config.adapter.isValidMove && this.state.gameState) {
      if (!this.config.adapter.isValidMove(this.state.gameState, move)) {
        console.warn('Invalid move attempted:', move);
        return;
      }
    }
    
    // Send move to server
    socketService.makeMove(this.roomIdRef, this.config.userId, move);
    
    // Optimistically disable moves until server responds
    this.setState({ canMove: false });
  }
  
  sendReady(): void {
    if (!this.roomIdRef) return;
    
    socketService.playerReady(this.roomIdRef, this.config.userId);
    
    this.setState({
      myPlayer: this.state.myPlayer ? {
        ...this.state.myPlayer,
        isReady: true,
      } : null,
    });
  }
  
  resign(): void {
    if (!this.roomIdRef) return;
    
    socketService.resign(this.roomIdRef, this.config.userId);
    
    this.setState({
      status: 'game_ended',
      isMyTurn: false,
      canMove: false,
    });
  }
  
  setRoomName(name: string): void {
    if (!this.roomIdRef) return;
    
    socketService.setRoomName(this.roomIdRef, name);
    
    // Optimistically update local state (will be confirmed by room_name_updated event)
    this.setState({
      room: this.state.room ? {
        ...this.state.room,
        name,
      } : null,
    });
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // STATE MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────
  
  getState(): MultiplayerState<TGameState> {
    return this.state;
  }
  
  private setState(partial: Partial<MultiplayerState<TGameState>>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }
  
  subscribe(listener: (state: MultiplayerState<TGameState>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────────────────────────────────
  
  private isMyTurnCheck(currentTurn: PlayerColor | number): boolean {
    // For position-based games (4+ players)
    if (typeof currentTurn === 'number' && this.myPositionRef !== null) {
      return currentTurn === this.myPositionRef;
    }
    
    // For color-based games (2 players)
    if (typeof currentTurn === 'string' && this.myColorRef !== null) {
      return currentTurn === this.myColorRef;
    }
    
    return false;
  }
  
  // ───────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ───────────────────────────────────────────────────────────────────────────
  
  destroy(): void {
    this.cleanupEventHandlers();
    this.listeners.clear();
    this.disconnect();
  }
}
