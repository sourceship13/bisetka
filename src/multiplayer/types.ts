/**
 * Enterprise Multiplayer Type System
 * 
 * Type-safe definitions for all multiplayer games
 * Eliminates `any` types and provides compile-time safety
 */

// ─────────────────────────────────────────────────────────────────────────────
// MULTIPLAYER STATUS STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

export type MultiplayerStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'matchmaking'
  | 'creating_room'
  | 'joining_room'
  | 'waiting_for_opponent'
  | 'waiting_for_ready'
  | 'playing'
  | 'game_ended'
  | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// GAME TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type GameType = 
  | 'chess' 
  | 'checkers' 
  | 'blot' 
  | 'blot-teams' 
  | 'nardi' 
  | 'mrotsi' 
  | 'poker' 
  | 'billiards-8ball'
  | 'billiards-9ball';

export type PlayerColor = 'white' | 'black';

export type MatchmakingMode = 
  | 'random'           // Find random opponent
  | 'private-create'   // Create private room
  | 'private-join';    // Join existing room

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  id: string;
  name?: string;
  color: PlayerColor;
  position?: number;      // For 4+ player games (0-indexed)
  isReady: boolean;
}

export interface OpponentInfo {
  id: string;
  name?: string;
  connected: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomInfo {
  id: string;
  code: string | null;    // 6-character join code for private rooms
  name: string;
  gameType: GameType;
  playerCount: number;
  maxPlayers: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE MULTIPLAYER STATE
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiplayerState<TGameState = any> {
  // Status
  status: MultiplayerStatus;
  error: string | null;
  
  // Connection
  socket: {
    connected: boolean;
    userId: string;
    token: string | null;
  };
  
  // Room
  room: RoomInfo | null;
  
  // Players
  myPlayer: PlayerInfo | null;
  opponent: OpponentInfo | null;
  allPlayers?: PlayerInfo[];  // For 3+ player games
  
  // Game State
  gameState: TGameState | null;
  currentTurn: PlayerColor | number;  // Color for 2P, position for 4+P
  
  // Computed
  isMyTurn: boolean;
  canMove: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EVENTS (Type-Safe)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseGameEvents<TGameState = any, TMove = any> {
  // Matchmaking
  matchmaking_status: {
    status: 'searching' | 'found';
    queuePosition?: number;
  };
  
  match_found: {
    roomId: string;
    color: PlayerColor;
    opponent: {
      id: string;
      name?: string;
    };
  };
  
  // Room Events
  room_created: {
    roomId: string;
    roomCode: string;
  };
  
  room_joined: {
    roomId: string;
    roomCode?: string;
    color: PlayerColor;
    opponent?: {
      id: string;
      name?: string;
    };
  };
  
  opponent_joined: {
    opponent: {
      id: string;
      name?: string;
    };
  };
  
  // Game Events
  game_started: {
    roomId: string;
    gameState: TGameState;
    myColor: PlayerColor;
    myPosition?: number;
    player1Id?: string;
    player2Id?: string;
  };
  
  move_made: {
    move: TMove;
    gameState: TGameState;
    currentTurn: PlayerColor | number;
  };
  
  game_ended: {
    winnerId: string | null;
    result: 'victory' | 'defeat' | 'draw' | 'resignation' | 'timeout';
    finalScore?: any;
  };
  
  // Connection Events
  opponent_disconnected: {
    opponentId: string;
  };
  
  // Room Management
  room_name_updated: {
    roomId: string;
    roomName: string;
  };
  
  // Error
  error: {
    message: string;
    code?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME ADAPTER INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Game-specific logic adapter
 * Each game implements this to integrate with multiplayer system
 */
export interface GameAdapter<TGameState, TMove> {
  /**
   * Initialize game state from server data
   */
  initializeGame(serverData: any): TGameState;
  
  /**
   * Apply a move to the current game state
   */
  applyMove(currentState: TGameState, move: TMove): TGameState;
  
  /**
   * Validate if a move is legal (client-side validation)
   */
  isValidMove?(currentState: TGameState, move: TMove): boolean;
  
  /**
   * Determine whose turn it is
   */
  getCurrentTurn(gameState: TGameState): PlayerColor | number;
  
  /**
   * Check if game is over
   */
  isGameOver(gameState: TGameState): boolean;
  
  /**
   * Get winner (returns player ID or null for draw)
   */
  getWinner?(gameState: TGameState): string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export interface UseMultiplayerGameConfig<TGameState, TMove> {
  // Required
  gameType: GameType;
  userId: string;
  mode: MatchmakingMode;
  adapter: GameAdapter<TGameState, TMove>;
  
  // Optional
  joinCode?: string;
  token?: string;
  
  // Lifecycle Hooks
  onGameStart?: (data: BaseGameEvents<TGameState>['game_started']) => void;
  onMoveMade?: (data: BaseGameEvents<TGameState, TMove>['move_made']) => void;
  onGameEnd?: (data: BaseGameEvents['game_ended']) => void;
  onOpponentDisconnected?: () => void;
  onError?: (error: string) => void;
  
  // Auto-actions
  autoConnect?: boolean;     // Default: true
  autoStart?: boolean;       // Auto-start matchmaking/room based on mode (default: true)
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK RETURN TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface UseMultiplayerGameReturn<TGameState, TMove> {
  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  
  // Matchmaking
  findMatch: () => Promise<void>;
  createPrivateRoom: (desiredCode?: string) => Promise<void>;
  joinPrivateRoom: (code: string) => Promise<void>;
  cancelMatchmaking: () => void;
  
  // Game Actions
  makeMove: (move: TMove) => void;
  sendReady: () => void;
  resign: () => void;
  setRoomName: (name: string) => void;
  
  // State
  state: MultiplayerState<TGameState>;
  gameState: TGameState | null;
  myPlayer: PlayerInfo | null;
  opponent: OpponentInfo | null;
  room: RoomInfo | null;
  status: MultiplayerStatus;
  error: string | null;
  
  // Computed
  isMyTurn: boolean;
  canMove: boolean;
  isPlaying: boolean;
  isWaiting: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE INTERFACE (for refactored SocketService)
// ─────────────────────────────────────────────────────────────────────────────

export interface ISocketService {
  // Connection
  connect(userId: string, token: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  
  // Matchmaking
  findMatch(gameType: GameType, userId: string): Promise<any>;
  cancelMatchmaking(userId: string): void;
  createPrivateRoom(gameType: GameType, userId: string, code?: string): Promise<any>;
  joinPrivateRoom(code: string, userId: string): Promise<any>;
  
  // Game Actions
  makeMove(roomId: string, userId: string, move: any): void;
  playerReady(roomId: string, userId: string): void;
  resign(roomId: string, userId: string): void;
  setRoomName(roomId: string, roomName: string): void;
  
  // Event Listeners (generic)
  on<K extends keyof BaseGameEvents>(
    event: K,
    callback: (data: BaseGameEvents[K]) => void
  ): void;
  
  off<K extends keyof BaseGameEvents>(
    event: K,
    callback?: (data: BaseGameEvents[K]) => void
  ): void;
  
  removeAllListeners(): void;
  
  // Low-level socket access (for custom events like chat)
  getSocket(): any;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AsyncResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export type StateUpdater<T> = (prev: T) => T;
