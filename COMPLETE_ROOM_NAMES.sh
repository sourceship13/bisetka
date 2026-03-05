#!/bin/bash

# Quick implementation script for adding room names to remaining multiplayer screens
# Run this after reviewing changes

echo "🎮 Adding Room Name Editor to Remaining Multiplayer Screens..."

# Screens already done:
# ✅ MultiplayerBlotScreen.tsx
# ✅ MultiplayerChessScreen.tsx
# ✅ PokerRoomScreen.tsx

# Remaining screens to update:
# 4. MultiplayerMrotsiScreen (partial - needs completion)
# 5. MultiplayerBaazarBlotScreen (if exists)
# 6. CheckersScreen (check if multiplayer)
# 7. NardiScreen (check if multiplayer)
# 8. BilliardsGameScreen (check if multiplayer)

echo "✅ Already completed: Blot, Chess, Poker"
echo "⏳ Remaining: Mrotsi, Baazar Blot, Checkers, Nardi, Billiards"
echo ""
echo "📝 Manual steps required for each:"
echo "1. Add import: import RoomNameModal from '../../../components/RoomNameModal';"
echo "2. Add state: const [roomName, setRoomName] = useState('Multiplayer X');"
echo "              const [showRoomNameModal, setShowRoomNameModal] = useState(false);"
echo "3. Add handler: handleSaveRoomName function"
echo "4. Update GameToolbar: title={roomName} + pencil rightElement"
echo "5. Add <RoomNameModal /> before </SafeAreaView>"
echo "6. Add styles: editRoomButton, editRoomIcon"
echo ""
echo "See ROOM_NAME_EDITOR_GUIDE.md for full instructions!"
