#!/usr/bin/env python3
"""Standardize all card images to exact same size with uniform padding"""

from PIL import Image
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# Target dimensions for all cards
TARGET_WIDTH = 700
TARGET_HEIGHT = 1000
PADDING = 20  # Pixels of padding around the card content

def trim_transparent_borders(img):
    """Crop image to remove transparent borders"""
    # Get bounding box of non-transparent content
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def standardize_card(filepath):
    """Process a single card to standard size"""
    print(f"Processing {filepath.name}...")
    
    try:
        # Load image
        img = Image.open(filepath)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Trim transparent borders
        img = trim_transparent_borders(img)
        
        # Calculate new size maintaining aspect ratio
        # Target content area (with padding subtracted)
        content_width = TARGET_WIDTH - (2 * PADDING)
        content_height = TARGET_HEIGHT - (2 * PADDING)
        
        # Scale to fit within content area
        img.thumbnail((content_width, content_height), Image.Resampling.LANCZOS)
        
        # Create new image with target size and transparent background
        new_img = Image.new('RGBA', (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
        
        # Calculate centering position
        x = (TARGET_WIDTH - img.width) // 2
        y = (TARGET_HEIGHT - img.height) // 2
        
        # Paste card onto centered position
        new_img.paste(img, (x, y), img)
        
        # Save standardized image
        new_img.save(filepath, 'PNG', optimize=True)
        print(f"✅ Standardized {filepath.name} to {TARGET_WIDTH}x{TARGET_HEIGHT}")
        
    except Exception as e:
        print(f"❌ Error processing {filepath.name}: {e}")

def main():
    os.chdir(SCRIPT_DIR)
    
    # Get all PNG files
    cards = sorted(SCRIPT_DIR.glob('*.png'))
    
    if not cards:
        print("No card images found!")
        return
    
    print(f"🎴 Standardizing {len(cards)} cards to {TARGET_WIDTH}x{TARGET_HEIGHT}...")
    print()
    
    for card_path in cards:
        standardize_card(card_path)
        print()
    
    print("=" * 50)
    print("🎉 All cards standardized!")
    print(f"📐 Uniform size: {TARGET_WIDTH}x{TARGET_HEIGHT}")
    print(f"📦 Padding: {PADDING}px")
    print("=" * 50)

if __name__ == '__main__':
    main()
