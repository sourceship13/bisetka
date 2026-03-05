-- ============================================================================
-- Bisetka Spectator Rooms & Waitlist System
-- Database Schema for Multiplayer Room Management
-- ============================================================================

-- Table: game_rooms
-- Tracks active multiplayer game rooms that can be spectated
-- ============================================================================
CREATE TABLE IF NOT EXISTS game_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type VARCHAR(50) NOT NULL, -- 'blot', 'chess', 'poker', 'nardi', etc.
    room_name VARCHAR(255) NOT NULL,
    room_code VARCHAR(20) UNIQUE, -- Optional join code for private rooms
    host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Game state
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'in_progress', 'finished'
    current_player1_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_player2_id UUID REFERENCES users(id) ON DELETE SET NULL,
    current_player3_id UUID REFERENCES users(id) ON DELETE SET NULL, -- For games like poker
    current_player4_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    max_players INTEGER NOT NULL DEFAULT 2, -- 2 for chess/blot, 6 for poker, etc.
    spectator_count INTEGER NOT NULL DEFAULT 0,
    allow_spectators BOOLEAN NOT NULL DEFAULT TRUE,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Indexes for fast queries
    CONSTRAINT valid_status CHECK (status IN ('waiting', 'in_progress', 'finished'))
);

CREATE INDEX idx_game_rooms_game_type ON game_rooms(game_type);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_host ON game_rooms(host_user_id);
CREATE INDEX idx_game_rooms_active ON game_rooms(status, last_activity_at) WHERE status != 'finished';

-- Table: room_participants
-- Tracks all users in a room (players and spectators)
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Participant role
    role VARCHAR(20) NOT NULL, -- 'player', 'spectator', 'waitlist'
    
    -- Player position (for active players)
    player_position INTEGER, -- 1, 2, 3, 4 (NULL for spectators/waitlist)
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(room_id, user_id), -- User can only be in room once
    CONSTRAINT valid_role CHECK (role IN ('player', 'spectator', 'waitlist'))
);

CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
CREATE INDEX idx_room_participants_role ON room_participants(room_id, role);
CREATE INDEX idx_room_participants_active ON room_participants(room_id, left_at) WHERE left_at IS NULL;

-- Table: room_waitlist
-- Manages the queue of players waiting to play next
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Queue position
    queue_position INTEGER NOT NULL, -- 1 = next to play, 2 = second, etc.
    
    -- Preferences
    wants_to_play_winner BOOLEAN NOT NULL DEFAULT TRUE, -- Challenge winner mode
    
    -- Timestamps
    joined_queue_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    removed_from_queue_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(room_id, user_id), -- User can only be in queue once per room
    UNIQUE(room_id, queue_position) -- No duplicate positions in queue
);

CREATE INDEX idx_room_waitlist_room ON room_waitlist(room_id);
CREATE INDEX idx_room_waitlist_user ON room_waitlist(user_id);
CREATE INDEX idx_room_waitlist_position ON room_waitlist(room_id, queue_position);
CREATE INDEX idx_room_waitlist_active ON room_waitlist(room_id, removed_from_queue_at) WHERE removed_from_queue_at IS NULL;

-- Table: room_history
-- Historical record of all rooms and participants
-- ============================================================================
CREATE TABLE IF NOT EXISTS room_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL, -- Don't cascade delete, keep history
    user_id UUID NOT NULL,
    
    -- Role at time of recording
    role VARCHAR(20) NOT NULL, -- 'player', 'spectator', 'waitlist'
    
    -- Game outcome (for players)
    result VARCHAR(20), -- 'won', 'lost', 'draw', NULL for spectators
    player_position INTEGER,
    
    -- Timestamps
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    game_type VARCHAR(50) NOT NULL,
    room_name VARCHAR(255),
    
    CONSTRAINT valid_history_role CHECK (role IN ('player', 'spectator', 'waitlist')),
    CONSTRAINT valid_result CHECK (result IN ('won', 'lost', 'draw') OR result IS NULL)
);

CREATE INDEX idx_room_history_room ON room_history(room_id);
CREATE INDEX idx_room_history_user ON room_history(user_id);
CREATE INDEX idx_room_history_game_type ON room_history(game_type);
CREATE INDEX idx_room_history_date ON room_history(session_start);

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View: active_rooms
-- Shows all currently active rooms with participant counts
-- ============================================================================
CREATE OR REPLACE VIEW active_rooms AS
SELECT 
    gr.id,
    gr.game_type,
    gr.room_name,
    gr.room_code,
    gr.host_user_id,
    u.username AS host_username,
    gr.status,
    gr.max_players,
    gr.spectator_count,
    gr.allow_spectators,
    gr.is_private,
    gr.created_at,
    gr.started_at,
    gr.last_activity_at,
    
    -- Count active participants by role
    (SELECT COUNT(*) FROM room_participants 
     WHERE room_id = gr.id AND role = 'player' AND left_at IS NULL) AS active_players,
    
    (SELECT COUNT(*) FROM room_participants 
     WHERE room_id = gr.id AND role = 'spectator' AND left_at IS NULL) AS active_spectators,
    
    (SELECT COUNT(*) FROM room_waitlist 
     WHERE room_id = gr.id AND removed_from_queue_at IS NULL) AS waitlist_count,
    
    -- Current player usernames
    p1.username AS player1_username,
    p2.username AS player2_username,
    p3.username AS player3_username,
    p4.username AS player4_username
    
FROM game_rooms gr
LEFT JOIN users u ON gr.host_user_id = u.id
LEFT JOIN users p1 ON gr.current_player1_id = p1.id
LEFT JOIN users p2 ON gr.current_player2_id = p2.id
LEFT JOIN users p3 ON gr.current_player3_id = p3.id
LEFT JOIN users p4 ON gr.current_player4_id = p4.id
WHERE gr.status != 'finished';

-- View: room_waitlist_view
-- Shows waitlist with user details in queue order
-- ============================================================================
CREATE OR REPLACE VIEW room_waitlist_view AS
SELECT 
    rw.id,
    rw.room_id,
    rw.user_id,
    u.username,
    rw.queue_position,
    rw.wants_to_play_winner,
    rw.joined_queue_at,
    gr.game_type,
    gr.room_name
FROM room_waitlist rw
JOIN users u ON rw.user_id = u.id
JOIN game_rooms gr ON rw.room_id = gr.id
WHERE rw.removed_from_queue_at IS NULL
ORDER BY rw.room_id, rw.queue_position;

-- ============================================================================
-- Functions & Triggers
-- ============================================================================

-- Function: update_spectator_count
-- Automatically updates spectator_count when participants join/leave
-- ============================================================================
CREATE OR REPLACE FUNCTION update_spectator_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.role = 'spectator' AND NEW.left_at IS NULL THEN
            UPDATE game_rooms 
            SET spectator_count = spectator_count + 1,
                last_activity_at = NOW()
            WHERE id = NEW.room_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'spectator' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
            UPDATE game_rooms 
            SET spectator_count = GREATEST(0, spectator_count - 1),
                last_activity_at = NOW()
            WHERE id = NEW.room_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_spectator_count
AFTER INSERT OR UPDATE ON room_participants
FOR EACH ROW
EXECUTE FUNCTION update_spectator_count();

-- Function: reorder_waitlist
-- Reorders waitlist positions when someone leaves the queue
-- ============================================================================
CREATE OR REPLACE FUNCTION reorder_waitlist()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.removed_from_queue_at IS NULL AND NEW.removed_from_queue_at IS NOT NULL THEN
        -- Someone left the queue, shift everyone up
        UPDATE room_waitlist
        SET queue_position = queue_position - 1
        WHERE room_id = NEW.room_id
          AND queue_position > OLD.queue_position
          AND removed_from_queue_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reorder_waitlist
AFTER UPDATE ON room_waitlist
FOR EACH ROW
WHEN (OLD.removed_from_queue_at IS NULL AND NEW.removed_from_queue_at IS NOT NULL)
EXECUTE FUNCTION reorder_waitlist();

-- Function: archive_room_on_finish
-- Moves participants to history when room finishes
-- ============================================================================
CREATE OR REPLACE FUNCTION archive_room_on_finish()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'finished' AND NEW.status = 'finished' THEN
        -- Archive all participants
        INSERT INTO room_history (
            room_id, user_id, role, player_position, 
            session_start, session_end, game_type, room_name
        )
        SELECT 
            room_id, user_id, role, player_position,
            joined_at, COALESCE(left_at, NOW()), 
            NEW.game_type, NEW.room_name
        FROM room_participants
        WHERE room_id = NEW.id;
        
        -- Mark finish time
        UPDATE game_rooms
        SET finished_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_room
AFTER UPDATE ON game_rooms
FOR EACH ROW
WHEN (OLD.status != 'finished' AND NEW.status = 'finished')
EXECUTE FUNCTION archive_room_on_finish();

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Insert sample rooms (run only in dev environment)
/*
INSERT INTO game_rooms (game_type, room_name, host_user_id, status, max_players)
VALUES 
    ('chess', 'Speed Chess Arena', (SELECT id FROM users LIMIT 1), 'in_progress', 2),
    ('poker', 'High Stakes Table', (SELECT id FROM users LIMIT 1), 'waiting', 6),
    ('blot', 'Armenian Masters', (SELECT id FROM users LIMIT 1), 'in_progress', 2);
*/

-- ============================================================================
-- Cleanup Script (for development)
-- ============================================================================
-- Uncomment to drop all tables (WARNING: DELETES ALL DATA)
/*
DROP TRIGGER IF EXISTS trigger_archive_room ON game_rooms;
DROP TRIGGER IF EXISTS trigger_reorder_waitlist ON room_waitlist;
DROP TRIGGER IF EXISTS trigger_update_spectator_count ON room_participants;
DROP FUNCTION IF EXISTS archive_room_on_finish();
DROP FUNCTION IF EXISTS reorder_waitlist();
DROP FUNCTION IF EXISTS update_spectator_count();
DROP VIEW IF EXISTS room_waitlist_view;
DROP VIEW IF EXISTS active_rooms;
DROP TABLE IF EXISTS room_history;
DROP TABLE IF EXISTS room_waitlist;
DROP TABLE IF EXISTS room_participants;
DROP TABLE IF EXISTS game_rooms;
*/
