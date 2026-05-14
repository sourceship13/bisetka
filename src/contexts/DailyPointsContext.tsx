/**
 * DailyPointsContext
 *
 * Global state for the "free points awarded" reward flow:
 *   • `pendingReward`  — the points payload to show in the modal (or null).
 *   • `triggerReward`  — open the modal with N points (called from push tap).
 *   • `dismissReward`  — close the modal, claim on the backend, credit the
 *                        user.balance locally and bump `flashCounter` so the
 *                        toolbar points number flashes yellow→white→yellow.
 *   • `flashCounter`   — increments each time points are credited; consumers
 *                        watch this to drive their flash animation.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Vibration } from 'react-native';
import { useAuth } from '../libs/hooks/useAuth';
import apiService from '../services/api.service';
import { playCoinDropSound } from '../utils/coinSound';

interface PendingReward {
  points: number;
  /** Epoch-ms after which the modal auto-dismisses without crediting. */
  expiresAt?: number;
}

interface DailyPointsContextValue {
  pendingReward: number | null;
  flashCounter: number;
  triggerReward: (points: number, expiresAt?: number) => void;
  dismissReward: () => void;
}

const DailyPointsContext = createContext<DailyPointsContextValue | undefined>(
  undefined,
);

export const DailyPointsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { setUser } = useAuth();
  const [pendingReward, setPendingReward] = useState<PendingReward | null>(null);
  const [flashCounter, setFlashCounter] = useState(0);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const triggerReward = useCallback((points: number, expiresAt?: number) => {
    if (!Number.isFinite(points) || points <= 0) return;
    if (typeof expiresAt === 'number' && expiresAt > 0 && Date.now() > expiresAt) {
      // Already expired before we even rendered.
      return;
    }
    setPendingReward({ points, expiresAt });
  }, []);

  // Auto-dismiss the modal when its window ends — no claim, no credit.
  useEffect(() => {
    clearExpiryTimer();
    if (!pendingReward?.expiresAt) return;
    const ms = pendingReward.expiresAt - Date.now();
    if (ms <= 0) {
      setPendingReward(null);
      return;
    }
    expiryTimerRef.current = setTimeout(() => {
      console.log('[DailyPoints] reward window elapsed — auto-dismissing');
      setPendingReward(null);
    }, ms);
    return clearExpiryTimer;
  }, [pendingReward, clearExpiryTimer]);

  const dismissReward = useCallback(() => {
    const current = pendingReward;
    if (!current) {
      setPendingReward(null);
      return;
    }
    const { points: awarded, expiresAt } = current;

    // Belt-and-braces: if the user managed to tap Claim exactly as the timer
    // fires, treat it as expired and don't credit.
    if (expiresAt && Date.now() > expiresAt) {
      console.log('[DailyPoints] claim arrived after expiry — dropping');
      clearExpiryTimer();
      setPendingReward(null);
      return;
    }

    // Play sound + haptic FIRST, while the modal is still on-screen so the
    // dismiss animation doesn't preempt anything.
    console.log('[DailyPoints] CLAIM pressed → firing coin drop sound');
    Vibration.vibrate(50);
    try {
      playCoinDropSound();
    } catch (e) {
      console.warn('[DailyPoints] playCoinDropSound threw:', e);
    }

    clearExpiryTimer();
    setPendingReward(null);

    // Optimistically credit the local balance and flash; the server call
    // confirms the value and corrects it if needed.
    setUser(curr =>
      curr ? { ...curr, balance: (curr.balance ?? 0) + awarded } : curr,
    );
    setFlashCounter(c => c + 1);

    apiService
      .claimDailyPoints(awarded, expiresAt)
      .then(res => {
        if (typeof res?.balance === 'number') {
          setUser(curr => (curr ? { ...curr, balance: res.balance } : curr));
        }
      })
      .catch(err => {
        // Server rejected as expired — roll the optimistic credit back.
        const code = err?.code ?? err?.data?.code;
        if (code === 'REWARD_EXPIRED' || err?.status === 410) {
          console.warn('[DailyPoints] server says reward expired, rolling back');
          setUser(curr =>
            curr ? { ...curr, balance: Math.max(0, (curr.balance ?? 0) - awarded) } : curr,
          );
          return;
        }
        console.warn('[DailyPoints] claim failed:', err?.message ?? err);
      });
  }, [pendingReward, setUser, clearExpiryTimer]);

  const value = useMemo<DailyPointsContextValue>(
    () => ({
      pendingReward: pendingReward?.points ?? null,
      flashCounter,
      triggerReward,
      dismissReward,
    }),
    [pendingReward, flashCounter, triggerReward, dismissReward],
  );

  return (
    <DailyPointsContext.Provider value={value}>
      {children}
    </DailyPointsContext.Provider>
  );
};

export const useDailyPoints = (): DailyPointsContextValue => {
  const ctx = useContext(DailyPointsContext);
  if (!ctx) {
    throw new Error('useDailyPoints must be used within a DailyPointsProvider');
  }
  return ctx;
};
