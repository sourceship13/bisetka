-- ============================================================
-- Bisetka Hierarchical Locations Schema
-- Version: 1.0
-- Date: 2025-01-21
-- ============================================================

-- Extension for distance calculations
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- ============================================================
-- 1. COUNTRIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS countries (
  id VARCHAR(10) PRIMARY KEY,
  code CHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_countries_code ON countries(code);

-- ============================================================
-- 2. REGIONS TABLE (States, Oblasts, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
  id VARCHAR(50) PRIMARY KEY,
  country_id VARCHAR(10) NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  center_lat DECIMAL(10, 8),
  center_lng DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_regions_country ON regions(country_id);

-- ============================================================
-- 3. CITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(100) PRIMARY KEY,
  country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  region_id VARCHAR(50) REFERENCES regions(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(100), -- For US cities
  region VARCHAR(100), -- For Russian cities
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  population INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cities_country ON cities(country_code);
CREATE INDEX idx_cities_name ON cities(name);
CREATE INDEX idx_cities_location ON cities USING gist (ll_to_earth(center_lat, center_lng));

-- ============================================================
-- 4. NEIGHBORHOODS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS neighborhoods (
  id VARCHAR(150) PRIMARY KEY,
  city_id VARCHAR(100) NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  type VARCHAR(50), -- 'manual', 'osm', 'city_center'
  is_primary BOOLEAN DEFAULT true,
  parent_id VARCHAR(150) REFERENCES neighborhoods(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_neighborhoods_city ON neighborhoods(city_id);
CREATE INDEX idx_neighborhoods_name ON neighborhoods(name);
CREATE INDEX idx_neighborhoods_location ON neighborhoods USING gist (ll_to_earth(center_lat, center_lng));

-- ============================================================
-- 5. BISETKA SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bisetka_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id VARCHAR(150) NOT NULL REFERENCES neighborhoods(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  room_name VARCHAR(200),
  player_count INT DEFAULT 0,
  max_players INT DEFAULT 4,
  latitude DECIMAL(10, 8) NOT NULL, -- Exact session location (can differ from neighborhood center)
  longitude DECIMAL(11, 8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paused')),
  created_by UUID, -- Reference to users table
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bisetka_sessions_neighborhood ON bisetka_sessions(neighborhood_id);
CREATE INDEX idx_bisetka_sessions_status ON bisetka_sessions(status);
CREATE INDEX idx_bisetka_sessions_location ON bisetka_sessions USING gist (ll_to_earth(latitude, longitude));
CREATE INDEX idx_bisetka_sessions_created ON bisetka_sessions(created_at DESC);

-- ============================================================
-- 6. USER CLOSEST BISETKA CACHE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_closest_bisetka (
  user_id UUID PRIMARY KEY,
  neighborhood_id VARCHAR(150) REFERENCES neighborhoods(id) ON DELETE CASCADE,
  distance_km DECIMAL(10, 2),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_closest_updated ON user_closest_bisetka(last_updated);

-- ============================================================
-- DISTANCE CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lng1 DECIMAL,
  lat2 DECIMAL,
  lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R CONSTANT DECIMAL := 6371; -- Earth radius in km
  dLat DECIMAL;
  dLng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dLat := RADIANS(lat2 - lat1);
  dLng := RADIANS(lng2 - lng1);
  
  a := SIN(dLat/2) * SIN(dLat/2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dLng/2) * SIN(dLng/2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- FIND NEAREST NEIGHBORHOOD FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearest_neighborhood(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_km DECIMAL DEFAULT 50
) RETURNS TABLE (
  neighborhood_id VARCHAR(150),
  neighborhood_name VARCHAR(150),
  city_name VARCHAR(100),
  country_code CHAR(2),
  distance_km DECIMAL,
  active_sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.name,
    c.name,
    c.country_code,
    calculate_distance(user_lat, user_lng, n.center_lat, n.center_lng),
    COUNT(bs.id) FILTER (WHERE bs.status = 'active')
  FROM neighborhoods n
  JOIN cities c ON n.city_id = c.id
  LEFT JOIN bisetka_sessions bs ON n.id = bs.neighborhood_id
  WHERE calculate_distance(user_lat, user_lng, n.center_lat, n.center_lng) <= radius_km
  GROUP BY n.id, n.name, c.name, c.country_code, n.center_lat, n.center_lng
  ORDER BY calculate_distance(user_lat, user_lng, n.center_lat, n.center_lng) ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- IMPORT DATA FROM JSON
-- ============================================================
-- NOTE: Run the Node.js import script instead of SQL COPY
-- See: scripts/import-locations-to-db.js

-- ============================================================
-- SAMPLE QUERIES
-- ============================================================

-- Find nearest Bisetka to Houston (29.7604, -95.3698)
-- SELECT * FROM find_nearest_neighborhood(29.7604, -95.3698);

-- Get all active Bisetkas for globe
-- SELECT 
--   n.id, n.name as neighborhood_name, c.name as city_name,
--   c.country_code, n.center_lat, n.center_lng,
--   COUNT(bs.id) as active_sessions
-- FROM neighborhoods n
-- JOIN cities c ON n.city_id = c.id
-- JOIN bisetka_sessions bs ON n.id = bs.neighborhood_id
-- WHERE bs.status = 'active'
-- GROUP BY n.id, c.name, c.country_code
-- HAVING COUNT(bs.id) > 0;

COMMENT ON TABLE countries IS 'Countries where Bisetka is available';
COMMENT ON TABLE regions IS 'States, oblasts, and other administrative regions';
COMMENT ON TABLE cities IS 'Major cities with Bisetka presence';
COMMENT ON TABLE neighborhoods IS 'Neighborhoods/districts within cities';
COMMENT ON TABLE bisetka_sessions IS 'Active and past game sessions';
COMMENT ON TABLE user_closest_bisetka IS 'Cached nearest Bisetka for each user (30min TTL)';
COMMENT ON FUNCTION calculate_distance IS 'Haversine formula for distance between two lat/lng points';
COMMENT ON FUNCTION find_nearest_neighborhood IS 'Find the nearest neighborhood to a given coordinate';
