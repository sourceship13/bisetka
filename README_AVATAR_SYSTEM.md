# Bisetka 2D Avatar System

## Overview

Complete 2D avatar customization system with 16 base avatars, 31 clothing items, and 7 categories.

## Features

- **16 Base Avatars** - 8 male + 8 female body types
- **31 Clothing Items** - Multiple colors for each style
- **Try-On Preview** - See before/after before equipping
- **7 Categories** - Hair, Tops, Bottoms, Shoes, Jewelry, Hats, Other
- **Live Preview** - Real-time avatar updates in wardrobe
- **Local Storage** - AsyncStorage for offline functionality

## Quick Start

### 1. User Flow
```
Onboarding → Pick Base Avatar → Home → My Wardrobe → Dress Up
                                     → Clothing Store → Purchase Items
```

### 2. Key Screens
- **AvatarSelectionScreen** - Pick from 16 base avatars
- **WardrobeScreen** - Dress your avatar, try on items
- **ClothingStoreScreen** - Browse & purchase clothing
- **TryOnModal** - Before/after preview

### 3. Tech Stack
- **Storage:** AsyncStorage (will be replaced with backend API)
- **Assets:** Local PNG files (transparent layers)
- **Rendering:** React Native Image with layering

## File Structure

```
src/
├── types/
│   └── avatar2d.ts                    # TypeScript types
├── components/
│   ├── AvatarPreview.tsx              # Avatar renderer
│   └── TryOnModal.tsx                 # Try-on preview
├── screens/Meta/
│   ├── Onboarding/
│   │   └── AvatarSelectionScreen.tsx  # Pick base avatar
│   └── Home/
│       ├── WardrobeScreen.tsx         # Dress avatar
│       └── ClothingStoreScreen.tsx    # Store
├── data/
│   └── clothingItems.ts               # All 31 items
└── utils/
    └── avatars.ts                     # Helper functions

assets/
├── avatars/base/                      # 16 base avatar PNGs
└── clothing/                          # 31 clothing PNGs
    ├── hair/
    ├── top/
    ├── bottom/
    ├── shoes/
    ├── accessory/
    ├── glasses/
    └── hat/

database/migrations/
└── 002_avatar_2d_system_v2.sql       # Current DB schema
```

## Categories

| Category | Icon | Count | Examples |
|----------|------|-------|----------|
| Hair | 💇 | 3 | Black Curly, Brown Ponytail, Blonde Bob |
| Tops | 👕 | 11 | T-shirts (5 colors), Hoodies (4 colors), Polo, Jacket |
| Bottoms | 👖 | 9 | Jeans (4 colors), Joggers (2), Dress Pants, Shorts |
| Shoes | 👟 | 5 | Sneakers (4 colors), Dress Shoes |
| Jewelry | 💎 | 2 | Gold Chain, Sunglasses |
| Hats | 🧢 | 1 | Baseball Cap |
| Other | 🛹 | 0 | (Future: skateboards, backpacks) |

## Layering Order

Images render bottom-to-top:
1. Base Avatar (in underwear)
2. Bottom (pants/shorts)
3. Shoes
4. Top (shirt/hoodie)
5. Hair
6. Hat
7. Jewelry (chains/glasses)
8. Other (skateboards/backpacks)

## Base Avatars

### Male (8)
1. Bald Beard - Muscular
2. Curly Beard - Casual
3. Athletic - Fit
4. Skinny - Lean
5. Heavy - Big
6. Tall Blonde - Cool
7. Short Red - Stocky
8. Older Guy - Mature

### Female (8)
1. Ponytail - Athletic
2. Blonde Bob - Trendy
3. Curvy - Confident
4. Skinny - Slim
5. Plus Size - Beautiful
6. Tall Red - Athletic
7. Short Blonde - Petite
8. Mature - Elegant

## Backend Integration (TODO)

Currently using mock data + AsyncStorage. Need to implement:

### API Endpoints (9 total)
1. `GET /avatar/base-avatars` - List all base avatars
2. `POST /avatar/select-base` - Set user's base avatar
3. `GET /avatar/clothing/store` - Get store items
4. `GET /avatar/clothing/inventory` - Get owned items
5. `POST /avatar/clothing/claim` - Claim free items
6. `POST /avatar/clothing/purchase` - Buy with Stripe
7. `POST /avatar/clothing/equip` - Equip item
8. `POST /avatar/clothing/unequip` - Remove item
9. `GET /avatar/complete` - Get full avatar data

### Database Schema
See: `database/migrations/002_avatar_2d_system_v2.sql`

Tables:
- `base_avatars` - 16 base avatars
- `avatar_clothing` - 31 clothing items
- `user_avatars` - User's selected base
- `user_clothing_inventory` - Owned items
- `user_equipped_clothing` - Currently wearing

## Asset Generation

All 47 assets (16 avatars + 31 clothing) were AI-generated using:
- **Tool:** Gemini 3 Pro Image API
- **Style:** "2D cartoon, bold black outlines, simple flat colors, South Park meets GTA"
- **Resolution:** 2K (2816x1536)
- **Format:** PNG with white backgrounds (avatars) or transparent (clothing)

## Troubleshooting

### Avatar Not Showing
- Check: `baseAvatar` is loaded from AsyncStorage
- Fallback: Default avatar (Bald Beard Guy) should load
- Debug: Check console logs in `AvatarPreview.tsx`

### Checkerboard Pattern
- **Fixed:** All images now wrapped in white background Views
- Images use `resizeMode="contain"` to maintain aspect ratio

### Categories Missing
- Check: `CATEGORY_TABS` in WardrobeScreen & ClothingStoreScreen
- Types: Ensure `ClothingType` includes all 7 types

### Images Not Loading
- All assets use `require()` instead of URI strings
- Check paths in `src/data/clothingItems.ts`

## Development

### Add New Clothing Item
1. Generate asset PNG (transparent background)
2. Save to `assets/clothing/{type}/`
3. Add entry to `src/data/clothingItems.ts`
4. Rebuild app

### Add New Base Avatar
1. Generate avatar PNG (white background, in underwear)
2. Save to `assets/avatars/base/`
3. Add entry to `AvatarSelectionScreen.tsx` MOCK_AVATARS
4. Rebuild app

### Change Categories
1. Update `ClothingType` in `src/types/avatar2d.ts`
2. Update `CATEGORY_TABS` in both screens
3. Update `AvatarPreview.tsx` layering
4. Update database migration

## Performance

- **Asset Size:** ~150MB total (47 files)
- **Load Time:** Instant (local assets)
- **Rendering:** Fast (simple Image layering)
- **Storage:** AsyncStorage (< 1KB per user)

## Future Enhancements

### Planned Features
- [ ] More base avatars (32 total - 16 per gender)
- [ ] More clothing items (100+ total)
- [ ] Color picker for clothing
- [ ] Animated preview (walking, idle)
- [ ] Social sharing
- [ ] Avatar customization (skin tone, face features)

### Jewelry Category Items
- [ ] Watches
- [ ] Bracelets
- [ ] Rings
- [ ] Earrings
- [ ] More necklaces

### Other Category Items
- [ ] Skateboard
- [ ] Backpack
- [ ] Guitar
- [ ] Basketball
- [ ] Phone
- [ ] Headphones

## Documentation

- **FINAL_AVATAR_SYSTEM.md** - Complete system overview
- **AVATAR_FIXES_FINAL.md** - Latest bug fixes
- **AVATAR_ASSETS_COMPLETE.md** - Full asset inventory
- **CLEANUP_COMPLETE.md** - What was removed
- **README_AVATAR_SYSTEM.md** - This file

## Support

Issues? Check:
1. Console logs in browser/React Native debugger
2. AsyncStorage keys: `@bisetka_selected_avatar`, `@bisetka_equipped_clothing`
3. Asset paths in `src/data/clothingItems.ts`
4. Navigation routes in `AppNavigator.tsx`

---

**Last Updated:** March 14, 2026
**Version:** 1.0.0
**Status:** ✅ Fully Functional (Frontend Complete)
