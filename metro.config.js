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

<<<<<<< HEAD
// The @sourceship/capture360 package is symlinked from ../bisetka_photosphere.
// Metro needs to watch that directory and resolve shared deps from here.
const photospherePath = path.resolve(__dirname, '../bisetka_photosphere');

// Block the photosphere's own node_modules so shared deps resolve from bisetka only
const photosphereNodeModules = path.resolve(photospherePath, 'node_modules');
=======
// Ensure packages like @sourceship13/react-native-capture360 (installed via file:)
// resolve React and other peer deps from bisetka's node_modules,
// not from their own nested node_modules.
const extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-webview': path.resolve(__dirname, 'node_modules/react-native-webview'),
};
>>>>>>> develop

const config = {
  watchFolders: [photospherePath],
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'vrm'],
<<<<<<< HEAD
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Prevent Metro from picking up react/react-native from the photosphere's node_modules
    blockList: [new RegExp(`^${photosphereNodeModules.replace(/[/\\]/g, '[/\\\\]')}\\/.*`)],
=======
    extraNodeModules,
>>>>>>> develop
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
