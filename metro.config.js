const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  server: {
    experimentalDebuggerFrontend: false,
  },
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'vrm'],
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
