import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView} from 'react-native';
import {useAuth} from '../context/AuthContext';

const HomeScreen = ({navigation}: any) => {
  const {user, signOut} = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const games = [
    { id: 'blot', name: 'Blot', description: 'Play online, vs AI, or private games', screen: 'Blot', mode: 'legacy' },
    { id: 'baazar-blot', name: 'Baazar Blot', description: 'Fast-paced Blot variant', screen: 'BaazarBlot', mode: 'legacy' },
    { id: 'cards', name: 'Cards', description: 'Classic Armenian card rooms', gameType: 'cards', mode: 'selector' },
    { id: 'checkers', name: 'Checkers', description: 'Quick casual matches', gameType: 'checkers', mode: 'selector' },
    { id: 'poker', name: 'Poker', description: 'Texas Hold ’Em practice tables', gameType: 'poker', mode: 'selector' },
    { id: 'slots', name: 'Slots', description: 'Fun arcade-inspired slots', gameType: 'slots', mode: 'selector' },
    { id: 'nardi', name: 'Nardi', description: 'Armenian backgammon', screen: 'Nardi', mode: 'legacy' },
    { id: 'chess', name: 'Chess (vs AI)', description: 'Play against computer AI', screen: 'Chess', mode: 'legacy' },
    { id: 'chess-multiplayer', name: 'Chess (Multiplayer)', description: 'Play against friends or strangers', screen: 'MultiplayerChess', mode: 'legacy' },
    { id: 'mrotsi', name: 'Mrotsi', description: 'Traditional Armenian dice game', gameType: 'mrotsi', mode: 'selector' },
  ] as const;

  type GameConfig = (typeof games)[number];

  const handleGamePress = (game: GameConfig) => {
    if (game.mode === 'selector' && game.gameType) {
      navigation.navigate('GameMode', { gameType: game.gameType });
      return;
    }

    if (game.screen === 'MultiplayerChess' || game.screen === 'Blot') {
      navigation.navigate(game.screen, { userId: user?.id || 'temp-user' });
    } else if (game.screen) {
      navigation.navigate(game.screen);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Bisetka!</Text>
          {user?.fullName?.givenName && (
            <Text style={styles.userName}>
              {user.fullName.givenName} {user.fullName.familyName}
            </Text>
          )}
          {user?.email && <Text style={styles.email}>{user.email}</Text>}
        </View>

        <View style={styles.gamesContainer}>
          <Text style={styles.sectionTitle}>Choose a Game</Text>
          {games.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={styles.gameCard}
              onPress={() => handleGamePress(game)}
              activeOpacity={0.7}
            >
              <Text style={styles.gameName}>{game.name}</Text>
              <Text style={styles.gameDescription}>{game.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  gamesContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  gameCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gameName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  gameDescription: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
