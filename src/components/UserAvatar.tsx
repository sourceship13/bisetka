import React, {useCallback, useEffect, useState} from 'react';
import {Image, ImageStyle, StyleProp, View, ViewStyle} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AvatarPreview from './AvatarPreview';
import {ALL_BASE_AVATARS} from '../data/clothingItems';
import type {AvatarClothing, BaseAvatar} from '../types/avatar2d';
import {resolveAvatar} from '../utils/avatars';

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
      const id = await AsyncStorage.getItem(SELECTED_AVATAR_KEY);
      const found = id ? ALL_BASE_AVATARS.find(a => a.id === id) ?? null : null;
      setBaseAvatar(found);
      const eqStr = await AsyncStorage.getItem(EQUIPPED_KEY);
      setEquipped(eqStr ? JSON.parse(eqStr) : {});
      const g = await AsyncStorage.getItem(GENDER_KEY);
      setSavedGender(g === 'male' || g === 'female' ? g : null);
    } catch {
      // Non-fatal — fall through to fallback rendering.
    }
  }, []);

  useEffect(() => {
    load();
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

  return (
    <View style={[{width: size, height: size}, style]}>
      <AvatarPreview baseAvatar={fallbackBase} equipped={{}} size={size} />
    </View>
  );
};

export default UserAvatar;
