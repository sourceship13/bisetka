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

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

type SessionMode = 'random' | 'ai' | 'private-create' | 'private-join';

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
  
  const [loading, setLoading] = useState({
    ai: false,
    random: false,
    private: false,
    join: false,
  });

  const navigateToGame = (mode: SessionMode, result: any) => {
    let screenName = GAME_SCREEN_MAP[gameType];
    
    // For chess, route to multiplayer screen if not AI mode
    if (gameType === 'chess' && mode !== 'ai') {
      screenName = 'MultiplayerChess';
    }
    
    if (!screenName || screenName === 'Home') {
      BisetkaAlert.alert('Coming Soon', `${label.title} is not available yet!`);
      return;
    }

    // Build session data with team mode for team games
    const sessionData = {
      ...result,
      gameType,
      mode,
      difficulty: result?.difficulty || 'medium',
      teamMode: isTeamGame ? teamMode : undefined,
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
        navigation.replace('PokerRoom', {
          session: { ...sessionData, userId: user?.id || 'guest', displayName: resolvedName },
          gameType: gameType as any,
          mode: mode,
        } as any);
        break;
      }
      case 'Checkers':
        navigation.replace('Checkers', {session: sessionData, mode: mode} as any);
        break;
      case 'Mrotsi':
        navigation.replace('Mrotsi', {session: sessionData} as any);
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
      case 'Nardi':
        navigation.replace('Nardi' as any, {
          session: sessionData,
          mode: mode,
        });
        break;
      case 'Blot':
        if (mode === 'ai') {
          navigation.replace('Blot' as any);
        } else {
          navigation.replace('MultiplayerBlot' as any, {
            userId: user?.id || 'guest',
            mode: mode,
            difficulty: sessionData.difficulty || 'medium',
            joinCode: sessionData.code,
            teamMode: teamMode, // Pass team mode
          });
        }
        break;
      case 'BaazarBlot':
        if (mode === 'ai') {
          navigation.replace('BaazarBlot' as any, {
            userId: user?.id || 'guest',
            mode: mode,
            difficulty: sessionData.difficulty || 'medium',
          });
        } else {
          navigation.replace('MultiplayerBaazarBlot' as any, {
            userId: user?.id || 'guest',
            teamMode: teamMode, // Pass team mode
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
      BisetkaAlert.error('Unable to start game', error?.message || 'Unexpected error');
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
          onRandomMatch={() =>
            withLoading('random', 'random', async () => {
              return gameSessionsService.createRandomMatch(gameType);
            })
          }
          onPlayAi={() =>
            withLoading('ai', 'ai', async () => {
              return gameSessionsService.createAiMatch(gameType);
            })
          }
          onCreatePrivate={() =>
            withLoading('private', 'private-create', async () => {
              return gameSessionsService.createPrivateMatch(gameType);
            })
          }
          onJoinPrivate={code =>
            withLoading('join', 'private-join', async () => {
              return gameSessionsService.joinPrivateMatch(gameType, code);
            })
          }
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
