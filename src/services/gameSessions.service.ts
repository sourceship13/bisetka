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
  | 'blackjack'
  | 'slots'
  | 'nardi'
  | 'mrotsi'
  | 'billiards'
  | '9-ball';

export interface GlobeRoom {
  room_id: string;
  game_type: string;
  mode: string;
  status: string;
  room_name: string | null;
  player_count: number;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar_url: string | null;
  guest_id: string | null;
  guest_username: string | null;
  guest_avatar_url: string | null;
  created_at: string;
  started_at: string | null;
}

const request = async <T>(path: string, options: RequestInit = {}, timeoutMs = 12000): Promise<T> => {
  const token = await tokenService.getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiConfig.apiURL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.message || `Unable to process game request (HTTP ${response.status})`;
    throw new Error(message);
  }

  return response.json();
};

export const gameSessionsService = {
  getGlobeRooms: () =>
    request<GlobeRoom[]>('/games/globe', {
      method: 'GET',
    }),

  createRandomMatch: (gameType: GameType) =>
    request(`/games/${gameType}/matchmaking`, {
      method: 'POST',
    }),

  createPrivateMatch: (gameType: GameType) =>
    request(`/games/${gameType}/private`, {
      method: 'POST',
    }).then((s: any) => ({ ...s, code: s.access_code ?? s.code })),

  joinPrivateMatch: (gameType: GameType, code: string) =>
    request(`/games/${gameType}/private/join`, {
      method: 'POST',
      body: JSON.stringify({code}),
    }).then((s: any) => ({ ...s, code: s.access_code ?? s.code })),

  createAiMatch: (gameType: GameType, difficulty: 'easy' | 'medium' | 'hard' = 'medium', allowReplaceAI: boolean = false) =>
    request(`/games/${gameType}/ai`, {
      method: 'POST',
      body: JSON.stringify({ difficulty, allowReplaceAI }),
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
  blackjack: { title: 'Blackjack', description: 'Beat the dealer in classic 21' },
  slots: { title: 'Slots', description: 'Play for fun and practice' },
  nardi: { title: 'Nardi', description: 'Armenian backgammon showdowns' },
  mrotsi: { title: 'Mrotsi', description: 'Traditional dice battles' },
  billiards: { title: 'Billiards', description: '8-Ball Pool — sink your solids or stripes' },
  '9-ball': { title: '9-Ball Pool', description: 'Race to sink the 9-ball' },
};
