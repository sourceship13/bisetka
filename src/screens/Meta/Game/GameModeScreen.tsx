import React, {useState} from 'react';
import {StyleSheet, StatusBar} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameModeSelector from '../../../components/global/GameModeSelector';
import TeamModeSelector, { TeamMode } from '../../../components/TeamModeSelector';
import {GAME_LABELS, gameSessionsService} from '../../../services/gameSessions.service';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {colors} from '../../../theme';
import {useAuth} from '../../../libs/hooks/useAuth';
import {socketService} from '../../../services/SocketService';
import tokenService from '../../../services/token.service';
import locationService, {UserLocation} from '../../../services/location.service';

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
  'blackjack': 'Blackjack',
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

  /** Fetch location silently — never blocks the user if denied or slow. */
  const getGameLocation = (): Promise<UserLocation | null> =>
    locationService.getLocationForGame();

  const prepareSocketLocation = (location: UserLocation | null) => {
    socketService.setPendingLocation(location);
    return location;
  };

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

    // Use navigation.reset instead of navigation.replace.
    // replace does an in-place route swap that causes Fabric to unmount the
    // current screen's views and mount the new screen's views in a single
    // RCTMountingManager transaction.  RCTComponentViewRegistry asserts when
    // recycled views are still marked as mounted ("Attempt to recycle a mounted
    // view").  reset() rebuilds the entire navigation state, which
    // react-native-screens handles by creating a fresh native stack — avoiding
    // the view-recycling collision entirely.
    const buildReset = (name: string, params?: object) => {
      const state = navigation.getState();
      const prevRoutes = (state?.routes || []).slice(0, -1).map(r => ({
        name: r.name,
        params: r.params,
      })) as any[];
      const routes = [...prevRoutes, {name, ...(params ? {params} : {})}];
      return {
        index: Math.max(0, routes.length - 1),
        routes,
      };
    };

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
    switch (screenName) {
      case 'BilliardsGame':
        navigation.reset(buildReset('BilliardsGame', {session: sessionData}));
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
        navigation.reset(buildReset('PokerRoom', {
          session: { ...sessionData, userId: user?.id || 'guest', displayName: resolvedName },
          gameType: gameType as any,
          mode: pokerMode,
          joinCode: sessionData.code,
          location: sessionData.location,
        }));
        break;
      }
      case 'Checkers':
        navigation.reset(buildReset('Checkers', {session: sessionData, mode: mode}));
        break;
      case 'MultiplayerCheckers':
        navigation.reset(buildReset('MultiplayerCheckers', {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
          location: sessionData.location,
        }));
        break;
      case 'Mrotsi':
        navigation.reset(buildReset('Mrotsi', {session: sessionData, gameType: gameType, mode: mode}));
        break;
      case 'Chess':
        navigation.reset(buildReset('Chess'));
        break;
      case 'MultiplayerChess':
        navigation.reset(buildReset('MultiplayerChess', {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
          location: sessionData.location,
        }));
        break;
      case 'MultiplayerMrotsi':
        navigation.reset(buildReset('MultiplayerMrotsi', {
          userId: user?.id || 'guest',
          mode: mode,
          joinCode: sessionData.code,
          location: sessionData.location,
        }));
        break;
      case 'Nardi':
        navigation.reset(buildReset('Nardi', {
          session: sessionData,
          mode: mode,
        }));
        break;
      case 'Blot':
        if (mode === 'ai' && !allowReplaceAI) {
          navigation.reset(buildReset('Blot'));
        } else {
          navigation.reset(buildReset('MultiplayerBlot', {
            userId: user?.id || 'guest',
            mode: mode === 'ai' ? 'random' : mode,
            difficulty: sessionData.difficulty || 'medium',
            joinCode: sessionData.code,
            teamMode: teamMode,
            allowReplaceAI: allowReplaceAI || undefined,
            location: sessionData.location,
          }));
        }
        break;
      case 'BaazarBlot':
        if (mode === 'ai' && !allowReplaceAI) {
          navigation.reset(buildReset('BaazarBlot', {
            userId: user?.id || 'guest',
            mode: mode,
            difficulty: sessionData.difficulty || 'medium',
          }));
        } else {
          navigation.reset(buildReset('MultiplayerBaazarBlot', {
            userId: user?.id || 'guest',
            mode: mode === 'ai' ? 'random' : mode,
            joinCode: sessionData.code,
            teamMode: teamMode,
            allowReplaceAI: allowReplaceAI || undefined,
            location: sessionData.location,
          }));
        }
        break;
      case 'Blackjack':
        navigation.reset(buildReset('Blackjack'));
        break;
      default:
        // Fallback to SessionStatus for games that need matchmaking UI
        navigation.reset(buildReset('SessionStatus', {
          gameType,
          session: sessionData,
        }));
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
    let successResult: {mode: SessionMode; result: any} | null = null;
    try {
      setLoading(prev => ({...prev, [key]: true}));
      const result = await action();
      successResult = {mode, result};
    } catch (error: any) {
      const title = mode === 'private-join' ? 'Unable to join game' : 'Unable to start game';
      BisetkaAlert.error(title, error?.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(prev => ({...prev, [key]: false}));
    }
    // Navigate AFTER loading state is cleared — prevents setState on an
    // unmounting screen which crashes Fabric's native view recycling.
    // Use setTimeout so the async batching completes before unmounting!
    if (successResult) {
      setTimeout(() => {
        if (successResult) {
          handleSuccess(successResult.mode, successResult.result);
        }
      }, 10);
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
              const location = prepareSocketLocation(await getGameLocation());
              return gameSessionsService.createRandomMatch(gameType, location);
            })
          }
          onPlayAi={() =>
            withLoading('ai', 'ai', async () => {
              const location = prepareSocketLocation(await getGameLocation());
              return gameSessionsService.createAiMatch(gameType, 'medium', allowReplaceAI, location);
            })
          }
          onCreatePrivate={async () => {
            const location = prepareSocketLocation(await getGameLocation());
            if (SOCKET_BASED_GAMES.has(gameType)) {
              // Socket-managed room — navigate immediately, let the game screen create via socket
              navigateToGame('private-create', {location});
              return;
            }
            withLoading('private', 'private-create', async () => {
              return gameSessionsService.createPrivateMatch(gameType, location);
            });
          }}
          onJoinPrivate={async code => {
            // Universal join: look up the room code on the socket layer first.
            // This lets a user enter a code on ANY game's screen and get routed
            // to the correct multiplayer screen automatically.
            setLoading(prev => ({...prev, join: true}));
            const location = prepareSocketLocation(await getGameLocation());
            try {
              const token = await tokenService.getAccessToken() ?? 'guest';
              await socketService.connect(user?.id || 'guest', token);
              const roomInfo = await socketService.lookupRoomCode(code);
              // Navigate to the screen matching the ROOM's game type, not the current screen's
              navigateToGame('private-join', { code, foundGameType: roomInfo.gameType, location });
            } catch (err: any) {
              if (SOCKET_BASED_GAMES.has(gameType)) {
                BisetkaAlert.error('Unable to join game', err?.message || 'Room not found');
              } else {
                // Fall back to REST for non-socket games
                withLoading('join', 'private-join', async () => {
                  return gameSessionsService.joinPrivateMatch(gameType, code, location);
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
