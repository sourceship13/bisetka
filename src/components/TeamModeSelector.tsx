import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {colors, spacing, typography} from '../theme';

const {width} = Dimensions.get('window');

export type TeamMode = 'hybrid' | 'full-multiplayer';

export type TeamModeSelectorProps = {
  title: string;
  onSelectTeamMode: (mode: TeamMode) => void;
  onBack?: () => void;
};

const TEAM_MODE_STYLES = {
  hybrid: {
    gradient: ['#f093fb', '#f5576c'] as [string, string],
    icon: '🤖👤',
    label: '1 Player + AI',
    subtitle: 'vs',
    label2: '1 Player + AI',
    desc: 'You + AI partner vs Opponent + AI partner',
  },
  'full-multiplayer': {
    gradient: ['#667eea', '#764ba2'] as [string, string],
    icon: '👥',
    label: '2 Players',
    subtitle: 'vs',
    label2: '2 Players',
    desc: 'Full multiplayer - 4 human players in teams',
  },
};

const TeamModeSelector: React.FC<TeamModeSelectorProps> = ({
  title,
  onSelectTeamMode,
  onBack,
}) => {
  const renderTeamCard = (mode: TeamMode) => {
    const config = TEAM_MODE_STYLES[mode];

    return (
      <TouchableOpacity
        key={mode}
        activeOpacity={0.85}
        onPress={() => onSelectTeamMode(mode)}
        style={styles.cardWrapper}>
        <LinearGradient
          colors={config.gradient}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.teamCard}>
          <View style={styles.cardContent}>
            <Text style={styles.cardIcon}>{config.icon}</Text>
            <View style={styles.cardText}>
              <View style={styles.labelRow}>
                <Text style={styles.cardLabel}>{config.label}</Text>
                <Text style={styles.vsText}>{config.subtitle}</Text>
                <Text style={styles.cardLabel}>{config.label2}</Text>
              </View>
              <Text style={styles.cardDesc}>{config.desc}</Text>
            </View>
          </View>
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
        <Text style={styles.subtitle}>Choose Team Mode</Text>
      </View>

      {/* Team Mode Cards */}
      <View style={styles.cardsContainer}>
        {renderTeamCard('hybrid')}
        {renderTeamCard('full-multiplayer')}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🎴 Select your team configuration</Text>
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
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: 20,
    justifyContent: 'center',
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
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 180,
    paddingVertical: spacing.lg,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 30,
  },
  cardIcon: {
    fontSize: 48,
    marginRight: spacing.lg,
  },
  cardText: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  vsText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginHorizontal: spacing.sm,
  },
  cardDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  cardArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 30,
  },
  arrowText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
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

export default TeamModeSelector;
