import Sound from 'react-native-sound';

// Allow playback regardless of silent switch; on Android maps to STREAM_MUSIC
// (media volume) instead of STREAM_NOTIFICATION (notification volume).
Sound.setCategory('Playback', true);

// react-native-sound resolves filenames differently per platform:
//   iOS  → look up the file in main bundle (Resources build phase).
//   Android → MAIN_BUNDLE strips extension and looks in res/raw/ by resource
//             name. All sound files must be in res/raw/ on Android.
const PIECE_MOVE_FILE = 'piece_move.wav';
const DICE_ROLL_FILE = 'dice_roll.mp3';
const CARD_FLIP_FILE = 'card_flip.mp3';
const CARD_RIFFLE_SHUFFLE_FILE = 'card_riffle_shuffle.mp3';
const YOUR_TURN_FILE = 'your_turn.mp3';
const COIN_DROP_FILE = 'coin_drop.mp3';

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
  // NOTE: deliberately do NOT short-circuit on `failed` — react-native-sound
  // can spuriously fail to load on app cold-start (audio session not yet
  // ready) so we always retry rather than caching the failure forever.
  if (entry?.snd && entry.snd.isLoaded()) return cb(entry.snd);
  const snd = new Sound(filename, Sound.MAIN_BUNDLE, err => {
    if (err) {
      console.warn(`[nardiSound] failed to load ${filename}:`, err);
      cache[filename] = { snd: null, failed: true };
      cb(null);
      return;
    }
    snd.setVolume(1.0);
    cache[filename] = { snd, failed: false };
    cb(snd);
  });
};

// Pre-warm both sounds so the first play has no delay.
ensureLoaded(PIECE_MOVE_FILE, () => {});
ensureLoaded(DICE_ROLL_FILE, () => {});
ensureLoaded(CARD_FLIP_FILE, () => {});
ensureLoaded(CARD_RIFFLE_SHUFFLE_FILE, () => {});
ensureLoaded(YOUR_TURN_FILE, () => {});
ensureLoaded(COIN_DROP_FILE, () => {});

const playOnce = (filename: string) => {
  ensureLoaded(filename, snd => {
    if (!snd) {
      console.warn(`[nardiSound] play skipped — ${filename} not loaded`);
      return;
    }
    snd.setVolume(1.0);
    // Restart from beginning so rapid plays still trigger.
    snd.stop(() => {
      snd.setCurrentTime(0);
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
export const playYourTurnSound = () => playOnce(YOUR_TURN_FILE);
export const playCoinDropSound = () => playOnce(COIN_DROP_FILE);
