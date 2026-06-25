import React, {useCallback, useEffect, useState} from 'react';
import {DeviceEventEmitter, Image, ImageStyle, StyleProp, View, ViewStyle} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AvatarPreview from './AvatarPreview';
import {
  ALL_BASE_AVATARS,
  ALL_CLOTHING_ITEMS,
  getStarterHairIdForAvatar,
  getStarterPantsIdForAvatar,
  getStarterShirtIdForAvatar,
  getStarterShoeIdForAvatar,
} from '../data/clothingItems';
import type {AvatarClothing, BaseAvatar} from '../types/avatar2d';
import {resolveAvatar} from '../utils/avatars';
import {seedDefaultOutfitIfMissing} from '../utils/seedDefaultOutfit';

const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const EQUIPPED_KEY = '@bisetka_equipped_clothing';
const GENDER_KEY = '@bisetka_gender';

interface UserAvatarProps {
  /** Pixel size (width === height). */
  size: number;
  /** Optional remote/legacy avatar URL fallback when no builder selection exists. */
  avatarUrl?: string | null;
  /**
   * Optional gender hint used to pick a same-gender default avatar when the
   * user hasn't customised one yet. Falls back to a male default if absent.
   */
  genderHint?: 'male' | 'female' | null;
  /** Optional style for the wrapping square. */
  style?: StyleProp<ViewStyle>;
  /** Optional style applied to the fallback Image. */
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Renders the avatar the player picked in the AvatarBuilder screen
 * (SVG base + equipped clothing layers). Falls back to a remote avatar URL
 * if the user hasn't customised an avatar yet.
 *
 * Reloads on screen focus so changes from the builder propagate immediately.
 */
const UserAvatar: React.FC<UserAvatarProps> = ({
  size,
  avatarUrl,
  genderHint,
  style,
  imageStyle,
}) => {
  const [baseAvatar, setBaseAvatar] = useState<BaseAvatar | null>(null);
  const [equipped, setEquipped] = useState<Record<string, AvatarClothing>>({});
  const [savedGender, setSavedGender] = useState<'male' | 'female' | null>(null);

  const load = useCallback(async () => {
    try {
      await seedDefaultOutfitIfMissing();
      const id = await AsyncStorage.getItem(SELECTED_AVATAR_KEY);
      const found = id ? ALL_BASE_AVATARS.find(a => a.id === id) ?? null : null;
      setBaseAvatar(found);
      const eqStr = await AsyncStorage.getItem(EQUIPPED_KEY);
      // SVG components don't survive JSON round-trip, so rehydrate every
      // persisted entry by id from the in-memory catalog before rendering.
      // Accepts both `{slot: AvatarClothing}` and legacy `{slot: itemId}`.
      const raw: Record<string, any> = eqStr ? JSON.parse(eqStr) : {};
      const fresh: Record<string, AvatarClothing> = {};
      for (const slot of Object.keys(raw)) {
        const persisted = raw[slot];
        const id = typeof persisted === 'string' ? persisted : persisted?.id;
        if (!id) continue;
        const item = ALL_CLOTHING_ITEMS.find(i => i.id === id);
        if (item) fresh[slot] = item;
      }
      setEquipped(fresh);
      const g = await AsyncStorage.getItem(GENDER_KEY);
      setSavedGender(g === 'male' || g === 'female' ? g : null);
    } catch {
      // Non-fatal — fall through to fallback rendering.
    }
  }, []);

  useEffect(() => {
    load();
    const sub = DeviceEventEmitter.addListener('bisetka:avatarUpdated', () => {
      load();
    });
    return () => sub.remove();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (baseAvatar) {
    return (
      <View style={[{width: size, height: size}, style]}>
        <AvatarPreview baseAvatar={baseAvatar} equipped={equipped} size={size} />
      </View>
    );
  }

  const fallback = resolveAvatar(avatarUrl);
  if (fallback) {
    return (
      <View style={[{width: size, height: size}, style]}>
        <Image
          source={fallback}
          style={[{width: size, height: size}, imageStyle]}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Last-resort: render a same-gender default so we never show the wrong
  // gender to a returning user. Defaults to male when no hint is available.
  const inferred: 'male' | 'female' =
    genderHint ??
    savedGender ??
    (avatarUrl?.startsWith('woman-') || avatarUrl?.startsWith('avatar-female-')
      ? 'female'
      : avatarUrl?.startsWith('man-') || avatarUrl?.startsWith('avatar-male-')
      ? 'male'
      : 'male');
  const fallbackBase =
    ALL_BASE_AVATARS.find(a => a.gender === inferred) ?? ALL_BASE_AVATARS[0];

  const fallbackGender = (fallbackBase?.gender as 'male' | 'female' | undefined) ?? inferred;
  const fallbackBuild = (fallbackBase as any)?.build as string | undefined;
  const fallbackStarterIds = [
    getStarterShirtIdForAvatar(fallbackGender, fallbackBuild),
    getStarterPantsIdForAvatar(fallbackGender, fallbackBuild),
    getStarterHairIdForAvatar(fallbackGender),
    getStarterShoeIdForAvatar(fallbackGender),
  ];
  const fallbackEquipped: Record<string, AvatarClothing> = {};
  for (const starterId of fallbackStarterIds) {
    const item = ALL_CLOTHING_ITEMS.find(i => i.id === starterId);
    if (item) fallbackEquipped[item.type] = item;
  }

  return (
    <View style={[{width: size, height: size}, style]}>
      <AvatarPreview baseAvatar={fallbackBase} equipped={fallbackEquipped} size={size} />
    </View>
  );
};

export default UserAvatar;
