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
import {View, StyleSheet, Image, Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {SphereViewer, useAttitude} from '@sourceship13/react-native-capture360';
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

export default function Photosphere360Background({
  panoramaSource = DEFAULT_PANORAMA,
  initialPitch = -5,
  gyroEnabled = true,
  heightOffset = 0.08,
  overlayOpacity = 0.3,
  children,
  arEnabled = false,
  arOverlayRef,
}: Props) {
  const attitude = useAttitude();

  const panoramaImagePath = React.useMemo(() => {
    const resolved = Image.resolveAssetSource(panoramaSource);
    const uri = resolved?.uri;
    if (!uri) {
      return undefined;
    }

    // SphereViewer's native readFileBase64 expects a local file path.
    // In release/TestFlight, this avoids fetch-based placeholder loading getting stuck.
    if (uri.startsWith('file://') || uri.startsWith('/')) {
      return uri;
    }

    // iOS release may return a bundle-relative asset path (no URI scheme).
    if (Platform.OS === 'ios' && !uri.includes('://')) {
      return `${RNFS.MainBundlePath}/${uri.replace(/^\/+/, '')}`;
    }

    // Dev Metro URLs (http://...) continue through placeholderSource fallback.
    return undefined;
  }, [panoramaSource]);

  return (
    <AttitudeContext.Provider value={attitude}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SphereViewer
          imagePath={panoramaImagePath}
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
      {/* Generic AR overlay (no pieces) when arEnabled=true */}
      {arEnabled && <AR3DOverlay ref={arOverlayRef} visible={true} />}
      {/* Children (AR3DOverlay etc.) render on top of the sphere viewer */}
      {children}
    </AttitudeContext.Provider>
  );
}
