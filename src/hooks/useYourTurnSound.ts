import { useEffect, useRef } from 'react';
import { playYourTurnSound } from '../utils/nardiSound';

/**
 * Plays your_turn.mp3 once every time `isMyTurn` transitions from false → true.
 * Skips the very first render so the sound does not play on game mount.
 */
const useYourTurnSound = (isMyTurn: boolean) => {
  const mountedRef = useRef(false);
  const prevRef = useRef(isMyTurn);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = isMyTurn;
      return;
    }
    if (isMyTurn && !prevRef.current) {
      playYourTurnSound();
    }
    prevRef.current = isMyTurn;
  }, [isMyTurn]);
};

export default useYourTurnSound;
