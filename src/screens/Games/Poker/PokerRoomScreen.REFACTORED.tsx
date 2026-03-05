/**
 * REFACTORED: Poker Room Screen
 * 
 * **NOTE:** Poker uses custom socket events (poker_*) due to complex requirements:
 * - 6-player waiting rooms
 * - Per-player turn timers
 * - Blind rotations
 * - Private room codes with host-controlled start
 * 
 * This screen KEEPS the direct socket usage for poker-specific events,
 * but follows the refactor pattern where possible for consistency.
 * 
 * A full refactor to useMultiplayerGame would require extending the hook
 * to support poker's unique flow (waiting rooms, turn timers, etc.).
 * 
 * For now, this file serves as documentation that Poker is intentionally
 * excluded from the standard multiplayer hook pattern.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Original Poker screen imports
import PokerRoomScreen from './PokerRoomScreen';

/**
 * Poker uses socketService.onPokerJoined, socketService.onPokerGameStarted, etc.
 * These are fundamentally different from the standard game_started / move_made pattern.
 * 
 * To refactor Poker properly:
 * 1. Extend useMultiplayerGame to support waiting room mode
 * 2. Add turn timer support to MultiplayerGameController
 * 3. Support 6-player game state (not just 2-player white/black)
 * 4. Handle blind posting and dealer button rotation server-side
 * 
 * Until then, Poker continues to use direct socket management.
 */

const PokerRoomScreenRefactored = (props: any) => {
  return <PokerRoomScreen {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#094029',
  },
  notice: {
    padding: 20,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    margin: 20,
  },
  noticeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PokerRoomScreenRefactored;

/**
 * REFACTOR STATUS: DEFERRED
 * 
 * Poker's multiplayer architecture is fundamentally different from other games:
 * - Uses custom event namespace (poker_*)
 * - 6-player lobby system with waiting rooms
 * - Turn timers with auto-fold
 * - Complex state (chips, bets, community cards, pots, side pots)
 * 
 * The current PokerRoomScreen.tsx works well with its custom socket events.
 * Forcing it into the useMultiplayerGame pattern would:
 * 1. Require extensive hook modifications
 * 2. Complicate the clean 2-player white/black pattern
 * 3. Not provide significant benefit (poker logic is already well-structured)
 * 
 * RECOMMENDATION: Keep Poker's custom socket implementation.
 * It's a special case that benefits from dedicated architecture.
 */
