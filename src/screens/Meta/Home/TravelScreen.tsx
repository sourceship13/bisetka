import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import bisetkaService, { Neighborhood } from '../../../services/bisetka.service';
import apiService from '../../../services/api.service';
import bisetkaStorageService from '../../../services/bisetkaStorage.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { normalizeStateName, getUniqueNormalizedStates } from '../../../utils/stateNormalizer';

type NavigationProp = NativeStackNavigationProp<any>;

const TRAVEL_COST = 100;

const COUNTRY_CHIPS: Array<{
  code: 'all' | 'US' | 'AM' | 'RU';
  label: string;
  flag: string;
}> = [
  { code: 'all', label: 'All Countries', flag: '🌍' },
  { code: 'US', label: 'United States', flag: '🇺🇸' },
  { code: 'AM', label: 'Armenia', flag: '🇦🇲' },
  { code: 'RU', label: 'Russia', flag: '🇷🇺' },
];

const formatTravelLocationName = (location: Neighborhood) =>
  `${location.name}, ${location.city}`;

export default function TravelScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const [locations, setLocations] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [travelingTo, setTravelingTo] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] =
    useState<'all' | 'US' | 'RU' | 'AM'>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    setSelectedState('all');
  }, [selectedCountry]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const allLocations = await bisetkaService.getAllNeighborhoods();
      const seen = new Set<string>();
      const unique = allLocations.filter(loc => {
        if (seen.has(loc.id)) return false;
        seen.add(loc.id);
        return true;
      });
      const sorted = unique.sort((a, b) => {
        if (a.country !== b.country) return a.country.localeCompare(b.country);
        if (a.city !== b.city) return a.city.localeCompare(b.city);
        return a.name.localeCompare(b.name);
      });
      setLocations(sorted);
    } catch (error: any) {
      BisetkaAlert.error(
        'Failed to load locations',
        error.message || 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const normalizedLocations = useMemo(
    () =>
      locations.map(loc => ({
        ...loc,
        normalizedState: normalizeStateName(loc.state, loc.country),
      })),
    [locations],
  );

  const availableStates = useMemo(() => {
    if (selectedCountry === 'all') return [];
    const countryLocations = locations.filter(
      loc => loc.country === selectedCountry,
    );
    return getUniqueNormalizedStates(countryLocations);
  }, [locations, selectedCountry]);

  const filteredLocations = useMemo(() => {
    let filtered = normalizedLocations;
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(loc => loc.country === selectedCountry);
    }
    if (selectedState !== 'all') {
      filtered = filtered.filter(loc => loc.normalizedState === selectedState);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        loc =>
          loc.name.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.country.toLowerCase().includes(q) ||
          loc.normalizedState.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [normalizedLocations, searchQuery, selectedCountry, selectedState]);

  const handleTravel = (location: Neighborhood) => {
    if ((user?.balance || 0) < TRAVEL_COST) {
      BisetkaAlert.error(
        'Insufficient Points',
        `You need ${TRAVEL_COST} points to travel. You have ${user?.balance || 0}.`,
      );
      return;
    }
    Alert.alert(
      'Travel to Bisetka',
      `Travel to ${formatTravelLocationName(location)}?\n\nCost: ${TRAVEL_COST} points`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Travel', onPress: () => confirmTravel(location) },
      ],
    );
  };

  const confirmTravel = async (location: Neighborhood) => {
    try {
      setTravelingTo(location.id);
      const response = await apiService.post<{
        success: boolean;
        message?: string;
        bisetka?: any;
      }>(
        '/bisetka/travel',
        { neighborhood_id: location.id },
        true,
      );

      if (response.success) {
        await refreshUser();
        if (response.bisetka) {
          await bisetkaStorageService.storeBisetka({
            id: response.bisetka.id,
            neighborhood: response.bisetka.neighborhood_name,
            city: response.bisetka.city,
            country: response.bisetka.country,
            active_users: response.bisetka.active_users || 0,
            source: 'travel',
          });
        }
        BisetkaAlert.success(
          'Travel Complete!',
          `You've traveled to ${formatTravelLocationName(location)}.`,
        );
        setTimeout(() => {
          navigation.navigate('Home', {
            forceBackgroundReload: Date.now(),
            traveledTo: location.id,
          });
        }, 1200);
      } else {
        throw new Error(response.message || 'Travel failed');
      }
    } catch (error: any) {
      BisetkaAlert.error(
        'Travel Failed',
        error.message || error.error || 'Please try again.',
      );
    } finally {
      setTravelingTo(null);
    }
  };

  const handleCreateYours = () => {
    Alert.alert(
      'Create Your Bisetka',
      'Creating your own bisetka is coming soon!',
    );
  };

  const renderLocationCard = ({ item }: { item: Neighborhood }) => {
    const isCurrent = user?.neighborhood_id === item.id;
    const isTraveling = travelingTo === item.id;
    return (
      <TouchableOpacity
        disabled={isCurrent || isTraveling}
        onPress={() => handleTravel(item)}
        activeOpacity={0.85}
        style={styles.locationCardWrap}>
        <View
          style={[
            styles.locationCard,
            { backgroundColor: isCurrent ? '#22c55e' : '#7a6cf5' },
          ]}> 
          <Icon name="map-marker" size={36} color="#fff" />
          <View style={styles.locationText}>
            <Text style={styles.locationName} numberOfLines={1}>
              {formatTravelLocationName(item)}
            </Text>
            <Text style={styles.locationCountry}>{item.country}</Text>
          </View>
          {isTraveling ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 12 }} />
          ) : isCurrent ? (
            <View style={styles.currentPill}>
              <Text style={styles.currentPillText}>Current</Text>
            </View>
          ) : (
            <View
              style={[styles.travelPill, { backgroundColor: '#fbbf24' }]}>
              <Icon name="airplane" size={18} color="#fff" />
              <Text style={styles.travelPillText}>{TRAVEL_COST}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Top header card */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}>
            <Icon name="chevron-left" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topHeaderTitle}>Locations</Text>
          <View style={styles.topHeaderRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PointsShop')}
              activeOpacity={0.85}>
              <View style={styles.pointsPill}>
                <Text style={styles.pointsCoin}>🪙</Text>
                <Text style={styles.pointsAmount}>
                  {Math.floor(user?.balance || 0).toLocaleString()}
                </Text>
                <View style={styles.pointsPlus}>
                  <Icon name="plus" size={11} color="#fff" />
                  <Text style={styles.pointsPlusText}>Get Points</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('GlobalView', { userId: user?.id })
              }
              style={styles.globeBtn}
              activeOpacity={0.85}>
              <Icon name="earth" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Map / List toggle */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity
            onPress={() => {
              setViewMode('map');
              navigation.navigate('GlobalView', { userId: user?.id });
            }}
            activeOpacity={0.85}
            style={[
              styles.viewToggle,
              viewMode === 'map' && styles.viewToggleActive,
            ]}>
            <Text
              style={[
                styles.viewToggleText,
                viewMode === 'map' && styles.viewToggleTextActive,
              ]}>
              Map view
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            activeOpacity={0.85}
            style={[
              styles.viewToggle,
              viewMode === 'list' && styles.viewToggleActive,
            ]}>
            <Text
              style={[
                styles.viewToggleText,
                viewMode === 'list' && styles.viewToggleTextActive,
              ]}>
              List view
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search + Create Yours */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Icon name="magnify" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lacotion..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            onPress={handleCreateYours}
            activeOpacity={0.85}
            style={styles.createBtnWrap}>
            <View style={[styles.createBtn, { backgroundColor: '#f59e0b' }]}>
              <Text style={styles.createBtnText}>CREATE YOURS</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Country chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {COUNTRY_CHIPS.map(c => {
            const active = selectedCountry === c.code;
            return (
              <TouchableOpacity
                key={c.code}
                onPress={() => setSelectedCountry(c.code)}
                activeOpacity={0.85}
                style={[styles.countryChip, active && styles.countryChipActive]}>
                <View style={styles.flagBubble}>
                  <Text style={styles.flagEmoji}>{c.flag}</Text>
                </View>
                <Text
                  style={[
                    styles.countryChipText,
                    active && styles.countryChipTextActive,
                  ]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* State chips */}
        {selectedCountry !== 'all' && availableStates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            <TouchableOpacity
              onPress={() => setSelectedState('all')}
              activeOpacity={0.85}
              style={[
                styles.stateChip,
                selectedState === 'all' && styles.stateChipActive,
              ]}>
              <Text
                style={[
                  styles.stateChipText,
                  selectedState === 'all' && styles.stateChipTextActive,
                ]}>
                All States
              </Text>
            </TouchableOpacity>
            {availableStates.map(state => {
              const active = selectedState === state;
              return (
                <TouchableOpacity
                  key={state}
                  onPress={() => setSelectedState(state)}
                  activeOpacity={0.85}
                  style={[
                    styles.stateChip,
                    active && styles.stateChipActive,
                  ]}>
                  <Text
                    style={[
                      styles.stateChipText,
                      active && styles.stateChipTextActive,
                    ]}>
                    {state}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#7c4dff" />
            <Text style={styles.loadingText}>Loading locations...</Text>
          </View>
        ) : filteredLocations.length === 0 ? (
          <View style={styles.centerContainer}>
            <Icon name="map-marker-off" size={64} color="#666" />
            <Text style={styles.emptyText}>No locations found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredLocations}
            keyExtractor={item => item.id}
            renderItem={renderLocationCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={20}
            windowSize={10}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100828' },
  safeArea: { flex: 1 },

  /* Header */
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 18,
    backgroundColor: 'rgba(40, 22, 96, 0.55)',
    borderRadius: 22,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 4,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(20, 14, 60, 0.95)',
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    gap: 6,
  },
  pointsCoin: { fontSize: 16 },
  pointsAmount: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pointsPlus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    marginLeft: 4,
    gap: 2,
  },
  pointsPlusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  globeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  /* View toggle */
  viewToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 18,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 0,
  },
  viewToggle: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    minWidth: 130,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#7c4dff',
    backgroundColor: 'transparent',
  },
  viewToggleActive: {
    backgroundColor: '#3a2f8f',
  },
  viewToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  viewToggleTextActive: {
    color: '#fff',
  },

  /* Search row */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 0,
  },
  createBtnWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  createBtn: {
    paddingHorizontal: 16,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  /* Chips */
  chipsRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    gap: 8,
    marginRight: 8,
  },
  countryChipActive: {
    backgroundColor: '#d6c9ff',
    borderColor: '#d6c9ff',
  },
  flagBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flagEmoji: { fontSize: 16 },
  countryChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  countryChipTextActive: {
    color: '#1f1450',
  },
  stateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  stateChipActive: {
    backgroundColor: '#d6c9ff',
    borderColor: '#d6c9ff',
  },
  stateChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stateChipTextActive: {
    color: '#1f1450',
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 12,
  },
  locationCardWrap: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  locationText: {
    flex: 1,
  },
  locationName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  locationCountry: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  travelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  travelPillText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  currentPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  currentPillText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  /* Empty / loading */
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 14 },
  emptyText: { color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 16 },
});
