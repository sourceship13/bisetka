import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { version } from '../../../package.json';

type AppVersionFooterProps = {
  mode?: 'inline' | 'floating';
  containerStyle?: StyleProp<ViewStyle>;
  showBrand?: boolean;
};

const AppVersionFooter = ({
  mode = 'inline',
  containerStyle,
  showBrand = true,
}: AppVersionFooterProps) => {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        mode === 'floating' ? styles.floatingContainer : styles.inlineContainer,
        containerStyle,
      ]}>
      <Text style={mode === 'floating' ? styles.floatingText : styles.inlineText}>
        {showBrand ? `🇦🇲 Bisetka v${version}` : `v${version}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  inlineContainer: {
    marginTop: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
  },
  inlineText: {
    color: 'rgba(171, 6, 6, 0.95)',
    fontSize: 22,
  },
  floatingText: {
    color: 'rgba(171, 6, 6, 0.95)',
    fontSize: 22,
  },
});

export default AppVersionFooter;