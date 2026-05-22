/**
 * PlayerChip — small in-game HUD badge showing a player's avatar + name.
 *   - mode='self'    → renders local UserAvatar, label "You"
 *   - mode='opponent'→ renders RemoteUserAvatar, label = opponent username
 *   - mode='ai'      → renders a generic robot glyph, label "AI"
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import UserAvatar from './UserAvatar';
import RemoteUserAvatar from './RemoteUserAvatar';

export type PlayerChipMode = 'self' | 'opponent' | 'ai';

interface Props {
  mode: PlayerChipMode;
  /** Required for mode='opponent'. */
  userId?: string | null;
  /** Required for mode='opponent'. */
  username?: string | null;
  /** Avatar pixel size. */
  size?: number;
  /** When true, drops the dark backdrop behind the avatar + name so the chip
   *  reads as a transparent floating avatar (used by 8/9-ball pool HUDs). */
  transparentBackground?: boolean;
}

const PlayerChip: React.FC<Props> = ({
  mode,
  userId,
  username,
  size = 56,
  transparentBackground = false,
}) => {
  let label = 'You';
  let avatar: React.ReactNode = null;

  if (mode === 'self') {
    label = 'You';
    avatar = <UserAvatar size={size} />;
  } else if (mode === 'ai') {
    label = 'AI';
    avatar = (
      <View
        style={[
          styles.robot,
          { width: size, height: size, borderRadius: 12 },
        ]}
      >
        <Text style={[styles.robotGlyph, { fontSize: size * 0.55 }]}>🤖</Text>
      </View>
    );
  } else {
    label = (username && username.trim()) || 'Opponent';
    avatar = userId ? (
      <RemoteUserAvatar userId={userId} size={size} />
    ) : (
      <View
        style={[
          styles.robot,
          { width: size, height: size, borderRadius: 12 },
        ]}
      />
    );
  }

  return (
    <View style={styles.chip}>
      <View
        style={[
          styles.avatarRing,
          { width: size + 8, height: size + 8, borderRadius: 14 },
          transparentBackground && styles.avatarRingTransparent,
        ]}
      >
        {avatar}
      </View>
      <View
        style={[
          styles.labelWrap,
          transparentBackground && styles.labelWrapTransparent,
        ]}
      >
        <Text
          style={[styles.label, transparentBackground && styles.labelOnTransparent]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  avatarRingTransparent: {
    backgroundColor: 'transparent',
  },
  labelWrap: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    maxWidth: 110,
  },
  labelWrapTransparent: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelOnTransparent: {
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  robot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  robotGlyph: {
    color: '#fff',
  },
});

export default PlayerChip;
