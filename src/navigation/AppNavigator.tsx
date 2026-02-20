import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import UsernameSelectionScreen from '../screens/UsernameSelectionScreen';
import MultiplayerBlotScreen from '../screens/MultiplayerBlotScreen';
import BaazarBlotScreen from '../screens/BaazarBlotScreen';
import NardiScreen from '../screens/NardiScreen';
import ChessScreen from '../screens/ChessScreen';
import MultiplayerChessScreen from '../screens/MultiplayerChessScreen';
import MrotsiScreen from '../screens/MrotsiScreen';
import CheckersScreen from '../screens/CheckersScreen';
import PokerRoomScreen from '../screens/PokerRoomScreen';
import BilliardsGameScreen from '../screens/BilliardsGameScreen';
import SlotsScreen from '../screens/SlotsScreen';
import GameModeScreen from '../screens/GameModeScreen';
import GameInfoScreen from '../screens/GameInfoScreen';
import SessionStatusScreen from '../screens/SessionStatusScreen';
import GlobalChatScreen from '../screens/GlobalChatScreen';
import DMListScreen from '../screens/DMListScreen';
import DMChatScreen from '../screens/DMChatScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ChatRoomsListScreen from '../screens/ChatRoomsListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import {useAuth} from '../libs/hooks/useAuth';
import {ActivityIndicator, View, StyleSheet} from 'react-native';
import {GameType} from '../services/gameSessions.service';

export type RootStackParamList = {
  Login: undefined;
  UsernameSelection: undefined;
  Home: undefined;
  Blot: { userId: string; mode?: 'ai' | 'menu' | 'private-create' | 'private-join' | 'random'; difficulty?: 'easy' | 'medium' | 'hard'; joinCode?: string };
  BaazarBlot: undefined;
  Nardi: undefined;
  Chess: undefined;
  MultiplayerChess: { userId: string };
  Checkers: { session: any; gameType: GameType };
  Mrotsi: { session: any; gameType: GameType; mode: string };
  PokerRoom: { session: any; gameType: GameType; mode: string };
  BilliardsGame: { session: any };
  Slots: undefined;
  GameMode: { gameType: GameType };
  GameInfo: { gameType: GameType; gradient?: string[] };
  SessionStatus: { gameType: GameType; session: any };
  GlobalChat: undefined;
  DMList: undefined;
  DMChat: { chatId: string; chatName: string };
  Leaderboard: undefined;
  ChatRoomsList: undefined;
  ChatRoom: { roomId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const {user, isLoading} = useAuth();

  // Check if user needs to select a username
  const needsUsername = user && (
    user.needsUsernameSelection || // Flagged by auth flow
    !user.username || 
    user.username.includes('null') || 
    user.username.includes('undefined') ||
    user.username.startsWith('user_') // Auto-generated username pattern
  );

  console.log('🧭 Navigation check:', {
    hasUser: !!user,
    username: user?.username,
    needsUsernameSelection: user?.needsUsernameSelection,
    needsUsername,
  });

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}>
          {!user ? (
            // Auth Stack - User is NOT signed in
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : needsUsername ? (
            // Username Selection - User needs to pick a username
            <Stack.Screen name="UsernameSelection" component={UsernameSelectionScreen} />
          ) : (
            // App Stack - User IS signed in with valid username
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Blot" component={MultiplayerBlotScreen} />
              <Stack.Screen name="BaazarBlot" component={BaazarBlotScreen} />
              <Stack.Screen name="Chess" component={ChessScreen} />
              <Stack.Screen name="MultiplayerChess" component={MultiplayerChessScreen} />
              <Stack.Screen name="Checkers" component={CheckersScreen} />
              <Stack.Screen name="Nardi" component={NardiScreen} />
              <Stack.Screen name="Mrotsi" component={MrotsiScreen} />
              <Stack.Screen name="PokerRoom" component={PokerRoomScreen} />
              <Stack.Screen name="BilliardsGame" component={BilliardsGameScreen} />
              <Stack.Screen name="Slots" component={SlotsScreen} />
              <Stack.Screen name="GameInfo" component={GameInfoScreen} />
              <Stack.Screen name="GameMode" component={GameModeScreen} />
              <Stack.Screen name="SessionStatus" component={SessionStatusScreen} />
              <Stack.Screen name="GlobalChat" component={GlobalChatScreen} />
              <Stack.Screen name="DMList" component={DMListScreen} />
              <Stack.Screen name="DMChat" component={DMChatScreen} />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen name="ChatRoomsList" component={ChatRoomsListScreen} />
              <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AppNavigator;
