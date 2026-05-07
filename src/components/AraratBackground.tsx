/**
 * AraratBackground — static full-screen background using assets/backgrounds/ararat4.jpeg.
 *
 * Drop-in replacement for Photosphere360Background for screens that should
 * not use the 360 photosphere (Blot, Baazar Blot, Nardi, Checkers, Chess).
 *
 * API surface mirrors Photosphere360Background:
 *   - overlayOpacity (0-1)
 *   - children (rendered on top of the background)
 */
import React from 'react';
import {ImageBackground, StyleSheet, View} from 'react-native';

const ARARAT_BACKGROUND = require('../../assets/backgrounds/game_backgrounds/street_armo.png');

type Props = {
  /** Opacity of a dark overlay on top of the image (0-1, default 0.3) */
  overlayOpacity?: number;
  children?: React.ReactNode;
};

export default function AraratBackground({
  overlayOpacity = 0.3,
  children,
}: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ImageBackground
        source={ARARAT_BACKGROUND}
        style={StyleSheet.absoluteFill}
        resizeMode="cover">
        {overlayOpacity > 0 && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: `rgba(0,0,0,${overlayOpacity})`},
            ]}
          />
        )}
      </ImageBackground>
      {children}
    </View>
  );
}
