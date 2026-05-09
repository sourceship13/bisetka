/**
 * @format
 */

import 'react-native-gesture-handler';

// Firebase app must be imported first before any other Firebase modules
import '@react-native-firebase/app';

// Must be imported before uuid or any crypto-dependent libraries
import 'react-native-get-random-values';

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Hide the yellow-box "not connected to debugger" / remote-debugger warnings
// while developing on-device. Errors and other warnings still surface normally.
LogBox.ignoreLogs([
  /debugger/i,
  /Remote debugger/i,
  /Connection to .* debugger/i,
  /No apps connected/i,
  /not connected to a debugger/i,
]);

AppRegistry.registerComponent(appName, () => App);
