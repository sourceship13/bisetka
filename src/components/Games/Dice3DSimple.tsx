import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DICE_SIZE = SCREEN_WIDTH / 7;

interface Dice3DSimpleProps {
  value: number; // 1-6
  isRolling: boolean;
  index: number; // 0-4 for positioning
  onRollComplete?: () => void;
}

// Dice dot patterns for each face
const DOT_PATTERNS: { [key: number]: number[][] } = {
  1: [[50, 50]], // center
  2: [[25, 25], [75, 75]], // diagonal
  3: [[25, 25], [50, 50], [75, 75]], // diagonal + center
  4: [[25, 25], [75, 25], [25, 75], [75, 75]], // corners
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], // corners + center
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]], // 2 columns
};

const Dice3DSimple: React.FC<Dice3DSimpleProps> = ({ value, isRolling, index, onRollComplete }) => {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const rotateZ = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // Map dice value to rotation angles (degrees)
  const getRotationForValue = (val: number): { x: number; y: number; z: number } => {
    const rotations = {
      1: { x: 0, y: 0, z: 0 },          // top face
      6: { x: 180, y: 0, z: 0 },        // bottom face
      2: { x: -90, y: 0, z: 0 },        // front face
      5: { x: 90, y: 0, z: 0 },         // back face
      3: { x: 0, y: -90, z: 0 },        // left face
      4: { x: 0, y: 90, z: 0 },         // right face
    };
    return rotations[val] || { x: 0, y: 0, z: 0 };
  };

  useEffect(() => {
    if (isRolling) {
      // Rolling animation: chaotic tumbling
      const duration = 1800 + index * 100; // slightly staggered timing
      const bounces = 5 + Math.floor(Math.random() * 3);
      
      // Random starting rotations for variety
      const startRotX = Math.random() * 360;
      const startRotY = Math.random() * 360;
      const startRotZ = Math.random() * 360;

      Animated.parallel([
        // Tumbling rotation
        Animated.sequence([
          Animated.timing(rotateX, {
            toValue: startRotX + 360 * bounces,
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotateY, {
            toValue: startRotY + 360 * (bounces - 1),
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotateZ, {
            toValue: startRotZ + 360 * (bounces + 1),
            duration: duration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        
        // Bounce physics
        Animated.sequence([
          // Throw upward
          Animated.timing(translateY, {
            toValue: -80 - Math.random() * 40,
            duration: duration * 0.3,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // Bounce down multiple times
          ...Array.from({ length: bounces }).flatMap((_, i) => [
            Animated.timing(translateY, {
              toValue: 0,
              duration: (duration * 0.7) / bounces,
              easing: Easing.bounce,
              useNativeDriver: true,
            }),
          ]),
        ]),

        // Horizontal movement (slight drift)
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: (Math.random() - 0.5) * 40,
            duration: duration * 0.6,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: duration * 0.4,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),

        // Subtle scale pulse
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.1,
            duration: duration * 0.15,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: duration * 0.85,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Settle to final value
        const finalRot = getRotationForValue(value);
        Animated.parallel([
          Animated.spring(rotateX, {
            toValue: finalRot.x,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(rotateY, {
            toValue: finalRot.y,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(rotateZ, {
            toValue: finalRot.z,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (index === 4 && onRollComplete) {
            // Last dice finished
            onRollComplete();
          }
        });
      });
    } else {
      // Not rolling - show stable value
      const finalRot = getRotationForValue(value);
      rotateX.setValue(finalRot.x);
      rotateY.setValue(finalRot.y);
      rotateZ.setValue(finalRot.z);
      translateY.setValue(0);
      translateX.setValue(0);
      scale.setValue(1);
    }
  }, [isRolling, value]);

  const rotateXInterp = rotateX.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const rotateYInterp = rotateY.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const rotateZInterp = rotateZ.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  // Render a 3D cube with dots on each face
  const renderFace = (faceValue: number, faceStyle: any) => {
    const dots = DOT_PATTERNS[faceValue] || [];
    return (
      <Animated.View style={[styles.face, faceStyle]}>
        {dots.map((pos, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: `${pos[0]}%`,
                top: `${pos[1]}%`,
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX },
            { translateY },
            { perspective: 1000 },
            { rotateX: rotateXInterp },
            { rotateY: rotateYInterp },
            { rotateZ: rotateZInterp },
            { scale },
          ],
        },
      ]}
    >
      {/* Front face (2) */}
      {renderFace(2, [styles.faceFront])}
      
      {/* Back face (5) */}
      {renderFace(5, [styles.faceBack])}
      
      {/* Top face (1) */}
      {renderFace(1, [styles.faceTop])}
      
      {/* Bottom face (6) */}
      {renderFace(6, [styles.faceBottom])}
      
      {/* Left face (3) */}
      {renderFace(3, [styles.faceLeft])}
      
      {/* Right face (4) */}
      {renderFace(4, [styles.faceRight])}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: DICE_SIZE,
    height: DICE_SIZE,
    position: 'relative',
  },
  face: {
    position: 'absolute',
    width: DICE_SIZE,
    height: DICE_SIZE,
    backgroundColor: '#FFFACD',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    backfaceVisibility: 'hidden',
  },
  faceFront: {
    transform: [{ translateZ: DICE_SIZE / 2 }],
  },
  faceBack: {
    transform: [{ rotateY: '180deg' }, { translateZ: DICE_SIZE / 2 }],
  },
  faceTop: {
    transform: [{ rotateX: '90deg' }, { translateZ: DICE_SIZE / 2 }],
  },
  faceBottom: {
    transform: [{ rotateX: '-90deg' }, { translateZ: DICE_SIZE / 2 }],
  },
  faceLeft: {
    transform: [{ rotateY: '-90deg' }, { translateZ: DICE_SIZE / 2 }],
  },
  faceRight: {
    transform: [{ rotateY: '90deg' }, { translateZ: DICE_SIZE / 2 }],
  },
  dot: {
    position: 'absolute',
    width: DICE_SIZE * 0.15,
    height: DICE_SIZE * 0.15,
    borderRadius: DICE_SIZE * 0.075,
    backgroundColor: '#000',
    marginLeft: -DICE_SIZE * 0.075,
    marginTop: -DICE_SIZE * 0.075,
  },
});

export default Dice3DSimple;
