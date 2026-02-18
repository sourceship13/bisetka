import React, {useState} from 'react';
import {Alert, StyleSheet, StatusBar} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameModeSelector from '../components/GameModeSelector';
import {GAME_LABELS, gameSessionsService} from '../services/gameSessions.service';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {colors} from '../theme';
import {useAuth} from '../context/AuthContext';

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
  
  const [loading, setLoading] = useState({
    ai: false,
    random: false,
    private: false,
    join: false,
  });

  const navigateToGame = (mode: SessionMode, result: any) => {
    const screenName = GAME_SCREEN_MAP[gameType];
    
    if (!screenName || screenName === 'Home') {
      Alert.alert('Coming Soon', `${label.title} is not available yet!`);
      return;
    }

    // Build session data
    const sessionData = {
      ...result,
      gameType,
      mode,
      difficulty: result?.difficulty || 'medium',
    };

    // Navigate to the appropriate screen
    // Use replace to avoid double back navigation
    switch (screenName) {
      case 'BilliardsGame':
        navigation.replace('BilliardsGame', {session: sessionData});
        break;
      case 'PokerRoom':
        navigation.replace('PokerRoom', {session: sessionData} as any);
        break;
      case 'Checkers':
        navigation.replace('Checkers', {session: sessionData} as any);
        break;
      case 'Mrotsi':
        navigation.replace('Mrotsi', {session: sessionData} as any);
        break;
      case 'Chess':
        navigation.replace('Chess' as any);
        break;
      case 'MultiplayerChess':
        navigation.replace('MultiplayerChess' as any, {userId: user?.id || 'guest'});
        break;
      case 'Nardi':
        navigation.replace('Nardi' as any, {
          session: sessionData,
          mode: mode,
        });
        break;
      case 'Blot':
        navigation.replace('Blot' as any, {
          userId: user?.id || 'guest',
          mode: mode, // Pass the actual mode: 'ai', 'private-create', 'private-join', 'random'
          difficulty: sessionData.difficulty || 'medium',
          joinCode: sessionData.code, // For private-join, pass the room code
        });
        break;
      case 'BaazarBlot':
        navigation.replace('BaazarBlot' as any, {
          userId: user?.id || 'guest',
          mode: mode, // Pass the actual mode: 'ai', 'private-create', 'private-join', 'random'
          difficulty: sessionData.difficulty || 'medium',
          joinCode: sessionData.code, // For private-join, pass the room code
        });
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
    Alert.alert(title, message, [
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
      Alert.alert('Unable to start game', error?.message || 'Unexpected error');
    } finally {
      setLoading(prev => ({...prev, [key]: false}));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background.primary} />
      <GameModeSelector
        title={label.title}
        subtitle={label.description}
        loadingStates={loading}
        onBack={() => navigation.goBack()}
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
