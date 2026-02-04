import React from 'react';
import AppNavigator from './navigation/AppNavigator';
import {AuthProvider} from './context/AuthContext';
import 'react-native-gesture-handler';

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

export default App;
