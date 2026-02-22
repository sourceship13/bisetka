/**
 * @format
 */

// Firebase app must be imported first before any other Firebase modules
import '@react-native-firebase/app';

// Must be imported before uuid or any crypto-dependent libraries
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
