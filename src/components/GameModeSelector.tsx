import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';

export type GameModeSelectorProps = {
  title: string;
  subtitle?: string;
  onPlayAi: () => Promise<void> | void;
  onRandomMatch: () => Promise<void> | void;
  onCreatePrivate: () => Promise<void> | void;
  onJoinPrivate: (code: string) => Promise<void> | void;
  loadingStates?: Partial<Record<'ai' | 'random' | 'private' | 'join', boolean>>;
  disabled?: boolean;
};

const GameModeSelector: React.FC<GameModeSelectorProps> = ({
  title,
  subtitle,
  onPlayAi,
  onRandomMatch,
  onCreatePrivate,
  onJoinPrivate,
  loadingStates,
  disabled,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const isDisabled = useMemo(() => disabled || false, [disabled]);

  const handleJoin = () => {
    if (!joinCode.trim()) {
      return;
    }
    onJoinPrivate(joinCode.trim().toUpperCase());
  };

  const renderButton = (
    label: string,
    action: () => void,
    type: 'ai' | 'random' | 'private' | 'join',
  ) => {
    const isLoading = loadingStates?.[type];
    return (
      <TouchableOpacity
        style={[styles.modeButton, isDisabled && styles.modeButtonDisabled]}
        disabled={isDisabled || isLoading}
        onPress={action}
        activeOpacity={0.85}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.modeButtonText}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.buttonStack}>
        {renderButton('Random Opponent', onRandomMatch, 'random')}
        {renderButton('Play vs AI', onPlayAi, 'ai')}
        {renderButton('Private Game (Create)', onCreatePrivate, 'private')}
      </View>

      <View style={styles.joinCard}>
        <Text style={styles.joinTitle}>Join Private Game</Text>
        <TextInput
          placeholder="Enter Code"
          placeholderTextColor="#888"
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          value={joinCode}
          onChangeText={setJoinCode}
        />
        {renderButton('Join Game', handleJoin, 'join')}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonStack: {
    gap: 12,
    marginBottom: 24,
  },
  modeButton: {
    backgroundColor: '#11173F',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonDisabled: {
    opacity: 0.4,
  },
  modeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  joinCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  joinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
});

export default GameModeSelector;
