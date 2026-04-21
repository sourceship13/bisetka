/**
 * Photosphere360Background — full-screen 360° equirectangular background.
 *
 * Uses the native SphereViewer from @sourceship13/react-native-capture360
 * with gyro-based head tracking for an immersive ambient effect behind game UI.
 *
 * Also exports `useSharedAttitude()` so children (e.g. AR3DOverlay) can
 * consume the same gyro subscription without creating a second sensor read.
 */
import React, {createContext, useContext} from 'react';
import {View, StyleSheet} from 'react-native';
import {SphereViewer, useAttitude} from '@sourceship13/react-native-capture360';

// ─── Shared attitude context ──────────────────────────────────────────────────

export interface AttitudeValue {
  yaw: number;
  pitch: number;
  roll: number;
  rotationMatrix?: number[];
}

const AttitudeContext = createContext<AttitudeValue>({yaw: 0, pitch: 0, roll: 0});

/**
 * Use inside any descendant of Photosphere360Background to get the live
 * gyroscope attitude without starting a second sensor subscription.
 */
export function useSharedAttitude(): AttitudeValue {
  return useContext(AttitudeContext);
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_PANORAMA = require('../../assets/backgrounds/capture360/pano2.jpg');

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
  /**
   * Children receive the live attitude via useSharedAttitude().
   * Render AR3DOverlay here so it sits between the photosphere and the game UI.
   */
  children?: React.ReactNode;
};

export default function Photosphere360Background({
  panoramaSource = DEFAULT_PANORAMA,
  initialPitch = -5,
  gyroEnabled = true,
  heightOffset = 0.08,
  overlayOpacity = 0.3,
  children,
}: Props) {
  const attitude = useAttitude();

  return (
    <AttitudeContext.Provider value={attitude}>
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
      {/* Children (AR3DOverlay etc.) render on top of the sphere viewer */}
      {children}
    </AttitudeContext.Provider>
  );
}
