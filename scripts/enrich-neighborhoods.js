#!/usr/bin/env node
/**
 * Phase 2: Enrich neighborhoods for top cities
 * Loads comprehensive JSON and adds real neighborhoods to major cities
 * Usage: node scripts/enrich-neighborhoods.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const inputFile = path.join(dataDir, 'bisetka-locations-comprehensive.json');
const outputFile = path.join(dataDir, 'bisetka-locations-enriched.json');

// Manual neighborhoods for cities we know well
const MANUAL_NEIGHBORHOODS = {
  'Houston': [
    { name: 'Downtown', lat: 29.7589, lng: -95.3677 },
    { name: 'Midtown', lat: 29.7423, lng: -95.3846 },
    { name: 'Montrose', lat: 29.7466, lng: -95.3988 },
    { name: 'East Downtown', lat: 29.7531, lng: -95.3498 },
    { name: 'Galleria', lat: 29.7390, lng: -95.4618 },
    { name: 'The Heights', lat: 29.7994, lng: -95.4058 },
    { name: 'River Oaks', lat: 29.7591, lng: -95.4271 },
    { name: 'Memorial', lat: 29.7752, lng: -95.5207 },
    { name: 'Medical Center', lat: 29.7071, lng: -95.4024 },
    { name: 'Rice Village', lat: 29.7178, lng: -95.4191 },
    { name: 'Museum District', lat: 29.7211, lng: -95.3898 },
    { name: 'Upper Kirby', lat: 29.7368, lng: -95.4187 },
    { name: 'West University', lat: 29.7183, lng: -95.4347 },
  ],
  'Moscow': [
    { name: 'Kremlin', lat: 55.7520, lng: 37.6175 },
    { name: 'Arbat', lat: 55.7522, lng: 37.5989 },
    { name: 'Tverskoy', lat: 55.7655, lng: 37.6057 },
    { name: 'Zamoskvorechye', lat: 55.7377, lng: 37.6289 },
    { name: 'Presnensky', lat: 55.7601, lng: 37.5656 },
    { name: 'Tagansky', lat: 55.7406, lng: 37.6563 },
    { name: 'Khamovniki', lat: 55.7265, lng: 37.5634 },
  ],
  'Yerevan': [
    { name: 'Kentron', lat: 40.1776, lng: 44.5126 },
    { name: 'Arabkir', lat: 40.1920, lng: 44.4896 },
    { name: 'Ajapnyak', lat: 40.1625, lng: 44.4659 },
    { name: 'Malatia-Sebastia', lat: 40.1547, lng: 44.4598 },
    { name: 'Kanaker-Zeytun', lat: 40.2035, lng: 44.5344 },
  ],
};

let apiCalls = 0;
let neighborhoodsFound = 0;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchNeighborhoods(cityName, lat, lng) {
  await sleep(1100); // OSM rate limit
  apiCalls++;

  try {
    // Strategy 1: Search around city with specific types
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${cityName}`,
        format: 'json',
        limit: 50,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'BisetkaApp/1.0 (contact@bisetka.io)',
      },
      timeout: 15000,
    });

    // Filter for neighborhoods/suburbs/quarters
    const neighborhoods = response.data
      .filter(place => {
        const type = place.type;
        const cls = place.class;
        return (
          type === 'suburb' || 
          type === 'neighbourhood' || 
          type === 'quarter' ||
          type === 'residential' ||
          (cls === 'place' && (type === 'suburb' || type === 'quarter'))
        );
      })
      .map(place => ({
        name: place.display_name.split(',')[0].trim(),
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        type: place.type,
      }));

    // Deduplicate by name
    const unique = [];
    const seen = new Set();
    for (const n of neighborhoods) {
      if (!seen.has(n.name)) {
        seen.add(n.name);
        unique.push(n);
      }
    }

    return unique.slice(0, 20); // Max 20 per city
  } catch (error) {
    console.error(`   ⚠️  Error fetching neighborhoods: ${error.message}`);
    return [];
  }
}

async function reverseGeocodeArea(lat, lng, cityName) {
  await sleep(1100);
  apiCalls++;

  try {
    // Try reverse geocoding in a radius to find nearby places
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon: lng,
        format: 'json',
        addressdetails: 1,
        zoom: 12, // City district level
      },
      headers: {
        'User-Agent': 'BisetkaApp/1.0 (contact@bisetka.io)',
      },
      timeout: 10000,
    });

    if (response.data && response.data.address) {
      const addr = response.data.address;
      const neighborhoodName = addr.suburb || addr.neighbourhood || addr.quarter || addr.district;
      
      if (neighborhoodName && neighborhoodName !== cityName) {
        return [{
          name: neighborhoodName,
          lat: parseFloat(response.data.lat),
          lng: parseFloat(response.data.lon),
          type: 'reverse_geocoded',
        }];
      }
    }

    return [];
  } catch (error) {
    return [];
  }
}

async function enrichCity(city) {
  const cityName = city.name;
  
  // Check if we have manual data
  if (MANUAL_NEIGHBORHOODS[cityName]) {
    const manual = MANUAL_NEIGHBORHOODS[cityName];
    console.log(`   Using ${manual.length} manual neighborhoods`);
    return manual;
  }

  // Try OSM search
  process.stdout.write(`   Searching OSM...`);
  let neighborhoods = await searchNeighborhoods(cityName, city.lat, city.lng);
  
  if (neighborhoods.length > 0) {
    console.log(` found ${neighborhoods.length}`);
    return neighborhoods;
  }

  // Fallback: reverse geocode
  process.stdout.write(` trying reverse...`);
  neighborhoods = await reverseGeocodeArea(city.lat, city.lng, cityName);
  
  if (neighborhoods.length > 0) {
    console.log(` found ${neighborhoods.length}`);
    return neighborhoods;
  }

  console.log(` none found`);
  return [];
}

async function main() {
  console.log('🏘️  Phase 2: Neighborhood Enrichment');
  console.log('=' .repeat(60));
  
  // Load comprehensive data
  console.log('📂 Loading comprehensive locations...\n');
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  console.log(`✅ Loaded: ${data.cities.length} cities, ${data.neighborhoods.length} neighborhoods\n`);
  
  // Sort cities by population
  const sortedCities = [...data.cities].sort((a, b) => (b.population || 0) - (a.population || 0));
  
  // Pick top 50 for enrichment
  const TOP_N = 50;
  const citiesToEnrich = sortedCities.slice(0, TOP_N);
  
  console.log(`🎯 Enriching top ${TOP_N} cities by population...\n`);
  
  const newNeighborhoods = [];
  let processed = 0;
  
  for (const city of citiesToEnrich) {
    processed++;
    const progress = `[${processed}/${TOP_N}]`;
    
    process.stdout.write(`${progress} ${city.name} (${city.country_code})...`);
    
    const neighborhoods = await enrichCity(city);
    
    if (neighborhoods.length > 0) {
      // Remove old city-center placeholder
      const oldIndex = data.neighborhoods.findIndex(n => n.city_id === city.id);
      if (oldIndex >= 0) {
        data.neighborhoods.splice(oldIndex, 1);
      }
      
      // Add new neighborhoods
      neighborhoods.forEach(n => {
        newNeighborhoods.push({
          id: `${city.id}-${n.name.toLowerCase().replace(/[\s\/]+/g, '-')}`,
          city_id: city.id,
          city: city.name,
          country: city.country_code,
          ...n,
        });
      });
      
      neighborhoodsFound += neighborhoods.length;
    }
    
    // Progress update every 10 cities
    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: ${processed}/${TOP_N} cities | ${neighborhoodsFound} new neighborhoods | ${apiCalls} API calls\n`);
    }
  }
  
  // Add all new neighborhoods
  data.neighborhoods.push(...newNeighborhoods);
  
  // Save enriched data
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ SUCCESS! Enriched locations saved to:');
  console.log(`   ${outputFile}`);
  console.log('='.repeat(60));
  console.log('\n📊 Final Stats:');
  console.log(`   • Countries: ${data.countries.length}`);
  console.log(`   • Cities: ${data.cities.length}`);
  console.log(`   • Neighborhoods: ${data.neighborhoods.length}`);
  console.log(`   • New neighborhoods added: ${neighborhoodsFound}`);
  console.log(`   • API Calls: ${apiCalls}`);
  console.log('\n🎯 Coverage:');
  console.log(`   • Enriched cities: ${TOP_N}`);
  console.log(`   • Cities with center only: ${data.cities.length - TOP_N}`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Review bisetka-locations-enriched.json');
  console.log('   2. Create PostgreSQL tables');
  console.log('   3. Import data');
  console.log('   4. Build backend API\n');
}

main().catch(error => {
  console.error('\n❌ Fatal Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
