/**
 * Card GLB Modifier
 * Applies dynamic textures to a base card GLB model
 */

import * as THREE from 'three';
import { CardData } from '../components/DynamicCard';

/**
 * Load a texture from an asset path (works in both dev and production)
 */
export async function loadTexture(assetPath: string): Promise<THREE.Texture> {
  const textureLoader = new THREE.TextureLoader();
  
  return new Promise<THREE.Texture>((resolve, reject) => {
    textureLoader.load(
      assetPath,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        // Flip texture vertically for proper card orientation
        texture.flipY = true;
        resolve(texture);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Apply textures to a card GLB model
 * @param model - The loaded GLB scene
 * @param frontTexture - Texture for the front of the card
 * @param backTexture - Texture for the back of the card
 * @param faceDown - Whether the card is face down
 */
export function applyCardTextures(
  model: THREE.Scene,
  frontTexture: THREE.Texture,
  backTexture: THREE.Texture,
  faceDown: boolean = false
): void {
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      const material = child.material as THREE.MeshStandardMaterial;
      const matName = material.name.toLowerCase();
      
      // Determine which texture to apply based on material name and faceDown state
      let textureToApply: THREE.Texture | null = null;
      
      if (matName.includes('back')) {
        // Back face material
        textureToApply = faceDown ? backTexture : frontTexture;
      } else if (matName.includes('front') || matName.includes('face')) {
        // Front face material
        textureToApply = faceDown ? backTexture : frontTexture;
      } else {
        // Default: apply front texture
        textureToApply = faceDown ? backTexture : frontTexture;
      }
      
      material.map = textureToApply;
      material.needsUpdate = true;
    }
  });
}

/**
 * Create a card scene with dynamic textures
 * @param cardData - Card information (suit, rank, etc.)
 * @param baseGLBPath - Path to the base card GLB template
 * @param frontTexturePath - Path to the card front texture (from 2D assets)
 * @param backTexturePath - Path to the card back texture
 * @param faceDown - Whether the card should be face down
 */
export async function createCardScene(
  cardData: {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
    value: number;
  },
  baseGLBPath: string,
  frontTexturePath: string,
  backTexturePath: string,
  faceDown: boolean = false
): Promise<THREE.Scene> {
  // Load textures
  const [frontTexture, backTexture] = await Promise.all([
    loadTexture(frontTexturePath),
    loadTexture(backTexturePath),
  ]);

  // Load base GLB
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  
  return new Promise<THREE.Scene>((resolve, reject) => {
    loader.load(
      baseGLBPath,
      (gltf) => {
        const model = gltf.scene;
        
        // Apply textures
        applyCardTextures(model, frontTexture, backTexture, faceDown);
        
        // Scale to match standard playing card size
        // Standard card: 2.5" x 3.5" = 6.35cm x 8.89cm
        // GLB is typically in meters, scale to match
        model.scale.set(0.0635, 0.0889, 1); // width, height, depth scale
        
        resolve(model);
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Get card asset path from DynamicCard format
 */
export function getCardAssetPath(
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades',
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A',
  faceDown: boolean = false
): string {
  if (faceDown) {
    return require('../../assets/cards/default-card-back.png');
  }
  return require(`../../assets/cards/${rank}-${suit}.png`);
}

export default {
  loadTexture,
  applyCardTextures,
  createCardScene,
  getCardAssetPath,
};
