/**
 * useVoiceChat — WebRTC P2P voice chat hook for in-game use.
 *
 * Architecture:
 *  • Caller/callee is decided automatically: both players call startCall().
 *    Whoever does NOT receive a remote "voice:offer" within 1.5 s becomes
 *    the caller and sends the offer.  The one who receives the offer first
 *    becomes the callee and answers it.
 *  • Signaling is relayed through the existing game socket via the backend
 *    (voice:offer / voice:answer / voice:ice-candidate / voice:hangup).
 *  • Only audio tracks are used (no video).
 *  • Muting yourself disables the local audio track.
 *  • Muting the opponent disables the incoming remote audio track.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { socketService } from '../services/SocketService';

// ─── Public types ─────────────────────────────────────────────────────────────

export type VoiceCallState = 'idle' | 'connecting' | 'connected' | 'error';

export interface UseVoiceChatReturn {
  callState: VoiceCallState;
  isMuted: boolean;
  isOpponentMuted: boolean;
  startCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleOpponentMute: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/** How long (ms) to wait for a remote offer before we take the caller role. */
const CALLER_DECISION_DELAY_MS = 1500;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceChat(
  roomId: string,
  currentUserId: string,
  isActive: boolean,
): UseVoiceChatReturn {
  const [callState, setCallState] = useState<VoiceCallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isOpponentMuted, setIsOpponentMuted] = useState(false);

  // Refs so callbacks never capture stale closure state
  const pcRef = useRef<InstanceType<typeof RTCPeerConnection> | null>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const callerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callActiveRef = useRef(false);  // true while a call setup / call is live

  // ── Helpers ────────────────────────────────────────────────────────────────

  const detachVoiceListeners = useCallback(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.off('voice:offer');
    socket.off('voice:answer');
    socket.off('voice:ice-candidate');
    socket.off('voice:hangup');
  }, []);

  const cleanup = useCallback(() => {
    if (callerTimerRef.current) {
      clearTimeout(callerTimerRef.current);
      callerTimerRef.current = null;
    }
    detachVoiceListeners();
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    callActiveRef.current = false;
    setCallState('idle');
    setIsMuted(false);
    setIsOpponentMuted(false);
  }, [detachVoiceListeners]);

  // ── Tear down when game ends / component unmounts ──────────────────────────

  useEffect(() => {
    if (!isActive) cleanup();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ── startCall ──────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!isActive || !roomId || callActiveRef.current) return;

    const socket = socketService.getSocket();
    if (!socket?.connected) return;

    callActiveRef.current = true;
    setCallState('connecting');

    // 1. Request microphone permission
    const granted = await requestMicPermission();
    if (!granted) {
      callActiveRef.current = false;
      setCallState('error');
      return;
    }

    // 2. Capture local audio
    let localStream: any;
    try {
      localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      console.warn('[VoiceChat] getUserMedia failed:', err);
      callActiveRef.current = false;
      setCallState('error');
      return;
    }
    if (!callActiveRef.current) {
      // cleanup was called while we were awaiting
      localStream.getTracks().forEach((t: any) => t.stop());
      return;
    }
    localStreamRef.current = localStream;

    // 3. Build PeerConnection
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    localStream.getTracks().forEach((track: any) => {
      pc.addTrack(track, localStream);
    });

    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate && socket.connected) {
        socketService.emitVoiceIceCandidate(roomId, event.candidate);
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      if (!callActiveRef.current) return;
      const state = (pc as any).iceConnectionState as string;
      if (state === 'connected' || state === 'completed') {
        setCallState('connected');
      } else if (state === 'failed') {
        setCallState('error');
      } else if (state === 'disconnected') {
        setCallState('connecting');
      }
    };

    (pc as any).ontrack = (event: any) => {
      if (event.streams?.[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };

    // 4. Attach signaling listeners

    // voice:offer → we are the callee
    const handleOffer = async (data: { sdp: any }) => {
      if (!callActiveRef.current || !pcRef.current) return;
      // Cancel the caller-decision timer because we received an offer first
      if (callerTimerRef.current) {
        clearTimeout(callerTimerRef.current);
        callerTimerRef.current = null;
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await (pcRef.current as any).createAnswer({});
        await pcRef.current.setLocalDescription(answer as any);
        socketService.emitVoiceAnswer(roomId, answer);
      } catch (err) {
        console.warn('[VoiceChat] answer flow error:', err);
        setCallState('error');
      }
    };

    // voice:answer → we are the caller, remote accepted
    const handleAnswer = async (data: { sdp: any }) => {
      if (!callActiveRef.current || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.warn('[VoiceChat] setRemoteDescription (answer) error:', err);
      }
    };

    // voice:ice-candidate → trickle ICE
    const handleIce = async (data: { candidate: any }) => {
      if (!callActiveRef.current || !pcRef.current || !data.candidate) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        // Non-fatal, can happen during re-negotiation
        console.warn('[VoiceChat] addIceCandidate error:', err);
      }
    };

    // voice:hangup → opponent ended call
    const handleHangup = () => cleanup();

    detachVoiceListeners(); // clear any stale listeners first
    socket.on('voice:offer', handleOffer);
    socket.on('voice:answer', handleAnswer);
    socket.on('voice:ice-candidate', handleIce);
    socket.on('voice:hangup', handleHangup);

    // 5. Caller-decision: if no offer arrives within CALLER_DECISION_DELAY_MS,
    //    we take the initiative and create the offer ourselves.
    callerTimerRef.current = setTimeout(async () => {
      callerTimerRef.current = null;
      if (!callActiveRef.current || !pcRef.current) return;
      try {
        const offer = await (pcRef.current as any).createOffer({});
        await pcRef.current.setLocalDescription(offer as any);
        socketService.emitVoiceOffer(roomId, offer);
      } catch (err) {
        console.warn('[VoiceChat] createOffer error:', err);
        setCallState('error');
      }
    }, CALLER_DECISION_DELAY_MS);
  }, [isActive, roomId, cleanup, detachVoiceListeners]);

  // ── hangup ─────────────────────────────────────────────────────────────────

  const hangup = useCallback(() => {
    if (!callActiveRef.current) return;
    socketService.emitVoiceHangup(roomId);
    cleanup();
  }, [roomId, cleanup]);

  // ── Mute controls ──────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((track: any) => { track.enabled = !track.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleOpponentMute = useCallback(() => {
    const tracks = remoteStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((track: any) => { track.enabled = !track.enabled; });
    setIsOpponentMuted(prev => !prev);
  }, []);

  return {
    callState,
    isMuted,
    isOpponentMuted,
    startCall,
    hangup,
    toggleMute,
    toggleOpponentMute,
  };
}

// ─── Permission helper ────────────────────────────────────────────────────────

async function requestMicPermission(): Promise<boolean> {
  try {
    const permission =
      Platform.OS === 'ios'
        ? PERMISSIONS.IOS.MICROPHONE
        : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const result = await request(permission);
    return result === RESULTS.GRANTED;
  } catch {
    return false;
  }
}
