import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { gameResultService, UserPoints, GameStats } from '../../services/gameResult.service';

export interface GameEndData {
  /** Updated points balance from the server */
  points: UserPoints | null;
  /** Latest game stats for this game type */
  gameStats: GameStats | null;
  /** True while the refresh request is in-flight */
  isRefreshing: boolean;
  /**
   * Call this directly from multiplayer / async flows
   * (e.g. right after `recordGameResult` returns).
   * Safe to call multiple times — deduplicates in-flight calls.
   */
  refreshOnGameEnd: () => Promise<void>;
}

/**
 * Refreshes the authenticated user's profile (points) and game stats whenever
 * a game session ends.
 *
 * Usage — reactive (solo / AI games):
 *   const { points, gameStats } = useGameEndRefresh(gameState.isGameOver, 'chess');
 *
 * Usage — imperative (multiplayer, called after recordGameResult):
 *   const { refreshOnGameEnd } = useGameEndRefresh(undefined, 'blot');
 *   ...
 *   await gameResultService.recordGameResult(...);
 *   refreshOnGameEnd();
 */
export const useGameEndRefresh = (
  isGameOver?: boolean,
  gameType?: string,
): GameEndData => {
  const { refreshUser } = useAuth();
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Prevent duplicate calls within a single game session
  const hasRefreshedRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const refreshOnGameEnd = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    hasRefreshedRef.current = true;
    setIsRefreshing(true);

    try {
      // 1. Refresh auth context so totalPoints in the header updates
      await refreshUser();

      // 2. Fetch detailed points + game stats in parallel
      const [pointsData, statsData] = await Promise.all([
        gameResultService.getUserPoints(),
        gameType ? gameResultService.getGameStats(gameType) : Promise.resolve(null),
      ]);

      if (pointsData?.points) setPoints(pointsData.points);
      if (statsData) setGameStats(statsData);
    } catch (error) {
      console.error('[useGameEndRefresh] Failed to refresh game data:', error);
    } finally {
      setIsRefreshing(false);
      refreshInFlightRef.current = false;
    }
  }, [refreshUser, gameType]);

  // Reactive variant: fire automatically when isGameOver flips to true
  useEffect(() => {
    if (isGameOver && !hasRefreshedRef.current) {
      refreshOnGameEnd();
    }
    // Reset guard when a new game starts
    if (isGameOver === false) {
      hasRefreshedRef.current = false;
      setPoints(null);
      setGameStats(null);
    }
  }, [isGameOver, refreshOnGameEnd]);

  return { points, gameStats, isRefreshing, refreshOnGameEnd };
};
