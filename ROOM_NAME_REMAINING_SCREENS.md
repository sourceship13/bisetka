# Room Name Editor - Remaining Screens

## ✅ Completed (2/8)
1. **MultiplayerBlotScreen.tsx** - Done!
2. **MultiplayerChessScreen.tsx** - Done!

## ⏳ Remaining (6/8)

Follow these exact steps for each screen:

### 1. MultiplayerBaazarBlotScreen.tsx

**File:** `src/screens/MultiplayerBaazarBlotScreen.tsx`

**Step 1:** Add imports (after existing imports):
```typescript
import RoomNameModal from './components/RoomNameModal';
```

**Step 2:** Add state (after existing state declarations):
```typescript
const [roomName, setRoomName] = useState('Multiplayer Baazar Blot');
const [showRoomNameModal, setShowRoomNameModal] = useState(false);
```

**Step 3:** Add handler (after other handle functions):
```typescript
const handleSaveRoomName = async (newName: string) => {
  try {
    setRoomName(newName);
    if (currentRoom?.roomId) {
      socketService.setRoomName(currentRoom.roomId, newName);
    }
    BisetkaAlert.success('Success', 'Room name updated!');
  } catch (error) {
    console.error('Failed to update room name:', error);
    BisetkaAlert.error('Error', 'Failed to update room name');
  }
};
```

**Step 4:** Update GameToolbar (if exists) or add it:
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

**Step 5:** Add modal (before closing SafeAreaView):
```typescript
<RoomNameModal
  visible={showRoomNameModal}
  onClose={() => setShowRoomNameModal(false)}
  currentName={roomName}
  onSave={handleSaveRoomName}
  gameType="Baazar Blot"
/>
```

**Step 6:** Add styles (before closing }); in StyleSheet):
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

---

### 2. MultiplayerMrotsiScreen.tsx

**File:** `src/screens/Games/Mrotsi/MultiplayerMrotsiScreen.tsx`

**Follow the same 6 steps above**, replacing:
- Room name: `'Multiplayer Mrotsi'`
- gameType: `"Mrotsi"`

---

### 3. PokerRoomScreen.tsx

**File:** `src/screens/Games/Poker/PokerRoomScreen.tsx`

**Follow the same 6 steps**, replacing:
- Room name: `'Multiplayer Poker'`
- gameType: `"Poker"`

---

### 4. CheckersScreen.tsx (if has multiplayer)

**File:** `src/screens/Games/Checkers/CheckersScreen.tsx`

**First check:** Does this screen have multiplayer mode? Look for socket/multiplayer logic.

If YES, follow the same 6 steps:
- Room name: `'Multiplayer Checkers'`
- gameType: `"Checkers"`

If NO (single-player only): Skip this screen.

---

### 5. NardiScreen.tsx (if has multiplayer)

**File:** `src/screens/Games/Nardi/NardiScreen.tsx`

**First check:** Does this screen have multiplayer mode?

If YES, follow the same 6 steps:
- Room name: `'Multiplayer Nardi'`
- gameType: `"Nardi"`

If NO: Skip this screen.

---

### 6. BilliardsGameScreen.tsx (if has multiplayer)

**File:** `src/screens/Games/Billards/BilliardsGameScreen.tsx`

**First check:** Does this screen have multiplayer mode?

If YES, follow the same 6 steps:
- Room name: `'Multiplayer Billiards'`
- gameType: `"Billiards"`

If NO: Skip this screen.

---

## Quick Reference - The 6 Steps

For each multiplayer screen:

1. **Import:** `import RoomNameModal from '../../../components/RoomNameModal';`
2. **State:** `const [roomName, setRoomName] = useState('Multiplayer X');`
   `const [showRoomNameModal, setShowRoomNameModal] = useState(false);`
3. **Handler:** `handleSaveRoomName` function
4. **GameToolbar:** Add `title={roomName}` and `rightElement` with pencil
5. **Modal:** Add `<RoomNameModal ... />` before `</SafeAreaView>`
6. **Styles:** Add `editRoomButton` and `editRoomIcon`

## Testing After Implementation

For each screen:
- [ ] GameToolbar shows room name
- [ ] Pencil icon appears on right
- [ ] Tapping pencil opens modal
- [ ] Can edit room name
- [ ] Save button works
- [ ] Name updates in toolbar

## Files Already Done

✅ `src/screens/Games/Blot/MultiplayerBlotScreen.tsx`
✅ `src/screens/Games/Chess/MultiplayerChessScreen.tsx`
✅ `src/components/RoomNameModal.tsx` (reusable component)

## Complete Implementation Example

See `MultiplayerBlotScreen.tsx` or `MultiplayerChessScreen.tsx` for full working examples.
