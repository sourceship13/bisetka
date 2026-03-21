import apiService from './api.service';

export interface GameResult {
  gameType: string;
  score: number;
  won: boolean;
}

export interface BisetkaStats {
  id: string;
  user_id: string;
  bisetka_id: string;
  game_type: string;
  total_games: number;
  wins: number;
  losses: number;
  total_score: number;
  highest_score: number;
  win_streak: number;
  current_streak: number;
  bisetka_name?: string;
  city?: string;
  country?: string;
}

export interface BisetkaKing {
  id: string;
  bisetka_id: string;
  game_type: string;
  user_id: string;
  username: string;
  full_name?: string;
  total_score: number;
  total_wins: number;
  total_games: number;
  crowned_at: string;
  bisetka_name?: string;
  city?: string;
  country?: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  total_score: number;
  wins: number;
  total_games: number;
  is_king: boolean;
  bisetka_name?: string;
  city?: string;
}

class BisetkaLeaderboardService {
  /**
   * Record a game result - updates stats and checks for King status
   * Call this when any game ends
   */
  async recordGameResult(result: GameResult): Promise<{
    success: boolean;
    crowned: boolean;
    message: string;
    stats: BisetkaStats | null;
  }> {
    try {
      console.log('👑 Recording game result:', result);
      
      const response = await apiService.post<{
        success: boolean;
        message: string;
        crowned: boolean;
        stats: BisetkaStats;
      }>('/bisetka/record-game', result);

      console.log('✅ Game result recorded:', response.message);
      
      if (response.crowned) {
        console.log('👑 CROWNED! You are now the King!');
      }

      return {
        success: response.success,
        crowned: response.crowned || false,
        message: response.message,
        stats: response.stats || null,
      };
    } catch (error: any) {
      console.error('❌ Failed to record game result:', error);
      return {
        success: false,
        crowned: false,
        message: 'Failed to record game result',
        stats: null,
      };
    }
  }

  /**
   * Get leaderboard for a Bisetka
   */
  async getLeaderboard(
    bisetkaId: string,
    gameType: string,
    limit: number = 100
  ): Promise<LeaderboardEntry[]> {
    try {
      const response = await apiService.get<{
        leaderboard: LeaderboardEntry[];
      }>(`/bisetka/${bisetkaId}/leaderboard/${gameType}?limit=${limit}`);
      
      return response.leaderboard || [];
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Get the King of a Bisetka for a game type
   */
  async getKing(bisetkaId: string, gameType: string): Promise<BisetkaKing | null> {
    try {
      const response = await apiService.get<{
        king: BisetkaKing | null;
      }>(`/bisetka/${bisetkaId}/king/${gameType}`);
      
      return response.king;
    } catch (error) {
      console.error('Failed to get King:', error);
      return null;
    }
  }

  /**
   * Get all Kings for a Bisetka (all game types)
   */
  async getAllKings(bisetkaId: string): Promise<BisetkaKing[]> {
    try {
      const response = await apiService.get<{
        kings: BisetkaKing[];
      }>(`/bisetka/${bisetkaId}/kings`);
      
      return response.kings || [];
    } catch (error) {
      console.error('Failed to get Kings:', error);
      return [];
    }
  }

  /**
   * Get user's stats in their current Bisetka
   */
  async getMyStats(gameType?: string): Promise<BisetkaStats[]> {
    try {
      const url = gameType 
        ? `/bisetka/my-stats?gameType=${gameType}`
        : '/bisetka/my-stats';
      
      const response = await apiService.get<{
        stats: BisetkaStats[];
      }>(url);
      
      return response.stats || [];
    } catch (error) {
      console.error('Failed to get my stats:', error);
      return [];
    }
  }

  /**
   * Get user's rank in a Bisetka
   */
  async getMyRank(
    bisetkaId: string,
    gameType: string
  ): Promise<number | null> {
    try {
      const response = await apiService.get<{
        rank: number | null;
      }>(`/bisetka/${bisetkaId}/my-rank/${gameType}`);
      
      return response.rank;
    } catch (error) {
      console.error('Failed to get my rank:', error);
      return null;
    }
  }

  /**
   * Get user's achievements summary
   */
  async getMyAchievements(): Promise<{
    isKing: boolean;
    kingdoms: BisetkaKing[];
    totalStats: {
      total_games: number;
      total_wins: number;
      total_score: number;
      best_game_type: string | null;
    };
  }> {
    try {
      const response = await apiService.get<any>('/bisetka/my-achievements');
      
      return {
        isKing: response.isKing || false,
        kingdoms: response.kingdoms || [],
        totalStats: response.totalStats || {
          total_games: 0,
          total_wins: 0,
          total_score: 0,
          best_game_type: null,
        },
      };
    } catch (error) {
      console.error('Failed to get achievements:', error);
      return {
        isKing: false,
        kingdoms: [],
        totalStats: {
          total_games: 0,
          total_wins: 0,
          total_score: 0,
          best_game_type: null,
        },
      };
    }
  }

  /**
   * Get global leaderboard across all Bisetkas
   */
  async getGlobalLeaderboard(
    gameType: string,
    limit: number = 100
  ): Promise<LeaderboardEntry[]> {
    try {
      const response = await apiService.get<{
        leaderboard: LeaderboardEntry[];
      }>(`/bisetka/global-leaderboard/${gameType}?limit=${limit}`);
      
      return response.leaderboard || [];
    } catch (error) {
      console.error('Failed to get global leaderboard:', error);
      return [];
    }
  }

  /**
   * Get all active Kings worldwide
   */
  async getAllActiveKings(): Promise<BisetkaKing[]> {
    try {
      const response = await apiService.get<{
        kings: BisetkaKing[];
      }>('/bisetka/all-kings');
      
      return response.kings || [];
    } catch (error) {
      console.error('Failed to get all Kings:', error);
      return [];
    }
  }
}

export const bisetkaLeaderboardService = new BisetkaLeaderboardService();
export default bisetkaLeaderboardService;
