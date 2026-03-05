# Room Name Database Migration

## Quick Start

Run this SQL script to add room_name columns to all multiplayer game tables:

```bash
psql -U your_user -d bisetka_db -f database/add_room_name_column.sql
```

## What This Script Does

1. **Adds `room_name` column** to all game session tables
2. **Sets default values** (e.g., "Multiplayer Blot", "Multiplayer Chess")
3. **Creates indexes** for faster room name searches
4. **Updates existing rows** with appropriate default names based on game type

## Tables Modified

The script attempts to add `room_name VARCHAR(255)` to:

- `game_sessions` (main sessions table)
- `blot_sessions`
- `baazar_blot_sessions`
- `chess_sessions`
- `checkers_sessions`
- `poker_sessions`
- `nardi_sessions`
- `mrotsi_sessions`
- `billiards_sessions`
- `game_rooms` (from spectator system)

**Note:** The script uses `IF NOT EXISTS` and will skip tables that don't exist in your database.

## Verification

After running the script, verify the columns were added:

```sql
-- Check game_sessions table
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'game_sessions' AND column_name = 'room_name';

-- List all tables with room_name column
SELECT table_name 
FROM information_schema.columns 
WHERE column_name = 'room_name' 
  AND table_schema = 'public'
ORDER BY table_name;

-- Sample data check
SELECT id, game_type, room_name, created_at 
FROM game_sessions 
LIMIT 10;
```

## Expected Output

```
       table_name        | column_name | data_type | character_maximum_length
-------------------------+-------------+-----------+-------------------------
 game_sessions           | room_name   | varchar   | 255
 blot_sessions           | room_name   | varchar   | 255
 chess_sessions          | room_name   | varchar   | 255
 ...
```

## Rollback (If Needed)

If you need to undo the migration:

```sql
-- WARNING: This will delete all room names!
ALTER TABLE game_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE blot_sessions DROP COLUMN IF EXISTS room_name;
ALTER TABLE chess_sessions DROP COLUMN IF EXISTS room_name;
-- ... etc for all tables
```

Or run the commented-out rollback section at the bottom of `add_room_name_column.sql`.

## Custom Table Names

If your database uses different table names, edit `add_room_name_column.sql` and replace table names as needed.

Example: If you have `blot_game_sessions` instead of `blot_sessions`:

```sql
ALTER TABLE blot_game_sessions 
ADD COLUMN IF NOT EXISTS room_name VARCHAR(255) DEFAULT 'Multiplayer Blot';
```

## Next Steps

After running the SQL:

1. ✅ Database has `room_name` column
2. ⬜ Implement backend API endpoint (see `ROOM_NAME_EDITOR_GUIDE.md`)
3. ⬜ Add `RoomNameModal` to each multiplayer screen
4. ⬜ Connect frontend to API
5. ⬜ Test room name editing in all games

## Troubleshooting

### Error: "column already exists"
**Solution:** The script uses `IF NOT EXISTS`, so this shouldn't happen. If it does, the column is already there - no action needed.

### Error: "table does not exist"
**Solution:** The script will skip non-existent tables. This is expected if you don't have all game types implemented yet.

### Names not showing in UI
**Solution:** Make sure your backend API is returning the `room_name` field when fetching session data.

### Names resetting to default
**Solution:** Check that your UPDATE queries in the backend are saving the new names correctly.

## Support

For implementation questions, see:
- `ROOM_NAME_EDITOR_GUIDE.md` - Frontend integration guide
- `add_room_name_column.sql` - Full SQL with comments
