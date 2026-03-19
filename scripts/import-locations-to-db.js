#!/usr/bin/env node
/**
 * Import Bisetka locations from JSON to PostgreSQL
 * Usage: node scripts/import-locations-to-db.js
 * 
 * Requires: DATABASE_URL environment variable
 * Example: DATABASE_URL=postgresql://user:pass@localhost:5432/bisetka node scripts/import-locations-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bisetka';

async function main() {
  console.log('🗄️  Importing Bisetka locations to PostgreSQL...\n');
  
  // Read JSON file
  const jsonPath = path.join(__dirname, '../data/bisetka-locations.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Error: bisetka-locations.json not found!');
    console.error('   Run: node scripts/populate-locations.js first\n');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Connect to database
  const client = new Client({ connectionString: DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // ============================================================
    // 1. Import Countries
    // ============================================================
    console.log('📍 Importing countries...');
    let countryCount = 0;
    
    for (const country of data.countries) {
      await client.query(`
        INSERT INTO countries (id, code, name, center_lat, center_lng)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          center_lat = EXCLUDED.center_lat,
          center_lng = EXCLUDED.center_lng
      `, [country.id, country.code, country.name, country.lat, country.lng]);
      countryCount++;
    }
    
    console.log(`   ✓ ${countryCount} countries imported\n`);
    
    // ============================================================
    // 2. Import Cities
    // ============================================================
    console.log('🏙️  Importing cities...');
    let cityCount = 0;
    
    for (const city of data.cities) {
      await client.query(`
        INSERT INTO cities (id, country_code, name, state, region, center_lat, center_lng)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          center_lat = EXCLUDED.center_lat,
          center_lng = EXCLUDED.center_lng
      `, [
        city.id,
        city.country_code,
        city.name,
        city.state || null,
        city.region || null,
        city.lat,
        city.lng
      ]);
      cityCount++;
    }
    
    console.log(`   ✓ ${cityCount} cities imported\n`);
    
    // ============================================================
    // 3. Import Neighborhoods
    // ============================================================
    console.log('🏘️  Importing neighborhoods...');
    let neighborhoodCount = 0;
    
    for (const neighborhood of data.neighborhoods) {
      await client.query(`
        INSERT INTO neighborhoods (id, city_id, name, center_lat, center_lng, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          center_lat = EXCLUDED.center_lat,
          center_lng = EXCLUDED.center_lng
      `, [
        neighborhood.id,
        neighborhood.city_id,
        neighborhood.name,
        neighborhood.lat,
        neighborhood.lng,
        neighborhood.type || 'osm'
      ]);
      neighborhoodCount++;
    }
    
    console.log(`   ✓ ${neighborhoodCount} neighborhoods imported\n`);
    
    // ============================================================
    // 4. Commit Transaction
    // ============================================================
    await client.query('COMMIT');
    
    console.log('=' + '='.repeat(49));
    console.log('✅ SUCCESS! All data imported to PostgreSQL');
    console.log('=' + '='.repeat(49));
    console.log('\n📊 Summary:');
    console.log(`   • Countries: ${countryCount}`);
    console.log(`   • Cities: ${cityCount}`);
    console.log(`   • Neighborhoods: ${neighborhoodCount}`);
    
    // ============================================================
    // 5. Verify Data
    // ============================================================
    console.log('\n🔍 Verifying data...');
    
    const verification = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM countries) as countries,
        (SELECT COUNT(*) FROM cities) as cities,
        (SELECT COUNT(*) FROM neighborhoods) as neighborhoods
    `);
    
    const counts = verification.rows[0];
    console.log(`   Database contains:`);
    console.log(`   • ${counts.countries} countries`);
    console.log(`   • ${counts.cities} cities`);
    console.log(`   • ${counts.neighborhoods} neighborhoods`);
    
    // ============================================================
    // 6. Test Distance Function
    // ============================================================
    console.log('\n🧪 Testing distance function...');
    
    const distanceTest = await client.query(`
      SELECT calculate_distance(29.7604, -95.3698, 40.7128, -74.0060) as distance_km
    `);
    
    console.log(`   Houston to NYC: ${Math.round(distanceTest.rows[0].distance_km)}km ✓`);
    
    // ============================================================
    // 7. Test Nearest Function
    // ============================================================
    console.log('\n📍 Testing nearest neighborhood function...');
    
    const nearestTest = await client.query(`
      SELECT * FROM find_nearest_neighborhood(29.7466, -95.3988, 10)
    `);
    
    if (nearestTest.rows.length > 0) {
      const nearest = nearestTest.rows[0];
      console.log(`   Nearest to Montrose coordinates:`);
      console.log(`   • ${nearest.neighborhood_name}, ${nearest.city_name}`);
      console.log(`   • Distance: ${nearest.distance_km}km ✓`);
    }
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Add API endpoints (see NEAREST_BISETKA_API.md)');
    console.log('   2. Update socket handlers');
    console.log('   3. Add location permission to app');
    console.log('   4. Update GlobalView screen');
    console.log('   5. Test with real GPS coordinates\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
