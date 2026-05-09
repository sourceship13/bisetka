// Old PNG clothing assets have been replaced with the new SVG-based catalog
// from `bisetka/assets/avatars_new/`. This file just re-exports the new data
// so all existing imports of `ALL_CLOTHING_ITEMS` keep working.
import { NEW_CLOTHING_ITEMS, NEW_BASE_AVATARS } from './avatarsNew';
import { AvatarClothing, BaseAvatar } from '../types/avatar2d';

export const ALL_CLOTHING_ITEMS: AvatarClothing[] = NEW_CLOTHING_ITEMS;
export const ALL_BASE_AVATARS: BaseAvatar[] = NEW_BASE_AVATARS;

/**
 * Filter clothing items to those compatible with a given avatar build.
 * - Fat avatars only see items tagged `build === 'fat'`.
 * - Muscle avatars only see items tagged `build === 'muscle'`.
 * - All other avatars (slim/athletic/old/standard/undefined) see only items
 *   that are NOT fat- or muscle-specific.
 */
export function filterClothingForBuild(
  items: AvatarClothing[],
  build: string | undefined | null,
): AvatarClothing[] {
  if (build === 'fat') {
    return items.filter(i => (i as any).build === 'fat');
  }
  if (build === 'muscle') {
    return items.filter(i => (i as any).build === 'muscle');
  }
  return items.filter(i => {
    const b = (i as any).build;
    return b !== 'fat' && b !== 'muscle';
  });
}

/**
 * Filter clothing items to those matching the avatar's gender.
 * Items with no gender or `gender === 'unisex'` are shown to everyone.
 */
export function filterClothingForGender(
  items: AvatarClothing[],
  gender: string | undefined | null,
): AvatarClothing[] {
  if (!gender) return items;
  return items.filter(i => {
    const g = (i as any).gender;
    return !g || g === 'unisex' || g === gender;
  });
}

/** Apply both gender and build filters in one call. */
export function filterClothingForAvatar(
  items: AvatarClothing[],
  gender: string | undefined | null,
  build: string | undefined | null,
): AvatarClothing[] {
  return filterClothingForBuild(filterClothingForGender(items, gender), build);
}

/** Resolve a base avatar's build from its id (returns undefined if not found). */
export function getAvatarBuildById(avatarId: string | null | undefined): string | undefined {
  if (!avatarId) return undefined;
  const a = NEW_BASE_AVATARS.find(x => x.id === avatarId);
  return a ? ((a as any).build as string | undefined) : undefined;
}

/** Resolve a base avatar's gender from its id (returns undefined if not found). */
export function getAvatarGenderById(avatarId: string | null | undefined): string | undefined {
  if (!avatarId) return undefined;
  const a = NEW_BASE_AVATARS.find(x => x.id === avatarId);
  return a ? (a.gender as string | undefined) : undefined;
}
