const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Ensure packages like @sourceship13/react-native-capture360 (installed via file:)
// resolve React and other peer deps from bisetka's node_modules,
// not from their own nested node_modules.
const extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-webview': path.resolve(__dirname, 'node_modules/react-native-webview'),
};

const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'vrm'],
    extraNodeModules,
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
