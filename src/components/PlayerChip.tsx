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
}

const PlayerChip: React.FC<Props> = ({
  mode,
  userId,
  username,
  size = 56,
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
          { width: size, height: size, borderRadius: size / 2 },
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
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }

  return (
    <View style={styles.chip}>
      <View
        style={[
          styles.avatarRing,
          { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 },
        ]}
      >
        {avatar}
      </View>
      <View style={styles.labelWrap}>
        <Text style={styles.label} numberOfLines={1}>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.85)',
    overflow: 'hidden',
  },
  labelWrap: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    maxWidth: 110,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
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
