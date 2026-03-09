import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { Renderer, THREE } from 'expo-three';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Vec3 { x: number; y: number; z: number; }
interface PhysicsBody {
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3;
  angularVelocity: Vec3;
}

interface Dice3DRealProps {
  finalValues: number[];  // Array of 5 numbers (1-6)
  onRollComplete: () => void;
  isRolling: boolean;
}

// Simple physics simulation
class DicePhysics {
  bodies: PhysicsBody[] = [];
  gravity = -30;
  bounce = 0.4;
  friction = 0.98;
  floorY = 0.5;
  wallLeft = -7;
  wallRight = 7;
  wallFront = 5;
  wallBack = -5;

  createDice(count: number) {
    this.bodies = [];
    for (let i = 0; i < count; i++) {
      const xPos = (i - 2) * 2;
      this.bodies.push({
        position: { x: xPos, y: 15, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        rotation: { 
          x: Math.random() * Math.PI * 2, 
          y: Math.random() * Math.PI * 2, 
          z: Math.random() * Math.PI * 2 
        },
        angularVelocity: { x: 0, y: 0, z: 0 },
      });
    }
  }

  throwDice(index: number) {
    const body = this.bodies[index];
    const spread = Math.PI / 8;
    const baseAngle = -Math.PI / 2 + (index - 2) * spread / 4;
    
    body.velocity.x = Math.cos(baseAngle) * (12 + Math.random() * 8);
    body.velocity.y = 15 + Math.random() * 10;
    body.velocity.z = Math.sin(baseAngle) * (12 + Math.random() * 8);
    
    body.angularVelocity.x = (Math.random() - 0.5) * 25;
    body.angularVelocity.y = (Math.random() - 0.5) * 25;
    body.angularVelocity.z = (Math.random() - 0.5) * 25;
  }

  step(deltaTime: number) {
    this.bodies.forEach(body => {
      // Apply gravity
      body.velocity.y += this.gravity * deltaTime;
      
      // Update position
      body.position.x += body.velocity.x * deltaTime;
      body.position.y += body.velocity.y * deltaTime;
      body.position.z += body.velocity.z * deltaTime;
      
      // Update rotation
      body.rotation.x += body.angularVelocity.x * deltaTime;
      body.rotation.y += body.angularVelocity.y * deltaTime;
      body.rotation.z += body.angularVelocity.z * deltaTime;
      
      // Floor collision
      if (body.position.y < this.floorY) {
        body.position.y = this.floorY;
        body.velocity.y = -body.velocity.y * this.bounce;
        body.angularVelocity.x *= 0.8;
        body.angularVelocity.y *= 0.8;
        body.angularVelocity.z *= 0.8;
      }
      
      // Wall collisions
      if (body.position.x < this.wallLeft) {
        body.position.x = this.wallLeft;
        body.velocity.x = -body.velocity.x * this.bounce;
      }
      if (body.position.x > this.wallRight) {
        body.position.x = this.wallRight;
        body.velocity.x = -body.velocity.x * this.bounce;
      }
      if (body.position.z < this.wallBack) {
        body.position.z = this.wallBack;
        body.velocity.z = -body.velocity.z * this.bounce;
      }
      if (body.position.z > this.wallFront) {
        body.position.z = this.wallFront;
        body.velocity.z = -body.velocity.z * this.bounce;
      }
      
      // Apply friction
      body.velocity.x *= this.friction;
      body.velocity.z *= this.friction;
      body.angularVelocity.x *= 0.98;
      body.angularVelocity.y *= 0.98;
      body.angularVelocity.z *= 0.98;
    });
  }

  settleToValue(index: number, targetValue: number, progress: number) {
    const body = this.bodies[index];
    const targetRot = this.getRotationForValue(targetValue);
    
    // Smoothly interpolate rotation
    body.rotation.x += (targetRot.x - body.rotation.x) * progress * 0.15;
    body.rotation.y += (targetRot.y - body.rotation.y) * progress * 0.15;
    body.rotation.z += (targetRot.z - body.rotation.z) * progress * 0.15;
    
    // Move to rest position
    const targetY = 0.5;
    body.position.y += (targetY - body.position.y) * progress * 0.1;
    
    // Dampen velocities
    body.velocity.x *= 0.9;
    body.velocity.y *= 0.9;
    body.velocity.z *= 0.9;
    body.angularVelocity.x *= 0.85;
    body.angularVelocity.y *= 0.85;
    body.angularVelocity.z *= 0.85;
  }

  stopAll() {
    this.bodies.forEach(body => {
      body.velocity = { x: 0, y: 0, z: 0 };
      body.angularVelocity = { x: 0, y: 0, z: 0 };
      body.position.y = 0.5;
    });
  }

  getRotationForValue(value: number): Vec3 {
    const rotations: { [key: number]: Vec3 } = {
      1: { x: 0, y: 0, z: 0 },
      6: { x: Math.PI, y: 0, z: 0 },
      2: { x: -Math.PI/2, y: 0, z: 0 },
      5: { x: Math.PI/2, y: 0, z: 0 },
      3: { x: 0, y: -Math.PI/2, z: 0 },
      4: { x: 0, y: Math.PI/2, z: 0 },
    };
    return rotations[value] || { x: 0, y: 0, z: 0 };
  }
}

const Dice3DReal: React.FC<Dice3DRealProps> = ({ finalValues, onRollComplete, isRolling }) => {
  const animationFrameId = useRef<number>();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<Renderer>();
  const diceMeshesRef = useRef<THREE.Group[]>([]);
  const physicsRef = useRef(new DicePhysics());
  const rollStartTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  // Create dice mesh with colored faces (dots will be separate spheres)
  const createDiceMesh = () => {
    const diceSize = 1;
    const group = new THREE.Group();
    
    // Main dice cube (ivory color)
    const geometry = new THREE.BoxGeometry(diceSize, diceSize, diceSize);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xFFFACD,
      shininess: 30,
    });
    const cube = new THREE.Mesh(geometry, material);
    group.add(cube);
    
    // Add edge highlights
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    group.add(edges);
    
    // Create dots as small spheres
    const dotGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const dotMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    const addDot = (x: number, y: number, z: number) => {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(x, y, z);
      group.add(dot);
    };
    
    const offset = 0.51; // Just outside cube surface
    const spacing = 0.25; // Distance between dots
    
    // Face 1 (top, Y+): 1 dot center
    addDot(0, offset, 0);
    
    // Face 6 (bottom, Y-): 6 dots (2 columns of 3)
    addDot(-spacing, -offset, -spacing);
    addDot(-spacing, -offset, 0);
    addDot(-spacing, -offset, spacing);
    addDot(spacing, -offset, -spacing);
    addDot(spacing, -offset, 0);
    addDot(spacing, -offset, spacing);
    
    // Face 2 (front, Z+): 2 dots diagonal
    addDot(-spacing, -spacing, offset);
    addDot(spacing, spacing, offset);
    
    // Face 5 (back, Z-): 5 dots (4 corners + center)
    addDot(-spacing, -spacing, -offset);
    addDot(spacing, -spacing, -offset);
    addDot(0, 0, -offset);
    addDot(-spacing, spacing, -offset);
    addDot(spacing, spacing, -offset);
    
    // Face 3 (left, X-): 3 dots diagonal
    addDot(-offset, -spacing, -spacing);
    addDot(-offset, 0, 0);
    addDot(-offset, spacing, spacing);
    
    // Face 4 (right, X+): 4 dots corners
    addDot(offset, -spacing, -spacing);
    addDot(offset, spacing, -spacing);
    addDot(offset, -spacing, spacing);
    addDot(offset, spacing, spacing);
    
    return group;
  };

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    // Initialize renderer
    const renderer = new Renderer({ gl });
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT * 0.45);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      45,
      SCREEN_WIDTH / (SCREEN_HEIGHT * 0.45),
      0.1,
      1000
    );
    camera.position.set(0, 10, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(20, 15);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x0f3460,
      side: THREE.DoubleSide,
      shininess: 20,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    // Create 5 dice
    physicsRef.current.createDice(5);
    for (let i = 0; i < 5; i++) {
      const diceMesh = createDiceMesh();
      const body = physicsRef.current.bodies[i];
      diceMesh.position.set(body.position.x, body.position.y, body.position.z);
      scene.add(diceMesh);
      diceMeshesRef.current.push(diceMesh);
    }

    setReady(true);
    lastFrameTimeRef.current = Date.now();

    // Animation loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);

      const now = Date.now();
      const deltaTime = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1); // Cap at 100ms
      lastFrameTimeRef.current = now;

      if (!physicsRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) {
        return;
      }

      const elapsed = now - rollStartTimeRef.current;
      const rollDuration = 2500;
      const settleDuration = 1000;

      if (elapsed < rollDuration) {
        // Physics simulation during roll
        physicsRef.current.step(deltaTime);
      } else if (elapsed < rollDuration + settleDuration) {
        // Settling phase
        const settleProgress = (elapsed - rollDuration) / settleDuration;
        physicsRef.current.bodies.forEach((body, i) => {
          physicsRef.current.settleToValue(i, finalValues[i], settleProgress);
        });
      } else if (elapsed >= rollDuration + settleDuration && elapsed < rollDuration + settleDuration + 100) {
        // Stop and lock to final positions
        physicsRef.current.stopAll();
        physicsRef.current.bodies.forEach((body, i) => {
          const finalRot = physicsRef.current.getRotationForValue(finalValues[i]);
          body.rotation = finalRot;
        });
      } else if (elapsed >= rollDuration + settleDuration + 100 && elapsed < rollDuration + settleDuration + 200) {
        // Trigger completion callback once
        onRollComplete();
      }

      // Update mesh transforms from physics
      diceMeshesRef.current.forEach((mesh, i) => {
        const body = physicsRef.current.bodies[i];
        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.rotation.set(body.rotation.x, body.rotation.y, body.rotation.z);
      });

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      gl.endFrameEXP();
    };

    animate();
  };

  // Trigger roll when isRolling changes
  useEffect(() => {
    if (isRolling && ready && physicsRef.current.bodies.length > 0) {
      rollStartTimeRef.current = Date.now();
      
      // Throw all dice
      physicsRef.current.bodies.forEach((_, index) => {
        physicsRef.current.throwDice(index);
      });
    }
  }, [isRolling, ready]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      diceMeshesRef.current = [];
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
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: '#1a1a2e',
  },
  glView: {
    flex: 1,
  },
});

export default Dice3DReal;
