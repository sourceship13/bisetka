# Avatar Setup

## To use your character:

1. **Get a PNG of your character** (front view)
   - Either screenshot from VRM viewer
   - Or use the Midjourney character you generated

2. **Save it as:** `character.png` in this folder

3. **Update HomeScreen.tsx:**
   ```typescript
   <WalkingAvatar
     size={120}
     walkSpeed={150}
     avatarImage={require('../../assets/avatars/character.png')}
   />
   ```

## For clothing changes:

Create multiple PNGs:
- `character_blue_shirt.png`
- `character_red_shirt.png`
- etc.

Then swap them in code to change outfits!
