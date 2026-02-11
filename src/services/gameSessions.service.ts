import apiConfig from '../libs/utils/api.utils';
import tokenService from './token.service';

type GameOpponentType = 'random' | 'ai' | 'private';

export type GameType =
  | 'blot'
  | 'baazar-blot'
  | 'chess'
  | 'chess-multiplayer'
  | 'cards'
  | 'checkers'
  | 'poker'
  | 'slots'
  | 'nardi'
  | 'mrotsi'
  | 'billiards'
  | '9-ball';

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = await tokenService.getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiConfig.apiURL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.message || `Unable to process game request (HTTP ${response.status})`;
    throw new Error(message);
  }

  return response.json();
};

export const gameSessionsService = {
  createRandomMatch: (gameType: GameType) =>
    request(`/games/${gameType}/matchmaking`, {
      method: 'POST',
    }),

  createPrivateMatch: (gameType: GameType) =>
    request(`/games/${gameType}/private`, {
      method: 'POST',
    }),

  joinPrivateMatch: (gameType: GameType, code: string) =>
    request(`/games/${gameType}/private/join`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  createAiMatch: (gameType: GameType, difficulty: 'easy' | 'medium' | 'hard' = 'medium') =>
    request(`/games/${gameType}/ai`, {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
    }),
};

export const GAME_LABELS: Record<GameType, { title: string; description: string }> = {
  blot: { title: 'Blot', description: 'Play online, AI, or private tables' },
  'baazar-blot': { title: 'Baazar Blot', description: 'Fast-paced variant' },
  cards: { title: 'Cards', description: 'Classic Armenian card rooms' },
  checkers: { title: 'Checkers', description: 'Quick casual matches' },
  chess: { title: 'Chess (AI)', description: 'Training vs Bisetka AI' },
  'chess-multiplayer': { title: 'Chess (Multiplayer)', description: 'Private or random opponents' },
  poker: { title: 'Poker', description: 'Texas Hold ’Em tables' },
  slots: { title: 'Slots', description: 'Play for fun and practice' },
  nardi: { title: 'Nardi', description: 'Armenian backgammon showdowns' },
  mrotsi: { title: 'Mrotsi', description: 'Traditional dice battles' },
  billiards: { title: 'Billiards', description: '8-Ball Pool — sink your solids or stripes' },
  '9-ball': { title: '9-Ball Pool', description: 'Race to sink the 9-ball' },
};
