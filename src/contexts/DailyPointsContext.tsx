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
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../libs/hooks/useAuth';
import apiService from '../services/api.service';
import { playCoinDropSound } from '../utils/coinSound';

interface DailyPointsContextValue {
  pendingReward: number | null;
  flashCounter: number;
  triggerReward: (points: number) => void;
  dismissReward: () => void;
}

const DailyPointsContext = createContext<DailyPointsContextValue | undefined>(
  undefined,
);

export const DailyPointsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { setUser } = useAuth();
  const [pendingReward, setPendingReward] = useState<number | null>(null);
  const [flashCounter, setFlashCounter] = useState(0);

  const triggerReward = useCallback((points: number) => {
    if (!Number.isFinite(points) || points <= 0) return;
    setPendingReward(points);
  }, []);

  const dismissReward = useCallback(() => {
    const awarded = pendingReward;
    setPendingReward(null);
    if (!awarded) return;

    // Optimistically credit the local balance and flash + play sound now;
    // the server call confirms the value and corrects it if needed.
    setUser(curr =>
      curr ? { ...curr, balance: (curr.balance ?? 0) + awarded } : curr,
    );
    setFlashCounter(c => c + 1);
    playCoinDropSound();

    apiService
      .claimDailyPoints(awarded)
      .then(res => {
        if (typeof res?.balance === 'number') {
          setUser(curr => (curr ? { ...curr, balance: res.balance } : curr));
        }
      })
      .catch(err => {
        console.warn('[DailyPoints] claim failed:', err?.message ?? err);
      });
  }, [pendingReward, setUser]);

  const value = useMemo<DailyPointsContextValue>(
    () => ({ pendingReward, flashCounter, triggerReward, dismissReward }),
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
