/**
 * ModeratorPanelScreen
 *
 * Moderator-only queue of pending message reports. Each row shows the
 * reported message, the reporter, the reason, and gives the moderator two
 * actions: dismiss (report goes away, message stays) or hide (report is
 * resolved and the message is soft-deleted from every user's chat feed).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api.service';
import { useAuth } from '../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../utils/BisetkaAlert';

interface Report {
  id: string;
  reporter_username: string | null;
  reported_username: string | null;
  chat_system: 'dm' | 'room';
  message_content: string | null;
  reason: string;
  details: string | null;
  created_at: string;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  sexual: 'Sexual content',
  threat: 'Threat',
  self_harm: 'Self-harm',
  impersonation: 'Impersonation',
  other: 'Other',
};

const ModeratorPanelScreen: React.FC<any> = ({ navigation }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiService.getPendingReports();
      setReports(res.reports as Report[]);
    } catch (e: any) {
      BisetkaAlert.error('Load failed', e?.message ?? 'Could not load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Block navigation for non-moderators (defensive — drawer entry already hidden)
  useEffect(() => {
    if (!loading && user && !user.isModerator) {
      navigation.goBack?.();
    }
  }, [loading, user, navigation]);

  const act = async (id: string, action: 'hide-message' | 'dismiss') => {
    setBusyId(id);
    try {
      await apiService.resolveReport(id, action);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      BisetkaAlert.error('Action failed', e?.message ?? 'Could not resolve report.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: Report }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.reasonPill}>{REASON_LABELS[item.reason] || item.reason}</Text>
        <Text style={styles.system}>{item.chat_system.toUpperCase()}</Text>
      </View>
      <Text style={styles.messageContent} numberOfLines={4}>
        {item.message_content || <Text style={{ fontStyle: 'italic' }}>(message content unavailable)</Text>}
      </Text>
      <Text style={styles.meta}>
        <Text style={styles.metaLabel}>From:</Text> {item.reported_username || 'Unknown'}   ·   <Text style={styles.metaLabel}>Reporter:</Text> {item.reporter_username || 'Unknown'}
      </Text>
      {item.details ? (
        <Text style={styles.details}>“{item.details}”</Text>
      ) : null}
      <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.dismissBtn]}
          onPress={() => act(item.id, 'dismiss')}
          disabled={busyId === item.id}
          activeOpacity={0.85}>
          {busyId === item.id ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionText}>Dismiss</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.hideBtn]}
          onPress={() => act(item.id, 'hide-message')}
          disabled={busyId === item.id}
          activeOpacity={0.85}>
          {busyId === item.id ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionText}>Hide message</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#a78bfa" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderator Panel</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={reports}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#a78bfa"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyText}>No pending reports.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0620' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reasonPill: {
    backgroundColor: 'rgba(220,38,38,0.2)',
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  system: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
  },
  messageContent: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginBottom: 4,
  },
  metaLabel: { color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  details: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  date: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  hideBtn: { backgroundColor: '#dc2626' },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 15 },
});

export default ModeratorPanelScreen;
