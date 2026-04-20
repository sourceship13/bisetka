const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const fs = require('fs');
const defaultConfig = getDefaultConfig(__dirname);

// When developing locally with a symlinked bisetka_photosphere, watch that
// directory and block its node_modules. In CI (or when the dir is absent),
// the package is installed from GitHub Packages and no extra config is needed.
const photospherePath = path.resolve(__dirname, '../bisetka_photosphere');
const hasLocalPhotosphere = fs.existsSync(photospherePath);

const config = {
  projectRoot: path.resolve(__dirname),
  watchFolders: hasLocalPhotosphere ? [photospherePath] : [],
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'vrm'],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    blockList: hasLocalPhotosphere
      ? [new RegExp(`^${path.resolve(photospherePath, 'node_modules').replace(/[/\\]/g, '[/\\\\]')}\\/.*`)]
      : [],
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
