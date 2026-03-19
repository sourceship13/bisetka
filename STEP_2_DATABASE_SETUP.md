# Step 2: Database Setup - Complete Guide

## ✅ What We Have

- ✅ 140 neighborhoods across 35 cities in 3 countries
- ✅ JSON file: `data/bisetka-locations.json`
- ✅ SQL migration script: `database/001_create_bisetka_locations.sql`
- ✅ Import script: `scripts/import-locations-to-db.js`

## 🚀 Quick Setup (5 minutes)

### Option A: PostgreSQL (Recommended)

**1. Install pg package:**
```bash
cd bisetka
npm install pg
```

**2. Run SQL migration:**
```bash
# Connect to your PostgreSQL database
psql -U postgres -d bisetka -f database/001_create_bisetka_locations.sql
```

**3. Import data:**
```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/bisetka"

# Run import
node scripts/import-locations-to-db.js
```

### Option B: Using Docker PostgreSQL

```bash
# Start PostgreSQL in Docker
docker run --name bisetka-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bisetka \
  -p 5432:5432 \
  -d postgres:16

# Wait 5 seconds for startup
sleep 5

# Run migration
docker exec -i bisetka-db psql -U postgres -d bisetka < database/001_create_bisetka_locations.sql

# Import data
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bisetka" \
  node scripts/import-locations-to-db.js
```

## 📊 What Gets Created

### Tables (6):
1. **countries** - US, Russia, Armenia
2. **regions** - States, oblasts (currently empty, can be added later)
3. **cities** - 35 major cities
4. **neighborhoods** - 140 neighborhoods/districts
5. **bisetka_sessions** - Active game sessions (empty initially)
6. **user_closest_bisetka** - Cache for user's nearest Bisetka

### Functions (2):
1. **calculate_distance(lat1, lng1, lat2, lng2)** - Haversine distance in km
2. **find_nearest_neighborhood(lat, lng, radius)** - Find closest neighborhood

### Indexes (7):
- Spatial indexes on all location columns (using PostGIS)
- Regular indexes on foreign keys and status fields
- Optimized for distance queries

## 🧪 Test Queries

After import, test with:

```sql
-- 1. Count data
SELECT 
  (SELECT COUNT(*) FROM countries) as countries,
  (SELECT COUNT(*) FROM cities) as cities,
  (SELECT COUNT(*) FROM neighborhoods) as neighborhoods;

-- 2. Test distance function
SELECT calculate_distance(29.7604, -95.3698, 40.7128, -74.0060) as houston_to_nyc_km;
-- Expected: ~2278 km

-- 3. Find nearest to Houston coordinates
SELECT * FROM find_nearest_neighborhood(29.7604, -95.3698, 50);
-- Expected: Montrose or Downtown Houston

-- 4. Get all Houston neighborhoods
SELECT id, name, center_lat, center_lng 
FROM neighborhoods 
WHERE city_id = 'us-houston'
ORDER BY name;
-- Expected: 18 neighborhoods

-- 5. Get all cities in US
SELECT id, name, state, center_lat, center_lng
FROM cities
WHERE country_code = 'US'
ORDER BY name;
-- Expected: 20 cities
```

## ✅ Success Criteria

You should see:
```
📊 Summary:
   • Countries: 3
   • Cities: 35
   • Neighborhoods: 140

🔍 Verifying data...
   Database contains:
   • 3 countries
   • 35 cities
   • 140 neighborhoods

🧪 Testing distance function...
   Houston to NYC: 2278km ✓

📍 Testing nearest neighborhood function...
   Nearest to Montrose coordinates:
   • Montrose, Houston
   • Distance: 0km ✓
```

## 🐛 Troubleshooting

### Error: "relation 'countries' already exists"
**Solution:** Tables already exist. Drop them first:
```sql
DROP TABLE IF EXISTS user_closest_bisetka CASCADE;
DROP TABLE IF EXISTS bisetka_sessions CASCADE;
DROP TABLE IF EXISTS neighborhoods CASCADE;
DROP TABLE IF EXISTS cities CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS countries CASCADE;
DROP FUNCTION IF EXISTS calculate_distance CASCADE;
DROP FUNCTION IF EXISTS find_nearest_neighborhood CASCADE;
```

### Error: "module 'pg' not found"
**Solution:**
```bash
cd bisetka
npm install pg
```

### Error: "connection refused"
**Solution:** Check PostgreSQL is running:
```bash
# macOS (Homebrew)
brew services start postgresql@16

# Linux
sudo systemctl start postgresql

# Docker
docker start bisetka-db
```

### Error: "extension 'cube' not available"
**Solution:** Install PostGIS extensions:
```bash
# macOS
brew install postgis

# Ubuntu/Debian
sudo apt-get install postgresql-16-postgis-3

# Then in psql:
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
```

## 📁 File Structure

```
bisetka/
├── data/
│   └── bisetka-locations.json          ← Generated in Step 1
├── database/
│   └── 001_create_bisetka_locations.sql ← Migration script
└── scripts/
    ├── populate-locations.js            ← Step 1 script
    └── import-locations-to-db.js        ← Step 2 script
```

## ⏭️ Next Steps

After successful import, move to:
- **Step 3**: Add API endpoints
- **Step 4**: Update socket handlers
- **Step 5**: Frontend integration

See `NEAREST_BISETKA_API.md` for Step 3!

---

## 🚨 Important Notes

1. **Backup first** if you have existing data
2. The import script is **idempotent** (safe to run multiple times)
3. Uses `ON CONFLICT DO UPDATE` to handle duplicates
4. Distance function uses **Haversine formula** (accurate to ~0.5%)
5. Spatial indexes use **PostGIS earthdistance** extension

## 💡 Pro Tips

- **Performance:** The spatial indexes make distance queries lightning fast
- **Accuracy:** Use exact coordinates from GPS, not city centers
- **Caching:** user_closest_bisetka table reduces repeated calculations
- **Scaling:** Add Redis caching layer for 10,000+ concurrent users

---

**Need help?** Check the full implementation in `BISETKA_LOCATIONS_MASTERPLAN.md`
