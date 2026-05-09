import { Platform } from 'react-native';
import Sound from 'react-native-sound';

// Allow playback in iOS silent mode and mix with other audio.
Sound.setCategory('Ambient', true);

// react-native-sound resolves filenames differently per platform:
//   iOS  → look up `piece_move.wav` in main bundle (Resources build phase).
//   Android → with MAIN_BUNDLE the lib loads from res/raw if no slash, or
//             from the assets folder when the filename contains a slash.
//             react-native-asset placed our wav at assets/custom/piece_move.wav.
const FILENAME = Platform.OS === 'android' ? 'custom/piece_move.wav' : 'piece_move.wav';

let cached: Sound | null = null;
let loadFailed = false;

const ensureLoaded = (cb: (snd: Sound | null) => void) => {
  if (loadFailed) return cb(null);
  if (cached && cached.isLoaded()) return cb(cached);
  const snd = new Sound(FILENAME, Sound.MAIN_BUNDLE, err => {
    if (err) {
      console.warn('[nardiSound] failed to load piece_move.wav:', err);
      loadFailed = true;
      cb(null);
      return;
    }
    cached = snd;
    cb(snd);
  });
};

// Pre-warm so the first move plays without delay.
ensureLoaded(() => {});

export const playPieceMoveSound = () => {
  ensureLoaded(snd => {
    if (!snd) return;
    // Restart from beginning on each play so rapid AI moves still trigger.
    snd.stop(() => {
      snd.play(success => {
        if (!success) console.warn('[nardiSound] playback failed');
      });
    });
  });
};
