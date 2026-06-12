/**
 * Games configuration
 * Uses translation keys for dynamic name/description
 * Images and gradients are static
 */

export const GAME_ICONS = {
  blot: require('../../assets/game-icons/blot-icon.png'),
  baazarBlot: require('../../assets/game-icons/baazar-blot-icon.png'),
  checkers: require('../../assets/game-icons/checkers-icon.png'),
  chess: require('../../assets/game-icons/chess-icon.png'),
  nardi: require('../../assets/game-icons/nardi-icon.png'),
  eightBall: require('../../assets/game-icons/8ball-icon.png'),
  nineBall: require('../../assets/game-icons/9ball-icon.png'),
  mrotsi: require('../../assets/game-icons/mrotsi-icon.png'),
  blackjack: require('../../assets/game-icons/blackjack-icon.png'),
  slots: require('../../assets/game-icons/slots-icon.png'),
};

export interface GameConfig {
  id: string;
  nameKey: string; // Translation key for name
  descriptionKey: string; // Translation key for description
  icon: any;
  gradient: [string, string];
  gameType: string;
  isImage: boolean;
}

// Static game configuration - names/descriptions resolved via i18n
export const GAMES_CONFIG: GameConfig[] = [
  {
    id: 'blot',
    nameKey: 'games.blot.name',
    descriptionKey: 'games.blot.description',
    icon: GAME_ICONS.blot,
    gradient: ['#6366f1', '#8b5cf6'],
    gameType: 'blot',
    isImage: true,
  },
  {
    id: 'baazar-blot',
    nameKey: 'games.baazarBlot.name',
    descriptionKey: 'games.baazarBlot.description',
    icon: GAME_ICONS.baazarBlot,
    gradient: ['#ec4899', '#f472b6'],
    gameType: 'baazar-blot',
    isImage: true,
  },
  {
    id: 'checkers',
    nameKey: 'games.checkers.name',
    descriptionKey: 'games.checkers.description',
    icon: GAME_ICONS.checkers,
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: 'checkers',
    isImage: true,
  },
  {
    id: 'chess',
    nameKey: 'games.chess.name',
    descriptionKey: 'games.chess.description',
    icon: GAME_ICONS.chess,
    gradient: ['#3b82f6', '#60a5fa'],
    gameType: 'chess',
    isImage: true,
  },
  {
    id: 'nardi',
    nameKey: 'games.nardi.name',
    descriptionKey: 'games.nardi.description',
    icon: GAME_ICONS.nardi,
    gradient: ['#8b5cf6', '#a78bfa'],
    gameType: 'nardi',
    isImage: true,
  },
  {
    id: 'billiards',
    nameKey: 'games.billards.name',
    descriptionKey: 'games.billards.description',
    icon: GAME_ICONS.eightBall,
    gradient: ['#06b6d4', '#22d3ee'],
    gameType: 'billiards',
    isImage: true,
  },
  {
    id: '9-ball',
    nameKey: 'games.billards.name',
    descriptionKey: 'games.billards.description',
    icon: GAME_ICONS.nineBall,
    gradient: ['#f59e0b', '#fbbf24'],
    gameType: '9-ball',
    isImage: true,
  },
  {
    id: 'mrotsi',
    nameKey: 'games.mrotsi.name',
    descriptionKey: 'games.mrotsi.description',
    icon: GAME_ICONS.mrotsi,
    gradient: ['#14b8a6', '#2dd4bf'],
    gameType: 'mrotsi',
    isImage: true,
  },
  {
    id: 'blackjack',
    nameKey: 'games.blackjack.name',
    descriptionKey: 'games.blackjack.description',
    icon: GAME_ICONS.blackjack,
    gradient: ['#7c3aed', '#a78bfa'],
    gameType: 'blackjack',
    isImage: true,
  },
  {
    id: 'slots',
    nameKey: 'games.slots.name',
    descriptionKey: 'games.slots.description',
    icon: GAME_ICONS.slots,
    gradient: ['#ef4444', '#f87171'],
    gameType: 'slots',
    isImage: true,
  },
];

/**
 * Helper to resolve game config with translations
 * Usage in components:
 * const { translate } = useI18n();
 * const games = GAMES_CONFIG.map(game => ({
 *   ...game,
 *   name: translate(game.nameKey),
 *   description: translate(game.descriptionKey),
 * }));
 */
export const resolveGameConfig = (
  game: GameConfig,
  translate: (key: string) => string
) => ({
  ...game,
  name: translate(game.nameKey),
  description: translate(game.descriptionKey),
});

/**
 * Resolve all games with translations
 */
export const resolveAllGames = (
  translate: (key: string) => string
) => GAMES_CONFIG.map(game => resolveGameConfig(game, translate));
