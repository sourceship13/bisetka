-- ============================================================================
-- Add room_name Column to Existing Multiplayer Game Tables
-- SAFE VERSION: Only alters tables that actually exist
-- ============================================================================

-- ============================================================================
-- Helper function to check if table exists and add column if missing
-- ============================================================================

-- Add room_name to game_sessions (main table)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_sessions') THEN
        -- Add column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'game_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE game_sessions ADD COLUMN room_name VARCHAR(255);
            RAISE NOTICE 'Added room_name to game_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in game_sessions';
        END IF;
        
        -- Set default values for NULL rows
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
        
        -- Add index if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_game_sessions_room_name') THEN
            CREATE INDEX idx_game_sessions_room_name ON game_sessions(room_name);
            RAISE NOTICE 'Created index idx_game_sessions_room_name';
        ELSE
            RAISE NOTICE 'Index idx_game_sessions_room_name already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Table game_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to blot_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blot_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'blot_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE blot_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Blot';
            RAISE NOTICE 'Added room_name to blot_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in blot_sessions';
        END IF;
        
        UPDATE blot_sessions SET room_name = 'Multiplayer Blot' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blot_sessions_room_name') THEN
            CREATE INDEX idx_blot_sessions_room_name ON blot_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table blot_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to chess_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chess_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'chess_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE chess_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Chess';
            RAISE NOTICE 'Added room_name to chess_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in chess_sessions';
        END IF;
        
        UPDATE chess_sessions SET room_name = 'Multiplayer Chess' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chess_sessions_room_name') THEN
            CREATE INDEX idx_chess_sessions_room_name ON chess_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table chess_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to poker_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'poker_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'poker_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE poker_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Poker';
            RAISE NOTICE 'Added room_name to poker_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in poker_sessions';
        END IF;
        
        UPDATE poker_sessions SET room_name = 'Multiplayer Poker' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_poker_sessions_room_name') THEN
            CREATE INDEX idx_poker_sessions_room_name ON poker_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table poker_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to nardi_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nardi_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'nardi_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE nardi_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Nardi';
            RAISE NOTICE 'Added room_name to nardi_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in nardi_sessions';
        END IF;
        
        UPDATE nardi_sessions SET room_name = 'Multiplayer Nardi' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_nardi_sessions_room_name') THEN
            CREATE INDEX idx_nardi_sessions_room_name ON nardi_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table nardi_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to mrotsi_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mrotsi_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'mrotsi_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE mrotsi_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Mrotsi';
            RAISE NOTICE 'Added room_name to mrotsi_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in mrotsi_sessions';
        END IF;
        
        UPDATE mrotsi_sessions SET room_name = 'Multiplayer Mrotsi' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_mrotsi_sessions_room_name') THEN
            CREATE INDEX idx_mrotsi_sessions_room_name ON mrotsi_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table mrotsi_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to checkers_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checkers_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'checkers_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE checkers_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Checkers';
            RAISE NOTICE 'Added room_name to checkers_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in checkers_sessions';
        END IF;
        
        UPDATE checkers_sessions SET room_name = 'Multiplayer Checkers' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_checkers_sessions_room_name') THEN
            CREATE INDEX idx_checkers_sessions_room_name ON checkers_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table checkers_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to billiards_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billiards_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'billiards_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE billiards_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Billiards';
            RAISE NOTICE 'Added room_name to billiards_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in billiards_sessions';
        END IF;
        
        UPDATE billiards_sessions SET room_name = 'Multiplayer Billiards' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_billiards_sessions_room_name') THEN
            CREATE INDEX idx_billiards_sessions_room_name ON billiards_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table billiards_sessions does not exist, skipping';
    END IF;
END $$;

-- Add room_name to baazar_blot_sessions (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'baazar_blot_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'baazar_blot_sessions' AND column_name = 'room_name') THEN
            ALTER TABLE baazar_blot_sessions ADD COLUMN room_name VARCHAR(255) DEFAULT 'Multiplayer Baazar Blot';
            RAISE NOTICE 'Added room_name to baazar_blot_sessions';
        ELSE
            RAISE NOTICE 'room_name already exists in baazar_blot_sessions';
        END IF;
        
        UPDATE baazar_blot_sessions SET room_name = 'Multiplayer Baazar Blot' WHERE room_name IS NULL;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_baazar_blot_sessions_room_name') THEN
            CREATE INDEX idx_baazar_blot_sessions_room_name ON baazar_blot_sessions(room_name);
        END IF;
    ELSE
        RAISE NOTICE 'Table baazar_blot_sessions does not exist, skipping';
    END IF;
END $$;

-- Update game_rooms table (from spectator system) if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_rooms') THEN
        -- room_name already exists in game_rooms from spectator_rooms_schema.sql
        -- Just ensure it has defaults for any NULL rows
        UPDATE game_rooms 
        SET room_name = CONCAT('Multiplayer ', INITCAP(REPLACE(game_type, '-', ' ')))
        WHERE room_name IS NULL OR room_name = '';
        RAISE NOTICE 'Updated game_rooms room_name defaults';
    ELSE
        RAISE NOTICE 'Table game_rooms does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- Verification - Show what was modified
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Verification: Tables with room_name column';
    RAISE NOTICE '============================================';
    
    SELECT COUNT(DISTINCT table_name) INTO table_count
    FROM information_schema.columns 
    WHERE column_name = 'room_name' 
      AND table_schema = 'public';
    
    RAISE NOTICE 'Total tables with room_name: %', table_count;
END $$;

-- List all tables that now have room_name
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    column_default
FROM information_schema.columns 
WHERE column_name = 'room_name' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Show which tables exist in the database
SELECT '=== Existing session tables ===' AS info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name LIKE '%session%'
ORDER BY table_name;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'room_name column has been added to all existing session tables';
    RAISE NOTICE 'Default values have been set for existing rows';
    RAISE NOTICE 'Indexes have been created for faster searches';
    RAISE NOTICE 'You can now use editable room names in multiplayer games!';
    RAISE NOTICE '============================================';
END $$;
