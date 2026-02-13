import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const {width} = Dimensions.get('window');

export type GameModeSelectorProps = {
  title: string;
  subtitle?: string;
  onPlayAi: () => Promise<void> | void;
  onRandomMatch: () => Promise<void> | void;
  onCreatePrivate: () => Promise<void> | void;
  onJoinPrivate: (code: string) => Promise<void> | void;
  loadingStates?: Partial<Record<'ai' | 'random' | 'private' | 'join', boolean>>;
  disabled?: boolean;
  onBack?: () => void;
};

// Gradient presets for each mode
const MODE_STYLES = {
  random: {
    gradient: ['#667eea', '#764ba2'],
    icon: '🎲',
    label: 'Random Match',
    desc: 'Find an opponent online',
  },
  ai: {
    gradient: ['#f093fb', '#f5576c'],
    icon: '🤖',
    label: 'Play vs AI',
    desc: 'Practice against the computer',
  },
  private: {
    gradient: ['#4facfe', '#00f2fe'],
    icon: '🔐',
    label: 'Create Private',
    desc: 'Get a code to share with friends',
  },
  join: {
    gradient: ['#43e97b', '#38f9d7'],
    icon: '🎯',
    label: 'Join Game',
    desc: 'Enter a friend\'s code',
  },
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
  onBack,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    onJoinPrivate(joinCode.trim().toUpperCase());
  };

  const renderModeCard = (
    mode: 'random' | 'ai' | 'private' | 'join',
    action: () => void,
  ) => {
    const config = MODE_STYLES[mode];
    const isLoading = loadingStates?.[mode];
    const isDisabled = disabled || isLoading;

    return (
      <TouchableOpacity
        key={mode}
        activeOpacity={0.85}
        disabled={isDisabled}
        onPress={action}
        style={[styles.cardWrapper, isDisabled && styles.cardDisabled]}>
        <LinearGradient
          colors={config.gradient as [string, string]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.modeCard}>
          <View style={styles.cardContent}>
            <Text style={styles.cardIcon}>{config.icon}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{config.label}</Text>
              <Text style={styles.cardDesc}>{config.desc}</Text>
            </View>
          </View>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
          <View style={styles.cardArrow}>
            <Text style={styles.arrowText}>→</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Mode Cards */}
      <View style={styles.cardsContainer}>
        {renderModeCard('random', onRandomMatch)}
        {renderModeCard('ai', onPlayAi)}
        {renderModeCard('private', onCreatePrivate)}
        
        {/* Join Card - Expandable */}
        {!showJoinInput ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowJoinInput(true)}
            style={styles.cardWrapper}>
            <LinearGradient
              colors={MODE_STYLES.join.gradient as [string, string]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.modeCard}>
              <View style={styles.cardContent}>
                <Text style={styles.cardIcon}>{MODE_STYLES.join.icon}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{MODE_STYLES.join.label}</Text>
                  <Text style={styles.cardDesc}>{MODE_STYLES.join.desc}</Text>
                </View>
              </View>
              <View style={styles.cardArrow}>
                <Text style={styles.arrowText}>→</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.joinExpanded}>
            <LinearGradient
              colors={MODE_STYLES.join.gradient as [string, string]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.joinGradient}>
              <Text style={styles.joinTitle}>
                {MODE_STYLES.join.icon} Enter Game Code
              </Text>
              <View style={styles.joinInputRow}>
                <TextInput
                  placeholder="ABC123"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={styles.joinInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.joinButton,
                    !joinCode.trim() && styles.joinButtonDisabled,
                  ]}
                  disabled={!joinCode.trim() || loadingStates?.join}
                  onPress={handleJoin}>
                  {loadingStates?.join ? (
                    <ActivityIndicator color="#43e97b" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowJoinInput(false);
                  setJoinCode('');
                }}
                style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* Decorative bottom */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🎮 Choose your battle mode</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    color: '#a0a0ff',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(102, 126, 234, 0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 14,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 90,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 36,
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  cardArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  joinExpanded: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#43e97b',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  joinGradient: {
    padding: 20,
  },
  joinTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 4,
  },
  joinButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#43e97b',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
});

export default GameModeSelector;
