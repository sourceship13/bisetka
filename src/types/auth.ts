import type { BaseAvatar, AvatarClothing } from './avatar2d';

export interface PlayerStats {
  total_games: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  win_rate: number;
  total_points: number;
  available_points: number;
  lifetime_points: number;
  current_win_streak: number;
  best_win_streak: number;
  current_daily_streak: number;
  best_daily_streak: number;
  avg_score: number;
  best_score: number;
  ai_games: number;
  multiplayer_games: number;
  leaderboard_rank: number;
}

export interface User {
  id: string;
  email: string | null;
  username?: string;
  balance?: number;
  avatar_url?: string | null;
  full_name?: string | null;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  } | null;
  provider?: string;
  needsUsernameSelection?: boolean;
  onboarding_shown?: boolean;
  avatar?: {
    baseAvatar: BaseAvatar | null;
    equipped: Record<string, AvatarClothing>;
    inventory: AvatarClothing[];
  };
  playerStats?: PlayerStats | null;
  bisetka?: {
    id: string;
    neighborhood: string;
    city: string;
    country: string;
    active_users: number;
  } | null;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  isNewUser?: boolean;
  bisetka?: {
    id: string;
    neighborhood: string;
    city: string;
    country: string;
    active_users: number;
  };
}
