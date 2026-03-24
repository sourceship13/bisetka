import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAchievements } from '../../contexts/AchievementContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AchievementTestScreen({ navigation }: any) {
  const { showAchievements } = useAchievements();

  const testAchievements = [
    {
      achievement_id: 'test_bronze',
      name: 'First Victory',
      description: 'Win your first game',
      icon: 'trophy-variant',
      tier: 'bronze',
      points_reward: 10,
    },
    {
      achievement_id: 'test_silver',
      name: 'Hot Streak',
      description: 'Win 2 games in a row',
      icon: 'fire',
      tier: 'silver',
      points_reward: 50,
    },
    {
      achievement_id: 'test_gold',
      name: 'Master',
      description: 'Win 50 games',
      icon: 'crown',
      tier: 'gold',
      points_reward: 250,
    },
    {
      achievement_id: 'test_platinum',
      name: 'Untouchable',
      description: 'Win 10 games in a row',
      icon: 'shield-crown',
      tier: 'platinum',
      points_reward: 500,
    },
    {
      achievement_id: 'test_diamond',
      name: 'Legend',
      description: 'Win 100 games',
      icon: 'trophy-award',
      tier: 'diamond',
      points_reward: 1000,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievement Preview</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Tap any button below to preview what the achievement unlock popup looks like:
        </Text>

        {testAchievements.map((achievement) => (
          <TouchableOpacity
            key={achievement.achievement_id}
            style={[styles.button, { borderColor: getTierColor(achievement.tier) }]}
            onPress={() => showAchievements([achievement])}
          >
            <Icon name={achievement.icon} size={32} color={getTierColor(achievement.tier)} />
            <View style={styles.buttonText}>
              <Text style={styles.buttonTitle}>{achievement.name}</Text>
              <Text style={styles.buttonTier}>{achievement.tier.toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.multiButton}
          onPress={() => showAchievements([testAchievements[0], testAchievements[1]])}
        >
          <Text style={styles.multiButtonText}>🎉 Show Multiple Achievements</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    diamond: '#B9F2FF',
  };
  return colors[tier] || '#fff';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  description: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  buttonText: {
    flex: 1,
    marginLeft: 16,
  },
  buttonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTier: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  multiButton: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  multiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
