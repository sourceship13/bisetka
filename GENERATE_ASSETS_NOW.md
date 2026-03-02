# Generate Chess & Checkers Assets - Multiple Options

## Current Situation

**Problem:** 
- Gemini API: Quota exhausted (retry in 28s)
- OpenAI API: Server error

**What you have:**
- ✅ Chess screen with beautiful park background
- ✅ Empty asset directories ready
- ❌ No piece images yet

---

## Option 1: Wait & Use Gemini (RECOMMENDED - FREE)

**Wait:** ~30 seconds for quota reset  
**Commands:** Ready to copy-paste below

### Generate Chess Pieces (Run after quota resets):

```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess/pieces

# White pieces
uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White King. Elegant design. Front view. Crown and cross on top. White marble with gold. Transparent background." --filename "white-king.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White Queen. Elegant design. Front view. Graceful crown (no cross). White marble with gold. Transparent background." --filename "white-queen.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White Rook. Tower shape with battlements. White marble. Transparent background." --filename "white-rook.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White Bishop. Tall piece with pointed mitre top. White marble. Transparent background." --filename "white-bishop.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White Knight. Horse head side profile. White marble. Transparent background." --filename "white-knight.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White Pawn. Small simple piece with rounded top. White marble. Transparent background." --filename "white-pawn.png" --resolution 1K

# Black pieces
uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black King. Elegant design. Front view. Crown and cross on top. Black obsidian with silver. Transparent background." --filename "black-king.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black Queen. Elegant design. Front view. Graceful crown (no cross). Black obsidian with silver. Transparent background." --filename "black-queen.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black Rook. Tower shape with battlements. Black obsidian. Transparent background." --filename "black-rook.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black Bishop. Tall piece with pointed mitre top. Black obsidian. Transparent background." --filename "black-bishop.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black Knight. Horse head side profile. Black obsidian. Transparent background." --filename "black-knight.png" --resolution 1K

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: Black Pawn. Small simple piece with rounded top. Black obsidian. Transparent background." --filename "black-pawn.png" --resolution 1K
```

### Generate Chess Board:

```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess

uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Beautiful chess board viewed from above. 8x8 grid. Alternating light tan and dark brown squares. Wood texture. Coordinates a-h and 1-8 on edges. No pieces. Professional quality." --filename "board.png" --resolution 2K
```

**Time:** ~15 minutes for all 13 images (may hit rate limits, wait between batches)

---

## Option 2: Use Different AI Service

### Midjourney (via Discord):
1. Join Midjourney Discord
2. Use `/imagine` command with the prompts above
3. Download and save to asset folders
4. **Pros:** Best quality
5. **Cons:** Requires Discord, manual process

### Leonardo.ai (Free):
1. Go to https://leonardo.ai
2. Use "AI Image Generation"
3. Paste prompts from above
4. Download PNG files
5. **Pros:** Free, good quality
6. **Cons:** Manual process

---

## Option 3: Use Stock/Free Chess Piece PNGs (FASTEST)

### Quick Win - Download ready-made pieces:

**Websites with free chess piece PNGs:**
- https://www.flaticon.com/free-icons/chess
- https://www.svgrepo.com/vectors/chess/
- https://www.iconfinder.com/search/icons?q=chess+piece&price=free

**Download requirements:**
- 1024x1024px minimum
- Transparent background (PNG)
- Clear, professional design
- Rename to match:
  - white-king.png, white-queen.png, etc.
  - black-king.png, black-queen.png, etc.

**Pros:** Instant, guaranteed to work  
**Cons:** Not custom/original design

---

## Option 4: Create Simple Programmatic Pieces (ULTRA FAST)

I can create simple SVG-based pieces right now using code! These won't be photorealistic but will work immediately.

**Want me to do this as a temporary solution?**

---

## My Recommendation

**Immediate (5 mins):**
1. Download 12 free chess piece PNGs from Flaticon/SVGrepo
2. Rename and place in `assets/chess/pieces/`
3. Game works immediately with nice pieces

**Later (when APIs work):**
4. Generate custom AI pieces using the commands above
5. Replace the downloaded ones
6. You'll have unique, original pieces

**OR**

**Wait ~30 seconds:**
1. Try Gemini commands above
2. If still blocked, try Option 3 (download free PNGs)

---

## Quick Test - See if Quota Reset:

```bash
cd /Users/alpha/Documents/tor/sera/client_meta/arm_tech/no.limit.bisetka/bisetka/assets/chess/pieces
uv run ~/.openclaw/workspace/skills/nano-banana-pro-1.0.1/scripts/generate_image.py --prompt "Chess piece: White King. Simple test." --filename "test-king.png" --resolution 1K
```

If this works, run all the commands above!

---

## What I Can Do Right Now

I can create:
1. ✅ A batch script to generate all 13 chess images at once
2. ✅ Download links to free high-quality chess piece PNGs
3. ✅ Simple procedural/SVG pieces as placeholders
4. ✅ The checkers pieces commands (same process)

**What do you prefer?**
- Wait & generate custom AI pieces (best quality, takes time)
- Download free PNGs now (instant, still look good)
- Let me create simple placeholders (1 minute, basic but functional)
