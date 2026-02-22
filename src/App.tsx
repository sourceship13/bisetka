import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './libs/hooks/useAuth';
import InAppNotificationBanner from './components/InAppNotificationBanner';
import 'react-native-gesture-handler';

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <View style={styles.root}>
        <AppNavigator />
        {/* Renders above everything — shows push banners when app is foregrounded */}
        <InAppNotificationBanner />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
