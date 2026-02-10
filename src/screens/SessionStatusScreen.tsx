import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/AppNavigator';
import {GAME_LABELS, GameType} from '../services/gameSessions.service';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionStatus'>;

type SessionMode = 'random' | 'ai' | 'private-create' | 'private-join';

type SessionPayload = {
  id?: string;
  status?: string;
  code?: string;
  mode?: SessionMode;
  difficulty?: string;
  timestamp?: string;
};

const SessionStatusScreen: React.FC<Props> = ({route, navigation}) => {
  const {gameType, session} = route.params;
  const labels = GAME_LABELS[gameType];
  const payload: SessionPayload = session || {};

  const goHome = () => navigation.navigate('Home');

  const launchGame = () => {
    switch (gameType) {
      case 'chess':
        navigation.navigate('Chess');
        break;
      case 'chess-multiplayer':
        navigation.navigate('MultiplayerChess', {userId: session?.userId || 'temp-user'});
        break;
      case 'blot':
      case 'baazar-blot':
        navigation.navigate('Blot', {userId: session?.userId || 'temp-user'});
        break;
      case 'cards':
        navigation.navigate('Blot', {userId: session?.userId || 'temp-user'});
        break;
      default:
        navigation.goBack();
    }
  };

  const statusTitle = () => {
    switch (session?.mode) {
      case 'random':
        return 'Queued for Random Match';
      case 'private-create':
        return 'Private Table Created';
      case 'private-join':
        return 'Joined Private Table';
      case 'ai':
        return 'AI Match Ready';
      default:
        return 'Session Ready';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{labels?.title || 'Game Session'}</Text>
        <Text style={styles.subheading}>{labels?.description}</Text>

        <View style={styles.card}>
          <Text style={styles.statusTitle}>{statusTitle()}</Text>
          {session?.code ? (
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>Share Code</Text>
              <Text style={styles.codeValue}>{session.code}</Text>
            </View>
          ) : null}

          {session?.id ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Session ID</Text>
              <Text style={styles.detailValue}>{session.id}</Text>
            </View>
          ) : null}

          {session?.timestamp ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{session.timestamp}</Text>
            </View>
          ) : null}

          {session?.difficulty ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Difficulty</Text>
              <Text style={styles.detailValue}>{session.difficulty}</Text>
            </View>
          ) : null}

          <View style={styles.actionStack}>
            <TouchableOpacity style={styles.launchButton} onPress={launchGame}>
              <Text style={styles.launchButtonText}>Launch Game</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={goHome}>
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#11173F',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeRow: {
    backgroundColor: '#11173F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  codeLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 6,
  },
  codeValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    color: '#666',
    fontSize: 14,
  },
  detailValue: {
    color: '#111',
    fontSize: 14,
    fontWeight: '600',
  },
  actionStack: {
    marginTop: 24,
    gap: 12,
  },
  launchButton: {
    backgroundColor: '#11173F',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  launchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    backgroundColor: '#E4E7F2',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#11173F',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SessionStatusScreen;
