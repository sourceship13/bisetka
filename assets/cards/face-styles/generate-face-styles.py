#!/usr/bin/env python3
"""Generate face cards (J, Q, K) for all 5 design styles"""

import os
import sys
import time
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GEN_SCRIPT = "/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"

# Face ranks
RANKS = ['J', 'Q', 'K']
SUITS = {
    'hearts': ('♥', 'red'),
    'diamonds': ('♦', 'red'),
    'clubs': ('♣', 'black'),
    'spades': ('♠', 'black')
}

# Style definitions
STYLES = {
    'modern': {
        'description': 'modern minimalist design, clean geometric shapes, bold colors, sans-serif typography, flat design',
        'vibe': 'contemporary, sleek, professional'
    },
    'vintage': {
        'description': 'vintage ornate patterns, aged textured look, sepia tones, decorative borders, classic playing card style',
        'vibe': 'antique, elegant, timeless'
    },
    'retro': {
        'description': '1980s retro aesthetic, neon colors, geometric patterns, bold outlines, vibrant gradients',
        'vibe': 'nostalgic, energetic, fun'
    },
    'cyberpunk': {
        'description': 'futuristic cyberpunk theme, neon cyan and magenta accents, digital glitch effects, circuit patterns, tech aesthetic',
        'vibe': 'sci-fi, high-tech, dystopian'
    },
    'minimal': {
        'description': 'ultra-minimal design, maximum negative space, subtle monochrome colors, refined elegance, simple lines',
        'vibe': 'zen, clean, sophisticated'
    }
}

def create_style_directory(style):
    """Create directory for style if it doesn't exist"""
    style_dir = SCRIPT_DIR / style
    style_dir.mkdir(exist_ok=True)
    return style_dir

def generate_face_card(rank, suit, symbol, color, style, style_def):
    """Generate a single face card"""
    style_dir = create_style_directory(style)
    filename = f"{rank}-{suit}.png"
    filepath = style_dir / filename
    
    if filepath.exists():
        print(f"✓ Skipping {style}/{filename} (already exists)")
        return True
    
    # Create character prompt based on rank
    character_map = {
        'J': 'Jack (young knight)',
        'Q': 'Queen (regal figure)',
        'K': 'King (royal figure)'
    }
    character = character_map[rank]
    
    # Create prompt
    prompt = (
        f"Playing card face card design for {character}, {symbol} {suit} suit, "
        f"{rank} displayed in corners in {color}, "
        f"{style_def['description']}, "
        f"{style_def['vibe']} aesthetic, "
        f"portrait orientation, white card background with rounded corners, "
        f"professional casino quality, centered character illustration, "
        f"transparent background, crisp clean edges, high detail"
    )
    
    print(f"🎴 Generating {style}/{filename}...")
    print(f"   {character} of {suit}")
    
    # Run generation
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
            # Find and rename generated file
            tmp_dirs = sorted(SCRIPT_DIR.glob('tmp/openai-image-gen-*'))
            if tmp_dirs:
                latest_dir = tmp_dirs[-1]
                gen_files = list(latest_dir.glob('*.png'))
                if gen_files:
                    gen_files[0].rename(filepath)
                    import shutil
                    shutil.rmtree(latest_dir.parent)
                    print(f"✅ Generated {style}/{filename}")
                    return True
        
        print(f"❌ Failed to generate {style}/{filename}")
        return False
        
    except Exception as e:
        print(f"❌ Error generating {style}/{filename}: {e}")
        return False

def main():
    os.chdir(SCRIPT_DIR)
    
    total_cards = len(STYLES) * len(RANKS) * len(SUITS)
    print(f"🎴 Generating {total_cards} face cards across {len(STYLES)} styles...")
    print()
    
    start_time = time.time()
    generated = 0
    skipped = 0
    failed = 0
    
    for style, style_def in STYLES.items():
        print(f"\n{'='*60}")
        print(f"🎨 Style: {style.upper()}")
        print(f"{'='*60}\n")
        
        for suit, (symbol, color) in SUITS.items():
            for rank in RANKS:
                result = generate_face_card(rank, suit, symbol, color, style, style_def)
                
                if result is True:
                    if (SCRIPT_DIR / style / f"{rank}-{suit}.png").stat().st_mtime > start_time:
                        generated += 1
                    else:
                        skipped += 1
                else:
                    failed += 1
                
                done = generated + skipped + failed
                print(f"Progress: {done}/{total_cards} ({generated} new, {skipped} skipped, {failed} failed)")
                print()
                
                # Delay to avoid rate limits
                time.sleep(2)
    
    elapsed = time.time() - start_time
    print()
    print("=" * 60)
    print("🎉 Face card generation complete!")
    print(f"✅ Generated: {generated}")
    print(f"⏭️  Skipped: {skipped}")
    print(f"❌ Failed: {failed}")
    print(f"⏱️  Time: {elapsed/60:.1f} minutes")
    print("=" * 60)

if __name__ == '__main__':
    main()
