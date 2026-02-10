import React, {useState} from 'react';
import {Alert, SafeAreaView, StyleSheet} from 'react-native';
import GameModeSelector from '../components/GameModeSelector';
import {GAME_LABELS, gameSessionsService} from '../services/gameSessions.service';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

type SessionMode = 'random' | 'ai' | 'private-create' | 'private-join';

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
        message: `Joined private game ${result?.id ?? ''}. Waiting for host...`,
      };
    case 'ai':
      return {
        title: heading,
        message: `AI match started (difficulty: ${result?.difficulty ?? 'medium'}). Launching board...`,
      };
    case 'random':
    default:
      return {
        title: heading,
        message: 'You are queued for a random opponent. Sit tight!',
      };
  }
};

const GameModeScreen: React.FC<Props> = ({route, navigation}) => {
  const {gameType} = route.params;
  const label = GAME_LABELS[gameType];
  const [loading, setLoading] = useState({
    ai: false,
    random: false,
    private: false,
    join: false,
  });

  const navigateToSession = (mode: SessionMode, result: any) => {
    // Navigate directly to game screen for checkers and mrotsi
    if (gameType === 'checkers') {
      navigation.navigate('Checkers' as any, { session: result, gameType, mode });
      return;
    }
    
    if (gameType === 'mrotsi') {
      navigation.navigate('Mrotsi' as any, { session: result, gameType, mode });
      return;
    }
    
    // For other games, go to SessionStatus screen
    navigation.navigate('SessionStatus', {
      gameType,
      session: {
        ...result,
        mode,
      },
    });
  };

  const handleSuccess = (mode: SessionMode, result: any) => {
    console.log('[GameMode] session response', {mode, result});
    const {title, message} = formatSuccessMessage(mode, result, label?.title || 'Game');
    Alert.alert(title, message);
    navigateToSession(mode, result);
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
      <GameModeSelector
        title={label?.title || 'Start Game'}
        subtitle={label?.description}
        loadingStates={loading}
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
    backgroundColor: '#F6F8FB',
  },
});

export default GameModeScreen;
