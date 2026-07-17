import React from 'react';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import BilliardsGameScreen from './src/screens/Games/Billards/BilliardsGameScreen';
const Root = () => <BilliardsGameScreen route={{params:{session:{}}}} navigation={{}} />;
AppRegistry.registerComponent(appName, () => Root);
