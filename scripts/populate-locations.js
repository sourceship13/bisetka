#!/usr/bin/env node
/**
 * Populate Bisetka locations from OpenStreetMap
 * Usage: node scripts/populate-locations.js
 * 
 * NO API KEY REQUIRED - Nominatim is free!
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Major cities to seed (30+ cities as per masterplan)
const CITIES = {
  US: [
    { name: 'Houston', state: 'Texas', lat: 29.7604, lng: -95.3698 },
    { name: 'Los Angeles', state: 'California', lat: 34.0522, lng: -118.2437 },
    { name: 'New York', state: 'New York', lat: 40.7128, lng: -74.0060 },
    { name: 'Chicago', state: 'Illinois', lat: 41.8781, lng: -87.6298 },
    { name: 'Dallas', state: 'Texas', lat: 32.7767, lng: -96.7970 },
    { name: 'Austin', state: 'Texas', lat: 30.2672, lng: -97.7431 },
    { name: 'San Antonio', state: 'Texas', lat: 29.4241, lng: -98.4936 },
    { name: 'Phoenix', state: 'Arizona', lat: 33.4484, lng: -112.0740 },
    { name: 'Miami', state: 'Florida', lat: 25.7617, lng: -80.1918 },
    { name: 'Atlanta', state: 'Georgia', lat: 33.7490, lng: -84.3880 },
    { name: 'Boston', state: 'Massachusetts', lat: 42.3601, lng: -71.0589 },
    { name: 'Seattle', state: 'Washington', lat: 47.6062, lng: -122.3321 },
    { name: 'San Francisco', state: 'California', lat: 37.7749, lng: -122.4194 },
    { name: 'Las Vegas', state: 'Nevada', lat: 36.1699, lng: -115.1398 },
    { name: 'Denver', state: 'Colorado', lat: 39.7392, lng: -104.9903 },
    { name: 'Philadelphia', state: 'Pennsylvania', lat: 39.9526, lng: -75.1652 },
    { name: 'San Diego', state: 'California', lat: 32.7157, lng: -117.1611 },
    { name: 'Portland', state: 'Oregon', lat: 45.5152, lng: -122.6784 },
    { name: 'Detroit', state: 'Michigan', lat: 42.3314, lng: -83.0458 },
    { name: 'Nashville', state: 'Tennessee', lat: 36.1627, lng: -86.7816 },
  ],
  RU: [
    { name: 'Moscow', region: 'Moscow', lat: 55.7558, lng: 37.6173 },
    { name: 'Saint Petersburg', region: 'Leningrad Oblast', lat: 59.9343, lng: 30.3351 },
    { name: 'Novosibirsk', region: 'Novosibirsk Oblast', lat: 55.0084, lng: 82.9357 },
    { name: 'Yekaterinburg', region: 'Sverdlovsk Oblast', lat: 56.8389, lng: 60.6057 },
    { name: 'Nizhny Novgorod', region: 'Nizhny Novgorod Oblast', lat: 56.2965, lng: 43.9361 },
    { name: 'Kazan', region: 'Tatarstan', lat: 55.8304, lng: 49.0661 },
    { name: 'Samara', region: 'Samara Oblast', lat: 53.1952, lng: 50.1069 },
    { name: 'Omsk', region: 'Omsk Oblast', lat: 54.9885, lng: 73.3242 },
    { name: 'Chelyabinsk', region: 'Chelyabinsk Oblast', lat: 55.1644, lng: 61.4368 },
    { name: 'Rostov-on-Don', region: 'Rostov Oblast', lat: 47.2357, lng: 39.7015 },
  ],
  AM: [
    { name: 'Yerevan', region: 'Yerevan', lat: 40.1872, lng: 44.5152 },
    { name: 'Gyumri', region: 'Shirak', lat: 40.7894, lng: 43.8475 },
    { name: 'Vanadzor', region: 'Lori', lat: 40.8059, lng: 44.4882 },
    { name: 'Vagharshapat', region: 'Armavir', lat: 40.1564, lng: 44.2933 },
    { name: 'Hrazdan', region: 'Kotayk', lat: 40.4978, lng: 44.7681 },
  ],
};

// Manually curated neighborhoods (most accurate)
const MANUAL_NEIGHBORHOODS = {
  Houston: [
    { name: 'Downtown', lat: 29.7589, lng: -95.3677 },
    { name: 'Midtown', lat: 29.7423, lng: -95.3846 },
    { name: 'Montrose', lat: 29.7466, lng: -95.3988 },
    { name: 'East Downtown (EaDo)', lat: 29.7531, lng: -95.3498 },
    { name: 'Galleria', lat: 29.7390, lng: -95.4618 },
    { name: 'The Heights', lat: 29.7994, lng: -95.4058 },
    { name: 'River Oaks', lat: 29.7591, lng: -95.4271 },
    { name: 'Memorial', lat: 29.7752, lng: -95.5207 },
    { name: 'Medical Center', lat: 29.7071, lng: -95.4024 },
    { name: 'Rice Village', lat: 29.7178, lng: -95.4191 },
    { name: 'Museum District', lat: 29.7211, lng: -95.3898 },
    { name: 'Greenway Plaza', lat: 29.7385, lng: -95.4386 },
    { name: 'Upper Kirby', lat: 29.7368, lng: -95.4187 },
    { name: 'West University', lat: 29.7183, lng: -95.4347 },
    { name: 'Katy', lat: 29.7858, lng: -95.8244 },
    { name: 'Sugar Land', lat: 29.6196, lng: -95.6349 },
    { name: 'Pearland', lat: 29.5636, lng: -95.2861 },
    { name: 'The Woodlands', lat: 30.1658, lng: -95.4613 },
  ],
  Moscow: [
    { name: 'Arbat', lat: 55.7522, lng: 37.5989 },
    { name: 'Tverskoy', lat: 55.7655, lng: 37.6057 },
    { name: 'Zamoskvorechye', lat: 55.7377, lng: 37.6289 },
    { name: 'Presnensky', lat: 55.7601, lng: 37.5656 },
    { name: 'Tagansky', lat: 55.7406, lng: 37.6563 },
    { name: 'Khamovniki', lat: 55.7265, lng: 37.5634 },
  ],
  Yerevan: [
    { name: 'Kentron', lat: 40.1776, lng: 44.5126 },
    { name: 'Arabkir', lat: 40.1920, lng: 44.4896 },
    { name: 'Ajapnyak', lat: 40.1625, lng: 44.4659 },
    { name: 'Malatia-Sebastia', lat: 40.1547, lng: 44.4598 },
    { name: 'Kanaker-Zeytun', lat: 40.2035, lng: 44.5344 },
  ],
};

async function getNeighborhoods(city, country) {
  try {
    const url = `https://nominatim.openstreetmap.org/search`;
    const response = await axios.get(url, {
      params: {
        city,
        country,
        format: 'json',
        limit: 50,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'BisetkaApp/1.0 (contact@bisetka.io)',
      },
    });

    return response.data.map(place => ({
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      type: place.type,
      osm_id: place.osm_id,
    }));
  } catch (error) {
    console.error(`Error fetching neighborhoods for ${city}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🌍 Fetching Bisetka locations from OpenStreetMap...');
  console.log('📝 NO API KEY REQUIRED - Using free Nominatim API\n');
  
  const locations = {
    countries: [],
    regions: [],
    cities: [],
    neighborhoods: [],
  };

  // Add countries
  locations.countries = [
    { id: 'us', code: 'US', name: 'United States', lat: 37.0902, lng: -95.7129 },
    { id: 'ru', code: 'RU', name: 'Russia', lat: 61.5240, lng: 105.3188 },
    { id: 'am', code: 'AM', name: 'Armenia', lat: 40.0691, lng: 45.0382 },
  ];

  console.log('✅ Countries: 3 (US, Russia, Armenia)\n');

  let cityCount = 0;
  let neighborhoodCount = 0;

  // Add cities and fetch neighborhoods
  for (const [countryCode, cities] of Object.entries(CITIES)) {
    for (const city of cities) {
      const cityId = `${countryCode.toLowerCase()}-${city.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      locations.cities.push({
        id: cityId,
        country_code: countryCode,
        ...city,
      });
      
      cityCount++;

      // Check if we have manual neighborhoods for this city
      if (MANUAL_NEIGHBORHOODS[city.name]) {
        const manualNeighborhoods = MANUAL_NEIGHBORHOODS[city.name];
        console.log(`📍 ${city.name}: ${manualNeighborhoods.length} neighborhoods (manual)`);
        
        locations.neighborhoods.push(...manualNeighborhoods.map((n, idx) => ({
          id: `${cityId}-${n.name.toLowerCase().replace(/\s+/g, '-')}`,
          city_id: cityId,
          city: city.name,
          country: countryCode,
          ...n,
        })));
        
        neighborhoodCount += manualNeighborhoods.length;
      } else {
        // Fetch from OSM
        console.log(`🔍 Fetching ${city.name} from OpenStreetMap...`);
        
        try {
          const osmNeighborhoods = await getNeighborhoods(city.name, countryCode);
          
          if (osmNeighborhoods.length > 0) {
            console.log(`   Found ${osmNeighborhoods.length} neighborhoods`);
            
            locations.neighborhoods.push(...osmNeighborhoods.map((n, idx) => ({
              id: `${cityId}-${idx}`,
              city_id: cityId,
              city: city.name,
              country: countryCode,
              ...n,
            })));
            
            neighborhoodCount += osmNeighborhoods.length;
          } else {
            console.log(`   No neighborhoods found - using city center`);
            // Add city center as default neighborhood
            locations.neighborhoods.push({
              id: `${cityId}-center`,
              city_id: cityId,
              city: city.name,
              country: countryCode,
              name: 'City Center',
              lat: city.lat,
              lng: city.lng,
              type: 'city_center',
            });
            neighborhoodCount++;
          }
        } catch (error) {
          console.log(`   ⚠️  Error: ${error.message} - using city center`);
          locations.neighborhoods.push({
            id: `${cityId}-center`,
            city_id: cityId,
            city: city.name,
            country: countryCode,
            name: 'City Center',
            lat: city.lat,
            lng: city.lng,
            type: 'city_center',
          });
          neighborhoodCount++;
        }

        // Rate limit: 1 request per second (Nominatim policy)
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    }
  }

  // Save to JSON
  const outputPath = path.join(dataDir, 'bisetka-locations.json');
  fs.writeFileSync(outputPath, JSON.stringify(locations, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ SUCCESS! Locations saved to:');
  console.log(`   ${outputPath}`);
  console.log('='.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`   • Countries: ${locations.countries.length}`);
  console.log(`   • Cities: ${cityCount}`);
  console.log(`   • Neighborhoods: ${neighborhoodCount}`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Review the JSON file');
  console.log('   2. Create database tables (see NEAREST_BISETKA_API.md)');
  console.log('   3. Import data to PostgreSQL');
  console.log('   4. Add API endpoints');
  console.log('   5. Update GlobalView screen\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
