#!/usr/bin/env python3
"""
Generate transparent rank/suit overlays for all 52 cards
These will be composited over custom backgrounds
"""

import os
import sys
import time
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GEN_SCRIPT = "/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"

SUITS = {
    'hearts': ('♥', 'red'),
    'diamonds': ('♦', 'red'),
    'clubs': ('♣', 'black'),
    'spades': ('♠', 'black')
}
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

def generate_overlay(rank, suit, symbol, color):
    """Generate a transparent overlay with just rank and suit symbols"""
    filename = f"{rank}-{suit}.png"
    filepath = SCRIPT_DIR / filename
    
    if filepath.exists():
        print(f"✓ Skipping {filename} (already exists)")
        return True
    
    # Describe the layout based on rank
    if rank == 'A':
        layout = f"single large centered {symbol} symbol"
    elif rank in ['J', 'Q', 'K']:
        layout = f"{rank} in corners, stylized {symbol} symbol in center, face card design"
    elif rank == '2':
        layout = f"two {symbol} symbols vertically centered"
    elif rank == '3':
        layout = f"three {symbol} symbols in vertical line"
    elif rank == '4':
        layout = f"four {symbol} symbols in 2x2 grid"
    elif rank == '5':
        layout = f"five {symbol} symbols, center plus corners"
    elif rank == '6':
        layout = f"six {symbol} symbols in two columns of three"
    elif rank == '7':
        layout = f"seven {symbol} symbols, standard pattern"
    elif rank == '8':
        layout = f"eight {symbol} symbols, standard pattern"
    elif rank == '9':
        layout = f"nine {symbol} symbols, standard pattern"
    elif rank == '10':
        layout = f"ten {symbol} symbols, standard pattern"
    else:
        layout = f"{symbol} symbols in standard playing card pattern"
    
    prompt = (
        f"Playing card rank and suit overlay ONLY, transparent background, "
        f"NO card background, just the symbols and numbers, "
        f"{rank} in top-left and bottom-right corners in {color}, "
        f"{layout} in {color}, "
        f"clean minimalist modern style, "
        f"portrait orientation, "
        f"professional casino quality typography and symbols, "
        f"FULLY TRANSPARENT background, "
        f"crisp vector-style symbols, "
        f"no shadows, no borders, no card frame, "
        f"ONLY rank numbers and suit symbols visible"
    )
    
    print(f"🎴 Generating {filename}...")
    
    try:
        result = subprocess.run(
            [
                'python3', GEN_SCRIPT,
                '--prompt', prompt,
                '--count', '1',
                '--size', '1024x1536',
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
            tmp_dirs = sorted(SCRIPT_DIR.glob('tmp/openai-image-gen-*'))
            if tmp_dirs:
                latest_dir = tmp_dirs[-1]
                gen_files = list(latest_dir.glob('*.png'))
                if gen_files:
                    gen_files[0].rename(filepath)
                    import shutil
                    shutil.rmtree(latest_dir.parent)
                    print(f"✅ Generated {filename}")
                    return True
        
        print(f"❌ Failed to generate {filename}")
        return False
        
    except Exception as e:
        print(f"❌ Error generating {filename}: {e}")
        return False

def main():
    os.chdir(SCRIPT_DIR)
    
    total = len(SUITS) * len(RANKS)
    print(f"🎴 Generating {total} transparent rank/suit overlays...")
    print()
    
    start_time = time.time()
    generated = 0
    skipped = 0
    failed = 0
    
    for suit, (symbol, color) in SUITS.items():
        for rank in RANKS:
            result = generate_overlay(rank, suit, symbol, color)
            
            if result is True:
                if (SCRIPT_DIR / f"{rank}-{suit}.png").exists():
                    if (SCRIPT_DIR / f"{rank}-{suit}.png").stat().st_mtime > start_time:
                        generated += 1
                    else:
                        skipped += 1
            else:
                failed += 1
            
            done = generated + skipped + failed
            print(f"Progress: {done}/{total} ({generated} new, {skipped} skipped, {failed} failed)")
            print()
            
            time.sleep(1.5)
    
    elapsed = time.time() - start_time
    print()
    print("=" * 60)
    print("🎉 Overlay generation complete!")
    print(f"✅ Generated: {generated}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Time: {elapsed/60:.1f} minutes")
    print("=" * 60)

if __name__ == '__main__':
    main()
