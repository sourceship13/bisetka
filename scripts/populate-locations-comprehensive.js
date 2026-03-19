#!/usr/bin/env node
/**
 * Comprehensive Bisetka locations from OpenStreetMap
 * Fetches top 500 US cities, 100 Russian cities, all Armenian cities
 * Usage: node scripts/populate-locations-comprehensive.js
 * 
 * NO API KEY REQUIRED - Nominatim is free!
 * Runtime: ~15-20 minutes with 1 req/sec rate limit
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load US cities from JSON
const TOP_US_CITIES = require('./us-cities-500.json');

// Load Russian cities from JSON  
const TOP_RUSSIAN_CITIES = require('./russian-cities-100.json');

// All major Armenian cities
const ARMENIAN_CITIES = [
  { name: 'Yerevan', region: 'Yerevan', pop: 1093485 },
  { name: 'Gyumri', region: 'Shirak', pop: 114600 },
  { name: 'Vanadzor', region: 'Lori', pop: 79223 },
  { name: 'Vagharshapat', region: 'Armavir', pop: 46540 },
  { name: 'Hrazdan', region: 'Kotayk', pop: 41875 },
  { name: 'Abovyan', region: 'Kotayk', pop: 36916 },
  { name: 'Kapan', region: 'Syunik', pop: 35404 },
  { name: 'Armavir', region: 'Armavir', pop: 29319 },
  { name: 'Gavar', region: 'Gegharkunik', pop: 23302 },
  { name: 'Artashat', region: 'Ararat', pop: 22269 },
  { name: 'Goris', region: 'Syunik', pop: 20591 },
  { name: 'Ashtarak', region: 'Aragatsotn', pop: 19615 },
  { name: 'Sevan', region: 'Gegharkunik', pop: 19229 },
  { name: 'Ijevan', region: 'Tavush', pop: 16126 },
  { name: 'Charentsavan', region: 'Kotayk', pop: 15281 },
];

let requestCount = 0;
let cacheHits = 0;
const cache = new Map();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function osmGeocode(city, state, country) {
  const cacheKey = `${city},${state},${country}`;
  
  if (cache.has(cacheKey)) {
    cacheHits++;
    return cache.get(cacheKey);
  }

  await sleep(1100); // OSM rate limit: 1 req/sec
  requestCount++;

  try {
    const query = state 
      ? `${city}, ${state}, ${country}`
      : `${city}, ${country}`;
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'BisetkaApp/1.0 (contact@bisetka.io)',
      },
      timeout: 10000,
    });

    if (response.data && response.data.length > 0) {
      const result = {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon),
      };
      cache.set(cacheKey, result);
      return result;
    }
    
    return null;
  } catch (error) {
    console.error(`   ⚠️  Geocode error for ${city}: ${error.message}`);
    return null;
  }
}

async function getNeighborhoods(city, state, country) {
  await sleep(1100); // OSM rate limit
  requestCount++;

  try {
    const query = state 
      ? `${city}, ${state}, ${country}`
      : `${city}, ${country}`;
    
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 50,
        addressdetails: 1,
        featuretype: 'settlement',
      },
      headers: {
        'User-Agent': 'BisetkaApp/1.0 (contact@bisetka.io)',
      },
      timeout: 15000,
    });

    const neighborhoods = response.data
      .filter(place => place.type === 'suburb' || place.type === 'neighbourhood' || place.type === 'quarter')
      .map(place => ({
        name: place.display_name.split(',')[0],
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        type: place.type,
      }));

    return neighborhoods.slice(0, 20); // Limit to 20 neighborhoods per city
  } catch (error) {
    console.error(`   ⚠️  Neighborhoods error for ${city}: ${error.message}`);
    return [];
  }
}

async function processCities(cities, countryCode, countryName, locations) {
  console.log(`\n🌍 Processing ${cities.length} cities in ${countryName}...`);
  
  let processed = 0;
  let skipped = 0;

  for (const city of cities) {
    processed++;
    const progress = `[${processed}/${cities.length}]`;
    
    process.stdout.write(`${progress} ${city.name}...`);

    // Geocode city if no coordinates
    let coords = city.lat && city.lng 
      ? { lat: city.lat, lng: city.lng }
      : await osmGeocode(city.name, city.state || city.region, countryName);

    if (!coords) {
      console.log(' ❌ Skipped (geocode failed)');
      skipped++;
      continue;
    }

    const cityId = `${countryCode.toLowerCase()}-${city.name.toLowerCase().replace(/[\s\/]+/g, '-')}`;
    
    locations.cities.push({
      id: cityId,
      country_code: countryCode,
      name: city.name,
      state: city.state || city.region,
      lat: coords.lat,
      lng: coords.lng,
      population: city.pop,
    });

    // Fetch neighborhoods
    const neighborhoods = await getNeighborhoods(
      city.name, 
      city.state || city.region, 
      countryName
    );

    if (neighborhoods.length > 0) {
      console.log(` ✅ ${neighborhoods.length} neighborhoods`);
      
      locations.neighborhoods.push(...neighborhoods.map((n, idx) => ({
        id: `${cityId}-${n.name.toLowerCase().replace(/[\s\/]+/g, '-')}`,
        city_id: cityId,
        city: city.name,
        country: countryCode,
        ...n,
      })));
    } else {
      console.log(` ✅ City center only`);
      
      // Add city center as fallback
      locations.neighborhoods.push({
        id: `${cityId}-center`,
        city_id: cityId,
        city: city.name,
        country: countryCode,
        name: 'City Center',
        lat: coords.lat,
        lng: coords.lng,
        type: 'city_center',
      });
    }

    // Progress summary every 50 cities
    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${cities.length} cities | ${locations.neighborhoods.length} neighborhoods | ${requestCount} API calls | ${cacheHits} cache hits\n`);
    }
  }

  console.log(`\n✅ ${countryName}: ${processed - skipped}/${cities.length} cities processed (${skipped} skipped)\n`);
}

async function main() {
  console.log('🌍 COMPREHENSIVE Bisetka Locations Collection');
  console.log('=' .repeat(60));
  console.log(`📝 Target: ${TOP_US_CITIES.length} US + ${TOP_RUSSIAN_CITIES.length} RU + ${ARMENIAN_CITIES.length} AM = ${TOP_US_CITIES.length + TOP_RUSSIAN_CITIES.length + ARMENIAN_CITIES.length} cities`);
  console.log('⏱️  Estimated runtime: 10-15 minutes (depends on API responses)');
  console.log('🔓 NO API KEY REQUIRED - Using free OSM Nominatim\n');
  
  const locations = {
    countries: [
      { id: 'us', code: 'US', name: 'United States', lat: 37.0902, lng: -95.7129 },
      { id: 'ru', code: 'RU', name: 'Russia', lat: 61.5240, lng: 105.3188 },
      { id: 'am', code: 'AM', name: 'Armenia', lat: 40.0691, lng: 45.0382 },
    ],
    regions: [],
    cities: [],
    neighborhoods: [],
  };

  const startTime = Date.now();

  // Process each country
  await processCities(TOP_US_CITIES, 'US', 'United States', locations);
  await processCities(TOP_RUSSIAN_CITIES, 'RU', 'Russia', locations);
  await processCities(ARMENIAN_CITIES, 'AM', 'Armenia', locations);

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // Save to JSON
  const outputPath = path.join(dataDir, 'bisetka-locations-comprehensive.json');
  fs.writeFileSync(outputPath, JSON.stringify(locations, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ SUCCESS! Comprehensive locations saved to:');
  console.log(`   ${outputPath}`);
  console.log('='.repeat(60));
  console.log('\n📊 Final Summary:');
  console.log(`   • Countries: ${locations.countries.length}`);
  console.log(`   • Cities: ${locations.cities.length}`);
  console.log(`   • Neighborhoods: ${locations.neighborhoods.length}`);
  console.log(`   • API Calls: ${requestCount}`);
  console.log(`   • Cache Hits: ${cacheHits}`);
  console.log(`   • Runtime: ${duration} minutes`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Review the JSON file');
  console.log('   2. Create PostgreSQL database tables');
  console.log('   3. Import with: psql -U postgres bisetka < import.sql');
  console.log('   4. Add backend API endpoints');
  console.log('   5. Update GlobalView to fetch from API\n');
}

main().catch(error => {
  console.error('\n❌ Fatal Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
