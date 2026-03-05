# Room Name Editor Implementation Guide

## Overview

This guide shows how to add editable room names to all multiplayer game screens using the GameToolbar with a pencil icon.

## Files Created

1. **`src/components/RoomNameModal.tsx`** - Reusable modal for editing room names
2. **`database/add_room_name_column.sql`** - SQL scripts to add room_name column to all tables

## Implementation Steps

### Step 1: Import Required Components

Add these imports to each multiplayer screen:

```typescript
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
```

### Step 2: Add State for Room Name

Add state variables at the top of your component:

```typescript
const [roomName, setRoomName] = useState('Multiplayer Blot'); // Default name
const [showRoomNameModal, setShowRoomNameModal] = useState(false);
```

### Step 3: Add Save Room Name Handler

```typescript
const handleSaveRoomName = async (newName: string) => {
  try {
    // TODO: Replace with actual API call
    // await fetch(`${API_BASE_URL}/game-sessions/${sessionId}/room-name`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ roomName: newName }),
    // });
    
    setRoomName(newName);
    BisetkaAlert.success('Success', 'Room name updated!');
  } catch (error) {
    console.error('Failed to update room name:', error);
    BisetkaAlert.error('Error', 'Failed to update room name');
  }
};
```

### Step 4: Replace Header with GameToolbar

**Before (example from MultiplayerBlotScreen):**
```typescript
<View style={styles.header}>
  <TouchableOpacity onPress={() => navigation.goBack()}>
    <Text style={styles.backButton}>← Back</Text>
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Multiplayer Blot</Text>
  <View style={{ width: 60 }} />
</View>
```

**After:**
```typescript
<GameToolbar
  title={roomName}
  onBack={() => navigation.goBack()}
  backgroundColor="transparent"
  rightElement={
    <TouchableOpacity 
      onPress={() => setShowRoomNameModal(true)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.editRoomButton}
    >
      <Text style={styles.editRoomIcon}>✏️</Text>
    </TouchableOpacity>
  }
/>
```

### Step 5: Add RoomNameModal Component

Add this before the closing tag of your main container:

```typescript
<RoomNameModal
  visible={showRoomNameModal}
  onClose={() => setShowRoomNameModal(false)}
  currentName={roomName}
  onSave={handleSaveRoomName}
  gameType="Blot" // Change to your game type
/>
```

### Step 6: Add Styles for Edit Button

Add these styles to your StyleSheet:

```typescript
editRoomButton: {
  padding: 8,
  borderRadius: 8,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
},
editRoomIcon: {
  fontSize: 18,
},
```

### Step 7: Load Room Name from Backend (Optional)

If loading an existing session, fetch the room name:

```typescript
useEffect(() => {
  const loadRoomName = async () => {
    try {
      // const response = await fetch(`${API_BASE_URL}/game-sessions/${sessionId}`);
      // const data = await response.json();
      // setRoomName(data.room_name || 'Multiplayer Blot');
    } catch (error) {
      console.error('Failed to load room name:', error);
    }
  };

  if (sessionId) {
    loadRoomName();
  }
}, [sessionId]);
```

## Complete Example: MultiplayerBlotScreen

Here's a complete example showing all changes:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';

const MultiplayerBlotScreen = ({ navigation, route }: any) => {
  // ... existing state ...
  const [roomName, setRoomName] = useState('Multiplayer Blot');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  const handleSaveRoomName = async (newName: string) => {
    try {
      // TODO: API call to save room name
      setRoomName(newName);
      BisetkaAlert.success('Success', 'Room name updated!');
    } catch (error) {
      BisetkaAlert.error('Error', 'Failed to update room name');
    }
  };

  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        {/* NEW: GameToolbar with editable room name */}
        <GameToolbar
          title={roomName}
          onBack={() => navigation.goBack()}
          backgroundColor="transparent"
          rightElement={
            <TouchableOpacity 
              onPress={() => setShowRoomNameModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.editRoomButton}
            >
              <Text style={styles.editRoomIcon}>✏️</Text>
            </TouchableOpacity>
          }
        />

        {/* ... rest of your game UI ... */}

        {/* NEW: Room name edit modal */}
        <RoomNameModal
          visible={showRoomNameModal}
          onClose={() => setShowRoomNameModal(false)}
          currentName={roomName}
          onSave={handleSaveRoomName}
          gameType="Blot"
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  editRoomButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  editRoomIcon: {
    fontSize: 18,
  },
  // ... other styles ...
});

export default MultiplayerBlotScreen;
```

## List of Multiplayer Screens to Update

Update each of these files following the steps above:

1. **Blot**
   - `src/screens/Games/Blot/MultiplayerBlotScreen.tsx`
   - Default: "Multiplayer Blot"

2. **Baazar Blot**
   - `src/screens/MultiplayerBaazarBlotScreen.tsx`
   - Default: "Multiplayer Baazar Blot"

3. **Chess**
   - `src/screens/Games/Chess/MultiplayerChessScreen.tsx`
   - Default: "Multiplayer Chess"

4. **Mrotsi**
   - `src/screens/Games/Mrotsi/MultiplayerMrotsiScreen.tsx`
   - Default: "Multiplayer Mrotsi"

5. **Poker**
   - `src/screens/Games/Poker/PokerRoomScreen.tsx`
   - Default: "Multiplayer Poker"

6. **Checkers** (if has multiplayer)
   - `src/screens/Games/Checkers/CheckersScreen.tsx`
   - Default: "Multiplayer Checkers"

7. **Nardi** (if has multiplayer)
   - `src/screens/Games/Nardi/NardiScreen.tsx`
   - Default: "Multiplayer Nardi"

8. **Billiards** (if has multiplayer)
   - `src/screens/Games/Billards/BilliardsGameScreen.tsx`
   - Default: "Multiplayer Billiards"

## Backend API Endpoint Needed

### Update Room Name

```
PATCH /api/game-sessions/:sessionId/room-name
Body: { roomName: string }
Response: { success: boolean, roomName: string }
```

**Implementation:**
```javascript
app.patch('/api/game-sessions/:sessionId/room-name', async (req, res) => {
  const { sessionId } = req.params;
  const { roomName } = req.body;

  // Validate room name
  if (!roomName || roomName.trim().length === 0) {
    return res.status(400).json({ error: 'Room name cannot be empty' });
  }

  if (roomName.length > 255) {
    return res.status(400).json({ error: 'Room name too long (max 255 characters)' });
  }

  try {
    // Update in database
    await db.query(
      'UPDATE game_sessions SET room_name = $1 WHERE id = $2',
      [roomName.trim(), sessionId]
    );

    // Optionally: Broadcast to other players in the room
    // io.to(sessionId).emit('room:name-updated', { roomName });

    res.json({ success: true, roomName: roomName.trim() });
  } catch (error) {
    console.error('Failed to update room name:', error);
    res.status(500).json({ error: 'Failed to update room name' });
  }
});
```

## Testing Checklist

For each multiplayer screen:

- [ ] GameToolbar appears at the top
- [ ] Room name displays in the center
- [ ] Pencil icon (✏️) appears on the right
- [ ] Tapping pencil opens the modal
- [ ] Modal shows current room name
- [ ] Can edit room name in the modal
- [ ] Character counter shows X/50
- [ ] Save button updates the name
- [ ] Cancel button closes without saving
- [ ] X button closes without saving
- [ ] Empty names are rejected
- [ ] Name updates in the toolbar after saving
- [ ] Name persists after refresh (once backend connected)
- [ ] Name syncs across all players in the room (once sockets connected)

## Optional Enhancements

### 1. WebSocket Sync
Broadcast room name changes to all players:

```typescript
// In handleSaveRoomName
socket.emit('room:update-name', { sessionId, roomName: newName });

// Listen for updates
socket.on('room:name-updated', ({ roomName }) => {
  setRoomName(roomName);
});
```

### 2. Room Name History
Track previous room names for analytics:

```sql
CREATE TABLE room_name_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id),
  old_name VARCHAR(255),
  new_name VARCHAR(255) NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Profanity Filter
Add validation to reject inappropriate names:

```typescript
const isProfane = (text: string): boolean => {
  // Use a profanity filter library
  return false; // Implement your logic
};

if (isProfane(newName)) {
  BisetkaAlert.error('Error', 'Room name contains inappropriate content');
  return;
}
```

### 4. Suggested Names
Offer random suggestions:

```typescript
const SUGGESTED_NAMES = [
  "Champions Arena",
  "Epic Battle Royale",
  "Victory Hall",
  "Masters Tournament",
  "Friendly Match",
  "Quick Game",
];

const suggestRandomName = () => {
  const randomName = SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)];
  setRoomName(randomName);
};

// Add a "🎲 Random" button in the modal
```

### 5. Emoji Picker
Allow emojis in room names:

```typescript
import EmojiSelector from 'react-native-emoji-selector';

// Add emoji picker button in modal
<TouchableOpacity onPress={() => setShowEmojiPicker(true)}>
  <Text>😀</Text>
</TouchableOpacity>
```

## Troubleshooting

### Issue: GameToolbar not found
**Solution:** Make sure you have the component:
```typescript
import GameToolbar from '../../../components/global/GameToolbar';
```

Adjust the path based on your screen location:
- From `Games/Blot/`: `../../../components/global/GameToolbar`
- From root `screens/`: `../../components/global/GameToolbar`

### Issue: RoomNameModal not displaying
**Solution:** Check the modal is outside any scrollable containers and within the SafeAreaView.

### Issue: Name not persisting
**Solution:** Ensure you've:
1. Run the SQL script to add the column
2. Implemented the backend API endpoint
3. Connected the frontend to the API

### Issue: Multiple modals stacking
**Solution:** Only show one modal at a time:
```typescript
const closeAllModals = () => {
  setShowRoomNameModal(false);
  setShowSettingsModal(false);
  setShowWaitlistModal(false);
};
```

## Summary

This implementation adds professional room name editing to all multiplayer games with:
- ✅ Consistent UI across all games
- ✅ Reusable modal component
- ✅ Database support with proper indexing
- ✅ Easy to integrate (5 steps per screen)
- ✅ User-friendly editing experience
- ✅ Validation and error handling

Follow the steps above for each multiplayer screen to maintain consistency across the Bisetka app!
