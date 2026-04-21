/**
 * SyncedYouTubePlayer.tsx
 *
 * Collapsible YouTube player with search, queue, and room sync.
 *
 * Tabs (expanded):
 *   ▶ Player  — 16:9 YouTube IFrame
 *   🔍 Search — keyword search → play now or add to queue
 *   📋 Queue  — upcoming tracks, removable, auto-advances on song end
 *
 * Sync: all actions relay through the existing music_control socket event.
 */

import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import WebView from 'react-native-webview';
import {socketService} from '../services/SocketService';
import apiConfig from '../libs/utils/api.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type MusicAction = 'load' | 'play' | 'pause' | 'seek' | 'enqueue' | 'dequeue' | 'queue_sync';

interface QueueItem {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
}

interface MusicPayload {
  roomId: string;
  action: MusicAction;
  videoId?: string;
  currentTime?: number;
  sentAt?: number;
  queueItem?: QueueItem;
  queue?: QueueItem[];
}

interface SearchResult extends QueueItem {}

// YouTube IFrame player states
const YT_ENDED     =  0;
const YT_PLAYING   =  1;
const YT_PAUSED    =  2;
const YT_BUFFERING =  3;

type Tab = 'player' | 'search' | 'queue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── YouTube IFrame HTML ──────────────────────────────────────────────────────

const YOUTUBE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#000; overflow:hidden; }
  #player { width:100%; height:100%; }
</style>
</head>
<body>
<div id="player"></div>
<script>
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  var player;

  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      playerVars: {
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
      },
      events: {
        onReady: function() {
          notify({ type: 'ready' });
        },
        onStateChange: function(event) {
          var ct = 0;
          try { ct = player.getCurrentTime() || 0; } catch(e) {}
          var vd = {};
          try { vd = player.getVideoData() || {}; } catch(e) {}
          notify({
            type: 'stateChange',
            state: event.data,
            currentTime: ct,
            title: vd.title || '',
            videoId: vd.video_id || '',
          });
        },
        onError: function(event) {
          notify({ type: 'error', code: event.data });
        }
      }
    });
  }

  function notify(data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  // Called by React Native via injectJavaScript
  window.rnControl = function(cmd) {
    if (!player || typeof player.playVideo !== 'function') return;
    try {
      if (cmd.action === 'load') {
        player.loadVideoById({ videoId: cmd.videoId, startSeconds: cmd.startTime || 0 });
      } else if (cmd.action === 'play') {
        if (cmd.currentTime != null) player.seekTo(cmd.currentTime, true);
        player.playVideo();
      } else if (cmd.action === 'pause') {
        player.pauseVideo();
      } else if (cmd.action === 'seek') {
        player.seekTo(cmd.currentTime, true);
      } else if (cmd.action === 'getTime') {
        var t = 0;
        try { t = player.getCurrentTime() || 0; } catch(e) {}
        notify({ type: 'timeReport', pendingAction: cmd.pendingAction, currentTime: t });
      }
    } catch(e) {}
  };
</script>
</body>
</html>`;

// ─── Component ────────────────────────────────────────────────────────────────

interface SyncedYouTubePlayerProps {
  /** Current game room ID — null if not yet in a game (no sync). */
  roomId: string | null;
  /** Whether to show the player UI. */
  visible: boolean;
}

export default function SyncedYouTubePlayer({
  roomId,
  visible,
}: SyncedYouTubePlayerProps) {
  const webViewRef = useRef<WebView>(null);

  const [expanded, setExpanded]       = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>('player');
  const [playerReady, setPlayerReady] = useState(false);
  const [videoId, setVideoId]         = useState<string | null>(null);
  const [playing, setPlaying]         = useState(false);
  const [buffering, setBuffering]     = useState(false);
  const [videoTitle, setVideoTitle]   = useState('');

  // Queue
  const [queue, setQueue]             = useState<QueueItem[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState('');

  // Keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Shift the panel above the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  // ── Send a command to the YouTube player in the WebView ─────────────────
  const control = useCallback((cmd: object) => {
    webViewRef.current?.injectJavaScript(
      `window.rnControl(${JSON.stringify(cmd)});true;`,
    );
  }, []);

  // ── Emit a socket event to sync other players ────────────────────────────
  const syncToRoom = useCallback(
    (payload: Omit<MusicPayload, 'roomId'>) => {
      if (!roomId) return;
      socketService.emitMusicControl({roomId, ...payload, sentAt: Date.now()});
    },
    [roomId],
  );

  // ── Load a video locally (no socket emit) ────────────────────────────────
  const loadVideo = useCallback(
    (item: QueueItem, startTime = 0) => {
      setVideoId(item.videoId);
      setVideoTitle(item.title);
      setPlaying(true);
      control({action: 'load', videoId: item.videoId, startTime});
    },
    [control],
  );

  // ── Play next from queue ──────────────────────────────────────────────────
  const playNext = useCallback(() => {
    setQueue(current => {
      if (current.length === 0) return current;
      const [next, ...rest] = current;
      loadVideo(next);
      syncToRoom({action: 'load', videoId: next.videoId, currentTime: 0});
      return rest;
    });
  }, [loadVideo, syncToRoom]);

  // ── Apply a received (or self-initiated) music control action ────────────
  const applyRemote = useCallback(
    (data: MusicPayload) => {
      if (data.action === 'load' && data.videoId) {
        setVideoId(data.videoId);
        setPlaying(true);
        control({action: 'load', videoId: data.videoId, startTime: data.currentTime ?? 0});
      } else if (data.action === 'play') {
        setPlaying(true);
        const elapsed = data.sentAt ? (Date.now() - data.sentAt) / 1000 : 0;
        control({action: 'play', currentTime: (data.currentTime ?? 0) + elapsed});
      } else if (data.action === 'pause') {
        setPlaying(false);
        control({action: 'pause'});
      } else if (data.action === 'seek') {
        control({action: 'seek', currentTime: data.currentTime ?? 0});
      } else if (data.action === 'enqueue' && data.queueItem) {
        setQueue(q => [...q, data.queueItem!]);
      } else if (data.action === 'dequeue' && data.videoId !== undefined) {
        setQueue(q => {
          const idx = q.findIndex(i => i.videoId === data.videoId);
          if (idx === -1) return q;
          return [...q.slice(0, idx), ...q.slice(idx + 1)];
        });
      } else if (data.action === 'queue_sync' && data.queue) {
        setQueue(data.queue);
      }
    },
    [control],
  );

  // ── Subscribe to remote music_control events from the server ─────────────
  useEffect(() => {
    if (!roomId) return;
    const handler = (data: MusicPayload) => applyRemote(data);
    socketService.onMusicControl(handler);
    return () => { socketService.offMusicControl(); };
  }, [roomId, applyRemote]);

  // ── Handle messages from the WebView (YouTube player events) ─────────────
  const handleMessage = useCallback(
    (event: {nativeEvent: {data: string}}) => {
      let msg: any;
      try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

      if (msg.type === 'ready') { setPlayerReady(true); return; }

      if (msg.type === 'stateChange') {
        if (msg.title)   setVideoTitle(msg.title);
        if (msg.videoId) setVideoId(msg.videoId);
        if (msg.state === YT_PLAYING)        { setPlaying(true);  setBuffering(false); }
        else if (msg.state === YT_PAUSED)    { setPlaying(false); setBuffering(false); }
        else if (msg.state === YT_BUFFERING) { setBuffering(true); }
        else if (msg.state === YT_ENDED)     { playNext(); }
        return;
      }

      if (msg.type === 'timeReport') {
        if (msg.pendingAction === 'play') {
          syncToRoom({action: 'play', videoId: videoId ?? undefined, currentTime: msg.currentTime});
        } else if (msg.pendingAction === 'pause') {
          syncToRoom({action: 'pause', videoId: videoId ?? undefined, currentTime: msg.currentTime});
        }
      }
    },
    [syncToRoom, videoId, playNext],
  );

  // ── User presses Play / Pause ─────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!videoId || !playerReady) return;
    if (playing) {
      control({action: 'pause'});
      control({action: 'getTime', pendingAction: 'pause'});
    } else {
      control({action: 'play'});
      control({action: 'getTime', pendingAction: 'play'});
    }
  }, [videoId, playerReady, playing, control]);

  // ── Search YouTube ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError('');
    try {
      const url = `${apiConfig.baseURL}/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data?.error || 'Search failed');
        setSearchResults([]);
      } else {
        setSearchResults(data.items || []);
        if ((data.items || []).length === 0) setSearchError('No results found');
      }
    } catch {
      setSearchError('Network error — check connection');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // ── Play a search result immediately ─────────────────────────────────────
  const handlePlayNow = useCallback(
    (item: SearchResult) => {
      loadVideo(item);
      syncToRoom({action: 'load', videoId: item.videoId, currentTime: 0});
      setActiveTab('player');
    },
    [loadVideo, syncToRoom],
  );

  // ── Add search result to queue ────────────────────────────────────────────
  const handleEnqueue = useCallback(
    (item: SearchResult) => {
      const queueItem: QueueItem = {
        videoId: item.videoId,
        title: item.title,
        channel: item.channel,
        thumbnail: item.thumbnail,
      };
      setQueue(q => [...q, queueItem]);
      syncToRoom({action: 'enqueue', queueItem});
    },
    [syncToRoom],
  );

  // ── Remove item from queue ────────────────────────────────────────────────
  const handleDequeue = useCallback(
    (item: QueueItem) => {
      setQueue(q => {
        const idx = q.findIndex(i => i.videoId === item.videoId);
        if (idx === -1) return q;
        return [...q.slice(0, idx), ...q.slice(idx + 1)];
      });
      syncToRoom({action: 'dequeue', videoId: item.videoId});
    },
    [syncToRoom],
  );

  // ─────────────────────────────────────────────────────────────────────────

  if (!visible) return null;

  const hasVideo = !!videoId;

  return (
    <View style={[styles.container, {bottom: keyboardHeight}]}>

      {/* ── Mini bar ─────────────────────────────────────────────────── */}
      <View style={styles.bar}>
        <View style={styles.noteIcon}>
          <Text style={styles.noteText}>🎵</Text>
        </View>

        <Text style={styles.titleText} numberOfLines={1}>
          {hasVideo ? videoTitle || 'Loading...' : 'Add music'}
        </Text>

        {queue.length > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{queue.length}</Text>
          </View>
        )}

        {hasVideo && (
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handlePlayPause}
            hitSlop={{top:10,bottom:10,left:10,right:10}}
            disabled={!playerReady}>
            {buffering
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.playIcon}>{playing ? '⏸' : '▶'}</Text>
            }
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded(e => !e)}
          hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Expanded panel ───────────────────────────────────────────── */}
      {expanded && (
        <View style={styles.panel}>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {(['player', 'search', 'queue'] as Tab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'player' ? '▶ Player'
                    : tab === 'search' ? '🔍 Search'
                    : `📋 Queue${queue.length > 0 ? ` (${queue.length})` : ''}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Player tab ──────────────────────────────────────────── */}
          {activeTab === 'player' && (
            <View>
              <View style={styles.playerContainer}>
                <WebView
                  ref={webViewRef}
                  source={{html: YOUTUBE_HTML}}
                  style={styles.webview}
                  scrollEnabled={false}
                  bounces={false}
                  mediaPlaybackRequiresUserAction={false}
                  allowsInlineMediaPlayback
                  originWhitelist={['*']}
                  onMessage={handleMessage}
                  onShouldStartLoadWithRequest={req =>
                    req.url === 'about:blank' ||
                    req.url.startsWith('http') ||
                    req.url.startsWith('https') ||
                    req.url.startsWith('data:')
                  }
                />
                {!playerReady && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>
              {roomId && (
                <Text style={styles.syncNote}>🔗 Controls sync to all players</Text>
              )}
            </View>
          )}

          {/* ── Search tab ──────────────────────────────────────────── */}
          {activeTab === 'search' && (
            <View style={styles.searchPanel}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={text => { setSearchQuery(text); setSearchError(''); }}
                  placeholder="Search YouTube…"
                  placeholderTextColor="#888"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  style={[styles.searchBtn, (!searchQuery.trim() || searching) && styles.searchBtnDisabled]}
                  onPress={handleSearch}
                  disabled={!searchQuery.trim() || searching}>
                  {searching
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={styles.searchBtnText}>Search</Text>
                  }
                </TouchableOpacity>
              </View>

              {!!searchError && (
                <Text style={styles.errorText}>{searchError}</Text>
              )}

              <FlatList
                data={searchResults}
                keyExtractor={item => item.videoId}
                style={styles.resultsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({item}) => (
                  <View style={styles.resultRow}>
                    {!!item.thumbnail && (
                      <Image source={{uri: item.thumbnail}} style={styles.thumb} />
                    )}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.resultChannel} numberOfLines={1}>{item.channel}</Text>
                    </View>
                    <View style={styles.resultActions}>
                      <TouchableOpacity style={styles.playNowBtn} onPress={() => handlePlayNow(item)}>
                        <Text style={styles.playNowText}>▶</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addQueueBtn} onPress={() => handleEnqueue(item)}>
                        <Text style={styles.addQueueText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  !searching && !searchError
                    ? <Text style={styles.emptyText}>Search to find music</Text>
                    : null
                }
              />
            </View>
          )}

          {/* ── Queue tab ───────────────────────────────────────────── */}
          {activeTab === 'queue' && (
            <View style={styles.queuePanel}>
              <FlatList
                data={queue}
                keyExtractor={(item, idx) => `${item.videoId}-${idx}`}
                style={styles.queueList}
                renderItem={({item, index}) => (
                  <View style={styles.queueRow}>
                    <Text style={styles.queueIndex}>{index + 1}</Text>
                    {!!item.thumbnail && (
                      <Image source={{uri: item.thumbnail}} style={styles.thumb} />
                    )}
                    <View style={styles.queueInfo}>
                      <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                      {!!item.channel && (
                        <Text style={styles.resultChannel} numberOfLines={1}>{item.channel}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleDequeue(item)}
                      hitSlop={{top:8,bottom:8,left:8,right:8}}>
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Queue is empty — search and tap + to add</Text>
                }
              />
              {queue.length > 0 && (
                <TouchableOpacity
                  style={styles.clearQueueBtn}
                  onPress={() => {
                    setQueue([]);
                    syncToRoom({action: 'queue_sync', queue: []});
                  }}>
                  <Text style={styles.clearQueueText}>Clear queue</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const {height: SCREEN_H} = Dimensions.get('window');
const BAR_HEIGHT  = 44;
const LIST_HEIGHT = Math.min(260, SCREEN_H * 0.32);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(12, 12, 18, 0.96)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,215,0,0.25)',
  },
  // ── Bar ──────────────────────────────────────────────────────────────────
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  noteIcon:  { width: 28, alignItems: 'center' },
  noteText:  { fontSize: 18 },
  titleText: { flex: 1, color: '#ddd', fontSize: 13, fontWeight: '500' },
  queueBadge: {
    backgroundColor: '#d4af37',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  queueBadgeText: { color: '#000', fontSize: 11, fontWeight: '700' },
  playBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
  },
  playIcon:   { fontSize: 16, color: '#fff' },
  expandBtn:  { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  expandIcon: { fontSize: 20, color: '#aaa' },
  // ── Panel ─────────────────────────────────────────────────────────────────
  panel: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab:           { flex: 1, paddingVertical: 9, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: '#d4af37' },
  tabText:       { color: '#888', fontSize: 12 },
  tabTextActive: { color: '#d4af37', fontWeight: '600' },
  // ── Player tab ─────────────────────────────────────────────────────────────
  playerContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  webview:         { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  syncNote: { color: '#555', fontSize: 11, textAlign: 'center', paddingVertical: 6 },
  // ── Search tab ─────────────────────────────────────────────────────────────
  searchPanel: { paddingTop: 8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchBtn: {
    paddingHorizontal: 14,
    height: 40,
    backgroundColor: '#d4af37',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: { backgroundColor: '#555' },
  searchBtnText:     { color: '#000', fontWeight: '700', fontSize: 13 },
  resultsList: { maxHeight: LIST_HEIGHT },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  thumb:         { width: 56, height: 42, borderRadius: 4, backgroundColor: '#222' },
  resultInfo:    { flex: 1 },
  resultTitle:   { color: '#eee', fontSize: 12, lineHeight: 16 },
  resultChannel: { color: '#888', fontSize: 11, marginTop: 2 },
  resultActions: { flexDirection: 'row', gap: 6 },
  playNowBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#d4af37',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playNowText: { color: '#000', fontSize: 13, fontWeight: '700' },
  addQueueBtn: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addQueueText: { color: '#fff', fontSize: 20, lineHeight: 26 },
  // ── Queue tab ──────────────────────────────────────────────────────────────
  queuePanel: { paddingTop: 4 },
  queueList:  { maxHeight: LIST_HEIGHT },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  queueIndex: { color: '#d4af37', fontSize: 12, fontWeight: '700', width: 18, textAlign: 'center' },
  queueInfo:  { flex: 1 },
  removeBtn:  { padding: 4 },
  removeText: { color: '#ff6b6b', fontSize: 14, fontWeight: '700' },
  clearQueueBtn: {
    margin: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  clearQueueText: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
  // ── Misc ───────────────────────────────────────────────────────────────────
  errorText: { color: '#ff6b6b', fontSize: 12, paddingHorizontal: 12, paddingBottom: 6 },
  emptyText: { color: '#555', fontSize: 12, textAlign: 'center', paddingVertical: 24 },
});
