import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  NativeEventEmitter,
  NativeModules,
  InteractionManager,
} from 'react-native';
import { useI18n } from '../../../hooks/useI18n';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  ARCameraView,
  SphericalGuide,
  SphereViewer,
  VideoRecorder,
  composeEquirect,
  useVideoCapture,
} from '@sourceship13/react-native-capture360';
import type {
  ARCameraViewHandle,
  OrientationEvent,
  RecordingCompleteEvent,
} from '@sourceship13/react-native-capture360';

type NavigationProp = NativeStackNavigationProp<any>;

export default function PhotosphereScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [mode, setMode] = useState<'capture' | 'preview'>('capture');
  const [equirectPath, setEquirectPath] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressPhase, setProgressPhase] = useState('');
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [capturedCount, setCapturedCount] = useState(0);
  const [driftWarning, setDriftWarning] = useState(false);
  const prevCapturedCountRef = useRef(0);

  const cameraRef = useRef<ARCameraViewHandle>(null);
  const videoCapture = useVideoCapture();

  const yawOffsetRef = useRef<number | null>(null);
  const [arAttitude, setArAttitude] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    rawYaw: 0,
    resetYawOffset: () => {
      yawOffsetRef.current = null;
    },
  });

  // Delay mounting the native ARCameraView until after interactions settle
  useEffect(() => {
    if (!cameraActive) {
      setCameraReady(false);
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() => {
      setCameraReady(true);
    });
    return () => handle.cancel();
  }, [cameraActive]);

  // Only subscribe to native events once the camera is active
  useEffect(() => {
    if (!cameraActive) return;
    const emitter = new NativeEventEmitter(NativeModules.NativePhotosphere);
    const sub = emitter.addListener('stitchProgress', (event: any) => {
      setProgressPhase(event.phase);
      setProgressCurrent(event.current);
      setProgressTotal(event.total);
    });
    return () => sub.remove();
  }, [cameraActive]);

  const handleOrientationUpdate = useCallback(
    (event: OrientationEvent) => {
      const {yaw: rawYaw, pitch, roll, capturedCount: count} = event.nativeEvent;

      if (count != null) {
        setCapturedCount(count);
      }
      setDriftWarning(!!(event.nativeEvent as any).driftWarning);

      if (yawOffsetRef.current === null) {
        yawOffsetRef.current = rawYaw;
      }
      let yaw = rawYaw - (yawOffsetRef.current ?? 0);
      if (yaw > 180) yaw -= 360;
      if (yaw < -180) yaw += 360;

      setArAttitude(prev => ({...prev, yaw, pitch, roll, rawYaw}));

      if (count != null && count > prevCapturedCountRef.current) {
        prevCapturedCountRef.current = count;
        videoCapture.trackFrame(yaw, pitch, roll);
      }
    },
    [videoCapture],
  );

  const handleRecordingComplete = useCallback(
    (event: RecordingCompleteEvent) => {
      const {frameCount, frames, sessionDir} = event.nativeEvent;
      console.log(`[Photosphere] Recording complete: ${frameCount} frames in ${sessionDir}`);

      Alert.alert(
        'Recording Complete',
        `Frames: ${frameCount}\nCoverage: ${videoCapture.coveragePercent}%`,
        [
          {text: 'Retake', onPress: () => videoCapture.reset()},
          {
            text: 'Process',
            onPress: async () => {
              if (frameCount === 0) {
                Alert.alert('Error', 'No frames captured');
                return;
              }
              setProcessing(true);
              setProgressPhase('loading');
              setProgressCurrent(0);
              setProgressTotal(frameCount);
              try {
                const shots = frames.map((f: any, i: number) => ({
                  path: f.path,
                  yaw: f.yaw,
                  pitch: f.pitch,
                  hFov: f.hFov || 65,
                  vFov: f.vFov || 50,
                  rotationMatrix: f.rotationMatrix || null,
                  fx: f.fx,
                  fy: f.fy,
                  cx: f.cx,
                  cy: f.cy,
                  imageWidth: f.imageWidth,
                  imageHeight: f.imageHeight,
                  gridRow: f.gridRow ?? -1,
                  gridCol: f.gridCol ?? -1,
                  targetYaw: f.targetYaw ?? 0,
                  targetPitch: f.targetPitch ?? 0,
                }));
                const stitchedPath = await composeEquirect(shots);
                setEquirectPath(stitchedPath);
                setMode('preview');
              } catch (err) {
                console.error('[Photosphere] Compose error:', err);
                Alert.alert('Error', String(err));
              } finally {
                setProcessing(false);
              }
            },
          },
        ],
      );
    },
    [videoCapture],
  );

  const handleSessionToggle = useCallback(() => {
    if (videoCapture.isRecording) {
      videoCapture.stopRecording();
    } else {
      setCapturedCount(0);
      prevCapturedCountRef.current = 0;
      videoCapture.startRecording();
    }
  }, [videoCapture]);

  const handleCaptureFrame = useCallback(() => {
    if (!videoCapture.isRecording) return;
    cameraRef.current?.captureFrame();
  }, [videoCapture.isRecording]);

  const handleStartCamera = useCallback(async () => {
    try {
      const status = await VideoRecorder.requestCameraPermission();
      if (status === 'granted') {
        setHasPermission(true);
        setCameraActive(true);
      } else {
        Alert.alert('Permission Denied', 'Camera access is required to capture photospheres.');
      }
    } catch (err) {
      console.error('[Photosphere] Camera permission error:', err);
      Alert.alert('Error', 'Failed to request camera permission: ' + String(err));
    }
  }, []);

  // Landing screen — no native camera until user taps Start
  if (!cameraActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photosphere</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.permissionText}>📸 Capture 360° Photosphere</Text>
          <Text style={styles.permissionSubtext}>
            Use your camera to capture a full 360° panoramic photo. Move your device slowly to cover all angles.
          </Text>
          <TouchableOpacity style={styles.startButton} onPress={handleStartCamera}>
            <Text style={styles.startButtonText}>Start Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photosphere</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.permissionText}>Camera permission required</Text>
          <Text style={styles.permissionSubtext}>
            Please allow camera access in Settings to capture photospheres.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'preview' && equirectPath) {
    return (
      <SafeAreaView style={styles.container}>
        <SphereViewer imagePath={equirectPath} />
        <View style={styles.previewControls}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => {
              setMode('capture');
              setEquirectPath(null);
              videoCapture.reset();
            }}>
            <Text style={styles.buttonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.previewButton, styles.saveButton]}
            onPress={() => {
              Alert.alert('Saved', 'Photosphere saved successfully.');
              navigation.goBack();
            }}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const progressPercent =
    progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
  const phaseLabel =
    progressPhase === 'loading'
      ? 'Loading frames'
      : progressPhase === 'saving'
        ? 'Saving panorama'
        : 'Stitching';

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={processing} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#ec4899" />
            <Text style={styles.modalTitle}>{phaseLabel}</Text>
            <Text style={styles.modalStatus}>
              {progressCurrent}/{progressTotal} frames
            </Text>
            <View style={styles.progressBarModal}>
              <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]} />
            </View>
            <Text style={styles.modalPercent}>{progressPercent}%</Text>
          </View>
        </View>
      </Modal>

      {cameraReady ? (
        <ARCameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          isRecording={videoCapture.isRecording}
          onOrientationUpdate={handleOrientationUpdate}
          onRecordingComplete={handleRecordingComplete}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <ActivityIndicator size="large" color="#ec4899" />
          <Text style={{color: '#fff', marginTop: 12}}>Starting camera...</Text>
        </View>
      )}

      <SphericalGuide
        attitude={arAttitude}
        shots={[]}
        coverageGrid={videoCapture.coverageGrid}
        videoMode={true}
      />

      {/* Back button overlay */}
      <TouchableOpacity
        style={styles.floatingBack}
        onPress={() => navigation.goBack()}>
        <Text style={styles.floatingBackText}>←</Text>
      </TouchableOpacity>

      {/* Recording HUD */}
      <View style={styles.topHUD}>
        <View style={[styles.hudPill, videoCapture.isRecording && styles.hudPillRecording]}>
          {videoCapture.isRecording && <Text style={styles.recordingDot}>●</Text>}
          <Text style={styles.hudText}>
            {videoCapture.isRecording ? `${capturedCount} frames` : 'Ready'}
          </Text>
        </View>

        <View style={styles.hudPill}>
          <Text style={styles.hudText}>Coverage: {videoCapture.coveragePercent}%</Text>
          <View style={styles.coverageBar}>
            <View style={[styles.coverageBarFill, {width: `${videoCapture.coveragePercent}%`}]} />
          </View>
        </View>

        {driftWarning && (
          <View style={styles.driftBanner}>
            <Text style={styles.driftBannerText}>⚠️ Move back to center!</Text>
          </View>
        )}
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {!videoCapture.isRecording ? (
          <TouchableOpacity style={styles.startButton} onPress={handleSessionToggle}>
            <Text style={styles.startButtonText}>Start Capture</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.doneButton} onPress={handleSessionToggle}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCaptureFrame}
              activeOpacity={0.6}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <View style={styles.frameCountBadge}>
              <Text style={styles.frameCountText}>{capturedCount}</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionSubtext: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
  },
  floatingBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  floatingBackText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  topHUD: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    gap: 10,
  },
  hudPill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  hudPillRecording: {
    backgroundColor: 'rgba(220,0,0,0.8)',
  },
  recordingDot: {
    color: '#fff',
    fontSize: 18,
    marginRight: 6,
  },
  hudText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  coverageBar: {
    marginLeft: 8,
    width: 80,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  coverageBarFill: {
    height: '100%',
    backgroundColor: '#ec4899',
    borderRadius: 2,
  },
  driftBanner: {
    backgroundColor: 'rgba(255,165,0,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'center',
  },
  driftBannerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  startButton: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ec4899',
  },
  frameCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  frameCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  previewButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  saveButton: {
    backgroundColor: '#ec4899',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: 280,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  modalStatus: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 8,
  },
  progressBarModal: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ec4899',
    borderRadius: 3,
  },
  modalPercent: {
    color: '#ec4899',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
});
