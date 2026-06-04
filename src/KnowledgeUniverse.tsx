import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Text, Line, Sphere } from "@react-three/drei";
import * as THREE from "three";
import type { KnowledgeGraph } from "./graph-data";

// Force-directed 3D layout
function computeLayout(graph: KnowledgeGraph) {
  const pos = new Map<string, THREE.Vector3>();
  const vel = new Map<string, THREE.Vector3>();

  for (const node of graph.nodes) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 3 + Math.random() * 2;
    pos.set(node.id, new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) + 1,
      r * Math.cos(phi)
    ));
    vel.set(node.id, new THREE.Vector3());
  }

  const iterations = 80;
  const repulsion = 40;
  const attraction = 0.015;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, THREE.Vector3>();
    for (const n of graph.nodes) forces.set(n.id, new THREE.Vector3());

    const nl = graph.nodes;
    for (let i = 0; i < nl.length; i++) {
      for (let j = i + 1; j < nl.length; j++) {
        const a = nl[i].id, b = nl[j].id;
        const pa = pos.get(a)!, pb = pos.get(b)!;
        const diff = pa.clone().sub(pb);
        const dist = Math.max(diff.length(), 0.05);
        const f = repulsion / (dist * dist);
        diff.normalize().multiplyScalar(f);
        forces.get(a)!.add(diff); forces.get(b)!.sub(diff);
      }
    }

    for (const edge of graph.edges) {
      const pa = pos.get(edge.source), pb = pos.get(edge.target);
      if (!pa || !pb) continue;
      const diff = pb.clone().sub(pa);
      const f = diff.length() * attraction;
      diff.normalize().multiplyScalar(f);
      forces.get(edge.source)!.add(diff);
      forces.get(edge.target)!.sub(diff);
    }

    for (const n of graph.nodes) {
      const p = pos.get(n.id)!;
      forces.get(n.id)!.add(p.clone().multiplyScalar(-0.001));
    }

    for (const n of graph.nodes) {
      const v = vel.get(n.id)!;
      v.add(forces.get(n.id)!.multiplyScalar(0.015));
      v.multiplyScalar(damping);
      pos.get(n.id)!.add(v);
    }
  }
  return pos;
}

const COLORS: Record<string, string> = {
  core: "#00E6C8",
  module: "#FF5A78",
  foundation: "#FFB83C",
  concept: "#8250FF",
};

const GraphNode: React.FC<{ position: THREE.Vector3; label: string; group?: string; isActive: boolean }> = ({ position, label, group, isActive }) => {
  const colorHex = COLORS[group || "concept"] || "#3CB4FF";
  const color = new THREE.Color(colorHex);
  const glowColor = color.clone().multiplyScalar(isActive ? 1.8 : 0.25);

  return (
    <group position={position}>
      <Sphere args={[isActive ? 0.22 : 0.13, 32, 32]}>
        <meshBasicMaterial color={glowColor} transparent opacity={isActive ? 0.7 : 0.15} />
      </Sphere>
      <Sphere args={[isActive ? 0.38 : 0.22, 16, 16]}>
        <meshBasicMaterial color={glowColor} transparent opacity={isActive ? 0.12 : 0.03} />
      </Sphere>
      <Text
        position={[0, isActive ? 0.35 : 0.25, 0]}
        fontSize={isActive ? 0.16 : 0.11}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.015}
        outlineColor="black"
      >
        {label}
      </Text>
    </group>
  );
};

const GraphEdge: React.FC<{ start: THREE.Vector3; end: THREE.Vector3 }> = ({ start, end }) => {
  const points = useMemo(() => {
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 0.25;
    return new THREE.QuadraticBezierCurve3(start.clone(), mid, end.clone()).getPoints(20);
  }, [start, end]);
  return <Line points={points} color="#223355" lineWidth={0.4} transparent opacity={0.25} />;
};

const CameraController: React.FC<{
  positions: Map<string, THREE.Vector3>;
  order: string[];
  totalFrames: number;
}> = ({ positions, order, totalFrames }) => {
  const frame = useRef(0);

  useFrame(({ camera }) => {
    frame.current++;
    const f = frame.current;
    if (f > totalFrames) return;

    const progress = f / totalFrames;
    const segCount = Math.max(order.length - 1, 1);
    const segSize = 1 / segCount;
    const segIdx = Math.min(Math.floor(progress / segSize), segCount - 1);
    const segT = (progress - segIdx * segSize) / segSize;
    const t = segT < 0.5 ? 2*segT*segT : 1-Math.pow(-2*segT+2,2)/2;

    const n1 = order[segIdx];
    const n2 = order[Math.min(segIdx+1, order.length-1)];
    const p1 = positions.get(n1) || new THREE.Vector3();
    const p2 = positions.get(n2) || p1;
    const target = p1.clone().lerp(p2, t);

    const orbitR = 7;
    const orbitA = progress * Math.PI * 0.6;
    camera.position.set(
      target.x + Math.cos(orbitA) * orbitR,
      target.y + 3.5,
      target.z + Math.sin(orbitA) * orbitR
    );
    camera.lookAt(target);
  });

  return null;
};

// Scene content
const UniverseScene: React.FC<{ graph: KnowledgeGraph; durationInFrames: number; activeNodeId?: string }> = ({ graph, durationInFrames, activeNodeId }) => {
  const positions = useMemo(() => computeLayout(graph), [graph]);
  const order = useMemo(() => {
    const core = graph.nodes.filter(n => n.group === "core").map(n => n.id);
    const mods = graph.nodes.filter(n => n.group === "module").map(n => n.id);
    const others = graph.nodes.filter(n => n.group !== "core" && n.group !== "module").map(n => n.id);
    return [...core, ...mods, ...others];
  }, [graph]);

  return (
    <>
      <ambientLight intensity={0.08} />
      <pointLight position={[5, 5, 5]} intensity={0.6} />

      {/* Stars */}
      {Array.from({ length: 150 }).map((_, i) => {
        const theta = Math.random()*Math.PI*2;
        const phi = Math.acos(2*Math.random()-1);
        const r = 14+Math.random()*6;
        return (
          <Sphere key={i} args={[0.015, 4, 4]} position={[r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi)]}>
            <meshBasicMaterial color="white" transparent opacity={0.2+Math.random()*0.3} />
          </Sphere>
        );
      })}

      {graph.edges.map((e, i) => {
        const p1 = positions.get(e.source), p2 = positions.get(e.target);
        if (!p1 || !p2) return null;
        return <GraphEdge key={i} start={p1} end={p2} />;
      })}

      {graph.nodes.map(n => {
        const p = positions.get(n.id);
        if (!p) return null;
        return <GraphNode key={n.id} position={p} label={n.label} group={n.group} isActive={n.id === activeNodeId} />;
      })}

      <CameraController positions={positions} order={order} totalFrames={durationInFrames} />
    </>
  );
};

export const KnowledgeUniverse: React.FC<{ graph: KnowledgeGraph; durationInFrames: number; activeNodeId?: string }> = (props) => (
  <ThreeCanvas width={1920} height={1080} style={{ background: "black" }}>
    <UniverseScene {...props} />
  </ThreeCanvas>
);
