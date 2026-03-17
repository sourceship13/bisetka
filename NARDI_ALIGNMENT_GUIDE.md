# Nardi Board Alignment Guide

## Quick Adjustment Constants

All positioning is controlled by **6 simple constants** at the top of `NardiScreen.tsx`:

```typescript
const LEFT_MARGIN = 32;        // Distance from left edge to first column
const TOP_MARGIN = 32;         // Distance from top edge to top pieces
const BOTTOM_MARGIN = 32;      // Distance from bottom edge to bottom pieces
const POINT_SPACING = 54;      // Horizontal space between point centers
const BAR_GAP = 24;            // Extra gap in the middle for the bar
const CHECKER_SIZE = 44;       // Size of each game piece
```

## How to Adjust

### Pieces too far LEFT
**Decrease** `LEFT_MARGIN`
```typescript
const LEFT_MARGIN = 28;  // was 32
```

### Pieces too far RIGHT
**Increase** `LEFT_MARGIN`
```typescript
const LEFT_MARGIN = 36;  // was 32
```

### Pieces too CLOSE together horizontally
**Increase** `POINT_SPACING`
```typescript
const POINT_SPACING = 58;  // was 54
```

### Pieces too FAR APART horizontally
**Decrease** `POINT_SPACING`
```typescript
const POINT_SPACING = 50;  // was 54
```

### Pieces too HIGH (top row)
**Increase** `TOP_MARGIN`
```typescript
const TOP_MARGIN = 36;  // was 32
```

### Pieces too LOW (bottom row)
**Decrease** `BOTTOM_MARGIN`
```typescript
const BOTTOM_MARGIN = 28;  // was 32
```

### Pieces too BIG
**Decrease** `CHECKER_SIZE`
```typescript
const CHECKER_SIZE = 40;  // was 44
```

### Pieces too SMALL
**Increase** `CHECKER_SIZE`
```typescript
const CHECKER_SIZE = 48;  // was 44
```

### Center BAR too narrow
**Increase** `BAR_GAP`
```typescript
const BAR_GAP = 28;  // was 24
```

### Center BAR too wide
**Decrease** `BAR_GAP`
```typescript
const BAR_GAP = 20;  // was 24
```

## Tips

- **Make small changes** (2-4 units at a time)
- **Reload the app** after each change to see the result
- **Start with LEFT_MARGIN and POINT_SPACING** — these have the biggest impact
- **Use the background board image as reference** — pieces should center in each triangle

## Current Board Background

File: `bisetka/assets/nardi/board-futuristic.png`
- 12 triangular points on each half (24 total)
- Neon/cyberpunk style
- Center bar divider

---

**Last updated:** 2025-01-21
