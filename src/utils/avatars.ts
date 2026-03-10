import {ImageSourcePropType} from 'react-native';

export interface AvatarOption {
  key: string;
  label: string;
  source: ImageSourcePropType;
  category: 'men' | 'women';
}

const AVATARS: AvatarOption[] = [
  // Men
  {key: 'man-suit-white', label: 'Suited', source: require('../../assets/avatars/men/white-base/man-suit-white.png'), category: 'men'},
  {key: 'man-bald-white', label: 'Bald', source: require('../../assets/avatars/men/white-base/man-bald-white.png'), category: 'men'},
  {key: 'man-muscle-white', label: 'Muscular', source: require('../../assets/avatars/men/white-base/man-muscle-white.png'), category: 'men'},
  {key: 'man-tattoo-white', label: 'Tattoo', source: require('../../assets/avatars/men/white-base/man-tattoo-white.png'), category: 'men'},
  {key: 'man-older-white', label: 'Older', source: require('../../assets/avatars/men/white-base/man-older-white.png'), category: 'men'},
  {key: 'man-beard-white', label: 'Beard', source: require('../../assets/avatars/men/white-base/man-beard-white.png'), category: 'men'},
  {key: 'man-jacket-white', label: 'Jacket', source: require('../../assets/avatars/men/white-base/man-jacket-white.png'), category: 'men'},
  // Women
  {key: 'woman-base-gray', label: 'Classic', source: require('../../assets/avatars/women/white-base/woman-base-gray.png'), category: 'women'},
  {key: 'woman-short-hair-gray', label: 'Short Hair', source: require('../../assets/avatars/women/white-base/woman-short-hair-gray.png'), category: 'women'},
  {key: 'woman-young-gray', label: 'Young', source: require('../../assets/avatars/women/white-base/woman-young-gray.png'), category: 'women'},
  {key: 'woman-curly-gray', label: 'Curly', source: require('../../assets/avatars/women/white-base/woman-curly-gray.png'), category: 'women'},
  {key: 'woman-casual-gray', label: 'Casual', source: require('../../assets/avatars/women/white-base/woman-casual-gray.png'), category: 'women'},
  {key: 'woman-mature-gray', label: 'Mature', source: require('../../assets/avatars/women/white-base/woman-mature-gray.png'), category: 'women'},
  {key: 'woman-trendy-gray', label: 'Trendy', source: require('../../assets/avatars/women/white-base/woman-trendy-gray.png'), category: 'women'},
  {key: 'woman-glamorous-gray', label: 'Glamorous', source: require('../../assets/avatars/women/white-base/woman-glamorous-gray.png'), category: 'women'},
  {key: 'woman-sporty-gray', label: 'Sporty', source: require('../../assets/avatars/women/white-base/woman-sporty-gray.png'), category: 'women'},
  {key: 'woman-elegant-gray', label: 'Elegant', source: require('../../assets/avatars/women/white-base/woman-elegant-gray.png'), category: 'women'},
  {key: 'woman-tall-gray', label: 'Tall', source: require('../../assets/avatars/women/white-base/woman-tall-gray.png'), category: 'women'},
];

const avatarMap = new Map<string, ImageSourcePropType>();
AVATARS.forEach(a => avatarMap.set(a.key, a.source));

/**
 * Resolve an avatar_url to an ImageSourcePropType.
 * - If it's a known local key (e.g. "man-base-gray"), returns the local require.
 * - If it starts with http, returns {uri: ...}.
 * - Otherwise returns null (caller should show fallback).
 */
export function resolveAvatar(avatarUrl: string | null | undefined): ImageSourcePropType | null {
  if (!avatarUrl) return null;
  const local = avatarMap.get(avatarUrl);
  if (local) return local;
  if (avatarUrl.startsWith('http')) return {uri: avatarUrl};
  return null;
}

export default AVATARS;
