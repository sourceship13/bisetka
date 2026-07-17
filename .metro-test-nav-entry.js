import 'react-native-gesture-handler';
import React from 'react';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import AppNavigator from './src/navigation/AppNavigator';
const Root = () => <AppNavigator />;
AppRegistry.registerComponent(appName, () => Root);
