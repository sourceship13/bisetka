-- ============================================================================
-- Add room_name Column to All Multiplayer Game Tables
-- Run this script to add editable room names to all multiplayer sessions
-- ============================================================================

-- ============================================================================
-- 1. Add room_name to game_sessions (if this is your main sessions table)
-- ============================================================================
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255);

-- Set default values for existing rows
UPDATE game_sessions 
SET room_name = CASE 
    WHEN game_type = 'blot' THEN 'Multiplayer Blot'
    WHEN game_type = 'baazar-blot' THEN 'Multiplayer Baazar Blot'
    WHEN game_type = 'chess' THEN 'Multiplayer Chess'
    WHEN game_type = 'checkers' THEN 'Multiplayer Checkers'
    WHEN game_type = 'poker' THEN 'Multiplayer Poker'
    WHEN game_type = 'nardi' THEN 'Multiplayer Nardi'
    WHEN game_type = 'mrotsi' THEN 'Multiplayer Mrotsi'
    WHEN game_type = 'billiards' THEN 'Multiplayer Billiards'
    WHEN game_type = '9-ball' THEN 'Multiplayer 9-Ball'
    ELSE 'Multiplayer Game'
END
WHERE room_name IS NULL;

-- Add index for faster room name searches
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_name ON game_sessions(room_name);

-- ============================================================================
-- 2. Add room_name to blot_sessions (if exists)
-- ============================================================================
ALTER TABLE blot_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Blot';

UPDATE blot_sessions 
SET room_name = 'Multiplayer Blot' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_blot_sessions_room_name ON blot_sessions(room_name);

-- ============================================================================
-- 3. Add room_name to chess_sessions (if exists)
-- ============================================================================
ALTER TABLE chess_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Chess';

UPDATE chess_sessions 
SET room_name = 'Multiplayer Chess' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_chess_sessions_room_name ON chess_sessions(room_name);

-- ============================================================================
-- 4. Add room_name to poker_sessions (if exists)
-- ============================================================================
ALTER TABLE poker_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Poker';

UPDATE poker_sessions 
SET room_name = 'Multiplayer Poker' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_poker_sessions_room_name ON poker_sessions(room_name);

-- ============================================================================
-- 5. Add room_name to nardi_sessions (if exists)
-- ============================================================================
ALTER TABLE nardi_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Nardi';

UPDATE nardi_sessions 
SET room_name = 'Multiplayer Nardi' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_nardi_sessions_room_name ON nardi_sessions(room_name);

-- ============================================================================
-- 6. Add room_name to mrotsi_sessions (if exists)
-- ============================================================================
ALTER TABLE mrotsi_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Mrotsi';

UPDATE mrotsi_sessions 
SET room_name = 'Multiplayer Mrotsi' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_mrotsi_sessions_room_name ON mrotsi_sessions(room_name);

-- ============================================================================
-- 7. Add room_name to checkers_sessions (if exists)
-- ============================================================================
ALTER TABLE checkers_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Checkers';

UPDATE checkers_sessions 
SET room_name = 'Multiplayer Checkers' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_checkers_sessions_room_name ON checkers_sessions(room_name);

-- ============================================================================
-- 8. Add room_name to billiards_sessions (if exists)
-- ============================================================================
ALTER TABLE billiards_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Billiards';

UPDATE billiards_sessions 
SET room_name = 'Multiplayer Billiards' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_billiards_sessions_room_name ON billiards_sessions(room_name);

-- ============================================================================
-- 9. Add room_name to baazar_blot_sessions (if exists)
-- ============================================================================
ALTER TABLE baazar_blot_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Baazar Blot';

UPDATE baazar_blot_sessions 
SET room_name = 'Multiplayer Baazar Blot' 
WHERE room_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_baazar_blot_sessions_room_name ON baazar_blot_sessions(room_name);

-- ============================================================================
-- 10. Update the game_rooms table from spectator system (if using it)
-- ============================================================================
-- Note: game_rooms already has room_name from the spectator_rooms_schema.sql
-- Just ensure it has a default if somehow NULL
UPDATE game_rooms 
SET room_name = CONCAT('Multiplayer ', INITCAP(game_type))
WHERE room_name IS NULL OR room_name = '';

-- ============================================================================
-- Verification Queries - Run these to check if columns were added
-- ============================================================================

-- Check game_sessions
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns 
WHERE table_name = 'game_sessions' AND column_name = 'room_name';

-- Check blot_sessions
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns 
WHERE table_name = 'blot_sessions' AND column_name = 'room_name';

-- Check chess_sessions
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns 
WHERE table_name = 'chess_sessions' AND column_name = 'room_name';

-- Check poker_sessions
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns 
WHERE table_name = 'poker_sessions' AND column_name = 'room_name';

-- List all tables to see what exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name LIKE '%session%'
ORDER BY table_name;

-- ============================================================================
-- Rollback Script (ONLY IF YOU NEED TO UNDO)
-- ============================================================================
-- Uncomment and run if you need to remove the room_name columns

/*
ALTER TABLE game_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE blot_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE chess_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE poker_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE nardi_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE mrotsi_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE checkers_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE billiards_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE baazar_blot_sessions DROP COLUMN IF EXISTS room_name;

DROP INDEX IF EXISTS idx_game_sessions_room_name;
DROP INDEX IF EXISTS idx_blot_sessions_room_name;
DROP INDEX IF EXISTS idx_chess_sessions_room_name;
DROP INDEX IF EXISTS idx_poker_sessions_room_name;
DROP INDEX IF EXISTS idx_nardi_sessions_room_name;
DROP INDEX IF EXISTS idx_mrotsi_sessions_room_name;
DROP INDEX IF EXISTS idx_checkers_sessions_room_name;
DROP INDEX IF EXISTS idx_billiards_sessions_room_name;
DROP INDEX IF EXISTS idx_baazar_blot_sessions_room_name;
*/

-- ============================================================================
-- Notes:
-- ============================================================================
-- 1. IF NOT EXISTS prevents errors if column already exists
-- 2. VARCHAR(255) allows room names up to 255 characters
-- 3. Default values set to "Multiplayer [GameType]"
-- 4. Indexes added for faster room name searches/filters
-- 5. Use the verification queries to confirm columns were added
-- 6. Adjust table names if your database uses different naming conventions
