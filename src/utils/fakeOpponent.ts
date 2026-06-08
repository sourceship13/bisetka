/**
 * Fake-opponent generator used as a silent fallback when matchmaking times out.
 *
 * Rather than show the user a "matchmaking timeout" error, the matchmaking
 * screen drops them into the AI version of the game with the AI presented as
 * a real-looking player: a randomly-picked username, a random base avatar
 * and a random outfit assembled from the local clothing catalog.
 *
 * The shape returned here is JSON-safe so it can travel through React
 * Navigation route params untouched.
 */
import { ALL_BASE_AVATARS, ALL_CLOTHING_ITEMS } from '../data/clothingItems';

export interface FakeOpponentAppearance {
  baseAvatarId: string;
  gender: 'male' | 'female';
  /** Map of slot -> clothing item id, matching the shape returned by
   *  `apiService.getAvatarAppearance().appearance.equipped`. */
  equipped: Record<string, string>;
}

export interface FakeOpponent {
  /** Synthetic id with a recognisable prefix so callers can detect bots. */
  id: string;
  username: string;
  appearance: FakeOpponentAppearance;
}

const FAKE_USERNAMES = [
  'Aram_K', 'Tigran88', 'GariPro', 'Vahan_M', 'Suren_Lev',
  'Ashot42', 'NarineH', 'Lilit_S', 'AniK', 'KarenZ',
  'AlexBoss', 'MikeyG', 'D4Pro', 'ChessKing7', 'PoolShark',
  'Levon77', 'GrigorR', 'Hayk_M', 'Davit91', 'Anush_T',
  'KingSlayer', 'NightOwl', 'Maverick', 'PhoenixX', 'IronMike',
  'BluePanda', 'RedFox', 'WildAce', 'SilverWolf', 'GoldenEagle',
  'Pro_Player', 'Lucky42', 'EagleEye', 'StealthOne', 'Champ_99',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick one item per "outfit slot" from items matching the chosen gender or unisex. */
function buildRandomOutfit(gender: 'male' | 'female'): Record<string, string> {
  const eligible = ALL_CLOTHING_ITEMS.filter(
    item => !item.gender || item.gender === gender || item.gender === 'unisex',
  );
  const equipped: Record<string, string> = {};
  // Slots we try to fill so the bot looks dressed. Anything missing is fine —
  // AvatarPreview just renders the layers it has.
  const desiredSlots: Array<string> = ['hair', 'top', 'bottom', 'shoes'];
  // Optional flair — only add maybe-half the time so bots don't all look the same.
  const optionalSlots: Array<string> = ['jacket', 'hat', 'jewelry'];

  for (const slot of desiredSlots) {
    const choices = eligible.filter(it => it.type === slot);
    if (choices.length > 0) equipped[slot] = pick(choices).id;
  }
  for (const slot of optionalSlots) {
    if (Math.random() < 0.45) {
      const choices = eligible.filter(it => it.type === slot);
      if (choices.length > 0) equipped[slot] = pick(choices).id;
    }
  }
  return equipped;
}

export function generateFakeOpponent(): FakeOpponent {
  const base = pick(ALL_BASE_AVATARS) ?? ALL_BASE_AVATARS[0];
  const gender: 'male' | 'female' = base?.gender ?? 'male';
  const username = pick(FAKE_USERNAMES);
  // 6 random hex chars keep ids unique without colliding with real userIds
  // (real ones are UUIDs).
  const idSuffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `fakebot-${idSuffix}`,
    username,
    appearance: {
      baseAvatarId: base?.id ?? 'avatar-male-1',
      gender,
      equipped: buildRandomOutfit(gender),
    },
  };
}

export function isFakeOpponentId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('fakebot-');
}
