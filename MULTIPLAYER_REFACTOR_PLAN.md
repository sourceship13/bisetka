# 🏗️ Multiplayer Architecture Refactor - Enterprise Design

**Goal:** Reduce multiplayer screens from 1000+ lines to ~200 lines with type-safe, reusable architecture

## Current Problems

### Code Bloat (5,519 lines across 5 screens)
- MultiplayerBlotScreen: **1,678 lines** 📊
- PokerRoomScreen: **1,430 lines**
- CheckersScreen: **912 lines**
- ChessScreen: **890 lines**
- MrotsiScreen: **609 lines**

### Duplication in Every Screen
Each screen manually:
1. ✅ Connects to socket (`socketService.connect()`)
2. ✅ Registers 6-10 event listeners (`onGameStarted`, `onMoveMade`, etc.)
3. ✅ Manages state: `mode`, `roomId`, `roomCode`, `myColor`, `isMyTurn`, etc.
4. ✅ Implements matchmaking flow (find match, create room, join room)
5. ✅ Cleans up listeners in `useEffect` cleanup
6. ✅ Uses `useRef` to avoid stale closure bugs
7. ✅ Mixes game logic with socket logic

### Type Safety Issues
- Events typed as `any`
- No compile-time validation
- Easy to break contracts

---

## New Architecture

### 1. **Core Hook: `useMultiplayerGame<TGameState, TMove>`**

**Purpose:** Single hook that handles ALL multiplayer logic

**API:**
```typescript
const {
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
  
  // State
  gameState,        // Type-safe game state
  myPlayer,         // { color, position, id }
  opponent,         // Opponent info
  room,             // { id, code, name }
  status,           // 'disconnected' | 'connecting' | 'matchmaking' | 'waiting' | 'playing' | 'ended'
  
  // Computed
  isMyTurn,
  canMove,
  
  // Events
  onGameEnd,        // Custom game-end callback
  
} = useMultiplayerGame<ChessGameState, ChessMove>({
  gameType: 'chess',
  userId: session.user.id,
  mode: route.params.mode, // 'random' | 'private-create' | 'private-join'
  joinCode: route.params.joinCode,
  
  // Lifecycle hooks
  onGameStart: (data) => {
    // Initialize chess board
    const board = initializeChessGame();
    return board;
  },
  
  onMoveMade: (currentState, moveData) => {
    // Apply move to board
    const newBoard = applyChessMove(currentState, moveData.move);
    return newBoard;
  },
  
  onGameEnd: (result) => {
    // Show winner modal
    showWinnerModal(result);
  },
});
```

**What It Eliminates:**
- ❌ No manual `useEffect` for socket connection
- ❌ No manual event listener registration
- ❌ No `useRef` for stale closures
- ❌ No manual cleanup
- ❌ No state machine management
- ❌ No matchmaking logic

---

### 2. **MultiplayerGameController Class**

**Purpose:** Encapsulates socket lifecycle, state machine, event management

```typescript
class MultiplayerGameController<TGameState, TMove> {
  private socket: SocketService;
  private state: MultiplayerState<TGameState>;
  private listeners: Map<string, Function[]>;
  
  constructor(config: MultiplayerConfig<TGameState, TMove>) {
    this.config = config;
    this.socket = socketService;
    this.setupEventHandlers();
  }
  
  // Lifecycle
  async connect(): Promise<void>
  disconnect(): void
  
  // Matchmaking
  async findMatch(): Promise<MatchData>
  async createPrivateRoom(code?: string): Promise<RoomData>
  async joinPrivateRoom(code: string): Promise<RoomData>
  cancelMatchmaking(): void
  
  // Game Actions
  makeMove(move: TMove): void
  sendReady(): void
  resign(): void
  
  // State Management (uses Zustand or similar)
  getState(): MultiplayerState<TGameState>
  setState(partial: Partial<MultiplayerState<TGameState>>): void
  subscribe(listener: (state) => void): () => void
  
  // Cleanup
  destroy(): void
}
```

---

### 3. **Type-Safe Event System**

**Problem:** Current events use `any`

**Solution:** Typed event contracts

```typescript
// Event types per game
interface ChessEvents {
  game_started: {
    roomId: string;
    myColor: 'white' | 'black';
    opponentId: string;
    gameState: ChessGameState;
  };
  
  move_made: {
    move: ChessMove;
    currentTurn: 'white' | 'black';
    gameState: ChessGameState;
  };
  
  game_ended: {
    winnerId: string;
    result: 'checkmate' | 'resignation' | 'timeout';
  };
}

// Generic event emitter
class TypedEventEmitter<TEvents> {
  on<K extends keyof TEvents>(
    event: K,
    handler: (data: TEvents[K]) => void
  ): void;
  
  off<K extends keyof TEvents>(
    event: K,
    handler?: (data: TEvents[K]) => void
  ): void;
  
  emit<K extends keyof TEvents>(
    event: K,
    data: TEvents[K]
  ): void;
}
```

---

### 4. **State Machine Pattern**

**Current:** Ad-hoc state management with `mode` variable

**New:** Formal state machine

```typescript
type MultiplayerStatus =
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

interface MultiplayerState<TGameState> {
  status: MultiplayerStatus;
  
  // Connection
  socket: {
    connected: boolean;
    userId: string;
  };
  
  // Room
  room: {
    id: string | null;
    code: string | null;
    name: string;
  };
  
  // Players
  myPlayer: {
    id: string;
    color: 'white' | 'black';
    position?: number; // For 4-player games
  };
  
  opponent: {
    id: string | null;
    connected: boolean;
  } | null;
  
  // Game
  gameState: TGameState | null;
  currentTurn: 'white' | 'black' | number;
  
  // Computed
  isMyTurn: boolean;
  canMove: boolean;
  
  // Error
  error: string | null;
}
```

---

### 5. **Generic Game Interface**

**Problem:** Each game has different state/move types

**Solution:** Generic interface with adapters

```typescript
interface GameAdapter<TGameState, TMove> {
  // Initialize game from server data
  initializeGame(serverData: any): TGameState;
  
  // Apply a move to current state
  applyMove(state: TGameState, move: TMove): TGameState;
  
  // Validate if move is legal
  isValidMove(state: TGameState, move: TMove): boolean;
  
  // Determine whose turn it is
  getCurrentTurn(state: TGameState): 'white' | 'black' | number;
  
  // Check if game is over
  isGameOver(state: TGameState): boolean;
  
  // Get winner (if game over)
  getWinner(state: TGameState): string | null;
}

// Example: Chess Adapter
const chessAdapter: GameAdapter<ChessGameState, ChessMove> = {
  initializeGame: (data) => initializeChessGame('medium'),
  applyMove: (state, move) => makeChessMove(state.board, move),
  isValidMove: (state, move) => /* check if legal */,
  getCurrentTurn: (state) => state.currentPlayer,
  isGameOver: (state) => state.isCheckmate || state.isStalemate,
  getWinner: (state) => /* determine winner */,
};
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)
1. ✅ Create `src/multiplayer/types.ts` - All TypeScript types
2. ✅ Create `src/multiplayer/MultiplayerGameController.ts` - Core controller class
3. ✅ Create `src/multiplayer/useMultiplayerGame.ts` - React hook
4. ✅ Create `src/multiplayer/adapters/` - Game-specific adapters
5. ✅ Update SocketService to support typed events

### Phase 2: Refactor Chess (Day 1-2)
1. ✅ Create `ChessGameAdapter`
2. ✅ Refactor `MultiplayerChessScreen` to use `useMultiplayerGame`
3. ✅ Test thoroughly
4. ✅ **Measure:** Lines of code reduction (expect 890 → ~250 lines)

### Phase 3: Refactor Other Games (Day 2-3)
1. ✅ Checkers
2. ✅ Blot (including 4-player teams)
3. ✅ Mrotsi
4. ✅ Poker (special case - 6 players)

### Phase 4: Documentation & Testing (Day 3)
1. ✅ Write developer guide for adding new multiplayer games
2. ✅ Add comprehensive tests
3. ✅ Update TOOLS.md with architecture patterns

---

## Expected Benefits

### Code Reduction
- **Before:** 5,519 lines across 5 screens
- **After:** ~1,500 lines (73% reduction!)
- **Core library:** ~800 lines (reusable)

### Developer Experience
- ✅ Add new multiplayer game in **1 hour** instead of 2 days
- ✅ Type-safe API prevents runtime errors
- ✅ No boilerplate - just implement game logic
- ✅ Consistent patterns across all games

### Maintainability
- ✅ Single source of truth for socket logic
- ✅ Easy to add features (e.g., spectator mode)
- ✅ Testable (controller is pure class)
- ✅ No stale closure bugs

---

## Migration Strategy

### Low-Risk Approach
1. **Build new system alongside old** (no breaking changes)
2. **Migrate Chess first** (simplest game)
3. **If successful**, migrate others one-by-one
4. **Keep old code** until all games migrated
5. **Delete old code** only after full testing

### Rollback Plan
- Git branch: `feature/multiplayer-refactor`
- Each game migration is a separate commit
- Can revert individual games if needed

---

## Success Metrics

- ✅ **70%+ code reduction** in multiplayer screens
- ✅ **Zero regression bugs** after migration
- ✅ **100% type safety** (no `any` types)
- ✅ **Faster feature development** (measure time to add spectator mode)
- ✅ **Developer satisfaction** (Arin's approval!)

---

**Status:** Ready to implement ✅  
**Timeline:** 3 days for complete migration  
**Risk:** Low (non-breaking, can rollback)  
**Impact:** Massive improvement in code quality & maintainability 🚀
