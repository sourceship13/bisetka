/**
 * RemoteUserAvatar — renders ANOTHER user's avatar (base + equipped clothing)
 * by fetching their appearance config from the backend and looking up the
 * matching SVG components in the local catalog.
 *
 * Falls back to a same-gender default base if the user has no saved config,
 * and to the first base avatar if even that lookup fails.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import AvatarPreview from './AvatarPreview';
import { ALL_BASE_AVATARS, ALL_CLOTHING_ITEMS } from '../data/clothingItems';
import type { AvatarClothing, BaseAvatar } from '../types/avatar2d';
import apiService from '../services/api.service';

interface Props {
  userId: string;
  size: number;
  /** Optional gender hint when the remote user has no saved appearance. */
  genderHint?: 'male' | 'female' | null;
  style?: StyleProp<ViewStyle>;
}

interface Resolved {
  baseAvatar: BaseAvatar;
  equipped: Record<string, AvatarClothing>;
}

// Module-level cache so we don't refetch the same opponent every frame.
const cache = new Map<
  string,
  { ts: number; data: { baseAvatarId: string | null; gender: 'male' | 'female' | null; equipped: Record<string, string> } }
>();
const CACHE_TTL_MS = 60_000;

async function fetchAppearance(userId: string) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const res = await apiService.getAvatarAppearance(userId);
  const data = {
    baseAvatarId: res.appearance.baseAvatarId ?? null,
    gender: res.appearance.gender ?? null,
    equipped: res.appearance.equipped ?? {},
  };
  cache.set(userId, { ts: Date.now(), data });
  return data;
}

const RemoteUserAvatar: React.FC<Props> = ({ userId, size, genderHint, style }) => {
  const [resolved, setResolved] = useState<Resolved | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchAppearance(userId);
        if (cancelled) return;

        const base =
          (cfg.baseAvatarId
            ? ALL_BASE_AVATARS.find(b => b.id === cfg.baseAvatarId)
            : null) ??
          ALL_BASE_AVATARS.find(
            b => b.gender === (cfg.gender ?? genderHint ?? 'male'),
          ) ??
          ALL_BASE_AVATARS[0];

        const equipped: Record<string, AvatarClothing> = {};
        for (const [slot, id] of Object.entries(cfg.equipped)) {
          const item = ALL_CLOTHING_ITEMS.find(i => i.id === id);
          if (item) equipped[slot] = item;
        }

        setResolved({ baseAvatar: base, equipped });
      } catch {
        if (cancelled) return;
        const base =
          ALL_BASE_AVATARS.find(b => b.gender === (genderHint ?? 'male')) ??
          ALL_BASE_AVATARS[0];
        setResolved({ baseAvatar: base, equipped: {} });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, genderHint]);

  const wrapperStyle = useMemo(
    () => [{ width: size, height: size }, style] as StyleProp<ViewStyle>,
    [size, style],
  );

  if (!resolved) {
    return <View style={wrapperStyle} />;
  }

  return (
    <View style={wrapperStyle}>
      <AvatarPreview
        baseAvatar={resolved.baseAvatar}
        equipped={resolved.equipped}
        size={size}
      />
    </View>
  );
};

export default RemoteUserAvatar;
