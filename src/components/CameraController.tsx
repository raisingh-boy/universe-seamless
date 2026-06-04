import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControllerProps {
  targets: THREE.Vector3[];
  autoRotate?: boolean;
}

const CameraController: React.FC<CameraControllerProps> = ({
  targets,
  autoRotate = true,
}) => {
  const { camera } = useThree();
  const currentTarget = useRef(0);
  const progress = useRef(0);

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 5, 25);
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).fov = 45;
    camera.updateProjectionMatrix();
  }, []);

  useFrame(({ clock }) => {
    if (targets.length === 0) return;

    const t = clock.getElapsedTime();

    // Slow auto-rotation for ambiance
    if (autoRotate && targets.length > 0) {
      // Gentle orbital drift
      const orbitSpeed = 0.03;
      const orbitCenter = new THREE.Vector3(0, 0, 0);
      const radius = 18;
      const cx = Math.sin(t * orbitSpeed) * radius;
      const cz = Math.cos(t * orbitSpeed) * radius;

      // Slowly move between targets
      const targetIdx = Math.floor((t * 0.08) % targets.length);
      const nextIdx = (targetIdx + 1) % targets.length;
      const mix = (t * 0.08) % 1;
      const smoothMix = mix * mix * (3 - 2 * mix); // smoothstep

      const lookAt = new THREE.Vector3().lerpVectors(
        targets[targetIdx],
        targets[nextIdx],
        smoothMix
      );

      camera.position.lerp(
        new THREE.Vector3(cx, 3 + Math.sin(t * 0.02) * 1.5, cz),
        0.02
      );
      camera.lookAt(lookAt);
    }
  });

  return null;
};

export default CameraController;
