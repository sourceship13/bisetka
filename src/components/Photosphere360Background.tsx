/**
 * Photosphere360Background — full-screen equirectangular background.
 *
 * Capture360 native SphereViewer + gyro tracking has been removed; this now
 * renders a static panorama image. `useSharedAttitude()` is preserved for
 * descendants (e.g. AR3DOverlay) but always returns zeroed attitude.
 */
import React, {createContext, useContext} from 'react';
import {View, StyleSheet, Image} from 'react-native';
import AR3DOverlay, {type AR3DOverlayHandle} from './AR3DOverlay';

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
  /** When true, renders a generic AR3DOverlay (no game pieces). */
  arEnabled?: boolean;
  /** Ref forwarded to the internal AR3DOverlay so callers can invoke recenter(). */
  arOverlayRef?: React.Ref<AR3DOverlayHandle>;
};

const STATIC_ATTITUDE: AttitudeValue = {yaw: 0, pitch: 0, roll: 0};

export default function Photosphere360Background({
  panoramaSource = DEFAULT_PANORAMA,
  overlayOpacity = 0.3,
  children,
  arEnabled = false,
  arOverlayRef,
}: Props) {
  return (
    <AttitudeContext.Provider value={STATIC_ATTITUDE}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Image
          source={panoramaSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {overlayOpacity > 0 && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {backgroundColor: `rgba(0,0,0,${overlayOpacity})`},
            ]}
          />
        )}
      </View>
      {arEnabled && <AR3DOverlay ref={arOverlayRef} visible={true} />}
      {children}
    </AttitudeContext.Provider>
  );
}
