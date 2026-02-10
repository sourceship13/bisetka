/**
 * Example App.tsx with Blot Multiplayer Integration
 * 
 * This shows how to integrate the Blot multiplayer screen into your app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';

// Import your Blot multiplayer screen
import MultiplayerBlotScreen from './src/screens/MultiplayerBlotScreen';

const Stack = createNativeStackNavigator();

// Example Home Screen with navigation to Blot
function HomeScreen({ navigation }: any) {
  const userId = 'user-' + Math.random().toString(36).substr(2, 9);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bisetka Games</Text>
      <Text style={styles.subtitle}>Choose a game to play</Text>

      <TouchableOpacity
        style={styles.gameButton}
        onPress={() => navigation.navigate('MultiplayerBlot', { userId })}
      >
        <Text style={styles.gameButtonText}>🎴 Blot Multiplayer</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.gameButton, styles.disabledButton]}>
        <Text style={styles.gameButtonText}>♟️ Chess (Coming Soon)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.gameButton, styles.disabledButton]}>
        <Text style={styles.gameButtonText}>🎲 Nardi (Coming Soon)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.gameButton, styles.disabledButton]}>
        <Text style={styles.gameButtonText}>⚫ Checkers (Coming Soon)</Text>
      </TouchableOpacity>
    </View>
  );
}

// Main App Component
function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#007AFF',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Bisetka Games' }}
          />
          <Stack.Screen
            name="MultiplayerBlot"
            component={MultiplayerBlotScreen}
            options={{ title: 'Blot Multiplayer' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  gameButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginVertical: 10,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  gameButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default App;
