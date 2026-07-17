import React from 'react';
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
const BilliardsLazy = React.lazy(() => import('./src/screens/Games/Billards/BilliardsGameScreen'));
const Root = () => null;
AppRegistry.registerComponent(appName, () => Root);
