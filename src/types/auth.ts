import type { BaseAvatar, AvatarClothing } from './avatar2d';

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
