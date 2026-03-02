# ✅ Poker Table - Park Background Visible

## Problem
The poker table image had a solid green background filling the entire rectangular area around the oval table. This blocked the park background from showing through.

## Solution Applied

### 1. Made Outer Green Area Transparent
Processed the poker table image to make everything OUTSIDE the oval table transparent:

```python
# For each pixel:
# Calculate distance from center using ellipse equation
distance = (x/table_width)² + (y/table_height)²

# If outside the oval table (distance > 1.0):
make pixel transparent
```

**Result:**
- ✅ Only the oval poker table is visible
- ✅ Green background outside the table → transparent
- ✅ Park background shows through transparent areas

### 2. Updated Container Backgrounds to Transparent

**Before:**
```typescript
tableContainer: {
  backgroundColor: '#0d5e3a',  // Solid poker green
}
```

**After:**
```typescript
tableContainer: {
  backgroundColor: 'transparent',  // Park shows through
}
```

### 3. Made Bottom Player Area Semi-Transparent

**Before:**
```typescript
currentPlayerArea: {
  backgroundColor: '#094029',  // Solid dark green
}
```

**After:**
```typescript
currentPlayerArea: {
  backgroundColor: 'rgba(9, 64, 41, 0.8)',  // 80% opacity, park shows through
}
```

---

## Visual Result

### Before:
```
┌─────────────────────────┐
│ 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 │
│ 🟩🟩                🟩🟩 │
│ 🟩  [Poker Table]   🟩 │  ← Solid green everywhere
│ 🟩🟩                🟩🟩 │
│ 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩 │
└─────────────────────────┘
```

### After:
```
┌─────────────────────────┐
│ 🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳 │
│ 🌳🌳                🌳🌳 │
│ 🌳  [Poker Table]   🌳 │  ← Park background visible!
│ 🌳🌳                🌳🌳 │
│ 🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳🌳 │
└─────────────────────────┘
   ↑ Park shows through  ↑
     transparent areas
```

---

## Implementation Details

### Park Background (Already in place)
The screen already wraps everything in park background:

```typescript
<ImageBackground
  source={require('../../../../assets/blot/park-background.png')}
  style={styles.container}
  resizeMode="cover">
  {/* Game content */}
</ImageBackground>
```

### Poker Table (Now transparent outside oval)
```typescript
<ImageBackground
  source={require('../../../../assets/poker/table.png')}
  style={styles.pokerTable}
  resizeMode="contain"
>
  {/* Players and cards */}
</ImageBackground>
```

**Table Image Processing:**
- Oval poker table: **visible** (green felt, gray rail, card positions, chips)
- Outside oval: **transparent** (park background shows through)

---

## Files Modified

### 1. `assets/poker/table.png`
- Processed to make outer green area transparent
- Only oval poker table visible
- Rest is transparent (alpha = 0)
- Size: 1.3MB, 1024×1536 (portrait)

### 2. `src/screens/Games/Poker/PokerRoomScreen.tsx`
```typescript
// Changed:
tableContainer: {
  backgroundColor: 'transparent',  // Was '#0d5e3a'
}

currentPlayerArea: {
  backgroundColor: 'rgba(9, 64, 41, 0.8)',  // Was '#094029'
}
```

---

## Benefits

✅ **Park background visible** around the poker table  
✅ **Consistent with other games** (Chess, Checkers use park background)  
✅ **Professional appearance** - table "floats" on park background  
✅ **Better depth perception** - table stands out from background  
✅ **Semi-transparent bottom area** - park still visible, UI readable  

---

## Visual Layers (Bottom to Top)

1. **Park Background** (blurred photo)
2. **Transparent areas** (park shows through)
3. **Poker Table** (oval with green felt and gray rail)
4. **Players, cards, UI** (on top of table)
5. **Bottom player area** (semi-transparent, park shows through)

---

## Summary

The poker table now:
- ✅ Has transparent background OUTSIDE the oval table
- ✅ Shows park background around the table
- ✅ Matches Chess/Checkers/Blot aesthetic
- ✅ Professional casino look with park background
- ✅ Only the oval table itself is visible (not the rectangular green background)

**The park background is now visible around the poker table!** 🃏🌳🛰️
