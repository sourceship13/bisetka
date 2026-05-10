import { Platform } from 'react-native';
import Sound from 'react-native-sound';

// Allow playback in iOS silent mode and mix with other audio.
Sound.setCategory('Ambient', true);

// react-native-sound resolves filenames differently per platform:
//   iOS  → look up the file in main bundle (Resources build phase).
//   Android → with MAIN_BUNDLE the lib loads from res/raw if no slash, or
//             from the assets folder when the filename contains a slash.
//   piece_move.wav → react-native-asset placed it under
//                    android/app/src/main/assets/custom/ (slash form).
//   dice_roll.mp3 → was copied to android/app/src/main/res/raw/ (no slash).
const PIECE_MOVE_FILE =
  Platform.OS === 'android' ? 'custom/piece_move.wav' : 'piece_move.wav';
const DICE_ROLL_FILE = 'dice_roll.mp3';
const CARD_FLIP_FILE = 'card_flip.mp3';
const CARD_RIFFLE_SHUFFLE_FILE = 'card_riffle_shuffle.mp3';

interface CachedSound {
  snd: Sound | null;
  failed: boolean;
}

const cache: Record<string, CachedSound> = {};

const ensureLoaded = (
  filename: string,
  cb: (snd: Sound | null) => void,
) => {
  let entry = cache[filename];
  if (entry?.failed) return cb(null);
  if (entry?.snd && entry.snd.isLoaded()) return cb(entry.snd);
  const snd = new Sound(filename, Sound.MAIN_BUNDLE, err => {
    if (err) {
      console.warn(`[nardiSound] failed to load ${filename}:`, err);
      cache[filename] = { snd: null, failed: true };
      cb(null);
      return;
    }
    cache[filename] = { snd, failed: false };
    cb(snd);
  });
};

// Pre-warm both sounds so the first play has no delay.
ensureLoaded(PIECE_MOVE_FILE, () => {});
ensureLoaded(DICE_ROLL_FILE, () => {});
ensureLoaded(CARD_FLIP_FILE, () => {});
ensureLoaded(CARD_RIFFLE_SHUFFLE_FILE, () => {});

const playOnce = (filename: string) => {
  ensureLoaded(filename, snd => {
    if (!snd) return;
    // Restart from beginning so rapid plays still trigger.
    snd.stop(() => {
      snd.play(success => {
        if (!success) console.warn(`[nardiSound] playback failed for ${filename}`);
      });
    });
  });
};

export const playPieceMoveSound = () => playOnce(PIECE_MOVE_FILE);
export const playDiceRollSound = () => playOnce(DICE_ROLL_FILE);
export const playCardFlipSound = () => playOnce(CARD_FLIP_FILE);
export const playCardRiffleShuffleSound = () => playOnce(CARD_RIFFLE_SHUFFLE_FILE);
