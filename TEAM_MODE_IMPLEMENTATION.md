# Team Mode Implementation Guide for Blot & Baazar Blot

## ✅ Completed

1. **TeamModeSelector Component** - Created at `src/components/TeamModeSelector.tsx`
   - Hybrid mode: 1P+AI vs 1P+AI
   - Full multiplayer: 2P vs 2P

2. **GameModeScreen Updates** - Modified `src/screens/Meta/GameModeScreen.tsx`
   - Shows TeamModeSelector first for Blot/Baazar Blot
   - Passes `teamMode` to multiplayer screens
   - Back button navigation between team selector and game mode selector

---

## 🚧 Remaining Work

### Phase 1: Multiplayer Screen Updates

#### A. MultiplayerBlotScreen.tsx

**Current state:** Supports 2-player (1v1) gameplay

**Needed changes:**

1. **Add TeamMode Support**
```typescript
type TeamMode = 'hybrid' | 'full-multiplayer' | null;

// In component:
const teamMode = route.params?.teamMode as TeamMode;
```

2. **4-Player Game State**
```typescript
interface TeamGameState {
  // Players: 0 (you), 1 (your partner), 2 (opponent 1), 3 (opponent 2)
  player0Hand: Card[];
  player1Hand: Card[];  // Partner or AI
  player2Hand: Card[];  // Opponent 1
  player3Hand: Card[];  // Opponent 2 or AI
  
  currentPlayer: 0 | 1 | 2 | 3;
  currentTrick: Array<{playerId: number; card: Card}>;
  
  team1Score: number;  // You + Partner
  team2Score: number;  // Opponents
  
  trumpSuit: string | null;
  
  // For hybrid mode
  player1IsAI: boolean;  // Your partner
  player3IsAI: boolean;  // Opponent 2
}
```

3. **Team Display UI**
```tsx
// Replace 2-player scoreboard with team scoreboard
<View style={styles.teamScoreboard}>
  <View style={styles.team}>
    <Text style={styles.teamName}>Team 1 (You + Partner)</Text>
    <View style={styles.teamPlayers}>
      <PlayerAvatar playerId={0} name="You" />
      <PlayerAvatar playerId={1} name={player1Name} isAI={teamMode === 'hybrid'} />
    </View>
    <Text style={styles.teamScore}>{gameState.team1Score}</Text>
  </View>
  
  <View style={styles.team}>
    <Text style={styles.teamName}>Team 2 (Opponents)</Text>
    <View style={styles.teamPlayers}>
      <PlayerAvatar playerId={2} name={player2Name} />
      <PlayerAvatar playerId={3} name={player3Name} isAI={teamMode === 'hybrid'} />
    </View>
    <Text style={styles.teamScore}>{gameState.team2Score}</Text>
  </View>
</View>
```

4. **Card Table - 4 Player Positions**
```tsx
// Extend current table to show 4 positions
const positionStyle: Record<number, object> = {
  0: styles.trickSlotBottom,    // You
  1: styles.trickSlotLeft,      // Your partner (across table)
  2: styles.trickSlotTop,       // Opponent 1
  3: styles.trickSlotRight,     // Opponent 2
};

{currentTrick.cards.map((cardPlay, idx) => (
  <View
    key={idx}
    style={[
      styles.trickSlot,
      positionStyle[cardPlay.playerId],
    ]}
  >
    <Text style={styles.trickPlayerName}>
      {getPlayerName(cardPlay.playerId)}
    </Text>
    <DynamicCard card={cardPlay.card} />
  </View>
))}
```

5. **AI Partner Logic (Hybrid Mode)**
```typescript
useEffect(() => {
  if (teamMode !== 'hybrid') return;
  if (!gameState || gameState.currentPlayer !== 1) return; // Player 1 is AI partner
  
  // AI partner plays automatically
  const timer = setTimeout(() => {
    const aiCard = chooseAICard(
      gameState.player1Hand,
      gameState.currentTrick,
      gameState.trumpSuit
    );
    handlePlayCard(aiCard, 1); // Play as player 1
  }, 1500);
  
  return () => clearTimeout(timer);
}, [gameState?.currentPlayer, teamMode]);
```

6. **Matchmaking/Room Logic**
```typescript
// For hybrid mode: 2 human players needed
// For full-multiplayer: 4 human players needed

const createTeamMatch = async () => {
  if (teamMode === 'hybrid') {
    // Create 2-player room (each gets AI partner)
    return socketService.createTeamMatch('blot', userId, 'hybrid');
  } else {
    // Create 4-player room
    return socketService.createTeamMatch('blot', userId, 'full-multiplayer');
  }
};
```

---

### Phase 2: Backend/Socket Updates

**File:** `src/services/SocketService.ts`

1. **Add Team Match Events**
```typescript
// Emit
createTeamMatch(gameType: string, userId: string, teamMode: 'hybrid' | 'full-multiplayer')
joinTeamMatch(roomId: string, userId: string)
teamPlayerReady(roomId: string, userId: string)

// Listen
onTeamGameStarted(callback: (data: TeamGameStartedData) => void)
onTeamMoveMade(callback: (data: TeamMoveMadeData) => void)
```

2. **Team Game Started Data**
```typescript
interface TeamGameStartedData {
  roomId: string;
  teamMode: 'hybrid' | 'full-multiplayer';
  players: Array<{
    id: string;
    name: string;
    teamId: 1 | 2;
    isAI: boolean;
    position: 0 | 1 | 2 | 3;  // Table position
  }>;
  gameState: TeamGameState;
  yourPlayerId: number;  // 0-3
}
```

---

### Phase 3: Backend Server Updates (Node.js)

**Needed on backend:**

1. **Team Room Management**
   - 2-player rooms for hybrid mode
   - 4-player rooms for full multiplayer
   - AI player slots for hybrid mode

2. **Team Matchmaking**
   - Match 2 players for hybrid
   - Match 4 players for full multiplayer
   - Track team assignments

3. **Game Logic**
   - 4-player trick-taking
   - Team scoring (partners combine scores)
   - AI decision making for hybrid mode

---

## 📋 Testing Checklist

### Hybrid Mode (1P+AI vs 1P+AI)
- [ ] Two players can create/join a team match
- [ ] Each player sees their AI partner
- [ ] AI partners play cards automatically
- [ ] Team scores combine correctly
- [ ] All 4 players' cards visible on table
- [ ] Trick winner calculated correctly for 4 players

### Full Multiplayer (2P vs 2P)
- [ ] Four players can create/join a team match
- [ ] Team assignments clear (Team 1: P0+P1, Team 2: P2+P3)
- [ ] Turn order works correctly (clockwise)
- [ ] All 4 human players can play cards
- [ ] Team coordination visible
- [ ] Trick winner calculated correctly

---

## 🎨 UI Enhancements

### Suggested Additions:

1. **Team Chat**
   - Private chat between team members
   - Strategy coordination

2. **Player Indicators**
   - Crown icon for human players
   - Robot icon for AI players
   - Team color coding (blue vs red)

3. **Turn Indicator**
   - Highlight current player's position
   - Show whose turn it is clearly

4. **Score History**
   - Show last trick winner
   - Running score per round
   - Team performance stats

---

## 🔧 Code Structure

### Recommended File Organization:

```
src/
  components/
    TeamModeSelector.tsx  ✅ Done
    TeamScoreboard.tsx    🚧 To Create
    PlayerAvatar.tsx      🚧 To Create
    
  screens/
    Games/
      Blot/
        MultiplayerBlotScreen.tsx  🚧 To Update
      Baazar Blot/
        MultiplayerBaazarBlotScreen.tsx  🚧 To Update
        
  game/
    blotTeamLogic.ts      🚧 To Create
    - 4-player trick taking
    - Team scoring
    - AI partner logic
    
  services/
    SocketService.ts      🚧 To Update
    - Team match events
```

---

## 🚀 Implementation Order

### Recommended sequence:

1. ✅ **GameModeScreen + TeamModeSelector** (DONE)

2. **Frontend - Display Only**
   - Update MultiplayerBlotScreen to show 4-player UI
   - Mock data for testing
   - Test with dummy 4-player game state

3. **Game Logic**
   - Create blotTeamLogic.ts
   - 4-player trick taking rules
   - Team scoring
   - AI partner decision making

4. **Socket Integration**
   - Update SocketService
   - Add team match events
   - Test with backend

5. **Backend**
   - Team room management
   - Matchmaking for 2/4 players
   - AI player integration

6. **Testing & Polish**
   - End-to-end testing
   - UI polish
   - Error handling
   - Edge cases

---

## 💡 Quick Start

To test the team mode selector immediately:

1. Navigate to Blot or Baazar Blot from game selection
2. You'll see the team mode screen
3. Select a mode (Hybrid or Full Multiplayer)
4. Then proceed to normal game mode selection (Random/AI/Private)

**Current behavior:** Team mode is selected and passed to multiplayer screen, but multiplayer screen doesn't handle it yet (still 1v1).

**Next step:** Update MultiplayerBlotScreen.tsx to handle `teamMode` parameter and display 4-player UI.
