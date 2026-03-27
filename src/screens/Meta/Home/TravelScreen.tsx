import React, { useState, useEffect, useMemo } from 'react';
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
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import bisetkaService, { Neighborhood } from '../../../services/bisetka.service';
import apiService from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { normalizeStateName, getUniqueNormalizedStates } from '../../../utils/stateNormalizer';

type NavigationProp = NativeStackNavigationProp<any>;

const TRAVEL_COST = 100; // Points required to travel

const formatTravelLocationName = (location: Neighborhood) =>
  `${location.name}, ${location.city}`;

export default function TravelScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const [locations, setLocations] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [travelingTo, setTravelingTo] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<'all' | 'US' | 'RU' | 'AM'>('all');
  const [selectedState, setSelectedState] = useState<string>('all');

  useEffect(() => {
    loadLocations();
  }, []);

  // Get unique states/provinces for the selected country (normalized)
  const availableStates = React.useMemo(() => {
    if (selectedCountry === 'all') return [];
    
    const countryLocations = locations.filter(loc => loc.country === selectedCountry);
    return getUniqueNormalizedStates(countryLocations);
  }, [locations, selectedCountry]);

  // Reset state filter when country changes
  useEffect(() => {
    setSelectedState('all');
  }, [selectedCountry]);

  // Normalize all locations once (memoized)
  const normalizedLocations = useMemo(() => {
    return locations.map(loc => ({
      ...loc,
      normalizedState: normalizeStateName(loc.state, loc.country),
    }));
  }, [locations]);

  // Filter logic (optimized with useMemo)
  const filteredLocations = useMemo(() => {
    let filtered = normalizedLocations;

    // Apply country filter
    if (selectedCountry !== 'all') {
      filtered = filtered.filter((loc) => loc.country === selectedCountry);
    }

    // Apply state filter (already normalized)
    if (selectedState !== 'all') {
      filtered = filtered.filter((loc) => loc.normalizedState === selectedState);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query) ||
          loc.city.toLowerCase().includes(query) ||
          loc.country.toLowerCase().includes(query) ||
          loc.normalizedState.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [normalizedLocations, searchQuery, selectedCountry, selectedState]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      console.log('🔍 [TravelScreen] Loading neighborhoods...');
      const allLocations = await bisetkaService.getAllNeighborhoods();
      // Deduplicate by id to prevent duplicate React keys
      const seen = new Set<string>();
      const unique = allLocations.filter(loc => {
        if (seen.has(loc.id)) return false;
        seen.add(loc.id);
        return true;
      });
      console.log('✅ [TravelScreen] Loaded neighborhoods:', unique.length, '(deduped from', allLocations.length, ')');
      
      // Sort by country, then city, then name
      const sorted = unique.sort((a, b) => {
        if (a.country !== b.country) return a.country.localeCompare(b.country);
        if (a.city !== b.city) return a.city.localeCompare(b.city);
        return a.name.localeCompare(b.name);
      });
      setLocations(sorted);
    } catch (error: any) {
      console.error('❌ [TravelScreen] Failed to load locations:', error);
      console.error('Error details:', error.message, error.stack);
      BisetkaAlert.error('Failed to load locations', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTravel = async (location: Neighborhood) => {
    // Check if user has enough points
    if ((user?.balance || 0) < TRAVEL_COST) {
      BisetkaAlert.error(
        `Insufficient Points`,
        `You need ${TRAVEL_COST} points to travel. You have ${user?.balance || 0} points.`
      );
      return;
    }

    Alert.alert(
      'Travel to Bisetka',
      `Travel to ${formatTravelLocationName(location)}?\n\nCost: ${TRAVEL_COST} points`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Travel',
          onPress: () => confirmTravel(location),
        },
      ]
    );
  };

  const confirmTravel = async (location: Neighborhood) => {
    try {
      setTravelingTo(location.id);
      
      console.log('🚀 Starting travel to:', formatTravelLocationName(location));
      
      // Call API to change location and deduct points
      const response = await apiService.post<{ success: boolean; message?: string; user?: any; bisetka?: any; travel_stats?: any }>('/bisetka/travel', {
        neighborhood_id: location.id,
      }, true); // requireAuth

      console.log('✅ Travel response:', response);

      if (response.success) {
        // Refresh user data to get updated balance and location
        await refreshUser();
        
        // Also update stored bisetka for immediate display
        const bisetkaStorageService = require('../../../services/bisetkaStorage.service').default;
        if (response.bisetka) {
          await bisetkaStorageService.storeBisetka({
            id: response.bisetka.id,
            neighborhood: response.bisetka.neighborhood_name,
            city: response.bisetka.city,
            country: response.bisetka.country,
            active_users: response.bisetka.active_users || 0,
            source: 'travel',
          });
          console.log('✅ Stored bisetka after travel:', response.bisetka.neighborhood_name);
        }
        
        BisetkaAlert.success(
          'Travel Complete!',
          `You've traveled to ${formatTravelLocationName(location)}. ${TRAVEL_COST} points deducted.`
        );
        
        // Return to Home; its focus effect will refresh the bisetka and background.
        setTimeout(() => {
          navigation.navigate('Home', { 
            forceBackgroundReload: Date.now(), // Force background regeneration
            traveledTo: location.id,
          });
        }, 1500);
      } else {
        throw new Error(response.message || 'Travel failed');
      }
    } catch (error: any) {
      console.error('❌ Travel failed:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Error message:', error.message);
      console.error('❌ Error status:', error.status);
      console.error('❌ Error code:', error.code);
      
      BisetkaAlert.error(
        'Travel Failed',
        error.message || error.error || 'Please try again. Check console for details.'
      );
    } finally {
      setTravelingTo(null);
    }
  };

  const renderLocationCard = (location: Neighborhood) => {
    const isCurrentLocation = user?.neighborhood_id === location.id;
    const isTraveling = travelingTo === location.id;

    return (
      <TouchableOpacity
        key={location.id}
        disabled={isCurrentLocation || isTraveling}
        onPress={() => handleTravel(location)}
        style={[
          styles.locationCard,
          isCurrentLocation && styles.currentLocationCard,
        ]}
        activeOpacity={0.7}>
        <View style={{flex:1, backgroundColor: isCurrentLocation ? 'rgba(52, 211, 153, 0.7)' : 'rgba(255, 255, 255, 0.05)', borderRadius: 12, padding: 12}}>
          <View style={styles.locationInfo}>
            <View style={styles.locationHeader}>
              <Icon
                name={isCurrentLocation ? 'map-marker-check' : 'map-marker'}
                size={24}
                color="#fff"
              />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationName}>{formatTravelLocationName(location)}</Text>
                <Text style={styles.locationCity}>
                  {location.country}
                </Text>
              </View>
            </View>
            {location.distance_km !== undefined && (
              <Text style={styles.locationDistance}>
                {Math.round(location.distance_km)} km away
              </Text>
            )}
          </View>
          <View style={[styles.locationAction, {backgroundColor:'red'}]}>
            {isCurrentLocation ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            ) : isTraveling ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.travelButton}>
                <Icon name="airplane-takeoff" size={20} color="#fff" />
                <Text style={styles.travelCost}>{TRAVEL_COST}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.8)']}
          style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Travel to Bisetka</Text>
            <Text style={styles.headerSubtitle}>
              Cost: {TRAVEL_COST} points per trip
            </Text>
          </View>
          <View style={styles.balanceBadge}>
            <Icon name="trophy" size={18} color="#fbbf24" />
            <Text style={styles.balanceText}>{user?.balance || 0}</Text>
          </View>
        </LinearGradient>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={24} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city or neighborhood..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={24} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Country Filter Buttons */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            <TouchableOpacity
              style={[styles.filterButton, selectedCountry === 'all' && styles.filterButtonActive]}
              onPress={() => setSelectedCountry('all')}>
              <Text style={styles.flagEmoji}>🌍</Text>
              <Text style={[styles.filterButtonText, selectedCountry === 'all' && styles.filterButtonTextActive]}>
                All Countries
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, selectedCountry === 'US' && styles.filterButtonActive]}
              onPress={() => setSelectedCountry('US')}>
              <Text style={styles.flagEmoji}>🇺🇸</Text>
              <Text style={[styles.filterButtonText, selectedCountry === 'US' && styles.filterButtonTextActive]}>
                United States
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, selectedCountry === 'RU' && styles.filterButtonActive]}
              onPress={() => setSelectedCountry('RU')}>
              <Text style={styles.flagEmoji}>🇷🇺</Text>
              <Text style={[styles.filterButtonText, selectedCountry === 'RU' && styles.filterButtonTextActive]}>
                Russia
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, selectedCountry === 'AM' && styles.filterButtonActive]}
              onPress={() => setSelectedCountry('AM')}>
              <Text style={styles.flagEmoji}>🇦🇲</Text>
              <Text style={[styles.filterButtonText, selectedCountry === 'AM' && styles.filterButtonTextActive]}>
                Armenia
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* State/Province Filter (only show when country is selected) */}
        {selectedCountry !== 'all' && availableStates.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
              <TouchableOpacity
                style={[styles.filterButton, styles.filterButtonSecondary, selectedState === 'all' && styles.filterButtonActive]}
                onPress={() => setSelectedState('all')}>
                <Text style={[styles.filterButtonText, styles.filterButtonTextSmall, selectedState === 'all' && styles.filterButtonTextActive]}>
                  All {selectedCountry === 'US' ? 'States' : 'Regions'}
                </Text>
              </TouchableOpacity>
              {availableStates.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[styles.filterButton, styles.filterButtonSecondary, selectedState === state && styles.filterButtonActive]}
                  onPress={() => setSelectedState(state)}>
                  <Text style={[styles.filterButtonText, styles.filterButtonTextSmall, selectedState === state && styles.filterButtonTextActive]}>
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Locations List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
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
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderLocationCard(item)}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            ListHeaderComponent={
              <Text style={styles.locationCount}>
                {filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}{' '}
                available
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  balanceText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 8,
  },
  filterButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  filterButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonTextSmall: {
    fontSize: 13,
  },
  flagEmoji: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  locationCount: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  locationCard: {
    marginBottom: 10,
    borderRadius: 12,
  },
  currentLocationCard: {
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  locationGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationInfo: {
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationCity: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  locationDistance: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 36,
  },
  locationAction: {

  },
  currentBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  travelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  travelCost: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 12,
  },
});
