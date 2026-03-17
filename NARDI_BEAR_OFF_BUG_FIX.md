# Nardi Bear-Off Bug Fix

## Bug Report
**Issue:** Players unable to bear off checkers even when all pieces were in the home board.

**Screenshot Evidence:** White player had all checkers in home board (visible in bottom right) with double 1s rolled, but could not bear off.

## Root Cause

The home board point ranges were **completely reversed** in the code:

### Incorrect Implementation
```javascript
// WRONG ❌
const homeStart = currentPlayer === 'white' ? 18 : 0;
const homeEnd = currentPlayer === 'white' ? 24 : 6;
```

### Correct Implementation
```javascript
// RIGHT ✅
const homeStart = currentPlayer === 'white' ? 0 : 18;
const homeEnd = currentPlayer === 'white' ? 6 : 24;
```

## Technical Details

### Board Layout (0-indexed)
- Points: 0-23
- White starts at point 0, moves towards point 23
- Black starts at point 23, moves towards point 0

### Home Boards
- **White home board:** Points 0-5 (bottom right section of board)
- **Black home board:** Points 18-23 (top right section of board)

### Bear-Off Positions
- **White bears off to:** -1 (moving past point 0)
- **Black bears off to:** 24 (moving past point 23)

### Movement Direction for Bearing Off
- **White:** `fromPos - dieValue` (moving towards -1)
- **Black:** `fromPos + dieValue` (moving towards 24)

## Files Modified

1. **`nardiLogic.ts`**
   - Fixed `canBearOff()` function
   - Fixed bear-off move generation in `calculatePossibleMoves()`
   - Updated overage bear-off logic

2. **`NardiScreen.tsx`**
   - Fixed `canPlayerBearOff()` helper function
   - Updated home board range checks

## Changes Made

### 1. canBearOff() Function
```javascript
// White home board: points 0-5 (bottom right)
// Black home board: points 18-23 (top right)
const homeStart = currentPlayer === 'white' ? 0 : 18;
const homeEnd = currentPlayer === 'white' ? 6 : 24;
```

### 2. Bear-Off Move Generation
```javascript
const bearOffPos = currentPlayer === 'white' ? -1 : 24;
const exactPos = currentPlayer === 'white' ? fromPos - dieValue : fromPos + dieValue;
```

### 3. Overage Bear-Off Logic
- **White:** Check if this is the farthest point (highest number 0-5)
- **Black:** Check if this is the farthest point (highest number 18-23)

## Testing Checklist

✅ White can bear off from points 0-5 when all checkers are in home board  
✅ Black can bear off from points 18-23 when all checkers are in home board  
✅ Cannot bear off with checkers on bar  
✅ Cannot bear off with checkers outside home board  
✅ Exact bear-off works (die roll matches distance)  
✅ Overage bear-off works (die too high, bears off from farthest point)  
✅ Win condition triggers at 15 borne-off checkers  
✅ Status message shows "🎯 You can bear off!" when ready  

## Visual Confirmation

When fixed, players will see:
- Green status message: "🎯 You can bear off! Tap your checkers in the home board."
- Tap checkers in home board → they move to tray
- Tray count increments: "X/15"
- At 15 borne-off → Win!

## Resolution

**Status:** ✅ Fixed  
**Date:** 2026-03-16  
**Impact:** High (core game mechanic was broken)  
**Severity:** Critical (prevented game completion)  
