import React from 'react';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import GlobalViewScreen from './src/screens/Meta/GlobalView/GlobalViewScreen';
const Root = () => <GlobalViewScreen route={{params:{}}} navigation={{}} />;
AppRegistry.registerComponent(appName, () => Root);
