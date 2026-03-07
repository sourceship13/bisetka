import React, {useState} from 'react';
import {StyleSheet, StatusBar} from 'react-native';
import { BisetkaAlert } from '../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameModeSelector from '../../components/global/GameModeSelector';
import TeamModeSelector, { TeamMode } from '../../components/TeamModeSelector';
import {GAME_LABELS, gameSessionsService} from '../../services/gameSessions.service';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/AppNavigator';
import {colors} from '../../theme';
import {useAuth} from '../../libs/hooks/useAuth';
import {socketService} from '../../services/SocketService';
import tokenService from '../../services/token.service';

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

type SessionMode = 'random' | 'ai' | 'private-create' | 'private-join';

// Games whose private rooms live entirely in the socket layer (no REST/DB session).
// For these, skip the REST API and navigate straight to the game screen.
const SOCKET_BASED_GAMES = new Set([
  'poker',
  'chess-multiplayer',
  'blot',
  'baazar-blot',
  'cards',
  'mrotsi',
  'checkers',
  'nardi',
]);

// Map game types to their actual game screens
const GAME_SCREEN_MAP: Record<string, keyof RootStackParamList> = {
  // Card games
  'blot': 'Blot',
  'baazar-blot': 'BaazarBlot',
  'cards': 'Blot', // Generic cards goes to Blot for now
  
  // Board games
  'chess': 'Chess',
  'chess-multiplayer': 'MultiplayerChess',
  'checkers': 'Checkers',
  'nardi': 'Nardi',
  
  // Pool games
  'billiards': 'BilliardsGame',
  '8-ball': 'BilliardsGame',
  '9-ball': 'BilliardsGame',
  
  // Other games
  'poker': 'PokerRoom',
  'mrotsi': 'Mrotsi',
  'slots': 'Home', // Slots not implemented yet
};

const formatSuccessMessage = (
  mode: SessionMode,
  result: Record<string, any>,
  gameLabel: string,
) => {
  const heading = `${gameLabel} ready`;

  switch (mode) {
    case 'private-create':
      return {
        title: heading,
        message: `Share code ${result?.code ?? '------'} with your friend to join.`,
      };
    case 'private-join':
      return {
        title: heading,
        message: `Joined private game! Get ready...`,
      };
    case 'ai':
      return {
        title: heading,
        message: `AI match started. Good luck!`,
      };
    case 'random':
    default:
      return {
        title: heading,
        message: 'Finding you an opponent...',
      };
  }
};

const GameModeScreen: React.FC<Props> = ({route, navigation}) => {
  const {gameType} = route.params;
  const {user} = useAuth();
  const label = GAME_LABELS[gameType] || {title: 'Game', description: ''};
  
  // Team games need to select team mode first
  const isTeamGame = gameType === 'blot' || gameType === 'baazar-blot';
  const [teamMode, setTeamMode] = useState<TeamMode | null>(null);
  const [showTeamSelector, setShowTeamSelector] = useState(isTeamGame);
  const [allowReplaceAI, setAllowReplaceAI] = useState(false);
  
  // Only show the "Allow players to join" toggle for games that support AI replacement
  const supportsReplaceAI = ['poker', 'baazar-blot', 'blot'].includes(gameType);

  const [loading, setLoading] = useState({
    ai: false,
    random: false,
    private: false,
    join: false,
  });

  const navigateToGame = (mode: SessionMode, result: any) => {
    // When joining via code from a different game's screen, use the found game type
    const effectiveGameType: string = result?.foundGameType || gameType;
    let screenName = GAME_SCREEN_MAP[effectiveGameType];
    
    // For chess, route to multiplayer screen if not AI mode
    if (effectiveGameType === 'chess' && mode !== 'ai') {
      screenName = 'MultiplayerChess';
    }

    // For mrotsi, route to multiplayer screen if not AI mode
    if (effectiveGameType === 'mrotsi' && mode !== 'ai') {
      screenName = 'MultiplayerMrotsi' as any;
    }

    // For checkers, route to dedicated multiplayer screen if not AI mode
    if (effectiveGameType === 'checkers' && mode !== 'ai') {
      screenName = 'MultiplayerCheckers' as any;
    }
    
    if (!screenName || screenName === 'Home') {
      BisetkaAlert.alert('Coming Soon', `${label.title} is not available yet!`);
      return;
    }

    // Build session data with team mode for team games
    const sessionData = {
      ...result,
      gameType: effectiveGameType,
      mode,
      difficulty: result?.difficulty || 'medium',
      teamMode: isTeamGame ? teamMode : undefined,
      allowReplaceAI: mode === 'ai' ? allowReplaceAI : false,
    };

    // Navigate to the appropriate screen
    // Use replace to avoid double back navigation
    switch (screenName) {
      case 'BilliardsGame':
        navigation.replace('BilliardsGame', {session: sessionData});
        break;
      case 'PokerRoom': {
        const fn: any = user?.fullName;
        const resolvedName: string = typeof fn === 'string' && fn
          ? fn
          : (fn?.givenName || fn?.familyName)
            ? [fn.givenName, fn.familyName].filter(Boolean).join(' ')
            : (user as any)?.username || (user as any)?.email || 'Guest';
        // When allowReplaceAI is on, route as 'random' so it uses multiplayer socket path
        const pokerMode = (mode === 'ai' && allowReplaceAI) ? 'random' : mode;
        navigation.replace('PokerRoom', {
          session: { ...sessionData, userId: user?.id || 'guest', displayName: resolvedName },
          gameType: gameType as any,
          mode: pokerMode,
          joinCode: sessionData.code,
        } as any);
        break;
      }
      case 'Checkers':
        navigation.replace('Checkers', {session: sessionData, mode: mode} as any);
        break;
      case 'MultiplayerCheckers':
        navigation.replace('MultiplayerCheckers' as any, {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
        });
        break;
      case 'Mrotsi':
        navigation.replace('Mrotsi', {session: sessionData, gameType: gameType, mode: mode} as any);
        break;
      case 'Chess':
        navigation.replace('Chess' as any);
        break;
      case 'MultiplayerChess':
        navigation.replace('MultiplayerChess' as any, {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
        });
        break;
      case 'MultiplayerMrotsi':
        navigation.replace('MultiplayerMrotsi' as any, {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
        });
        break;
      case 'Nardi':
        navigation.replace('Nardi' as any, {
          session: sessionData,
          mode: mode,
        });
        break;
      case 'Blot':
        if (mode === 'ai' && !allowReplaceAI) {
          navigation.replace('Blot' as any);
        } else {
          navigation.replace('MultiplayerBlot' as any, {
            userId: user?.id || 'guest',
            mode: mode === 'ai' ? 'random' : mode,
            difficulty: sessionData.difficulty || 'medium',
            joinCode: sessionData.code,
            teamMode: teamMode,
            allowReplaceAI: allowReplaceAI || undefined,
          });
        }
        break;
      case 'BaazarBlot':
        if (mode === 'ai' && !allowReplaceAI) {
          navigation.replace('BaazarBlot' as any, {
            userId: user?.id || 'guest',
            mode: mode,
            difficulty: sessionData.difficulty || 'medium',
          });
        } else {
          navigation.replace('MultiplayerBaazarBlot' as any, {
            userId: user?.id || 'guest',
            mode: mode === 'ai' ? 'random' : mode,
            joinCode: sessionData.code,
            teamMode: teamMode,
            allowReplaceAI: allowReplaceAI || undefined,
          });
        }
        break;
      default:
        // Fallback to SessionStatus for games that need matchmaking UI
        navigation.replace('SessionStatus', {
          gameType,
          session: sessionData,
        });
    }
  };

  const handleSuccess = (mode: SessionMode, result: any) => {
    console.log('[GameMode] session response', {mode, result, gameType});
    const {title, message} = formatSuccessMessage(mode, result, label.title);
    
    // For AI games, navigate directly without alert
    if (mode === 'ai') {
      navigateToGame(mode, result);
      return;
    }
    
    // For other modes, show brief alert then navigate
    BisetkaAlert.alert(title, message, [
      {text: 'Let\'s Go!', onPress: () => navigateToGame(mode, result)},
    ]);
  };

  const withLoading = async (
    key: keyof typeof loading,
    mode: SessionMode,
    action: () => Promise<any>,
  ) => {
    try {
      setLoading(prev => ({...prev, [key]: true}));
      const result = await action();
      handleSuccess(mode, result);
    } catch (error: any) {
      const title = mode === 'private-join' ? 'Unable to join game' : 'Unable to start game';
      BisetkaAlert.error(title, error?.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(prev => ({...prev, [key]: false}));
    }
  };

  const handleTeamModeSelect = (mode: TeamMode) => {
    setTeamMode(mode);
    setShowTeamSelector(false);
  };

  const handleBackFromModeSelector = () => {
    if (isTeamGame && teamMode !== null) {
      // Go back to team selector
      setShowTeamSelector(true);
      setTeamMode(null);
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      
      {showTeamSelector && isTeamGame ? (
        <TeamModeSelector
          title={label.title}
          onSelectTeamMode={handleTeamModeSelect}
          onBack={() => navigation.goBack()}
        />
      ) : (
        <GameModeSelector
          title={label.title}
          subtitle={label.description}
          loadingStates={loading}
          onBack={handleBackFromModeSelector}
          allowReplaceAI={allowReplaceAI}
          onToggleAllowReplaceAI={supportsReplaceAI ? setAllowReplaceAI : undefined}
          onRandomMatch={() =>
            withLoading('random', 'random', async () => {
              return gameSessionsService.createRandomMatch(gameType);
            })
          }
          onPlayAi={() =>
            withLoading('ai', 'ai', async () => {
              return gameSessionsService.createAiMatch(gameType, 'medium', allowReplaceAI);
            })
          }
          onCreatePrivate={() => {
            if (SOCKET_BASED_GAMES.has(gameType)) {
              // Socket-managed room — navigate immediately, let the game screen create via socket
              navigateToGame('private-create', {});
              return;
            }
            withLoading('private', 'private-create', async () => {
              return gameSessionsService.createPrivateMatch(gameType);
            });
          }}
          onJoinPrivate={async code => {
            // Universal join: look up the room code on the socket layer first.
            // This lets a user enter a code on ANY game's screen and get routed
            // to the correct multiplayer screen automatically.
            setLoading(prev => ({...prev, join: true}));
            try {
              const token = await tokenService.getAccessToken() ?? 'guest';
              await socketService.connect(user?.id || 'guest', token);
              const roomInfo = await socketService.lookupRoomCode(code);
              // Navigate to the screen matching the ROOM's game type, not the current screen's
              navigateToGame('private-join', { code, foundGameType: roomInfo.gameType });
            } catch (err: any) {
              if (SOCKET_BASED_GAMES.has(gameType)) {
                BisetkaAlert.error('Unable to join game', err?.message || 'Room not found');
              } else {
                // Fall back to REST for non-socket games
                withLoading('join', 'private-join', async () => {
                  return gameSessionsService.joinPrivateMatch(gameType, code);
                });
              }
            } finally {
              setLoading(prev => ({...prev, join: false}));
            }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
});

export default GameModeScreen;
