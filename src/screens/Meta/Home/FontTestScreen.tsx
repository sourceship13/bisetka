import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { useI18n } from '../../../hooks/useI18n';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// Every font file sitting in assets/fonts/, keyed by a display label and the
// PostScript / family name React Native uses for fontFamily.
// ---------------------------------------------------------------------------

type FontEntry = {
  /** Human-readable group heading */
  family: string;
  /** fontFamily value passed to the Text style */
  fontFamily: string;
};

const FONT_ENTRIES: FontEntry[] = [
  // ── BebasNeue ────────────────────────────────────────────────────────────
  { family: 'BebasNeue', fontFamily: 'BebasNeue-Regular' },

  // ── Cinzel ───────────────────────────────────────────────────────────────
  { family: 'Cinzel', fontFamily: 'Cinzel-Regular' },
  { family: 'Cinzel', fontFamily: 'Cinzel-Medium' },
  { family: 'Cinzel', fontFamily: 'Cinzel-SemiBold' },
  { family: 'Cinzel', fontFamily: 'Cinzel-Bold' },
  { family: 'Cinzel', fontFamily: 'Cinzel-ExtraBold' },
  { family: 'Cinzel', fontFamily: 'Cinzel-Black' },

  // ── CrimsonText ──────────────────────────────────────────────────────────
  { family: 'CrimsonText', fontFamily: 'CrimsonText-Regular' },
  { family: 'CrimsonText', fontFamily: 'CrimsonText-Italic' },
  { family: 'CrimsonText', fontFamily: 'CrimsonText-SemiBold' },
  { family: 'CrimsonText', fontFamily: 'CrimsonText-SemiBoldItalic' },
  { family: 'CrimsonText', fontFamily: 'CrimsonText-Bold' },
  { family: 'CrimsonText', fontFamily: 'CrimsonText-BoldItalic' },

  // ── EBGaramond ───────────────────────────────────────────────────────────
  { family: 'EBGaramond', fontFamily: 'EBGaramond-Regular' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-Italic' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-Medium' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-MediumItalic' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-SemiBold' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-SemiBoldItalic' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-Bold' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-BoldItalic' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-ExtraBold' },
  { family: 'EBGaramond', fontFamily: 'EBGaramond-ExtraBoldItalic' },

  // ── Fredoka (normal width) ────────────────────────────────────────────────
  { family: 'Fredoka', fontFamily: 'Fredoka-Light' },
  { family: 'Fredoka', fontFamily: 'Fredoka-Regular' },
  { family: 'Fredoka', fontFamily: 'Fredoka-Medium' },
  { family: 'Fredoka', fontFamily: 'Fredoka-SemiBold' },
  { family: 'Fredoka', fontFamily: 'Fredoka-Bold' },

  // ── Fredoka SemiCondensed ─────────────────────────────────────────────────
  { family: 'Fredoka SemiCondensed', fontFamily: 'FredokaSemiCondensed-Light' },
  { family: 'Fredoka SemiCondensed', fontFamily: 'FredokaSemiCondensed-Regular' },
  { family: 'Fredoka SemiCondensed', fontFamily: 'FredokaSemiCondensed-Medium' },
  { family: 'Fredoka SemiCondensed', fontFamily: 'FredokaSemiCondensed-SemiBold' },
  { family: 'Fredoka SemiCondensed', fontFamily: 'FredokaSemiCondensed-Bold' },

  // ── Fredoka Condensed ─────────────────────────────────────────────────────
  { family: 'Fredoka Condensed', fontFamily: 'FredokaCondensed-Light' },
  { family: 'Fredoka Condensed', fontFamily: 'FredokaCondensed-Regular' },
  { family: 'Fredoka Condensed', fontFamily: 'FredokaCondensed-Medium' },
  { family: 'Fredoka Condensed', fontFamily: 'FredokaCondensed-SemiBold' },
  { family: 'Fredoka Condensed', fontFamily: 'FredokaCondensed-Bold' },

  // ── Fredoka SemiExpanded ──────────────────────────────────────────────────
  { family: 'Fredoka SemiExpanded', fontFamily: 'FredokaSemiExpanded-Light' },
  { family: 'Fredoka SemiExpanded', fontFamily: 'FredokaSemiExpanded-Regular' },
  { family: 'Fredoka SemiExpanded', fontFamily: 'FredokaSemiExpanded-Medium' },
  { family: 'Fredoka SemiExpanded', fontFamily: 'FredokaSemiExpanded-SemiBold' },
  { family: 'Fredoka SemiExpanded', fontFamily: 'FredokaSemiExpanded-Bold' },

  // ── Fredoka Expanded ──────────────────────────────────────────────────────
  { family: 'Fredoka Expanded', fontFamily: 'FredokaExpanded-Light' },
  { family: 'Fredoka Expanded', fontFamily: 'FredokaExpanded-Regular' },
  { family: 'Fredoka Expanded', fontFamily: 'FredokaExpanded-Medium' },
  { family: 'Fredoka Expanded', fontFamily: 'FredokaExpanded-SemiBold' },
  { family: 'Fredoka Expanded', fontFamily: 'FredokaExpanded-Bold' },

  // ── Inter 18pt ───────────────────────────────────────────────────────────
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Thin' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-ThinItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-ExtraLight' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-ExtraLightItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Light' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-LightItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Regular' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Italic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Medium' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-MediumItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-SemiBold' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-SemiBoldItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Bold' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-BoldItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-ExtraBold' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-ExtraBoldItalic' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-Black' },
  { family: 'Inter 18pt', fontFamily: 'Inter18pt-BlackItalic' },

  // ── Inter 24pt ───────────────────────────────────────────────────────────
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Thin' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-ThinItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-ExtraLight' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-ExtraLightItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Light' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-LightItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Regular' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Italic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Medium' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-MediumItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-SemiBold' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-SemiBoldItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Bold' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-BoldItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-ExtraBold' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-ExtraBoldItalic' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-Black' },
  { family: 'Inter 24pt', fontFamily: 'Inter24pt-BlackItalic' },

  // ── Inter 28pt ───────────────────────────────────────────────────────────
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Thin' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-ThinItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-ExtraLight' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-ExtraLightItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Light' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-LightItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Regular' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Italic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Medium' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-MediumItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-SemiBold' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-SemiBoldItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Bold' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-BoldItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-ExtraBold' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-ExtraBoldItalic' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-Black' },
  { family: 'Inter 28pt', fontFamily: 'Inter28pt-BlackItalic' },

  // ── JetBrainsMono ─────────────────────────────────────────────────────────
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Thin' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-ThinItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-ExtraLight' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-ExtraLightItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Light' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-LightItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Regular' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Italic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Medium' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-MediumItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-SemiBold' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-SemiBoldItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-Bold' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-BoldItalic' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-ExtraBold' },
  { family: 'JetBrainsMono', fontFamily: 'JetBrainsMono-ExtraBoldItalic' },

  // ── PlayfairDisplaySC ─────────────────────────────────────────────────────
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-Regular' },
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-Italic' },
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-Bold' },
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-BoldItalic' },
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-Black' },
  { family: 'PlayfairDisplaySC', fontFamily: 'PlayfairDisplaySC-BlackItalic' },

  // ── RobotoMono ────────────────────────────────────────────────────────────
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Thin' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-ThinItalic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-ExtraLight' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-ExtraLightItalic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Light' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-LightItalic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Regular' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Italic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Medium' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-MediumItalic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-SemiBold' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-SemiBoldItalic' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-Bold' },
  { family: 'RobotoMono', fontFamily: 'RobotoMono-BoldItalic' },

  // ── SpaceMono ─────────────────────────────────────────────────────────────
  { family: 'SpaceMono', fontFamily: 'SpaceMono-Regular' },
  { family: 'SpaceMono', fontFamily: 'SpaceMono-Italic' },
  { family: 'SpaceMono', fontFamily: 'SpaceMono-Bold' },
  { family: 'SpaceMono', fontFamily: 'SpaceMono-BoldItalic' },
];

// Pre-compute unique families in order
const FAMILIES = Array.from(new Set(FONT_ENTRIES.map(e => e.family)));

const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog  0123456789';
const FONT_SIZE = 18;

const FontTestScreen = ({ navigation }: any) => {
  const { translate } = useI18n();
  const [preview, setPreview] = useState(PREVIEW_TEXT);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const visibleEntries = selectedFamily
    ? FONT_ENTRIES.filter(e => e.family === selectedFamily)
    : FONT_ENTRIES;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Font Test</Text>
        <Text style={styles.count}>{FONT_ENTRIES.length} fonts</Text>
      </View>

      {/* ── Live preview text input ── */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={preview}
          onChangeText={setPreview}
          placeholder="Type something to preview…"
          placeholderTextColor="#aaa"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Family filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chip, !selectedFamily && styles.chipActive]}
          onPress={() => setSelectedFamily(null)}>
          <Text style={[styles.chipText, !selectedFamily && styles.chipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {FAMILIES.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, selectedFamily === f && styles.chipActive]}
            onPress={() => setSelectedFamily(selectedFamily === f ? null : f)}>
            <Text style={[styles.chipText, selectedFamily === f && styles.chipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Font list ── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {(() => {
          const items: React.ReactElement[] = [];
          let lastFamily = '';

          visibleEntries.forEach((entry, idx) => {
            // Section heading when family changes
            if (entry.family !== lastFamily) {
              items.push(
                <View key={`h-${entry.family}`} style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{entry.family}</Text>
                </View>,
              );
              lastFamily = entry.family;
            }

            items.push(
              <View key={`f-${idx}`} style={styles.fontRow}>
                <Text style={styles.fontLabel}>{entry.fontFamily}</Text>
                <Text
                  style={{ fontFamily: entry.fontFamily, fontSize: FONT_SIZE, color: '#1a1a1a' }}
                  numberOfLines={1}>
                  {preview || PREVIEW_TEXT}
                </Text>
              </View>,
            );
          });

          return items;
        })()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default FontTestScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  backBtn: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  count: {
    fontSize: 12,
    color: '#888',
  },
  inputWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111',
  },
  chipsRow: {
    flexGrow: 0,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  chips: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fontRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  fontLabel: {
    fontSize: 10,
    color: '#aaa',
    marginBottom: 3,
    fontFamily: 'System',
  },
});
