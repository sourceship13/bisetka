import { useState, useCallback } from 'react';

interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  points_reward: number;
}

export function useAchievementNotifications() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length === 0) return;

    setQueue((prev) => [...prev, ...achievements]);
  }, []);

  const showNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrentAchievement(null);
        setIsVisible(false);
        return prev;
      }

      const [next, ...rest] = prev;
      setCurrentAchievement(next);
      setIsVisible(true);
      return rest;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setCurrentAchievement(null);
    // Show next achievement after a brief delay
    setTimeout(() => {
      showNext();
    }, 300);
  }, [showNext]);

  // Auto-show first achievement when queue is populated
  useState(() => {
    if (queue.length > 0 && !currentAchievement && !isVisible) {
      showNext();
    }
  });

  return {
    currentAchievement,
    isVisible,
    showAchievements,
    handleClose,
  };
}
