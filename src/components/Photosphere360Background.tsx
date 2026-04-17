/**
 * Photosphere360Background — full-screen 360° equirectangular background.
 *
 * Uses the native SphereViewer from @sourceship13/react-native-capture360
 * with gyro-based head tracking for an immersive ambient effect behind game UI.
 */
import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SphereViewer, useAttitude} from '@sourceship13/react-native-capture360';

const DEFAULT_PANORAMA = require('../../assets/capture360/relax_inn_seaview_suite_2k.jpg');

type Props = {
  /** A require()'d equirectangular panorama image (default: relax_inn_seaview_suite) */
  panoramaSource?: number;
  /** Initial pitch in degrees (default -5) */
  initialPitch?: number;
  /** Enable gyroscope-based head tracking (default true) */
  gyroEnabled?: boolean;
  /** Vertical offset for the sphere camera (default 0.08) */
  heightOffset?: number;
  /** Opacity of a dark overlay on top of the panorama (0-1, default 0.3) */
  overlayOpacity?: number;
};

export default function Photosphere360Background({
  panoramaSource = DEFAULT_PANORAMA,
  initialPitch = -5,
  gyroEnabled = true,
  heightOffset = 0.08,
  overlayOpacity = 0.3,
}: Props) {
  const attitude = useAttitude();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SphereViewer
        placeholderSource={panoramaSource}
        initialPitch={initialPitch}
        attitude={attitude}
        gyroEnabled={gyroEnabled}
        heightOffset={heightOffset}
      />
      {overlayOpacity > 0 && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: `rgba(0,0,0,${overlayOpacity})`},
          ]}
        />
      )}
    </View>
  );
}
