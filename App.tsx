import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import {AuthProvider} from './src/context/AuthContext';
import 'react-native-gesture-handler';

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

export default App;
