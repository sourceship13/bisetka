/**
 * Coin-drop SFX.
 *
 * IMPORTANT: this is intentionally NOT routed through the shared `nardiSound`
 * cache. The coin-drop is almost always played right after the app is woken
 * from a push-notification tap, at which point iOS frequently invalidates
 * the previously-cached `Sound` instance (the AVAudioSession was deactivated
 * while we were backgrounded). The symptom is `play()` reporting `success`
 * but no audio coming out. Re-instantiating the Sound on every call sidesteps
 * that whole class of bug.
 */
import Sound from 'react-native-sound';

// `Playback` plays even when the iOS silent switch is on — daily-reward feedback
// should be audible regardless. Mixed with other audio.
Sound.setCategory('Playback', true);

const FILE = 'coin_drop.mp3';

export const playCoinDropSound = () => {
  // Re-set the category in case something else (e.g. a video player) toggled it.
  Sound.setCategory('Playback', true);

  const snd = new Sound(FILE, Sound.MAIN_BUNDLE, err => {
    if (err) {
      console.warn(`[coinSound] failed to load ${FILE}:`, err);
      return;
    }
    snd.setVolume(1.0);
    snd.play(success => {
      if (!success) {
        console.warn('[coinSound] playback reported failure');
      }
      // Free the underlying iOS resource so we don't leak on repeated plays.
      snd.release();
    });
  });
};
