import apiConfig from '../libs/utils/api.utils';
import tokenService from './token.service';

export interface GameResultInput {
  gameType: string;
  gameMode: 'ai' | 'random' | 'private' | 'solo';
  result: 'win' | 'loss' | 'draw' | 'resigned' | 'opponent_resigned' | 'opponent_disconnected' | 'checkmate' | 'stalemate' | 'timeout';
  opponentId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  playerScore?: number;
  opponentScore?: number;
  durationSeconds?: number;
  movesCount?: number;
  gameData?: any;
  startedAt?: Date;
}

export interface GameResultResponse {
  success: boolean;
  gameResult: any;
  pointsEarned: number;
  totalPoints: number;
  currentStreak: number;
}

export interface UserPoints {
  total_points: number;
  available_points: number;
  lifetime_points: number;
  current_win_streak: number;
  best_win_streak: number;
}

export interface GameStats {
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
  avg_score: number;
  best_score: number;
  ai_games: number;
  multiplayer_games: number;
}

class GameResultService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = apiConfig.apiURL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await tokenService.getAccessToken();
    } catch {
      return null;
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Record a game result to the backend
   */
  async recordGameResult(input: GameResultInput): Promise<GameResultResponse | null> {
    try {
      const headers = await this.getHeaders();
      
      const response = await fetch(`${this.baseUrl}/game-results`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...input,
          startedAt: input.startedAt?.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Don't show error for auth failures - user might be playing as guest
        if (error?.error === 'No token provided' || response.status === 401) {
          console.log('Game result not recorded (user not authenticated)');
        } else {
          console.warn('Failed to record game result:', error);
        }
        return null;
      }

      const result = await response.json();
      console.log('Game result recorded:', result);
      return result;
    } catch (error) {
      console.error('Error recording game result:', error);
      return null;
    }
  }

  /**
   * Get user's points balance
   */
  async getUserPoints(): Promise<{ points: UserPoints; rank: number } | null> {
    try {
      const headers = await this.getHeaders();
      
      const response = await fetch(`${this.baseUrl}/game-results/points`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user points:', error);
      return null;
    }
  }

  /**
   * Get user's game history
   */
  async getGameHistory(gameType?: string, limit: number = 20): Promise<any[]> {
    try {
      const headers = await this.getHeaders();
      const params = new URLSearchParams();
      if (gameType) params.append('gameType', gameType);
      params.append('limit', limit.toString());
      
      const response = await fetch(`${this.baseUrl}/game-results/history?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error('Error fetching game history:', error);
      return [];
    }
  }

  /**
   * Get user's game statistics
   */
  async getGameStats(gameType?: string): Promise<GameStats | null> {
    try {
      const headers = await this.getHeaders();
      const params = new URLSearchParams();
      if (gameType) params.append('gameType', gameType);
      
      const response = await fetch(`${this.baseUrl}/game-results/stats?${params}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.stats;
    } catch (error) {
      console.error('Error fetching game stats:', error);
      return null;
    }
  }

  /**
   * Get overall leaderboard
   */
  async getLeaderboard(limit: number = 100): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/game-results/leaderboard?limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.leaderboard || [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }

  /**
   * Get game-specific leaderboard
   */
  async getGameLeaderboard(gameType: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/game-results/leaderboard/${gameType}?limit=${limit}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.leaderboard || [];
    } catch (error) {
      console.error('Error fetching game leaderboard:', error);
      return [];
    }
  }
}

export const gameResultService = new GameResultService();
