#!/usr/bin/env python3
"""Generate all 52 playing cards with modern design"""

import os
import sys
import time
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GEN_SCRIPT = "/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"

# Card data
SUITS = {
    'hearts': ('♥', 'red'),
    'diamonds': ('♦', 'red'),
    'clubs': ('♣', 'black'),
    'spades': ('♠', 'black')
}
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

def generate_card(rank, suit, symbol, color):
    """Generate a single card image"""
    filename = f"{rank}-{suit}.png"
    filepath = SCRIPT_DIR / filename
    
    if filepath.exists():
        print(f"✓ Skipping {filename} (already exists)")
        return True
    
    # Create prompt - request transparent background and card-sized output
    prompt = (
        f"A single playing card, portrait orientation, modern minimalist design, "
        f"white card with rounded corners, {rank} in top-left and bottom-right corners in {color}, "
        f"large centered {symbol} symbol in {color}, elegant sans-serif font, "
        f"premium casino quality, clean flat design, soft subtle shadows on card edges, "
        f"NO background, transparent background, card floating on transparent, "
        f"professional vector-style illustration, crisp edges"
    )
    
    print(f"🎴 Generating {filename}...")
    
    # Run generation script
    try:
        result = subprocess.run(
            [
                'python3', GEN_SCRIPT,
                '--prompt', prompt,
                '--count', '1',
                '--size', '1024x1536',  # Portrait aspect for cards
                '--quality', 'high',
                '--model', 'gpt-image-1',
                '--background', 'transparent',
                '--output-format', 'png'
            ],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Find generated file and rename
            tmp_dirs = sorted(SCRIPT_DIR.glob('tmp/openai-image-gen-*'))
            if tmp_dirs:
                latest_dir = tmp_dirs[-1]
                gen_files = list(latest_dir.glob('*.png'))
                if gen_files:
                    gen_files[0].rename(filepath)
                    # Clean up temp dir
                    import shutil
                    shutil.rmtree(latest_dir.parent)
                    print(f"✅ Generated {filename}")
                    return True
        
        print(f"❌ Failed to generate {filename}: {result.stderr}")
        return False
        
    except Exception as e:
        print(f"❌ Error generating {filename}: {e}")
        return False

def main():
    os.chdir(SCRIPT_DIR)
    
    total = len(SUITS) * len(RANKS)
    generated = 0
    skipped = 0
    failed = 0
    
    print(f"🎴 Generating {total} playing cards...")
    print(f"📁 Output directory: {SCRIPT_DIR}")
    print()
    
    start_time = time.time()
    
    for suit, (symbol, color) in SUITS.items():
        for rank in RANKS:
            result = generate_card(rank, suit, symbol, color)
            
            if result is True:
                if (SCRIPT_DIR / f"{rank}-{suit}.png").stat().st_mtime > start_time:
                    generated += 1
                else:
                    skipped += 1
            else:
                failed += 1
            
            # Progress
            done = generated + skipped + failed
            print(f"Progress: {done}/{total} ({generated} new, {skipped} skipped, {failed} failed)")
            print()
            
            # Small delay to avoid rate limits
            time.sleep(1)
    
    elapsed = time.time() - start_time
    print()
    print("=" * 50)
    print(f"🎉 Card generation complete!")
    print(f"✅ Generated: {generated}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Time: {elapsed:.1f}s")
    print("=" * 50)

if __name__ == '__main__':
    main()
