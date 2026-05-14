/**
 * avatarSync.ts
 *
 * Pushes the locally-stored avatar selection (base body + equipped clothing
 * + gender) up to the backend so the backend can serve it to opponents who
 * need to render this user's avatar in-game.
 *
 * Call `syncAvatarToBackend()` after any local change (avatar build save,
 * clothing equip/unequip, gender change). The caller usually emits the
 * `bisetka:avatarUpdated` DeviceEventEmitter event — this module subscribes
 * to that event so most callers don't need to import it directly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import apiService from './api.service';

const SELECTED_AVATAR_KEY = 'selectedAvatarId';
const EQUIPPED_KEY = '@bisetka_equipped_clothing';
const GENDER_KEY = '@bisetka_gender';

let inFlight = false;
let pending = false;

async function readLocalAppearance(): Promise<{
  baseAvatarId: string | null;
  gender: 'male' | 'female' | null;
  equipped: Record<string, string>;
}> {
  const [baseAvatarId, eqStr, genderStr] = await Promise.all([
    AsyncStorage.getItem(SELECTED_AVATAR_KEY),
    AsyncStorage.getItem(EQUIPPED_KEY),
    AsyncStorage.getItem(GENDER_KEY),
  ]);

  const equipped: Record<string, string> = {};
  if (eqStr) {
    try {
      const raw: Record<string, any> = JSON.parse(eqStr);
      for (const [slot, val] of Object.entries(raw)) {
        const id = typeof val === 'string' ? val : val?.id;
        if (typeof id === 'string' && id) equipped[slot] = id;
      }
    } catch {
      // ignore corrupt JSON
    }
  }

  const gender =
    genderStr === 'male' || genderStr === 'female' ? genderStr : null;

  return { baseAvatarId, gender, equipped };
}

export async function syncAvatarToBackend(): Promise<void> {
  if (inFlight) {
    pending = true;
    return;
  }
  inFlight = true;
  try {
    const payload = await readLocalAppearance();
    if (!payload.baseAvatarId && Object.keys(payload.equipped).length === 0) {
      // Nothing meaningful to upload yet (user hasn't built an avatar).
      return;
    }
    await apiService.saveAvatarAppearance(payload);
  } catch (err: any) {
    console.warn('[avatarSync] upload failed:', err?.message ?? err);
  } finally {
    inFlight = false;
    if (pending) {
      pending = false;
      // Re-run with the latest local state.
      syncAvatarToBackend();
    }
  }
}

let subscribed = false;
/**
 * Mount once near the app root (e.g. App.tsx). Subscribes to
 * `bisetka:avatarUpdated` and uploads the current local appearance whenever
 * the user changes their avatar. Also performs an initial sync on mount.
 */
export function startAvatarSync(): () => void {
  if (subscribed) return () => {};
  subscribed = true;
  syncAvatarToBackend();
  const sub = DeviceEventEmitter.addListener('bisetka:avatarUpdated', () => {
    syncAvatarToBackend();
  });
  return () => {
    subscribed = false;
    sub.remove();
  };
}
