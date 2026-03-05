# Multiplayer Refactor Pattern

This document explains how to refactor the remaining game screens using the `useMultiplayerGame` hook.

## ✅ COMPLETED
- Checkers: `CheckersScreen.REFACTORED.tsx`
- Mrotsi: `MultiplayerMrotsiScreen.REFACTORED.tsx`

## 🚧 TODO
Create .REFACTORED.tsx versions for:
1. Nardi
2. Blot  
3. Poker
4. Billiards

## Pattern to Follow

### Before (Old Socket Boilerplate)
```typescript
// Many lines of socket setup
useEffect(() => {
  socketService.connect(userId, token);
  socketService.onGameStarted((data) => { /* ... */ });
  socketService.onMoveMade((data) => { /* ... */ });
  socketService.onGameEnded((data) => { /* ... */ });
  socketService.onOpponentDisconnected(() => { /* ... */ });
  return () => {
    socketService.removeAllListeners();
    socketService.disconnect();
  };
}, []);

// Making moves
socketService.makeMove(roomId, userId, move);
```

### After (Clean Hook-Based)
```typescript
// ═══ Single import ═══
import { useMultiplayerGame, useMatchmakingUI, gameAdapter } from '../../../multiplayer';

// ═══ One hook call ═══
const mpHook = useMultiplayerGame<GameState, Move>({
  gameType: 'nardi', // or 'blot', 'poker', 'billiards'
  userId,
  mode: isMultiplayer ? (mode === 'random' ? 'random' : ...) : 'random',
  joinCode,
  adapter: nardiAdapter, // or blotAdapter, pokerAdapter, billiardsAdapter
  autoConnect: isMultiplayer,
  autoStart: isMultiplayer,
  
  onGameStart: (data) => {
    // Initialize game state
  },
  
  onMoveMade: (data) => {
    // Update game state
  },
  
  onGameEnd: (result) => {
    // Show winner
  },
  
  onOpponentDisconnected: () => {
    // Handle disconnect
  },
});

const { showMatchmaking, showWaitingRoom, showGame } = useMatchmakingUI(mpHook.status);

// Making moves
mpHook.makeMove(move);
```

## Key Points

1. **Keep ALL game logic** - Only replace socket code
2. **Use same adapters** - Already exist in `src/multiplayer/adapters/`
3. **Preserve AI mode** - Hook only activates when `isMultiplayer = true`
4. **Keep all UI** - Animations, chat, room names, etc.
5. **Import from** `../../../multiplayer` (relative path, not absolute)

## Adapter Mapping
- Nardi → `nardiAdapter` from `NardiGameAdapter.ts`
- Blot → `blotAdapter` from `BlotGameAdapter.ts`
- Poker → `pokerAdapter` from `PokerGameAdapter.ts`
- Billiards → `billiardsAdapter` from `BilliardsGameAdapter.ts`

## Testing Checklist
After refactoring each screen:
- [ ] AI mode still works
- [ ] Multiplayer matchmaking works
- [ ] Private rooms work  
- [ ] Game logic intact (no broken moves)
- [ ] Chat shows in multiplayer
- [ ] Room name editing works
- [ ] Git stage the file: `git add <file>`
