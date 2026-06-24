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
const nodeModulesPath = path.resolve(__dirname, 'node_modules');
const workspaceRoot = path.resolve(__dirname, '..');
const escapeForRegex = input =>
  input
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\//g, '[\\\\/]');
const anchoredDirPattern = absoluteDir =>
  new RegExp(`^${escapeForRegex(absoluteDir)}(?:[\\\\/].*)?$`);

const blockListPatterns = [
  // Ignore accidental Finder-style duplicate package folders (e.g. "chalk 2", "chalk 3").
  // These massively increase crawl/transform work and can stall bundle generation.
  /[\\/]node_modules[\\/][^\\/]+\s[23](?:[\\/].*)?$/,
  // iOS Pods are never part of JS bundling and can explode crawl time in this repo.
  /[\\/]ios[\\/]Pods(?:\s[23])?(?:[\\/].*)?$/,
  // Ignore archived node_modules snapshots kept beside the app.
  /[\\/]node_modules_stale_\d+(?:[\\/].*)?$/,
  // Ignore workspace-level non-JS trees by absolute path so dependency internals
  // like node_modules/*/scripts are never accidentally blocked.
  anchoredDirPattern(path.resolve(__dirname, 'ios')),
  anchoredDirPattern(path.resolve(__dirname, 'android')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'docs')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'capture_360')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'keys')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'scripts')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'bisetka-backend')),
  anchoredDirPattern(path.resolve(workspaceRoot, 'bisetka_stash_backup')),
];

if (hasLocalPhotosphere) {
  blockListPatterns.push(
    new RegExp(`^${escapeForRegex(path.resolve(photospherePath, 'node_modules'))}[\\\\/].*`),
  );
}

const config = {
  projectRoot: path.resolve(__dirname),
  // projectRoot must be in watchFolders so Metro's Node file crawler (used in CI
  // when useWatchman:false) has it in `roots`. Watchman ignores this since it
  // watches globally, but the Node crawler only crawls explicit roots.
  watchFolders: [
    path.resolve(__dirname),
    ...(hasLocalPhotosphere ? [photospherePath] : []),
  ],
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
      'vrm',
      'fbx',
      'glb',
      'gltf',
      'jsraw',
    ],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    nodeModulesPaths: [nodeModulesPath],
    // IMPORTANT: Never use [] for blockList. metro's getIgnorePattern() calls
    // combine([]) which produces new RegExp("") — matching every path — causing
    // ALL files to be ignored during the Node crawler crawl (SHA-1 error).
    // Use / ^/ (space+caret, never matches a real path) when no list is needed.
    blockList: blockListPatterns.length > 0 ? blockListPatterns : / ^/,
    // Prefer Node crawler by default in this repo; opt into Watchman explicitly.
    useWatchman: process.env.USE_WATCHMAN === '1',
  },
};

const mergedConfig = mergeConfig(defaultConfig, config);

module.exports = process.env.SENTRY_METRO_DISABLED === '1'
  ? mergedConfig
  : withSentryConfig(mergedConfig);
