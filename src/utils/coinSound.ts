import Sound from 'react-native-sound';

// Allow playback in iOS silent mode and mix with other audio.
// (nardiSound.ts also calls setCategory; safe to call again — last write wins.)
Sound.setCategory('Ambient', true);

const FILE = 'coin_drop.mp3';

let cached: Sound | null = null;
let failed = false;

const ensureLoaded = (cb: (snd: Sound | null) => void) => {
  if (failed) return cb(null);
  if (cached && cached.isLoaded()) return cb(cached);
  const snd = new Sound(FILE, Sound.MAIN_BUNDLE, err => {
    if (err) {
      console.warn(`[coinSound] failed to load ${FILE}:`, err);
      failed = true;
      cb(null);
      return;
    }
    cached = snd;
    cb(snd);
  });
};

// Pre-warm so first play has no delay.
ensureLoaded(() => {});

export const playCoinDropSound = () => {
  ensureLoaded(snd => {
    if (!snd) return;
    snd.stop(() => {
      snd.play(success => {
        if (!success) console.warn('[coinSound] playback failed');
      });
    });
  });
};
