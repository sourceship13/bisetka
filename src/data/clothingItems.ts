// Old PNG clothing assets have been replaced with the new SVG-based catalog
// from `bisetka/assets/avatars_new/`. This file just re-exports the new data
// so all existing imports of `ALL_CLOTHING_ITEMS` keep working.
import { NEW_CLOTHING_ITEMS, NEW_BASE_AVATARS } from './avatarsNew';
import { AvatarClothing, BaseAvatar } from '../types/avatar2d';

// Items whose embedded SVG references a high-end brand (Balenciaga, Alo Yoga,
// Louis Vuitton, Supreme). These are promoted to "legendary" rarity regardless
// of what the auto-generated catalog assigned.
const LEGENDARY_BRAND_ITEM_IDS = new Set<string>([
  // Jackets
  'jackets-female-fat-jacket-style-8',
  'jackets-female-fat-jacket-style-9',
  'jackets-female-jacket-style-8',
  'jackets-female-jacket-style-9',
  'jackets-female-muscle-jacket-style-8',
  'jackets-female-muscle-jacket-style-9',
  'jackets-jacket-style-8',
  'jackets-fat-jacket-style-8',
  'jackets-muscle-jacket-style-8',
  // Pants
  'pants-female-fat-pants-style-7',
  'pants-female-fat-pants-style-9',
  'pants-female-muscle-pants-style-7',
  'pants-female-muscle-pants-style-9',
  'pants-female-pants-style-7',
  'pants-female-pants-style-9',
  'pants-fat-pants-style-7',
  'pants-fat-pants-style-9',
  'pants-male-pants-style-7',
  'pants-male-pants-style-9',
  'pants-muscle-pants-style-7',
  'pants-muscle-pants-style-9',
  // Shirts
  'shirts-female-fat-shirt-style-10',
  'shirts-female-fat-shirt-style-7',
  'shirts-female-muscle-shirt-style-10',
  'shirts-female-muscle-shirt-style-7',
  'shirts-female-shirt-style-10',
  'shirts-female-shirt-style-7',
  'shirts-fat-shirt-style-10',
  'shirts-fat-shirt-style-8',
  'shirts-muscle-shirt-style-10',
  'shirts-muscle-shirt-style-8',
  'shirts-shirt-style-10',
  'shirts-shirt-style-8',
  // Shorts
  'shorts-female-fat-shorts-style-8',
  'shorts-female-fat-shorts-style-9',
  'shorts-female-muscle-shorts-style-8',
  'shorts-female-muscle-shorts-style-9',
  'shorts-female-shorts-style-8',
  'shorts-female-shorts-style-9',
  'shorts-fat-shorts-style-7',
  'shorts-fat-shorts-style-9',
  'shorts-male-short-style-8',
  'shorts-male-short-style-9',
  'shorts-muscle-shorts-style-7',
  'shorts-muscle-shorts-style-9',
]);

// Fixed retail price (in cents) per rarity tier. Free defaults stay free.
const RARITY_PRICE_CENTS: Record<string, number> = {
  common: 199,
  rare: 399,
  epic: 599,
  legendary: 1099,
};

export const ALL_CLOTHING_ITEMS: AvatarClothing[] = NEW_CLOTHING_ITEMS.map(i => {
  const isLegendary =
    LEGENDARY_BRAND_ITEM_IDS.has(i.id) || i.id.endsWith('-style-10');
  const rarity = isLegendary ? 'legendary' : (i.rarity as string);
  // Preserve free items (price 0 == starter/default), reprice everything else.
  const price =
    i.price === 0 ? 0 : (RARITY_PRICE_CENTS[rarity] ?? i.price);
  return { ...i, rarity: rarity as any, price };
});
export const ALL_BASE_AVATARS: BaseAvatar[] = NEW_BASE_AVATARS;

/**
 * Item types whose shape is body-agnostic (hair, shoes, hats, jewelry,
 * misc accessories). These don't need to be tagged per-build — a single
 * "standard" version works for every avatar build.
 */
const BODY_AGNOSTIC_TYPES = new Set(['hair', 'shoes', 'hat', 'jewelry', 'other']);

/**
 * Filter clothing items to those compatible with a given avatar build.
 * - Body-shaped items (top/bottom/jacket/shorts) must match the build tag.
 * - Body-agnostic items (hair/shoes/hat/jewelry/other) are shown regardless,
 *   as long as they aren't explicitly tagged for a different build.
 */
export function filterClothingForBuild(
  items: AvatarClothing[],
  build: string | undefined | null,
): AvatarClothing[] {
  const matchesBuild = (i: AvatarClothing): boolean => {
    const b = (i as any).build;
    const t = (i as any).type;
    // Body-agnostic items: allow if not tagged for a *different* specialty build.
    if (BODY_AGNOSTIC_TYPES.has(t)) {
      if (b === 'fat' || b === 'muscle') return b === build;
      return true;
    }
    // Body-shaped items: enforce build match.
    if (build === 'fat') return b === 'fat';
    if (build === 'muscle') return b === 'muscle';
    return b !== 'fat' && b !== 'muscle';
  };
  return items.filter(matchesBuild);
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

/** Starter shoes (one per gender — no build variants exist). */
export const STARTER_SHOE_IDS: ReadonlySet<string> = new Set([
  'shoes-shoe-style-1',          // male
  'shoes-female-shoe-style-1',   // female
]);

/** Resolve the starter shoe id for the given avatar gender. */
export function getStarterShoeIdForAvatar(
  gender: string | undefined | null,
): string {
  return gender === 'female'
    ? 'shoes-female-shoe-style-1'
    : 'shoes-shoe-style-1';
}

/** Set of all starter item ids (shirts + pants + hair + shoes), useful for store filtering. */
export const STARTER_ITEM_IDS: ReadonlySet<string> = new Set([
  ...STARTER_SHIRT_IDS,
  ...STARTER_PANTS_IDS,
  'hairstyle-male-hairstyle-5',
  'hairstyle-female-hair-style-5',
  ...STARTER_SHOE_IDS,
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

/**
 * Given a clothing item id, find the equivalent variant cut for a different
 * gender / build. Used when the user switches avatars so the body-shaped
 * clothes they're wearing (shirts / pants / jackets / shorts) automatically
 * swap to the version drawn for the new body.
 *
 * Item id convention in `avatarsNew.ts`:
 *   <category>-[<gender>?-][<build>?-]<kind>-style-<N>
 * Examples:
 *   shirts-shirt-style-5                 → male / standard
 *   shirts-female-shirt-style-5          → female / standard
 *   shirts-muscle-shirt-style-5          → male  / muscle
 *   shirts-female-fat-shirt-style-5      → female / fat
 *
 * The function extracts `<category>` and the trailing `style-<N>` from the
 * source id, then scans the catalog for the item with the same type whose
 * gender + build match the target. If no exact match exists, the original
 * item is returned unchanged.
 */
export function getEquivalentItemForBuild(
  itemId: string,
  gender: string | undefined | null,
  build: string | undefined | null,
): AvatarClothing | undefined {
  const source = NEW_CLOTHING_ITEMS.find(i => i.id === itemId);
  if (!source) return undefined;
  const sourceBuild = (source as any).build as string | undefined;
  const sourceGender = (source as any).gender as string | undefined;
  // Body-agnostic types don't have per-build cuts, so just return the source.
  if ((source as any).type && BODY_AGNOSTIC_TYPES.has((source as any).type)) {
    return source;
  }
  const targetGender = gender === 'female' ? 'female' : 'male';
  const targetBuild =
    build === 'muscle' ? 'muscle' : build === 'fat' ? 'fat' : 'standard';
  // Already correct.
  if (sourceGender === targetGender && (sourceBuild ?? 'standard') === targetBuild) {
    return source;
  }
  const styleMatch = itemId.match(/-style-(\d+)$/);
  if (!styleMatch) return source;
  const styleSuffix = `style-${styleMatch[1]}`;
  const sourceType = (source as any).type;
  const candidate = NEW_CLOTHING_ITEMS.find(i => {
    if ((i as any).type !== sourceType) return false;
    const g = (i as any).gender;
    const b = ((i as any).build as string | undefined) ?? 'standard';
    if (g !== targetGender) return false;
    if (b !== targetBuild) return false;
    return i.id.endsWith(`-${styleSuffix}`);
  });
  return candidate ?? source;
}

/**
 * Remap an entire `equipped` map to a new avatar's gender/build by swapping
 * every body-shaped item to its matching build variant. Body-agnostic items
 * (hair / shoes / hat / jewelry / other) are left in place.
 */
export function remapEquippedForAvatar(
  equipped: Record<string, AvatarClothing>,
  gender: string | undefined | null,
  build: string | undefined | null,
): Record<string, AvatarClothing> {
  const targetGender = gender === 'female' ? 'female' : 'male';
  const targetBuild =
    build === 'muscle' ? 'muscle' : build === 'fat' ? 'fat' : 'standard';
  const next: Record<string, AvatarClothing> = {};
  for (const slot of Object.keys(equipped)) {
    const item = equipped[slot];
    if (!item) continue;
    if (BODY_AGNOSTIC_TYPES.has(slot)) {
      next[slot] = item;
      continue;
    }
    const swapped = getEquivalentItemForBuild(item.id, gender, build) ?? item;
    // If no build variant of the user's current item exists for the target
    // body, the swap returns the original cut — which would render at the
    // wrong shape. Detect that mismatch and fall back to the slot's starter
    // for this gender+build so the avatar is never left in clothes that
    // don't fit it.
    const sg = (swapped as any).gender as string | undefined;
    const sb = ((swapped as any).build as string | undefined) ?? 'standard';
    const fits = sg === targetGender && sb === targetBuild;
    if (fits) {
      next[slot] = swapped;
      continue;
    }
    let starterId: string | null = null;
    if (slot === 'top') starterId = getStarterShirtIdForAvatar(targetGender, targetBuild);
    else if (slot === 'bottom') starterId = getStarterPantsIdForAvatar(targetGender, targetBuild);
    if (starterId) {
      const starter = ALL_CLOTHING_ITEMS.find(i => i.id === starterId);
      if (starter) {
        next[slot] = starter;
        continue;
      }
    }
    next[slot] = swapped;
  }
  return next;
}
