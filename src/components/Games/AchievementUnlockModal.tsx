import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  points_reward: number;
}

interface Props {
  visible: boolean;
  achievement: Achievement | null;
  onClose: () => void;
}

const TIER_COLORS: Record<string, string[]> = {
  bronze: ['#CD7F32', '#8B5A2B'],
  silver: ['#C0C0C0', '#808080'],
  gold: ['#FFD700', '#FFA500'],
  platinum: ['#E5E4E2', '#A8A8A8'],
  diamond: ['#B9F2FF', '#00BFFF'],
};

export default function AchievementUnlockModal({ visible, achievement, onClose }: Props) {
  const scaleAnim = new Animated.Value(0);
  const glowAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible && achievement) {
      // Entrance animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        // Glow pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();

      // Auto-close after 4 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      scaleAnim.setValue(0);
      glowAnim.setValue(0);
    }
  }, [visible, achievement]);

  const handleClose = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!achievement) return null;

  const tierColors = TIER_COLORS[achievement.tier] || TIER_COLORS.bronze;

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.card}>  
            
            {/* Glow Effect */}
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: tierColors[0],
                  opacity: glowOpacity,
                },
              ]}
            />

            {/* Header */}
            <View style={styles.header}>
              <Icon name="trophy-award" size={24} color="#FFD700" />
              <Text style={styles.headerText}>Achievement Unlocked!</Text>
            </View>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconGradient, { backgroundColor: tierColors[0] }]}
              >
                <Icon name={achievement.icon} size={64} color="#fff" />
              </View>
            </View>

            {/* Achievement Info */}
            <Text style={styles.achievementName}>{achievement.name}</Text>
            <Text style={styles.achievementDesc}>{achievement.description}</Text>

            {/* Tier + Points */}
            <View style={styles.footer}>
              <View style={[styles.tierBadge, { backgroundColor: tierColors[0] }]}>
                <Text style={styles.tierText}>{achievement.tier.toUpperCase()}</Text>
              </View>
              <View style={styles.pointsBadge}>
                <Icon name="star" size={16} color="#FFD700" />
                <Text style={styles.pointsText}>+{achievement.points_reward} pts</Text>
              </View>
            </View>

            {/* Tap to close hint */}
            <Text style={styles.tapHint}>Tap anywhere to close</Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width - 64,
    maxWidth: 400,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: 200,
    opacity: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  headerText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  achievementName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementDesc: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tapHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 16,
  },
});
