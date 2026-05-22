import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Switch,
} from 'react-native';
import {colors, spacing, typography} from '../../theme';

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
  allowReplaceAI?: boolean;
  onToggleAllowReplaceAI?: (value: boolean) => void;
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
  allowReplaceAI,
  onToggleAllowReplaceAI,
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
        <View style={[styles.modeCard, { backgroundColor: config.gradient[0] }]}> 
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
        </View>
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

        {/* Allow Replace AI toggle */}
        {onToggleAllowReplaceAI && (
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>Allow players to join</Text>
              <Text style={styles.toggleDesc}>Others can replace AI in your game</Text>
            </View>
            <Switch
              value={allowReplaceAI}
              onValueChange={onToggleAllowReplaceAI}
              trackColor={{false: 'rgba(255,255,255,0.15)', true: '#4facfe'}}
              thumbColor={allowReplaceAI ? '#fff' : '#aaa'}
            />
          </View>
        )}

        {renderModeCard('private', onCreatePrivate)}
        
        {/* Join Card - Expandable */}
        {!showJoinInput ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowJoinInput(true)}
            style={styles.cardWrapper}>
            <View style={[styles.modeCard, { backgroundColor: MODE_STYLES.join.gradient[0] }]}>
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
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.joinExpanded}>
            <View style={[styles.modeCard, { backgroundColor: MODE_STYLES.join.gradient[0] }]}>
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
            </View>
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
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.primaryLight,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text.primary,
    textAlign: 'center',
    textShadowColor: colors.shadow,
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: 14,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.shadow,
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
    minHeight: 160,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal:30
  },
  cardIcon: {
    fontSize: 36,
    marginRight: spacing.lg,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  cardArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    margin:30
  },
  arrowText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
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
    padding: spacing.xl,
  },
  joinTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 4,
  },
  joinButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#43e97b',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  toggleDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});

export default GameModeSelector;
