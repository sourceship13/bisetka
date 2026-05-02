/**
 * This file configures the React Native CLI.
 * @type {import('@react-native-community/cli-types').UserDependencyConfig}
 */
module.exports = {
  assets: ['./assets/fonts/'],
  dependencies: {
    // @viro-community/react-viro uses jcenter() which is removed in Gradle 8+
    // and does not support New Architecture. Exclude from Android autolinking.
    '@viro-community/react-viro': {
      platforms: {
        android: null,
      },
    },
  },
};
