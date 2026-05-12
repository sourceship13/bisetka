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

/**
 * Starter shirts every player owns from the moment they sign up. The exact
 * shirt depends on their avatar's gender + build. These items are excluded
 * from the clothing store (you already own them) and always appear in the
 * "My Clothes" section of the Avatar Builder.
 */
export const STARTER_SHIRT_IDS: ReadonlySet<string> = new Set([
  'shirts-shirt-style-5',              // male / standard
  'shirts-muscle-shirt-style-5',       // male / muscle
  'shirts-fat-shirt-style-5',          // male / fat
  'shirts-female-shirt-style-5',       // female / standard
  'shirts-female-muscle-shirt-style-5',// female / muscle
  'shirts-female-fat-shirt-style-5',   // female / fat
]);

/**
 * Resolve the correct starter shirt id for the given avatar gender + build.
 * Anything that isn't `muscle` or `fat` is treated as the standard build.
 */
export function getStarterShirtIdForAvatar(
  gender: string | undefined | null,
  build: string | undefined | null,
): string {
  const g = gender === 'female' ? 'female' : 'male';
  const b = build === 'muscle' ? 'muscle' : build === 'fat' ? 'fat' : 'standard';
  if (g === 'female') {
    if (b === 'muscle') return 'shirts-female-muscle-shirt-style-5';
    if (b === 'fat') return 'shirts-female-fat-shirt-style-5';
    return 'shirts-female-shirt-style-5';
  }
  if (b === 'muscle') return 'shirts-muscle-shirt-style-5';
  if (b === 'fat') return 'shirts-fat-shirt-style-5';
  return 'shirts-shirt-style-5';
}

/**
 * Starter pants every player owns from the moment they sign up. Same idea as
 * the starter shirts above — the exact pants id depends on the avatar's
 * gender + build. Excluded from the store and always present in the wardrobe.
 */
export const STARTER_PANTS_IDS: ReadonlySet<string> = new Set([
  'pants-male-pants-style-5',          // male / standard
  'pants-muscle-pants-style-5',        // male / muscle
  'pants-fat-pants-style-5',           // male / fat
  'pants-female-pants-style-5',        // female / standard
  'pants-female-muscle-pants-style-5', // female / muscle
  'pants-female-fat-pants-style-5',    // female / fat
]);

/**
 * Resolve the correct starter pants id for the given avatar gender + build.
 */
export function getStarterPantsIdForAvatar(
  gender: string | undefined | null,
  build: string | undefined | null,
): string {
  const g = gender === 'female' ? 'female' : 'male';
  const b = build === 'muscle' ? 'muscle' : build === 'fat' ? 'fat' : 'standard';
  if (g === 'female') {
    if (b === 'muscle') return 'pants-female-muscle-pants-style-5';
    if (b === 'fat') return 'pants-female-fat-pants-style-5';
    return 'pants-female-pants-style-5';
  }
  if (b === 'muscle') return 'pants-muscle-pants-style-5';
  if (b === 'fat') return 'pants-fat-pants-style-5';
  return 'pants-male-pants-style-5';
}

/** Set of all starter item ids (shirts + pants + hair), useful for store filtering. */
export const STARTER_ITEM_IDS: ReadonlySet<string> = new Set([
  ...STARTER_SHIRT_IDS,
  ...STARTER_PANTS_IDS,
  'hairstyle-male-hairstyle-5',
  'hairstyle-female-hair-style-5',
]);

/** Starter hairstyles (one per gender — no build variants exist). */
export const STARTER_HAIR_IDS: ReadonlySet<string> = new Set([
  'hairstyle-male-hairstyle-5',
  'hairstyle-female-hair-style-5',
]);

/** Resolve the starter hairstyle id for the given avatar gender. */
export function getStarterHairIdForAvatar(
  gender: string | undefined | null,
): string {
  return gender === 'female'
    ? 'hairstyle-female-hair-style-5'
    : 'hairstyle-male-hairstyle-5';
}
