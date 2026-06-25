/**
 * seedDefaultOutfit.ts
 *
 * Defensive on-boot seeder that guarantees every user is wearing the starter
 * wardrobe (shirt + pants + hair + shoes for their gender/build) the moment
 * the app is launched — including users who signed up before the starter-
 * wardrobe code existed and users whose AsyncStorage was wiped.
 *
 * Strategy:
 *   1. Read the user's selected base avatar.
 *   2. If they have a base avatar but any of the four core slots
 *      (top / bottom / hair / shoes) is empty, fill it with the matching
 *      starter item.
 *   3. Persist back to AsyncStorage and emit `bisetka:avatarUpdated` so
 *      `UserAvatar` reloads and `avatarSync` pushes to the backend.
 *
 * Idempotent — safe to call on every launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import {
  ALL_BASE_AVATARS,
  ALL_CLOTHING_ITEMS,
  getStarterShirtIdForAvatar,
  getStarterPantsIdForAvatar,
  getStarterHairIdForAvatar,
  getStarterShoeIdForAvatar,
  remapEquippedForAvatar,
  STARTER_ITEM_IDS,
} from '../data/clothingItems';

const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const SELECTED_AVATAR_OBJ_KEY = '@bisetka_selected_avatar';
const GENDER_KEY = '@bisetka_gender';
const EQUIPPED_KEY = '@bisetka_equipped_clothing';
const OWNED_KEY = 'ownedClothing';

export async function seedDefaultOutfitIfMissing(): Promise<void> {
  try {
    const [avatarId, eqStr, ownedStr, genderStr] = await Promise.all([
      AsyncStorage.getItem(SELECTED_AVATAR_KEY),
      AsyncStorage.getItem(EQUIPPED_KEY),
      AsyncStorage.getItem(OWNED_KEY),
      AsyncStorage.getItem(GENDER_KEY),
    ]);

    const preferredGender = genderStr === 'female' ? 'female' : 'male';
    let baseAvatar = avatarId
      ? ALL_BASE_AVATARS.find(a => a.id === avatarId)
      : undefined;

    // Legacy / returning users may have no selected avatar id persisted yet.
    // Pick a deterministic default base avatar so we can always seed clothing.
    if (!baseAvatar) {
      baseAvatar =
        ALL_BASE_AVATARS.find(a => a.gender === preferredGender) ??
        ALL_BASE_AVATARS[0];
      if (baseAvatar) {
        await AsyncStorage.multiSet([
          [SELECTED_AVATAR_KEY, baseAvatar.id],
          [SELECTED_AVATAR_OBJ_KEY, JSON.stringify(baseAvatar)],
        ]);
      }
    }

    if (!baseAvatar) return;

    const gender =
      (baseAvatar as any).gender ?? (genderStr === 'female' ? 'female' : 'male');
    const build = (baseAvatar as any).build as string | undefined;

    // Persist gender if missing — avatarSync needs it.
    if (!genderStr && gender) {
      await AsyncStorage.setItem(GENDER_KEY, gender);
    }

    const rawEquipped: Record<string, any> = eqStr ? JSON.parse(eqStr) : {};
    const equipped: Record<string, any> = {};
    // Rehydrate equipped entries by id so stale serialized objects never break
    // remapping/slot logic (SVG component refs do not survive JSON round-trip).
    for (const slot of Object.keys(rawEquipped)) {
      const persisted = rawEquipped[slot];
      const id = typeof persisted === 'string' ? persisted : persisted?.id;
      if (!id) continue;
      const item = ALL_CLOTHING_ITEMS.find(i => i.id === id);
      if (item) equipped[slot] = item;
    }
    const owned: Set<string> = new Set(ownedStr ? JSON.parse(ownedStr) : []);

    let mutated = false;

    // Every player owns the full starter set (both genders, all builds) so
    // switching avatars later never leaves the wardrobe empty.
    for (const sid of STARTER_ITEM_IDS) {
      if (!owned.has(sid)) {
        owned.add(sid);
        mutated = true;
      }
    }

    const wantIds = [
      getStarterShirtIdForAvatar(gender, build),
      getStarterPantsIdForAvatar(gender, build),
      getStarterHairIdForAvatar(gender),
      getStarterShoeIdForAvatar(gender),
    ];

    for (const id of wantIds) {
      const item = ALL_CLOTHING_ITEMS.find(i => i.id === id);
      if (!item) continue;
      const slot = item.type as string;
      if (!equipped[slot]) {
        equipped[slot] = item;
        mutated = true;
      }
      if (!owned.has(item.id)) {
        owned.add(item.id);
        mutated = true;
      }
    }

    // Remap body-shaped equipped items to the current avatar's build so e.g.
    // a player who picked the fat avatar always wears the fat-cut shirt.
    const remapped = remapEquippedForAvatar(equipped, gender, build);
    for (const slot of Object.keys(remapped)) {
      if (remapped[slot]?.id !== equipped[slot]?.id) {
        equipped[slot] = remapped[slot];
        mutated = true;
      }
    }

    if (!mutated) return;

    await AsyncStorage.setItem(EQUIPPED_KEY, JSON.stringify(equipped));
    await AsyncStorage.setItem(OWNED_KEY, JSON.stringify([...owned]));
    DeviceEventEmitter.emit('bisetka:avatarUpdated');
    console.log('[seedDefaultOutfit] starter wardrobe seeded');
  } catch (err) {
    console.warn('[seedDefaultOutfit] failed:', err);
  }
}
