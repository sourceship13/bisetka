import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AchievementUnlockModal from '../components/AchievementUnlockModal';

interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  points_reward: number;
}

interface AchievementContextType {
  showAchievements: (achievements: Achievement[]) => void;
}

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showNext = useCallback(() => {
    if (queue.length === 0) {
      setCurrentAchievement(null);
      setIsVisible(false);
      return;
    }

    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrentAchievement(next);
    setIsVisible(true);
  }, [queue]);

  const showAchievements = useCallback((achievements: Achievement[]) => {
    if (achievements.length === 0) return;

    setQueue((prev) => {
      const newQueue = [...prev, ...achievements];
      // If nothing is showing, trigger first one immediately
      if (!currentAchievement && !isVisible) {
        setTimeout(() => {
          const [first, ...rest] = newQueue;
          setQueue(rest);
          setCurrentAchievement(first);
          setIsVisible(true);
        }, 500); // Small delay to let game screen transition
      }
      return newQueue;
    });
  }, [currentAchievement, isVisible]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setCurrentAchievement(null);
    // Show next achievement after a brief delay
    setTimeout(() => {
      showNext();
    }, 300);
  }, [showNext]);

  return (
    <AchievementContext.Provider value={{ showAchievements }}>
      {children}
      <AchievementUnlockModal
        visible={isVisible}
        achievement={currentAchievement}
        onClose={handleClose}
      />
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const context = useContext(AchievementContext);
  if (!context) {
    throw new Error('useAchievements must be used within AchievementProvider');
  }
  return context;
}
