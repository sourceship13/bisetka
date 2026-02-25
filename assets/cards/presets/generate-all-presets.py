#!/usr/bin/env python3
"""Generate all preset card backs"""

import os
import subprocess
from pathlib import Path
import time

SCRIPT_DIR = Path(__file__).parent
GEN_SCRIPT = "/Users/alpha/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/openai-image-gen/scripts/gen.py"

CARD_BACKS = {
    'back-geometric': 'Modern abstract geometric shapes, colorful triangles and circles, contemporary design, symmetrical pattern, playing card back, portrait orientation',
    'back-floral': 'Elegant botanical floral design, ornate flowers and vines, Victorian style, symmetrical pattern, playing card back, portrait orientation',
    'back-tech': 'Circuit board pattern, technology theme, blue and green lines, microchip design, futuristic, playing card back, portrait orientation',
    'back-vintage': 'Aged vintage ornate pattern, sepia tones, classic decorative borders, antique playing card back, portrait orientation',
    'back-minimalist': 'Simple elegant minimalist design, clean lines, monochrome, modern luxury, subtle pattern, playing card back, portrait orientation',
}

THEME_BACKS = {
    'modern-back': 'Modern minimalist card back, clean geometric pattern, blue gradient, contemporary style, professional, portrait orientation',
    'retro-back': 'Retro 8-bit pixel art card back, vibrant neon colors magenta and cyan, arcade style, geometric pixel pattern, nostalgic 1980s, portrait orientation',
}

def generate_image(filename, prompt):
    """Generate a single image"""
    filepath = SCRIPT_DIR / f"{filename}.png"
    
    if filepath.exists():
        print(f"✓ Skipping {filename} (exists)")
        return True
    
    print(f"🎨 Generating {filename}...")
    
    try:
        result = subprocess.run(
            [
                'python3', GEN_SCRIPT,
                '--prompt', prompt,
                '--count', '1',
                '--size', '1024x1536',
                '--quality', 'high',
                '--model', 'gpt-image-1',
                '--output-format', 'png'
            ],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Move generated file
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
        
        print(f"❌ Failed {filename}")
        return False
        
    except Exception as e:
        print(f"❌ Error {filename}: {e}")
        return False

def main():
    os.chdir(SCRIPT_DIR)
    
    print("🎴 Generating preset card backs...")
    print()
    
    total = len(CARD_BACKS) + len(THEME_BACKS)
    done = 0
    
    # Generate regular card backs
    for name, prompt in CARD_BACKS.items():
        generate_image(name, prompt)
        done += 1
        print(f"Progress: {done}/{total}")
        print()
        time.sleep(1)
    
    # Generate theme backs
    for name, prompt in THEME_BACKS.items():
        generate_image(name, prompt)
        done += 1
        print(f"Progress: {done}/{total}")
        print()
        time.sleep(1)
    
    print("🎉 All presets generated!")

if __name__ == '__main__':
    main()
