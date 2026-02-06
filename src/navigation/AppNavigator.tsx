import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import BlotScreen from '../screens/BlotScreen';
import BaazarBlotScreen from '../screens/BaazarBlotScreen';
import NardiScreen from '../screens/NardiScreen';
import ChessScreen from '../screens/ChessScreen';
import MrotsiScreen from '../screens/MrotsiScreen';
import {useAuth} from '../context/AuthContext';
import {ActivityIndicator, View, StyleSheet} from 'react-native';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Blot: undefined;
  BaazarBlot: undefined;
  Nardi: undefined;
  Chess: undefined;
  Mrotsi: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const {user, isLoading} = useAuth();

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
          ) : (
            // App Stack - User IS signed in
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Blot" component={BlotScreen} />
              <Stack.Screen name="BaazarBlot" component={BaazarBlotScreen} />
              <Stack.Screen name="Chess" component={ChessScreen} />
              <Stack.Screen name="Nardi" component={NardiScreen} />
              <Stack.Screen name="Mrotsi" component={MrotsiScreen} />
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
