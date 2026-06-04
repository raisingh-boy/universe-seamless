import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { GraphNode } from "../utils/types";

interface NodeProps {
  node: GraphNode;
  color: string;
  onClick?: () => void;
}

const COLORS: Record<string, string> = {
  root: "#d4a857",
  era: "#2a9d8f",
  figure: "#e76f51",
};

const SIZES: Record<string, number> = {
  root: 2.5,
  era: 1.5,
  figure: 1.0,
};

const NodeSphere: React.FC<NodeProps> = ({ node, color, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  const size = SIZES[node.group] || 0.6;
  const hue = color || COLORS[node.group] || "#d4a857";
  const c = new THREE.Color(hue);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.position.set(node.x || 0, node.y || 0, node.z || 0);
    }
    if (glowRef.current) {
      glowRef.current.position.set(node.x || 0, node.y || 0, node.z || 0);
      const pulse = 1 + Math.sin(t * 0.5 + parseInt(node.id.slice(-2), 36) * 0.3) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 2.5, 16, 16]} />
        <meshBasicMaterial
          color={c}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      {/* Core */}
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={1.0}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {/* Label */}
      <Text
        position={[node.x || 0, (node.y || 0) - size - 0.8, node.z || 0]}
        fontSize={node.group === "root" ? 0.8 : node.group === "era" ? 0.5 : 0.35}
        color="#f4e4c1"
        anchorX="center"
        anchorY="top"
        font={undefined}
        letterSpacing={0.05}
        outlineWidth={0}
      >
        {node.label}
      </Text>
    </group>
  );
};

export default NodeSphere;
