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
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  isNewUser?: boolean;
}
