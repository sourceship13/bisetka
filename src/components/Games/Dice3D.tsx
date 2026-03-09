import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { Renderer, THREE } from 'expo-three';
import * as CANNON from 'cannon-es';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Dice3DProps {
  finalValues: number[];  // Array of 5 numbers (1-6) for final dice values
  onRollComplete: () => void;
  isRolling: boolean;
}

const Dice3D: React.FC<Dice3DProps> = ({ finalValues, onRollComplete, isRolling }) => {
  const [ready, setReady] = useState(false);
  const animationFrameId = useRef<number>();
  
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<Renderer>();
  const worldRef = useRef<CANNON.World>();
  const diceBodiesRef = useRef<CANNON.Body[]>([]);
  const diceMeshesRef = useRef<THREE.Mesh[]>([]);
  const rollStartTimeRef = useRef<number>(0);
  const rollDurationRef = useRef<number>(3000); // 3 seconds roll time

  // Create dice geometry with textures for each face
  const createDiceMesh = () => {
    const diceSize = 1;
    const geometry = new THREE.BoxGeometry(diceSize, diceSize, diceSize);
    
    // Create canvas textures for each face (1-6 dots)
    const createDotTexture = (dots: number): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Background (ivory/white)
      ctx.fillStyle = '#FFFACD';
      ctx.fillRect(0, 0, 256, 256);
      
      // Border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 256, 256);
      
      // Draw dots (black circles)
      ctx.fillStyle = '#000';
      const dotRadius = 20;
      const positions: { [key: number]: number[][] } = {
        1: [[128, 128]], // center
        2: [[64, 64], [192, 192]], // diagonal
        3: [[64, 64], [128, 128], [192, 192]], // diagonal + center
        4: [[64, 64], [192, 64], [64, 192], [192, 192]], // corners
        5: [[64, 64], [192, 64], [128, 128], [64, 192], [192, 192]], // corners + center
        6: [[64, 64], [192, 64], [64, 128], [192, 128], [64, 192], [192, 192]], // 2 columns
      };
      
      positions[dots]?.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    // Create materials for each face
    const materials = [
      new THREE.MeshPhongMaterial({ map: createDotTexture(4) }), // right
      new THREE.MeshPhongMaterial({ map: createDotTexture(3) }), // left
      new THREE.MeshPhongMaterial({ map: createDotTexture(1) }), // top
      new THREE.MeshPhongMaterial({ map: createDotTexture(6) }), // bottom
      new THREE.MeshPhongMaterial({ map: createDotTexture(2) }), // front
      new THREE.MeshPhongMaterial({ map: createDotTexture(5) }), // back
    ];

    return new THREE.Mesh(geometry, materials);
  };

  // Create physics body for dice
  const createDiceBody = (position: CANNON.Vec3): CANNON.Body => {
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({
      mass: 1,
      shape: shape,
      position: position,
      angularDamping: 0.3,
      linearDamping: 0.3,
    });
    
    // Random initial rotation
    body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    
    return body;
  };

  // Apply force to make dice roll toward final value
  const rollDiceToValue = (body: CANNON.Body, targetValue: number, index: number) => {
    // Random initial throw
    const throwForce = 15 + Math.random() * 10;
    const angleSpread = Math.PI / 6; // 30 degree spread
    const baseAngle = -Math.PI / 2 + (index - 2) * angleSpread / 4;
    
    body.velocity.set(
      Math.cos(baseAngle) * throwForce,
      15 + Math.random() * 10, // upward force
      Math.sin(baseAngle) * throwForce
    );
    
    // Random spin
    body.angularVelocity.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );
  };

  // Get rotation to show specific face on top
  const getRotationForValue = (value: number): CANNON.Quaternion => {
    const rotations: { [key: number]: [number, number, number] } = {
      1: [0, 0, 0],           // top face
      6: [Math.PI, 0, 0],     // bottom face (flip)
      2: [0, 0, -Math.PI/2],  // front face
      5: [0, 0, Math.PI/2],   // back face
      3: [0, -Math.PI/2, 0],  // left face
      4: [0, Math.PI/2, 0],   // right face
    };
    
    const [x, y, z] = rotations[value] || [0, 0, 0];
    const quat = new CANNON.Quaternion();
    quat.setFromEuler(x, y, z);
    return quat;
  };

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    // Initialize Three.js renderer
    const renderer = new Renderer({ gl });
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT * 0.4);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      50,
      SCREEN_WIDTH / (SCREEN_HEIGHT * 0.4),
      0.1,
      1000
    );
    camera.position.set(0, 12, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Create physics world
    const world = new CANNON.World();
    world.gravity.set(0, -30, 0);
    world.defaultContactMaterial.restitution = 0.4; // bounciness
    worldRef.current = world;

    // Create floor
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshPhongMaterial({ color: 0x0f3460, side: THREE.DoubleSide })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    scene.add(floorMesh);

    // Create walls (invisible collision boxes)
    const wallThickness = 1;
    const wallHeight = 10;
    const tableSize = 15;
    
    const walls = [
      { pos: [0, wallHeight/2, -tableSize/2], size: [tableSize, wallHeight, wallThickness] }, // back
      { pos: [0, wallHeight/2, tableSize/2], size: [tableSize, wallHeight, wallThickness] },  // front
      { pos: [-tableSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, tableSize] }, // left
      { pos: [tableSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, tableSize] },  // right
    ];
    
    walls.forEach(({ pos, size }) => {
      const wallBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(size[0]/2, size[1]/2, size[2]/2)),
        position: new CANNON.Vec3(pos[0], pos[1], pos[2]),
      });
      world.addBody(wallBody);
    });

    // Create 5 dice
    for (let i = 0; i < 5; i++) {
      const diceMesh = createDiceMesh();
      const xPos = (i - 2) * 2.5; // spread dice horizontally
      diceMesh.position.set(xPos, 15, 0);
      scene.add(diceMesh);
      diceMeshesRef.current.push(diceMesh);

      const diceBody = createDiceBody(new CANNON.Vec3(xPos, 15, 0));
      world.addBody(diceBody);
      diceBodiesRef.current.push(diceBody);
    }

    setReady(true);

    // Animation loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);

      if (!worldRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) {
        return;
      }

      const now = Date.now();
      const elapsed = now - rollStartTimeRef.current;

      // Step physics
      worldRef.current.step(1 / 60);

      // Update dice meshes from physics bodies
      diceBodiesRef.current.forEach((body, index) => {
        const mesh = diceMeshesRef.current[index];
        if (mesh) {
          mesh.position.copy(body.position as any);
          mesh.quaternion.copy(body.quaternion as any);
        }

        // After roll duration, gradually settle to final values
        if (elapsed > rollDurationRef.current && elapsed < rollDurationRef.current + 1000) {
          const settleProgress = (elapsed - rollDurationRef.current) / 1000;
          const targetQuat = getRotationForValue(finalValues[index]);
          
          // Smoothly interpolate to target rotation
          body.quaternion.slerp(targetQuat, settleProgress * 0.1, body.quaternion);
          
          // Dampen velocities
          body.velocity.scale(0.95, body.velocity);
          body.angularVelocity.scale(0.9, body.angularVelocity);
          
          // Move toward rest position
          const targetY = 0.5; // just above floor
          body.position.y += (targetY - body.position.y) * settleProgress * 0.1;
        }

        // Stop completely after settle period
        if (elapsed > rollDurationRef.current + 1000) {
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.position.y = 0.5;
          body.quaternion.copy(getRotationForValue(finalValues[index]));
        }
      });

      // Complete roll after everything settled
      if (elapsed > rollDurationRef.current + 1500 && elapsed < rollDurationRef.current + 1600) {
        onRollComplete();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
    };

    animate();
  };

  // Trigger roll when isRolling changes to true
  useEffect(() => {
    if (isRolling && ready && diceBodiesRef.current.length > 0) {
      rollStartTimeRef.current = Date.now();
      
      // Reset dice positions and throw them
      diceBodiesRef.current.forEach((body, index) => {
        const xPos = (index - 2) * 2.5;
        body.position.set(xPos, 15, 0);
        rollDiceToValue(body, finalValues[index], index);
      });
    }
  }, [isRolling, ready, finalValues]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      diceMeshesRef.current = [];
      diceBodiesRef.current = [];
    };
  }, []);

  return (
    <View style={styles.container}>
      <GLView
        style={styles.glView}
        onContextCreate={onContextCreate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.4,
    backgroundColor: '#1a1a2e',
  },
  glView: {
    flex: 1,
  },
});

export default Dice3D;
