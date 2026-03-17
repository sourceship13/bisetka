# Nardi Borne-Off Trays Design

## Visual Layout

The borne-off pieces are now displayed in styled trays positioned at the corners of the screen:

```
┌────────────────────────────────────┐
│  ┌─────────┐                       │
│  │ ⚫ 3/15  │  ← Black's Tray       │
│  │ ●●●     │    (top left)         │
│  └─────────┘                       │
│                                    │
│         GAME BOARD                 │
│       (24 points)                  │
│                                    │
│                     ┌─────────┐    │
│       White's Tray →│ ⚪ 5/15  │    │
│      (bottom right) │ ○○○○○   │    │
│                     └─────────┘    │
└────────────────────────────────────┘
```

## Tray Specifications

### Black Tray (Top Left)
- **Position**: `top: 80, left: 16`
- **Background**: Dark (rgba(26, 26, 46, 0.95))
- **Border**: 2px solid #555
- **Contents**: 
  - Small black circle indicator
  - Count display "X/15"
  - Grid of borne-off black checkers (18x18px each)

### White Tray (Bottom Right)
- **Position**: `bottom: 120, right: 16`
- **Background**: Light (rgba(255, 255, 255, 0.95))
- **Border**: 2px solid #ccc
- **Contents**:
  - Small white circle indicator
  - Count display "X/15"
  - Grid of borne-off white checkers (18x18px each)

## Styling Features

✅ **Rounded corners** (12px border radius)
✅ **Drop shadows** for depth
✅ **Semi-transparent backgrounds**
✅ **Color-coded** (dark for black, light for white)
✅ **Compact design** (min 120px width)
✅ **Flexible height** (grows as pieces are added)
✅ **Z-index: 50** (appears above board)

## Checker Display

- Checkers wrap in rows (3px gap between them)
- Uses actual checker images (18x18px)
- Minimum height ensures tray doesn't collapse when empty
- Auto-wraps to new rows as more pieces are borne off

## Responsive Behavior

The trays:
- Stay fixed in their corners
- Don't overlap with game controls
- Scale down checkers to fit more pieces
- Maintain readability at all counts

## Implementation Details

**File**: `NardiScreen.tsx`

**Black Tray** (lines ~760-790):
- Absolutely positioned from top-left
- Dark theme matching black checkers

**White Tray** (lines ~901-931):
- Absolutely positioned from bottom-right
- Light theme matching white checkers

Both trays are inside the SafeAreaView for proper positioning.

## Usage

As pieces are borne off:
1. Checker removed from board
2. `gameState.home.white` or `.black` increments
3. Tray automatically displays new checker
4. Count updates: "X/15"
5. When 15 reached → Win!

The trays provide clear visual feedback of game progress and make it easy to see how close each player is to winning.
