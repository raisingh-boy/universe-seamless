import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GraphNode, GraphEdge } from "../utils/types";

interface EdgeProps {
  edge: GraphEdge;
  source: GraphNode;
  target: GraphNode;
  color: string;
}

const EdgeLine: React.FC<EdgeProps> = ({ edge, source, target, color }) => {
  const lineRef = useRef<any>(null!);

  const { points, center } = useMemo(() => {
    const sx = source.x || 0;
    const sy = source.y || 0;
    const sz = source.z || 0;
    const tx = target.x || 0;
    const ty = target.y || 0;
    const tz = target.z || 0;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const mz = (sz + tz) / 2 + 6;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx, sy, sz),
      new THREE.Vector3(mx, my, mz),
      new THREE.Vector3(tx, ty, tz)
    );
    return { points: curve.getPoints(24), center: new THREE.Vector3(mx, my, mz) };
  }, [source.x, source.y, source.z, target.x, target.y, target.z]);

  const c = new THREE.Color(color);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      (lineRef.current.material as THREE.LineBasicMaterial).opacity =
        0.12 + Math.sin(clock.getElapsedTime() * 0.4 + parseInt(edge.source, 36) * 0.1) * 0.06;
    }
  });

  const positions = new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]));

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={c} transparent opacity={0.18} depthWrite={false} />
    </line>
  );
};

export default EdgeLine;
