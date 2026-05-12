import {ImageSourcePropType} from 'react-native';

export interface AvatarOption {
  key: string;
  label: string;
  source: ImageSourcePropType;
  category: 'men' | 'women';
}

/**
 * The PNG-based avatar set has been retired in favour of the SVG AvatarBuilder
 * pipeline (see `components/AvatarPreview` and `data/clothingItems`). This
 * array is kept empty so legacy `AVATARS[0]` callers fall through gracefully
 * while screens migrate to `<UserAvatar />`.
 */
const AVATARS: AvatarOption[] = [];

/**
 * Resolve an avatar_url to an ImageSourcePropType.
 * - If it starts with http, returns {uri: ...}.
 * - Otherwise returns null (caller should show fallback / use the AvatarBuilder
 *   selection via the `UserAvatar` component).
 */
export function resolveAvatar(
  avatarUrl: string | null | undefined,
): ImageSourcePropType | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return {uri: avatarUrl};
  return null;
}

export default AVATARS;
