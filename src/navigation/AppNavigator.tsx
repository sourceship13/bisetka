import React, {useState, useEffect} from 'react';
import {NavigationContainer, LinkingOptions} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from '../screens/Meta/LoginScreen';
import HomeScreen from '../screens/Meta/Home/HomeScreen';
import GameSelectionScreen from '../screens/Meta/Home/GameSelectionScreen';
import OnboardingScreen from '../screens/Meta/Onboarding/OnboardingScreen';
import {ONBOARDING_COMPLETE_KEY} from '../screens/Meta/Onboarding/OnboardingScreen';
import UsernameSelectionScreen from '../screens/Meta/Onboarding/UsernameSelectionScreen';
import BlotScreen from '../screens/Games/Blot/BlotScreen';
import MultiplayerBlotScreen from '../screens/Games/Blot/MultiplayerBlotScreen';
import BaazarBlotScreen from '../screens/Games/Baazar Blot/BaazarBlotScreen';
import MultiplayerBaazarBlotScreen from '../screens/MultiplayerBaazarBlotScreen';
import NardiScreen from '../screens/Games/Nardi/NardiScreen';
import ChessScreen from '../screens/Games/Chess/ChessScreen';
import MultiplayerChessScreen from '../screens/Games/Chess/MultiplayerChessScreen';
import MrotsiScreen from '../screens/Games/Mrotsi/MrotsiScreen';
import MultiplayerMrotsiScreen from '../screens/Games/Mrotsi/MultiplayerMrotsiScreen';
import CheckersScreen from '../screens/Games/Checkers/CheckersScreen';
import MultiplayerCheckersScreen from '../screens/Games/Checkers/MultiplayerCheckersScreen';
import PokerRoomScreen from '../screens/Games/Poker/PokerRoomScreen';
import BilliardsGameScreen from '../screens/Games/Billards/BilliardsGameScreen';
import SlotsScreen from '../screens/Games/Slots/SlotsScreen';
import BlackjackScreen from '../screens/Games/Blackjack/BlackjackScreen';
import GameModeScreen from '../screens/Meta/Game/GameModeScreen';
import GameInfoScreen from '../screens/Meta/Game/GameInfoScreen';
import SessionStatusScreen from '../screens/Meta/SessionStatusScreen';
import GlobalChatScreen from '../screens/Games/Blot/GlobalChatScreen';
import DMListScreen from '../screens/Chat/DMListScreen';
import DMChatScreen from '../screens/Chat/DMChatScreen';
import LeaderboardScreen from '../screens/Meta/Home/LeaderboardScreen';
import ActiveRoomsScreen from '../screens/Meta/Home/ActiveRoomsScreen';
import ChatRoomsListScreen from '../screens/Global Chat/ChatRoomsListScreen';
import ChatRoomScreen from '../screens/Global Chat/ChatRoomScreen';
import ProfileScreen from '../screens/Meta/Home/ProfileScreen';
import SettingsScreen from '../screens/Meta/Home/SettingsScreen';
import StoreScreen from '../screens/Meta/Home/StoreScreen';
import FontTestScreen from '../screens/Meta/Home/FontTestScreen';
import AvatarSelectionScreen from '../screens/Meta/Onboarding/AvatarSelectionScreen';
import ClothingStoreScreen from '../screens/Meta/Home/ClothingStoreScreen';
import WardrobeScreen from '../screens/Meta/Home/WardrobeScreen';
import GlobalViewScreen from '../screens/Meta/GlobalView/GlobalViewScreen';
import DrawerContent from '../components/DrawerContent';
import {useAuth} from '../libs/hooks/useAuth';
import {ActivityIndicator, View, StyleSheet, Dimensions} from 'react-native';
import {GameType} from '../services/gameSessions.service';

export type RootStackParamList = {
  Login: undefined;
  UsernameSelection: undefined;
  Onboarding: undefined;
  Home: undefined;
  GameSelection: undefined;
  Blot: undefined;
  MultiplayerBlot: { userId: string; mode?: 'ai' | 'menu' | 'private-create' | 'private-join' | 'random'; difficulty?: 'easy' | 'medium' | 'hard'; joinCode?: string };
  BaazarBlot: undefined;
  MultiplayerBaazarBlot: { userId: string };
  Nardi: undefined;
  Chess: undefined;
  MultiplayerChess: { userId: string };
  MultiplayerMrotsi: { userId: string; mode?: string; joinCode?: string };
  Checkers: { session: any; gameType: GameType; mode: string };
  MultiplayerCheckers: { userId: string; mode?: string; joinCode?: string };
  Mrotsi: { session: any; gameType: GameType; mode: string };
  PokerRoom: { session: any; gameType: GameType; mode: string; joinCode?: string };
  BilliardsGame: { session: any };
  Slots: undefined;
  Blackjack: undefined;
  GameMode: { gameType: GameType };
  GameInfo: { gameType: GameType; gradient?: string[] };
  SessionStatus: { gameType: GameType; session: any };
  GlobalChat: undefined;
  DMList: undefined;
  DMChat: { chatId: string; chatName: string };
  Leaderboard: undefined;
  ActiveRooms: undefined;
  ChatRoomsList: undefined;
  ChatRoom: { roomId: string };
  Profile: undefined;
  Settings: undefined;
  Store: undefined;
  FontTest: undefined;
  AvatarSelection: undefined;
  ClothingStore: undefined;
  Wardrobe: undefined;
  GlobalView: { userId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

const HomeDrawerScreen = () => (
  <Drawer.Navigator
    drawerContent={props => <DrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerType: 'front',
      drawerStyle: {
        width: Dimensions.get('window').width * 0.75,
        backgroundColor: 'transparent',
      },
      overlayColor: 'rgba(0,0,0,0.55)',
      swipeEdgeWidth: 40,
    }}>
    <Drawer.Screen name="HomeDrawer" component={HomeScreen} />
  </Drawer.Navigator>
);

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['bisetka://'],
  config: {
    screens: {
      Login: 'login',
      UsernameSelection: 'username-selection',
      Onboarding: 'onboarding',
      Home: 'home',
      GameSelection: 'game-selection',
      Blot: 'blot',
      MultiplayerBlot: {
        path: 'multiplayer-blot/:userId',
        parse: {
          userId: (userId: string) => userId,
          mode: (mode: string) => mode as 'ai' | 'menu' | 'private-create' | 'private-join' | 'random',
          difficulty: (difficulty: string) => difficulty as 'easy' | 'medium' | 'hard',
          joinCode: (joinCode: string) => joinCode,
        },
      },
      BaazarBlot: 'baazar-blot',
      MultiplayerBaazarBlot: 'multiplayer-baazar-blot/:userId',
      Nardi: 'nardi',
      Chess: 'chess',
      MultiplayerChess: 'multiplayer-chess/:userId',
      MultiplayerMrotsi: {
        path: 'multiplayer-mrotsi/:userId',
        parse: {
          userId: (userId: string) => userId,
          mode: (mode: string) => mode,
          joinCode: (joinCode: string) => joinCode,
        },
      },
      Checkers: 'checkers',
      MultiplayerCheckers: 'multiplayer-checkers/:userId',
      Mrotsi: 'mrotsi',
      PokerRoom: 'poker',
      BilliardsGame: 'billiards',
      Slots: 'slots',
      Blackjack: 'blackjack',
      GameMode: 'game-mode/:gameType',
      GameInfo: 'game-info/:gameType',
      SessionStatus: 'session-status/:gameType',
      GlobalChat: 'global-chat',
      DMList: 'dm-list',
      DMChat: 'dm/:chatId',
      Leaderboard: 'leaderboard',
      ActiveRooms: 'active-rooms',
      ChatRoomsList: 'chat-rooms',
      ChatRoom: 'chat-room/:roomId',
      Profile: 'profile',
      Settings: 'settings',
      Store: 'store',
      AvatarSelection: 'avatar-selection',
      ClothingStore: 'clothing-store',
      Wardrobe: 'wardrobe',
      GlobalView: 'global-view',
    },
  },
};

const AppNavigator = () => {
  const {user, isLoading} = useAuth();

  // Async-storage fallback result — only used when user.onboarding_shown is undefined
  // (i.e. a stale cached user that pre-dates the DB column).
  const [asyncOnboardingResult, setAsyncOnboardingResult] = useState<boolean | null>(null);

  useEffect(() => {
    // Only hit AsyncStorage when the server hasn't given us a definitive value.
    // For all other cases needsOnboarding is computed synchronously below, so the
    // NavigationContainer always mounts with the CORRECT value even when React 18
    // batches setUser() + setIsLoading(false) into a single render.
    if (user && user.onboarding_shown === undefined) {
      setAsyncOnboardingResult(null); // show spinner while we check
      AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
        .then(val => setAsyncOnboardingResult(val !== 'true'))
        .catch(() => setAsyncOnboardingResult(false));
    }
  }, [user]);

  // ── Synchronous derivation ──────────────────────────────────────────────────
  // Compute needsOnboarding RIGHT NOW from the current user object.
  // This is the key fix: by deriving inline (not in an effect), the first render
  // after login/bootstrap already has the correct value — React Navigation's
  // NavigationContainer therefore mounts with Onboarding as the initial screen
  // rather than Home.
  const needsOnboarding: boolean | null = (() => {
    if (!user) return false;
    if (user.onboarding_shown === true) return false;   // DB says done
    if (user.onboarding_shown === false) return true;   // DB says not done → show
    // onboarding_shown is undefined (pre-migration cached user) — wait for AsyncStorage
    return asyncOnboardingResult; // null = still resolving → keep spinner
  })();

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

  if (isLoading || needsOnboarding === null) {
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
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}>
          {!user ? (
            // Auth Stack - User is NOT signed in
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : needsUsername && !needsOnboarding ? (
            // Returning user who needs a username but already saw onboarding
            <Stack.Screen name="UsernameSelection" component={UsernameSelectionScreen} />
          ) : (
            // App Stack - User IS signed in
            <>
              {(needsOnboarding || needsUsername) && (
                <Stack.Screen
                  name="Onboarding"
                  component={OnboardingScreen}
                />
              )}
              <Stack.Screen name="Home" component={HomeDrawerScreen} />
              <Stack.Screen name="GameSelection" component={GameSelectionScreen} />
              <Stack.Screen name="Blot" component={BlotScreen} />
              <Stack.Screen name="MultiplayerBlot" component={MultiplayerBlotScreen} />
              <Stack.Screen name="BaazarBlot" component={BaazarBlotScreen} />
              <Stack.Screen name="MultiplayerBaazarBlot" component={MultiplayerBaazarBlotScreen} />
              <Stack.Screen name="Chess" component={ChessScreen} />
              <Stack.Screen name="MultiplayerChess" component={MultiplayerChessScreen} />
              <Stack.Screen name="Checkers" component={CheckersScreen} />
              <Stack.Screen name="MultiplayerCheckers" component={MultiplayerCheckersScreen} />
              <Stack.Screen name="Nardi" component={NardiScreen} />
              <Stack.Screen name="Mrotsi" component={MrotsiScreen} />
              <Stack.Screen name="MultiplayerMrotsi" component={MultiplayerMrotsiScreen} />
              <Stack.Screen name="PokerRoom" component={PokerRoomScreen} />
              <Stack.Screen name="BilliardsGame" component={BilliardsGameScreen} />
              <Stack.Screen name="Slots" component={SlotsScreen} />
              <Stack.Screen name="Blackjack" component={BlackjackScreen} />
              <Stack.Screen name="GameInfo" component={GameInfoScreen} />
              <Stack.Screen name="GameMode" component={GameModeScreen} />
              <Stack.Screen name="SessionStatus" component={SessionStatusScreen} />
              <Stack.Screen name="GlobalChat" component={GlobalChatScreen} />
              <Stack.Screen name="DMList" component={DMListScreen} />
              <Stack.Screen name="DMChat" component={DMChatScreen} />
              <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
              <Stack.Screen name="ActiveRooms" component={ActiveRoomsScreen} />
              <Stack.Screen name="ChatRoomsList" component={ChatRoomsListScreen} />
              <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Store" component={StoreScreen} />
              <Stack.Screen name="FontTest" component={FontTestScreen} />
              <Stack.Screen name="AvatarSelection" component={AvatarSelectionScreen} />
              <Stack.Screen name="ClothingStore" component={ClothingStoreScreen} />
              <Stack.Screen name="Wardrobe" component={WardrobeScreen} />
              <Stack.Screen name="GlobalView" component={GlobalViewScreen} />
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
