import bisetkaLeaderboardService from '../services/bisetkaLeaderboard.service';
import { BisetkaAlert } from './BisetkaAlert';

/**
 * Record a game result and notify user if they became King
 * 
 * Usage in game screens:
 * 
 * import { recordGameResult } from '../utils/recordGameResult';
 * 
 * // When game ends:
 * await recordGameResult({
 *   gameType: 'blot',
 *   score: 500,
 *   won: true
 * });
 */
export async function recordGameResult(result: {
  gameType: string;
  score: number;
  won: boolean;
}): Promise<void> {
  try {
    console.log('🎮 Recording game result to Bisetka leaderboard...', result);
    
    const response = await bisetkaLeaderboardService.recordGameResult(result);

    if (!response.success) {
      console.warn('Failed to record game result:', response.message);
      return;
    }

    // If player became King, show celebration
    if (response.crowned) {
      BisetkaAlert.alert(
        '👑 You are the King! 👑',
        `Congratulations! You are now the King of ${response.stats?.bisetka_name || 'the Bisetka'} for ${result.gameType}!`,
        [
          {
            text: 'View Leaderboard',
            onPress: () => {
              // TODO: Navigate to leaderboard screen
              console.log('Navigate to leaderboard');
            },
          },
          { text: 'Awesome!', style: 'cancel' },
        ]
      );
    } else if (response.stats) {
      // Show subtle notification of stats update
      console.log(
        `✅ Stats updated: ${response.stats.wins}/${response.stats.total_games} wins, ` +
        `total score: ${response.stats.total_score}`
      );
    }
  } catch (error) {
    console.error('Error recording game result:', error);
    // Fail silently - don't disrupt game flow
  }
}

/**
 * Helper to determine game type from navigation or screen name
 */
export function getGameTypeFromRoute(routeName: string): string {
  const gameTypeMap: Record<string, string> = {
    'Blot': 'blot',
    'BlotGame': 'blot',
    'BaazarBlot': 'baazar-blot',
    'Chess': 'chess',
    'Checkers': 'checkers',
    'Poker': 'poker',
    'Nardi': 'nardi',
    'Billiards': 'billiards',
    '9Ball': '9-ball',
    'Mrotsi': 'mrotsi',
    'Slots': 'slots',
    'Blackjack': 'blackjack',
  };

  return gameTypeMap[routeName] || routeName.toLowerCase();
}

/**
 * Calculate if player won based on game-specific logic
 * This is a helper - games should pass the actual result
 */
export function determineWinner(
  gameType: string,
  playerScore: number,
  opponentScore?: number
): boolean {
  if (opponentScore === undefined) {
    // Single player games - assume won if score > 0
    return playerScore > 0;
  }

  // Multiplayer games - compare scores
  return playerScore > opponentScore;
}
