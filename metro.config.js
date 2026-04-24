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
  // projectRoot must be in watchFolders so Metro's Node file crawler (used in CI
  // when useWatchman:false) has it in `roots`. Watchman ignores this since it
  // watches globally, but the Node crawler only crawls explicit roots.
  watchFolders: [
    path.resolve(__dirname),
    ...(hasLocalPhotosphere ? [photospherePath] : []),
  ],
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'vrm', 'glb', 'gltf', 'jsraw'],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // IMPORTANT: Never use [] for blockList. metro's getIgnorePattern() calls
    // combine([]) which produces new RegExp("") — matching every path — causing
    // ALL files to be ignored during the Node crawler crawl (SHA-1 error).
    // Use / ^/ (space+caret, never matches a real path) when no list is needed.
    blockList: hasLocalPhotosphere
      ? [new RegExp(`^${path.resolve(photospherePath, 'node_modules').replace(/[/\\]/g, '[/\\\\]')}\\/.*`)]
      : / ^/,
    // Disable Watchman in CI — Watchman's async crawl races against Metro's
    // SHA-1 lookup on fresh runners. Node crawler is synchronous, no race.
    useWatchman: !process.env.CI,
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
