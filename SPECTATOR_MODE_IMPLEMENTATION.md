# Spectator Mode & Waitlist System Implementation

## Overview

This document outlines the implementation of the spectator mode and waitlist system for Bisetka multiplayer games. The system allows unlimited spectators to watch ongoing games and provides a queue mechanism for players wanting to challenge the winner or join the next match.

## Features Implemented

### 1. Database Schema ✅
- **4 Main Tables**: `game_rooms`, `room_participants`, `room_waitlist`, `room_history`
- **2 Views**: `active_rooms`, `room_waitlist_view`
- **3 Triggers**: Auto-update spectator count, waitlist reordering, room archiving
- **Indexes**: Optimized for fast queries on active rooms and waitlist

### 2. Active Rooms Screen ✅
- List of all active multiplayer game rooms
- Shows game type, players, spectator count, waitlist count
- Similar styling to Leaderboard (gradient cards)
- Pull-to-refresh functionality
- Tap to join as spectator or join waitlist

### 3. Waitlist Modal Component ✅
- Reusable modal for all multiplayer games
- Shows queue position and player usernames
- Join/Leave waitlist buttons
- "Challenge Winner" badge for competitive mode
- Smooth slide-up animation

### 4. Home Screen Button ✅
- Prominent "Active Rooms" button
- Pink gradient matching app theme
- Located between Balance/Actions and Games Grid
- Deep link support: `bisetka://active-rooms`

## File Structure

```
bisetka/
├── database/
│   └── spectator_rooms_schema.sql          # Complete database schema
├── src/
│   ├── screens/
│   │   └── Meta/
│   │       ├── ActiveRoomsScreen.tsx       # Room list screen
│   │       └── HomeScreen.tsx              # Updated with button
│   ├── components/
│   │   └── WaitlistModal.tsx               # Reusable waitlist UI
│   └── navigation/
│       └── AppNavigator.tsx                # Added ActiveRooms route
└── SPECTATOR_MODE_IMPLEMENTATION.md        # This file
```

## Database Schema Details

### Table: game_rooms
Stores active multiplayer game rooms.

**Key Fields:**
- `id` (UUID, PK)
- `game_type` (VARCHAR) - 'blot', 'chess', 'poker', etc.
- `room_name` (VARCHAR) - Display name
- `room_code` (VARCHAR, UNIQUE) - Optional join code for private rooms
- `host_user_id` (UUID, FK → users.id)
- `status` (VARCHAR) - 'waiting', 'in_progress', 'finished'
- `current_player1_id` through `current_player4_id` (UUID, FK → users.id)
- `max_players` (INTEGER) - 2 for chess/blot, 6 for poker, etc.
- `spectator_count` (INTEGER) - Auto-updated by trigger
- `allow_spectators` (BOOLEAN) - Default TRUE
- `is_private` (BOOLEAN) - Requires room_code to join

**Indexes:**
- `idx_game_rooms_game_type` - Filter by game
- `idx_game_rooms_status` - Filter by status
- `idx_game_rooms_active` - Active rooms (status != 'finished')

### Table: room_participants
Tracks all users in a room (players, spectators, waitlist).

**Key Fields:**
- `id` (UUID, PK)
- `room_id` (UUID, FK → game_rooms.id)
- `user_id` (UUID, FK → users.id)
- `role` (VARCHAR) - 'player', 'spectator', 'waitlist'
- `player_position` (INTEGER) - 1, 2, 3, 4 (NULL for non-players)
- `joined_at` (TIMESTAMP)
- `left_at` (TIMESTAMP) - NULL while active

**Constraints:**
- Unique(room_id, user_id) - User can only be in room once
- Valid roles: 'player', 'spectator', 'waitlist'

### Table: room_waitlist
Manages the queue of players waiting to play.

**Key Fields:**
- `id` (UUID, PK)
- `room_id` (UUID, FK → game_rooms.id)
- `user_id` (UUID, FK → users.id)
- `queue_position` (INTEGER) - 1 = next to play
- `wants_to_play_winner` (BOOLEAN) - Challenge mode
- `joined_queue_at` (TIMESTAMP)
- `removed_from_queue_at` (TIMESTAMP) - NULL while in queue

**Constraints:**
- Unique(room_id, user_id) - User can only queue once per room
- Unique(room_id, queue_position) - No duplicate positions

**Auto-reordering:**
When a player leaves the queue, all positions after them shift up automatically via trigger.

### Table: room_history
Historical record of all rooms and participants for analytics.

**Key Fields:**
- `id` (UUID, PK)
- `room_id` (UUID) - Not cascading, keeps history
- `user_id` (UUID)
- `role` (VARCHAR)
- `result` (VARCHAR) - 'won', 'lost', 'draw' (NULL for spectators)
- `player_position` (INTEGER)
- `session_start` (TIMESTAMP)
- `session_end` (TIMESTAMP)
- `game_type` (VARCHAR)
- `room_name` (VARCHAR)

### Views

**active_rooms** - Precomputes room stats for fast queries:
```sql
SELECT * FROM active_rooms 
WHERE game_type = 'chess' 
ORDER BY last_activity_at DESC;
```

Returns: room details, player usernames, active counts, waitlist count

**room_waitlist_view** - Shows waitlist with user details:
```sql
SELECT * FROM room_waitlist_view 
WHERE room_id = 'room-uuid' 
ORDER BY queue_position;
```

Returns: queue positions, usernames, join times

## Backend API Endpoints Needed

### 1. Get Active Rooms
```
GET /api/game-rooms/active
Query params: ?game_type=chess (optional filter)
Response: { rooms: GameRoom[] }
```

Uses the `active_rooms` view for efficient querying.

### 2. Get Room Details
```
GET /api/game-rooms/:roomId
Response: { 
  room: GameRoom,
  participants: Participant[],
  waitlist: WaitlistPlayer[]
}
```

### 3. Join Room as Spectator
```
POST /api/game-rooms/:roomId/spectate
Body: { userId: string }
Response: { success: boolean, participantId: string }
```

Inserts into `room_participants` with role='spectator'.

### 4. Join Waitlist
```
POST /api/game-rooms/:roomId/waitlist
Body: { userId: string, wantsToPlayWinner: boolean }
Response: { success: boolean, queuePosition: number }
```

- Gets next queue_position: `MAX(queue_position) + 1`
- Inserts into `room_waitlist`
- Updates `room_participants` with role='waitlist'

### 5. Leave Waitlist
```
DELETE /api/game-rooms/:roomId/waitlist/:userId
Response: { success: boolean }
```

- Sets `removed_from_queue_at = NOW()`
- Trigger auto-reorders remaining players

### 6. Get Waitlist
```
GET /api/game-rooms/:roomId/waitlist
Response: { waitlist: WaitlistPlayer[] }
```

Uses `room_waitlist_view` for formatted data.

### 7. Create Room
```
POST /api/game-rooms
Body: {
  gameType: string,
  roomName: string,
  maxPlayers: number,
  isPrivate: boolean,
  roomCode?: string
}
Response: { room: GameRoom }
```

### 8. Update Room Status
```
PATCH /api/game-rooms/:roomId/status
Body: { status: 'waiting' | 'in_progress' | 'finished' }
Response: { success: boolean }
```

When status changes to 'finished', trigger auto-archives to `room_history`.

## Frontend Integration

### Adding Waitlist to Existing Games

1. **Import the component:**
```typescript
import WaitlistModal from '../../components/WaitlistModal';
```

2. **Add state:**
```typescript
const [showWaitlist, setShowWaitlist] = useState(false);
const [isUserInWaitlist, setIsUserInWaitlist] = useState(false);
```

3. **Add button to GameToolbar:**
```typescript
<GameToolbar
  title="Chess Game"
  onBack={() => navigation.goBack()}
  backgroundColor="transparent"
  rightElement={
    <TouchableOpacity onPress={() => setShowWaitlist(true)}>
      <Text style={styles.waitlistButton}>⏳ Waitlist (3)</Text>
    </TouchableOpacity>
  }
/>
```

4. **Render the modal:**
```typescript
<WaitlistModal
  visible={showWaitlist}
  onClose={() => setShowWaitlist(false)}
  roomId={roomId}
  gameType="chess"
  isUserInWaitlist={isUserInWaitlist}
  onJoinWaitlist={handleJoinWaitlist}
  onLeaveWaitlist={handleLeaveWaitlist}
/>
```

5. **Implement handlers:**
```typescript
const handleJoinWaitlist = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/game-rooms/${roomId}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, wantsToPlayWinner: true }),
    });
    const data = await response.json();
    setIsUserInWaitlist(true);
    BisetkaAlert.success('Success', `You are #${data.queuePosition} in the queue`);
  } catch (error) {
    BisetkaAlert.error('Error', 'Failed to join waitlist');
  }
};

const handleLeaveWaitlist = async () => {
  // Similar implementation for leaving
};
```

### Spectator View Implementation

Create a new component for each game type: `SpectatorView.tsx`

**Key Features:**
- Read-only game state (no player input)
- Real-time updates via WebSocket/polling
- Show player names and current turn
- Display waitlist count
- "Join Waitlist" button prominent

**Example for Chess:**
```typescript
const ChessSpectatorView = ({ route, navigation }) => {
  const { roomId, gameType } = route.params;
  const [gameState, setGameState] = useState(null);
  const [showWaitlist, setShowWaitlist] = useState(false);

  useEffect(() => {
    // Subscribe to game state updates
    const unsubscribe = subscribeToRoom(roomId, (newState) => {
      setGameState(newState);
    });
    return unsubscribe;
  }, [roomId]);

  return (
    <View style={styles.container}>
      <GameToolbar 
        title="Watching: Chess Match"
        rightElement={
          <TouchableOpacity onPress={() => setShowWaitlist(true)}>
            <Text>⏳ Waitlist</Text>
          </TouchableOpacity>
        }
      />
      
      {/* Render chess board in read-only mode */}
      <ChessBoard 
        gameState={gameState}
        isSpectator={true}
      />
      
      <WaitlistModal 
        visible={showWaitlist}
        onClose={() => setShowWaitlist(false)}
        roomId={roomId}
        gameType={gameType}
      />
    </View>
  );
};
```

## Games Supporting Spectator Mode

All multiplayer games **except Slots**:

- ✅ Blot
- ✅ Baazar Blot
- ✅ Chess
- ✅ Checkers
- ✅ Nardi (Backgammon)
- ✅ Mrotsi
- ✅ Poker
- ✅ Billiards (8-Ball & 9-Ball)
- ❌ Slots (single-player only)

## WebSocket Events (for Real-Time Updates)

### Client → Server

```javascript
// Join room as spectator
socket.emit('spectate:join', { roomId, userId });

// Leave room
socket.emit('spectate:leave', { roomId, userId });

// Join waitlist
socket.emit('waitlist:join', { roomId, userId, wantsToPlayWinner });

// Leave waitlist
socket.emit('waitlist:leave', { roomId, userId });
```

### Server → Client

```javascript
// Game state update (all spectators receive)
socket.on('game:update', (gameState) => {
  setGameState(gameState);
});

// Waitlist updated
socket.on('waitlist:update', (waitlist) => {
  setWaitlist(waitlist);
});

// Spectator count changed
socket.on('spectators:count', (count) => {
  setSpectatorCount(count);
});

// Your turn (when promoted from waitlist)
socket.on('waitlist:your-turn', () => {
  BisetkaAlert.alert('Your Turn!', 'You can now join the game');
});
```

## Security Considerations

### 1. Spectator Permissions
- Spectators should NEVER see private game state (e.g., opponent's cards in Blot)
- Backend must filter sensitive data before broadcasting
- Use separate socket rooms for players vs spectators

### 2. Waitlist Manipulation
- Verify user is not already in queue before adding
- Prevent queue position manipulation
- Rate limit waitlist join/leave actions

### 3. Room Access Control
- Check `is_private` flag before allowing spectators
- Validate `room_code` for private rooms
- Prevent spectating if `allow_spectators = FALSE`

### 4. Data Validation
```typescript
// Backend validation example
if (room.is_private && !validRoomCode(roomCode)) {
  throw new Error('Invalid room code');
}

if (!room.allow_spectators) {
  throw new Error('Spectating is disabled for this room');
}

if (room.status === 'finished') {
  throw new Error('This game has already finished');
}
```

## UI/UX Considerations

### 1. Waitlist Display Options

**Option A: Modal (Implemented)**
- ✅ Clean, focused view
- ✅ Shows full player list
- ✅ Easy to dismiss
- ❌ Requires tap to open

**Option B: Dropdown (Alternative)**
```typescript
<Collapsible trigger="⏳ Waitlist (3)">
  <FlatList data={waitlist} renderItem={renderWaitlistItem} />
</Collapsible>
```
- ✅ Always visible when expanded
- ✅ Quick access
- ❌ Takes up game screen space

**Recommendation:** Use Modal for cleaner UI, especially on smaller screens.

### 2. Spectator Indicators

Show spectator count prominently:
```typescript
<View style={styles.spectatorBadge}>
  <Text>👁️ {spectatorCount} watching</Text>
</View>
```

Position: Top-right corner of game screen, semi-transparent overlay

### 3. Waitlist Position Notifications

When player moves up in queue:
```typescript
socket.on('waitlist:position-changed', (newPosition) => {
  if (newPosition === 1) {
    BisetkaAlert.success('You\'re Next!', 'Get ready to play');
  } else {
    BisetkaAlert.alert('Queue Update', `You are now #${newPosition}`);
  }
});
```

### 4. Auto-Join When Ready

When a player's turn arrives:
```typescript
socket.on('waitlist:your-turn', () => {
  BisetkaAlert.alert(
    'Your Turn!',
    'Would you like to join the game now?',
    [
      { text: 'Not Yet', style: 'cancel' },
      { text: 'Join Game', onPress: () => joinAsPlayer() },
    ]
  );
});
```

## Testing Checklist

### Database
- [ ] Can create game room
- [ ] Can add spectators (unlimited)
- [ ] Spectator count updates automatically
- [ ] Waitlist positions are unique
- [ ] Waitlist reorders when someone leaves
- [ ] Room archives to history when finished
- [ ] Views return correct data

### Frontend
- [ ] Active Rooms screen loads and displays rooms
- [ ] Pull-to-refresh updates room list
- [ ] Tapping room shows join options
- [ ] Waitlist modal opens and closes smoothly
- [ ] Join/Leave waitlist buttons work
- [ ] Waitlist displays correct queue positions
- [ ] Deep link `bisetka://active-rooms` works

### Integration
- [ ] Can join as spectator and view game
- [ ] Game state updates in real-time for spectators
- [ ] Waitlist updates when players join/leave
- [ ] Promoted player receives notification
- [ ] Spectator count displays correctly
- [ ] Private rooms require correct code

### Edge Cases
- [ ] Joining waitlist when already in queue (should show error)
- [ ] Spectating finished game (should show read-only replay)
- [ ] Room creator leaves mid-game (host migration?)
- [ ] Network disconnect while spectating (auto-rejoin?)
- [ ] Maximum waitlist size (if needed)

## Migration Guide

### Step 1: Run SQL Schema
```bash
psql -U your_db_user -d bisetka_db -f database/spectator_rooms_schema.sql
```

Verify tables created:
```sql
\dt game_rooms
\dt room_participants
\dt room_waitlist
\dt room_history
```

### Step 2: Update Backend

Add API endpoints (see "Backend API Endpoints Needed" section above).

### Step 3: Update Frontend

1. Add ActiveRoomsScreen (already done)
2. Add WaitlistModal component (already done)
3. Update HomeScreen with button (already done)
4. Update AppNavigator with route (already done)
5. Add spectator views for each game (TODO)
6. Integrate waitlist modal into multiplayer screens (TODO)

### Step 4: Add WebSocket Support

Implement real-time updates for:
- Game state changes
- Waitlist updates
- Spectator count
- Turn notifications

### Step 5: Testing

Run through testing checklist above.

## Future Enhancements

### 1. Room Chat
Add chat for spectators and players within each room.

### 2. Spectator Reactions
Allow spectators to send emoji reactions (👏, 😮, 🔥) visible to all.

### 3. Spectator Betting
Let spectators bet virtual points on match outcomes.

### 4. Room Replays
Save game state snapshots to allow watching finished games.

### 5. Tournament Mode
Create brackets with automatic waitlist to bracket promotion.

### 6. Host Controls
- Kick spectators
- Ban users
- Toggle spectating on/off mid-game
- Set max spectators

### 7. Leaderboard Integration
Track most-spectated games, most active spectators, etc.

## Performance Optimizations

### Database

1. **Index optimization:**
```sql
-- Composite index for common query
CREATE INDEX idx_rooms_status_game_activity 
ON game_rooms(status, game_type, last_activity_at);

-- Partial index for active waitlists
CREATE INDEX idx_waitlist_active_rooms 
ON room_waitlist(room_id, queue_position) 
WHERE removed_from_queue_at IS NULL;
```

2. **Query optimization:**
Use the `active_rooms` view instead of joining tables manually.

3. **Connection pooling:**
Configure backend to use connection pools for frequent queries.

### Frontend

1. **Pagination:**
Load rooms in batches of 20, infinite scroll for more.

2. **Debounce refresh:**
Limit pull-to-refresh to once per 2 seconds.

3. **Memoization:**
```typescript
const roomCards = useMemo(() => 
  rooms.map(room => renderRoomCard(room)),
  [rooms]
);
```

4. **WebSocket throttling:**
Batch state updates, send max once per 100ms.

## Conclusion

This implementation provides a complete spectator mode and waitlist system for Bisetka's multiplayer games. The modular design allows easy integration into existing and future game screens.

**Next Steps:**
1. Run the SQL schema on your database
2. Implement the backend API endpoints
3. Add spectator views for each game type
4. Integrate waitlist modal into multiplayer screens
5. Test thoroughly and deploy!

For questions or issues, refer to the code comments in:
- `database/spectator_rooms_schema.sql`
- `src/screens/Meta/ActiveRoomsScreen.tsx`
- `src/components/WaitlistModal.tsx`
