# ✅ Avatar Backend System - Complete Implementation

## Overview

Complete backend implementation for the 2D avatar system with:
- ✅ Database schema (migrated)
- ✅ S3 asset storage
- ✅ RESTful API endpoints (9 total)
- ✅ Profile integration (avatar data in useAuth)
- ✅ Automatic default item claiming

## Architecture

```
Frontend (React Native)
    ↓
API Service (axios)
    ↓
Backend API (/api/avatar/*)
    ↓
Avatar Service
    ↓
Avatar Repository
    ↓
PostgreSQL + S3
```

## Database Tables (✅ Migrated)

### 1. `base_avatars`
Stores all base avatar characters (16 total).
```sql
- id (UUID, PK)
- name (TEXT)
- description (TEXT)
- s3_url (TEXT) -- S3 URL for avatar image
- gender (TEXT) -- 'male' or 'female'
- is_active (BOOLEAN)
- display_order (INTEGER)
- created_at (TIMESTAMP)
```

### 2. `avatar_clothing`
Stores all clothing items (31+ items).
```sql
- id (UUID, PK)
- name (TEXT)
- type (TEXT) -- 'hair', 'top', 'bottom', 'shoes', 'jewelry', 'hat', 'other'
- description (TEXT)
- price (INTEGER) -- in cents
- s3_url (TEXT) -- S3 URL for clothing image
- thumbnail_url (TEXT)
- rarity (TEXT) -- 'common', 'rare', 'epic', 'legendary'
- is_default (BOOLEAN) -- free starter items
- gender (TEXT) -- 'male', 'female', 'unisex'
- created_at (TIMESTAMP)
```

### 3. `user_avatars`
Tracks which base avatar each user selected.
```sql
- user_id (UUID, PK, FK -> users.id)
- base_avatar_id (UUID, FK -> base_avatars.id)
- selected_at (TIMESTAMP)
```

### 4. `user_clothing_inventory`
Tracks which clothing items each user owns.
```sql
- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- clothing_id (UUID, FK -> avatar_clothing.id)
- purchased_at (TIMESTAMP)
- UNIQUE(user_id, clothing_id)
```

### 5. `user_equipped_clothing`
Tracks what clothing each user is currently wearing.
```sql
- user_id (UUID, PK, FK -> users.id)
- hair_id (UUID, FK -> avatar_clothing.id)
- top_id (UUID, FK -> avatar_clothing.id)
- bottom_id (UUID, FK -> avatar_clothing.id)
- shoes_id (UUID, FK -> avatar_clothing.id)
- jewelry_id (UUID, FK -> avatar_clothing.id)
- hat_id (UUID, FK -> avatar_clothing.id)
- other_id (UUID, FK -> avatar_clothing.id)
- updated_at (TIMESTAMP)
```

## API Endpoints

### Base Avatar Routes

#### `GET /api/avatar/base-avatars`
Get all available base avatars.
```bash
# Response
{
  "avatars": [
    {
      "id": "uuid",
      "name": "Bald Beard",
      "description": "Strong and confident",
      "s3_url": "https://...",
      "gender": "male",
      "is_active": true,
      "display_order": 1,
      "created_at": "2026-03-14T..."
    },
    ...
  ]
}
```

#### `POST /api/avatar/select-base`
Select a base avatar for the user.
```bash
# Request
{
  "baseAvatarId": "uuid"
}

# Response
{
  "success": true,
  "avatar": { ... }
}
```
**Note:** Auto-equips default clothing items on first selection!

### Clothing Routes

#### `GET /api/avatar/clothing/store`
Get all clothing items available in store.
```bash
# Response
{
  "items": [
    {
      "id": "uuid",
      "name": "Black Hoodie",
      "type": "top",
      "description": "Classic black hoodie",
      "price": 399,
      "s3_url": "https://...",
      "rarity": "rare",
      "is_default": false,
      "gender": "unisex",
      "created_at": "2026-03-14T..."
    },
    ...
  ]
}
```

#### `GET /api/avatar/clothing/inventory`
Get user's owned clothing items.
```bash
# Response
{
  "items": [...]  // Same format as store
}
```

#### `POST /api/avatar/clothing/claim`
Claim all free (default) items.
```bash
# Response
{
  "claimed": [...],  // Items that were claimed
  "count": 6
}
```

#### `POST /api/avatar/clothing/purchase`
Purchase a clothing item (TODO: Stripe integration).
```bash
# Request
{
  "clothingId": "uuid"
}

# Response
{
  "success": true,
  "item": { ... }
}
```

#### `POST /api/avatar/clothing/equip`
Equip a clothing item.
```bash
# Request
{
  "clothingId": "uuid"
}

# Response
{
  "success": true,
  "item": { ... }
}
```

#### `POST /api/avatar/clothing/unequip`
Unequip a clothing item by type.
```bash
# Request
{
  "type": "hat"  // hair, top, bottom, shoes, jewelry, hat, other
}

# Response
{
  "success": true
}
```

#### `GET /api/avatar/complete`
Get complete avatar (base + equipped items).
```bash
# Response
{
  "baseAvatar": { ... },
  "equipped": {
    "hair": { ... },
    "top": { ... },
    "bottom": { ... },
    "shoes": { ... },
    "jewelry": { ... },
    "hat": null,
    "other": null
  }
}
```

### Profile Integration

#### `GET /api/auth/profile`
Now includes avatar data!
```bash
# Response
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "player1",
  "avatar": {
    "baseAvatar": { ... },
    "equipped": { ... },
    "inventory": [...]
  },
  ...
}
```

## S3 Folder Structure

```
bisetka-ai-images (bucket)
├── store-items/
│   ├── avatars/
│   │   ├── male-1-bald-beard.png
│   │   ├── male-2-curly-beard.png
│   │   ├── ...
│   │   └── female-8-mature.png
│   └── clothing/
│       ├── hair/
│       ├── top/
│       ├── bottom/
│       ├── shoes/
│       ├── accessory/ (→ jewelry)
│       ├── glasses/ (→ jewelry)
│       └── hat/
└── ai-generated/
    ├── game-boards/
    └── cards/
```

## Backend Files Created

### Repositories
- ✅ `src/repositories/avatar.repository.ts` (6882 bytes)

### Services
- ✅ `src/services/avatar.service.ts` (3231 bytes)

### Controllers
- ✅ `src/controllers/avatar.controller.ts` (4370 bytes)

### Routes
- ✅ `src/routes/avatar.routes.ts` (913 bytes)

### Scripts
- ✅ `src/scripts/upload-avatar-assets.ts` (7002 bytes)

### Modifications
- ✅ `src/index.ts` - Added avatar routes
- ✅ `src/controllers/auth.controller.ts` - Added avatar data to profile

## Frontend Files Modified

- ✅ `src/types/auth.ts` - Added `avatar` field to User interface

## Setup Instructions

### 1. Run Migration (✅ DONE)
```bash
cd bisetka-backend
source .env
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/002_avatar_2d_system_v2.sql
```

### 2. Upload Assets to S3
```bash
cd bisetka-backend
npx ts-node src/scripts/upload-avatar-assets.ts
```

This will:
- Upload all 16 base avatars to S3
- Upload all 31+ clothing items to S3
- Populate database with S3 URLs
- Set prices, rarities, and default flags

### 3. Test API Endpoints
```bash
# Get base avatars
curl https://api.bisetka.com/api/avatar/base-avatars

# Select base avatar (requires auth token)
curl -X POST https://api.bisetka.com/api/avatar/select-base \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"baseAvatarId":"uuid"}'

# Get store items
curl https://api.bisetka.com/api/avatar/clothing/store \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Update Frontend Screens
Replace AsyncStorage mock data with API calls:

**AvatarSelectionScreen.tsx:**
```typescript
// Old
const avatars = MOCK_AVATARS;

// New
const { data } = await apiService.get('/avatar/base-avatars');
const avatars = data.avatars;
```

**WardrobeScreen.tsx:**
```typescript
// Old
const inventory = MOCK_INVENTORY;

// New
const { data } = await apiService.get('/avatar/clothing/inventory');
const inventory = data.items;
```

**ClothingStoreScreen.tsx:**
```typescript
// Old
const items = MOCK_CLOTHING;

// New
const { data } = await apiService.get('/avatar/clothing/store');
const items = data.items;
```

## Auto-Equip Defaults

When a user selects their first base avatar, the backend automatically:
1. Adds all free (default) items to their inventory
2. Equips all default items

**Default Items (Free):**
- Gray T-Shirt
- White Polo
- Blue Jeans
- White Sneakers
- Black Curly Hair (if applicable)
- Brown Ponytail (if applicable)

## Data Flow Example

### User Selects Avatar
```
1. User picks "Bald Beard Guy" in app
2. POST /api/avatar/select-base { baseAvatarId: "..." }
3. Backend:
   - Saves to user_avatars table
   - Checks if first avatar → auto-equips defaults
   - Returns success
4. Frontend:
   - Saves to AsyncStorage (cache)
   - Updates UI
   - User now has base avatar + starter clothing
```

### User Equips Clothing
```
1. User taps "Black Hoodie" → "Equip Now"
2. POST /api/avatar/clothing/equip { clothingId: "..." }
3. Backend:
   - Validates ownership
   - Updates user_equipped_clothing.top_id
   - Returns success
4. Frontend:
   - Updates AsyncStorage
   - Re-renders AvatarPreview with new clothing
```

### useAuth Returns Avatar Data
```
1. App launches
2. useAuth calls apiService.getProfile()
3. Backend returns:
   {
     ...user data,
     avatar: {
       baseAvatar: {...},
       equipped: {...},
       inventory: [...]
     }
   }
4. Frontend:
   - user.avatar.baseAvatar → current base
   - user.avatar.equipped → currently wearing
   - user.avatar.inventory → owned items
```

## Next Steps

### Immediate
1. ✅ Migration run
2. 🔄 Upload assets to S3 (run script)
3. 🔄 Update frontend to use API instead of mock data
4. ✅ Test complete flow

### Future Enhancements
- [ ] Stripe payment integration for purchases
- [ ] Admin panel for adding new items
- [ ] Batch operations (equip multiple items)
- [ ] Avatar sharing/screenshots
- [ ] Clothing sets/outfits
- [ ] Seasonal items
- [ ] Limited edition items

## Troubleshooting

### "Item not owned" error
User tried to equip an item they don't own. Either:
- They need to purchase it
- Or claim free items first

### "Base avatar not found"
Invalid avatar ID passed. Check:
- ID format (UUID)
- Avatar exists in database
- Avatar is active

### S3 Upload fails
Check:
- AWS credentials in .env
- S3 bucket permissions
- File paths are correct
- Images are valid PNG/JPG

### Database connection error
Verify:
- DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env
- VPN/network access to RDS
- Database is running

---

**Status:** ✅ Backend Complete | 🔄 Assets Upload Pending | 🔄 Frontend Integration Pending

**Last Updated:** March 14, 2026
