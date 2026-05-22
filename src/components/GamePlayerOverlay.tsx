/**
 * GamePlayerOverlay — floating HUD for any game screen showing the local
 * player's avatar in one corner and the opponent's avatar (or AI badge) in
 * the opposite corner. Drop into a screen as the FIRST sibling of the game
 * board so it overlays everything but the toolbar.
 *
 * Usage:
 *   <GamePlayerOverlay opponent="ai" />
 *   <GamePlayerOverlay opponent={{ userId, username }} />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PlayerChip from './PlayerChip';

interface OpponentInfo {
  userId: string | null | undefined;
  username: string | null | undefined;
}

interface Props {
  /** 'ai' for single-player, an object for multiplayer, or null while loading. */
  opponent: 'ai' | OpponentInfo | null;
  /** Avatar size in px. */
  size?: number;
  /** Vertical offset from the top (to clear toolbars). */
  topOffset?: number;
  /** Hide the dark backdrop behind each chip (used by 8/9-ball pool). */
  transparentBackground?: boolean;
}

const GamePlayerOverlay: React.FC<Props> = ({
  opponent,
  size = 100,
  topOffset = 150,
  transparentBackground = false,
}) => {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: topOffset }]}
    >
      <View style={styles.left}>
        <PlayerChip mode="self" size={size} transparentBackground={transparentBackground} />
      </View>
      <View style={styles.right}>
        {opponent === 'ai' ? (
          <PlayerChip mode="ai" size={size} transparentBackground={transparentBackground} />
        ) : opponent ? (
          <PlayerChip
            mode="opponent"
            userId={opponent.userId ?? undefined}
            username={opponent.username ?? undefined}
            size={size}
            transparentBackground={transparentBackground}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 100,
    elevation: 100,
  },
  left: {
    alignItems: 'flex-start',
  },
  right: {
    alignItems: 'flex-end',
  },
});

export default GamePlayerOverlay;
