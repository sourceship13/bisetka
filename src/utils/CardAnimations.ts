/**
 * Card Shuffling Animation Utilities
 * Provides smooth card movement animations for shuffling and dealing
 */

import * as THREE from 'three';

export interface CardState {
  key: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  faceDown: boolean;
}

export interface AnimationConfig {
  duration: number; // milliseconds
  ease?: (t: number) => number; // easing function
}

export interface CardShuffleParams {
  cards: CardState[];
  targetPositions: THREE.Vector3[];
  onComplete?: () => void;
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Ease out cubic
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease in out cubic
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Interpolate between two positions
 */
export function interpolatePosition(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number
): THREE.Vector3 {
  return new THREE.Vector3(
    lerp(start.x, end.x, t),
    lerp(start.y, end.y, t),
    lerp(start.z, end.z, t)
  );
}

/**
 * Interpolate between two rotations
 */
export function interpolateRotation(
  start: THREE.Euler,
  end: THREE.Euler,
  t: number
): THREE.Euler {
  return new THREE.Euler(
    lerp(start.x, end.x, t),
    lerp(start.y, end.y, t),
    lerp(start.z, end.z, t),
    start.order
  );
}

/**
 * Create a card movement animation
 * @param card - The card to animate
 * @param targetPosition - Where the card should move to
 * @param config - Animation configuration
 * @returns Animation function that returns progress (0-1)
 */
export function createCardAnimation(
  card: THREE.Mesh,
  targetPosition: THREE.Vector3,
  config: AnimationConfig = { duration: 300, ease: easeOutCubic }
): (time: number) => boolean {
  const startPos = card.position.clone();
  const startRot = card.rotation.clone();
  
  let startTime: number | null = null;
  
  return (time: number) => {
    if (startTime === null) {
      startTime = time;
    }
    
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / config.duration, 1);
    const easedProgress = config.ease(progress);
    
    // Interpolate position
    card.position.copy(interpolatePosition(startPos, targetPosition, easedProgress));
    
    // Interpolate rotation (optional, keep current rotation for now)
    // card.rotation.copy(interpolateRotation(startRot, targetRotation, easedProgress));
    
    return progress >= 1;
  };
}

/**
 * Shuffle cards in a fan pattern
 * @param cards - Array of card meshes
 * @param center - Center position of the fan
 * @param spread - How wide the fan should be (in degrees)
 * @param duration - Animation duration in ms
 */
export function shuffleCardsFan(
  cards: THREE.Mesh[],
  center: THREE.Vector3,
  spread: number = 60,
  duration: number = 500
): void {
  const totalCards = cards.length;
  const angleStep = spread / (totalCards - 1);
  
  cards.forEach((card, i) => {
    const angle = -spread / 2 + i * angleStep;
    const radius = 0.15; // distance from center
    
    const targetX = center.x + Math.sin(angle * (Math.PI / 180)) * radius;
    const targetY = center.y;
    const targetZ = center.z + Math.cos(angle * (Math.PI / 180)) * radius;
    
    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
    
    // Add slight rotation for fan effect
    card.rotation.y = -angle * (Math.PI / 180);
    
    // Animate to position
    const startPos = card.position.clone();
    let startTime: number | null = null;
    
    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      
      card.position.copy(interpolatePosition(startPos, targetPos, eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  });
}

/**
 * Deal cards from a stack to target positions
 * @param cards - Cards to deal (in stack order)
 * @param targetPositions - Where each card should go
 * @param duration - Total animation duration
 */
export function dealCards(
  cards: THREE.Mesh[],
  targetPositions: THREE.Vector3[],
  duration: number = 300
): Promise<void> {
  return new Promise((resolve) => {
    const totalCards = cards.length;
    const staggerDelay = duration / totalCards / 2;
    
    cards.forEach((card, i) => {
      const startPos = card.position.clone();
      const targetPos = targetPositions[i] || targetPositions[targetPositions.length - 1];
      
      let startTime: number | null = null;
      const cardDuration = duration + i * staggerDelay;
      
      const animate = (time: number) => {
        if (startTime === null) startTime = time;
        
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / cardDuration, 1);
        const eased = easeOutCubic(progress);
        
        card.position.copy(interpolatePosition(startPos, targetPos, eased));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (i === totalCards - 1) {
          // All cards finished
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  });
}

/**
 * Fan out cards in a semi-circle
 * @param cards - Cards to fan
 * @param center - Center of the fan
 * @param radius - Radius of the fan
 * @param angle - Total angle of the fan in degrees
 */
export function fanOutCards(
  cards: THREE.Mesh[],
  center: THREE.Vector3,
  radius: number = 0.2,
  angle: number = 90
): void {
  const totalCards = cards.length;
  const angleStep = angle / (totalCards - 1);
  
  cards.forEach((card, i) => {
    const cardAngle = -angle / 2 + i * angleStep;
    
    const x = center.x + Math.sin(cardAngle * (Math.PI / 180)) * radius;
    const z = center.z + Math.cos(cardAngle * (Math.PI / 180)) * radius;
    
    card.position.set(x, center.y, z);
    card.rotation.y = -cardAngle * (Math.PI / 180);
  });
}

export default {
  lerp,
  easeOutCubic,
  easeInOutCubic,
  interpolatePosition,
  interpolateRotation,
  createCardAnimation,
  shuffleCardsFan,
  dealCards,
  fanOutCards,
};
