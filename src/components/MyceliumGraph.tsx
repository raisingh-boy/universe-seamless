import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { SomaticNode, SomaticLink, Domain, World, NodeStatus, CommunityUser } from '../types';
import { SAMPLE_AUDIO } from '../data/nodesData';
import { Flame } from 'lucide-react';
import { playNodeTone } from '../api/nodeSounds';

// ============================================================
// ЦВЕТА ДОМЕНОВ (Domain Colors)
// ============================================================
const DOMAIN_COLORS: Record<Domain, string> = {
  body: '#E8A95C',      // Warm Amber
  science: '#5C9BE8',   // Cold Blue
  philosophy: '#9B5CE8',// Purple
  movement: '#5CE87A',  // Green
  cognition: '#EAEAEA',  // Silver-White
  hybrid: '#E85C7A'     // Coral
};

// ============================================================
// GLOBAL VISUAL PHASE (RAF-based sync for all pulsation)
// ============================================================
const _visPhaseRef = { value: 0 };
if (typeof window !== 'undefined') {
  (function updateVisPhase() {
    _visPhaseRef.value = (Date.now() / 1200) % (Math.PI * 2);
    requestAnimationFrame(updateVisPhase);
  })();
}
function getVisualPhase() { return _visPhaseRef.value; }

// ============================================================
// ХЕЛПЕР ОПРЕДЕЛЕНИЯ ЭПОХИ ДЛЯ НОДЫ (Epoch Map Helper)
// ============================================================
export function getEpochNumberForNode(node: SomaticNode): number {
  if (node.id === 'central-me') return 0;
  if (node.id === 'root') return 0; // All time
  if (node.world === 'field') return 8;

  const years = (node.epochEn || '').toLowerCase();
  const desc = (node.descriptionEn || '').toLowerCase();
  const id = node.id.toLowerCase();

  // 1: Antiquity (–500 CE to 500 CE) — Plato, Aristotle, Buddha
  if (
    id.includes('buddha') || id.includes('aristotle') || id.includes('plato') || id.includes('antiquity') ||
    desc.includes('antiquity') || desc.includes('ancient greece') || desc.includes('buddhism') ||
    years.includes('bc') || (years.includes('ce') && !years.includes('19') && !years.includes('20') && !years.includes('18')) ||
    id.includes('yoga') || id.includes('socrates') || id.includes('zen') || id.includes('qigong')
  ) {
    return 1;
  }

  // 2: Medieval (500–1500) — Sufis, Zen masters
  if (
    id.includes('sufi') || desc.includes('medieval') || desc.includes('middle ages') ||
    id.includes('zen_masters') || id.includes('kabbalah') || years.includes('1100') || years.includes('1200') ||
    years.includes('1300') || years.includes('1400')
  ) {
    return 2;
  }

  // 3: Renaissance (1500–1800) — Descartes, Newton
  if (
    id.includes('descartes') || id.includes('newton') || id.includes('spinoza') || id.includes('renaissance') ||
    desc.includes('renaissance') || desc.includes('17th century') || desc.includes('18th century') ||
    years.includes('1500') || years.includes('1600') || years.includes('1700') ||
    id.includes('shinto') || id.includes('martial_arts')
  ) {
    return 3;
  }

  // 4: 19th Century (1800–1900) — Darwin, Nietzsche, Freud
  if (
    id.includes('darwin') || id.includes('nietzsche') || id.includes('freud') || id.includes('19th_century') ||
    desc.includes('19th century') || years.includes('18') || years.includes('1800') || years.includes('1860') ||
    years.includes('1880') || id.includes('duncan') || id.includes('alexander_technique')
  ) {
    return 4;
  }

  // 5: Early 20th (1900–1950) — Modern dance, Phenomenology
  if (
    id.includes('phenomenology') || id.includes('graham') || id.includes('cunningham') ||
    desc.includes('early 20th') || years.includes('1900') || years.includes('1910') || years.includes('1920') ||
    years.includes('1930') || years.includes('1940') || id.includes('laban') || id.includes('wigman') ||
    id.includes('bateson')
  ) {
    return 5;
  }

  // 6: Mid 20th (1950–1980) — Contact Improv, Somatics, Cybernetics
  if (
    id.includes('contact_improv') || id.includes('somatics') || id.includes('cybernetics') ||
    id.includes('paxton') || id.includes('feldenkrais') || id.includes('hanna') || id.includes('rolfing') ||
    years.includes('1950') || years.includes('1960') || years.includes('1970') ||
    years.includes('1972') || years.includes('1959')
  ) {
    return 6;
  }

  // 7: Late 20th (1980–2000) — Embodied AI, Complexity
  if (
    id.includes('complexity') || id.includes('embodied_ai') || id.includes('cognitive_sci') ||
    years.includes('1980') || years.includes('1990') || desc.includes('late 20th')
  ) {
    return 7;
  }

  // 8: Contemporary (2000–present) — Current research
  return 8;
}

// ============================================================
// КОМПОНЕНТ НОДЫ (3D Sphere with Bloom / Pulsing)
// ============================================================
function SomaticSphere({
  node, isSelected, isHovered, isActiveAudio, color, onClick, currentWorld, overlayUser, selectedEpoch
}: {
  node: SomaticNode; isSelected: boolean; isHovered: boolean; isActiveAudio: boolean;
  color: string; onClick: (n: SomaticNode) => void; currentWorld: World; overlayUser: string | null;
  selectedEpoch?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const SCALE = 0.045; // Units conversion: physics scale -> WebGL coordinate system

  const inEpoch = selectedEpoch === undefined || selectedEpoch === 0 || node.id === 'central-me' || getEpochNumberForNode(node) === selectedEpoch;

  const isOverlayMatch = !!(overlayUser && (
    node.authorRu?.includes(overlayUser) ||
    node.authorEn?.includes(overlayUser) ||
    node.descriptionEn?.toLowerCase().includes(overlayUser.toLowerCase()) ||
    node.descriptionRu?.toLowerCase().includes(overlayUser.toLowerCase())
  ));

  const finalColor = isOverlayMatch ? '#FFD700' : color;

  // Status opacity indicating the lifecycle of nodes in the field mind-map
  const statusOpacity: Record<NodeStatus, number> = {
    seed: 0.15, sprout: 0.45, alive: 0.8, rooted: 1.0, atlas: 1.0
  };
  let baseOpacity = (currentWorld === 'field' && node.world === 'atlas')
    ? 0.25  // Contextual background transparency for Atlas nodes inside Field map
    : (statusOpacity[node.status] || 1.0);

  // Dynamic Decay (fading without activity):
  const idleDays = node.lastActiveAt ? (Date.now() - node.lastActiveAt) / (1000 * 3600 * 24) : 0;
  const decayFactor = (node.world === 'field' && idleDays > 30)
    ? Math.max(0.08, Math.pow(0.95, idleDays - 30))
    : 1.0;

  const opacity = baseOpacity * decayFactor * (inEpoch ? 1.0 : 0.2);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const phase = getVisualPhase();
    const nodeHash = node.id.charCodeAt(0);
    const audioWave = 0.5 + Math.sin(phase * 2.5 + nodeHash * 0.1) * 0.5;
    const breath = 1 + Math.sin(t * (node.breathSpeed || 0.4) + (node.breathPhase || 0)) * 0.09 + audioWave * 0.035;
    const base = (node.currentRadius || 10) * SCALE;

    const camDist = state.camera.position.length();
    let lodScale = 1.0;
    if (node.level === 'micro' && node.id !== 'central-me') {
      if (camDist > 24) {
        lodScale = 0.0;
      } else if (camDist > 16) {
        lodScale = 1.0 - (camDist - 16) / 8;
      }
    } else if (node.level === 'meso' && node.id !== 'central-me') {
      if (camDist > 38) {
        lodScale = 0.0;
      } else if (camDist > 28) {
        lodScale = 1.0 - (camDist - 28) / 10;
      }
    }

    let s = base * breath * lodScale;
    if (isSelected) s *= 1.35;
    else if (isActiveAudio) s *= 1.25;
    else if (isHovered) s *= 1.15;

    meshRef.current.scale.setScalar(s);
    glowRef.current.scale.setScalar(s * (isActiveAudio ? 2.5 : 1.7));

    const x = (node.x || 0) * SCALE;
    const y = (node.y || 0) * SCALE;
    const z = (node.z || 0) * SCALE;
    meshRef.current.position.set(x, y, z);
    glowRef.current.position.set(x, y, z);

    // Drafts (isPrivate) and goals/practice mesh rotation
    if (node.isPrivate || node.type === 'practice' || node.type === 'question') {
      meshRef.current.rotation.x = t * 0.5;
      meshRef.current.rotation.y = t * 0.4;
    }

    // 3-seconds starry reveal entry sequence
    let bootFade = 1.0;
    if (t < 3.0) {
      const hash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100 / 100;
      const revealDelay = hash * 2.0; // staggered delay
      if (t < revealDelay) {
        bootFade = 0.0;
      } else {
        bootFade = Math.min(1.0, (t - revealDelay) / 1.0);
      }
    }

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (isActiveAudio) {
      mat.emissive.set('#DFB757');
      mat.emissiveIntensity = (0.6 + Math.sin(t * 8) * 0.3) * (inEpoch ? 1.0 : 0.15) * bootFade;
    } else {
      mat.emissive.set(new THREE.Color(finalColor));
      let baseInt = isOverlayMatch ? 1.2 : isSelected ? 0.75 : isHovered ? 0.45 : 0.2;
      mat.emissiveIntensity = baseInt * (inEpoch ? 1.0 : 0.15) * bootFade;
    }

    mat.transparent = true;
    mat.opacity = opacity * lodScale * bootFade;
  });

  const c = new THREE.Color(finalColor);

  const renderGeometry = () => {
    const t = node.type || 'concept';
    const lvl = node.level || 'meso';
    // Atlas canonical nodes are always spheres (authoritative)
    if (node.world === 'atlas') {
      return <sphereGeometry args={[1, 24, 24]} />;
    }
    // Personal drafts = small rough octahedrons (unstable form)
    if (node.isPrivate) {
      return <octahedronGeometry args={[0.8, 0]} />;
    }
    // Practices/methods = slightly flattened cylinders
    if (t === 'practice') {
      return <cylinderGeometry args={[0.9, 0.9, 0.6, 12]} />;
    }
    // Questions = pyramids (pointing to something)
    if (t === 'question') {
      return <coneGeometry args={[0.9, 1.3, 4]} />;
    }
    // Movement/techniques = thin flat disks
    if (t === 'movement' || lvl === 'micro') {
      return <sphereGeometry args={[0.7, 12, 8]} />;
    }
    // Events = rounded small boxes
    if (t === 'event') {
      return <boxGeometry args={[1.0, 1.0, 0.8]} />;
    }
    // Observations = subtly smaller spheres
    if (t === 'observation') {
      return <sphereGeometry args={[0.9, 16, 16]} />;
    }
    // Persons (only in atlas, already handled above) = fallback
    // Default concepts = classic spheres
    return <sphereGeometry args={[1, 24, 24]} />;
  };

  return (
    <group
      onClick={(e) => { e.stopPropagation(); onClick(node); }}
    >
      {/* Outer soft glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={c} transparent opacity={isSelected ? 0.18 : isActiveAudio ? 0.28 : inEpoch ? 0.06 : 0.01}
          depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Internal core mesh which adapts its geometry according to node type */}
      <mesh ref={meshRef}>
        {renderGeometry()}
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={0.2}
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

// ============================================================
// КОМПОНЕНТ РЕБРА (Curved Mycelial Strand + Interactive Signal Particle with 5 distinct relationship styles)
// ============================================================
function MyceliumEdge({
  source, target, color, activity, isActive, linkType = 'conceptual'
}: {
  source: SomaticNode; target: SomaticNode;
  color: string; activity: number; isActive: boolean;
  linkType?: 'conceptual' | 'historical' | 'practical' | 'resonance' | 'opposition';
}) {
  const lineRef = useRef<THREE.Line>(null!);
  const particleRef = useRef<THREE.Mesh>(null!);
  const progressRef = useRef(Math.random());
  const particle2Ref = useRef<THREE.Mesh>(null!);
  const particle3Ref = useRef<THREE.Mesh>(null!);
  const SCALE = 0.045;

  // Calculates organic curved bezier points dynamically responding to physics force changes
  const getCurve = useCallback(() => {
    const s = new THREE.Vector3(
      (source.x || 0) * SCALE, (source.y || 0) * SCALE, (source.z || 0) * SCALE
    );
    const t = new THREE.Vector3(
      (target.x || 0) * SCALE, (target.y || 0) * SCALE, (target.z || 0) * SCALE
    );
    const mid = new THREE.Vector3().addVectors(s, t).multiplyScalar(0.5);
    const seed = ((source.id || '').charCodeAt(0) || 0) + ((target.id || '').charCodeAt(0) || 0);
    const perp = new THREE.Vector3(
      -(t.y - s.y), (t.x - s.x), (seed % 7) * 0.2
    ).normalize().multiplyScalar(0.6 + (seed % 20) / 20 * 1.0);
    return new THREE.QuadraticBezierCurve3(s, mid.clone().add(perp), t);
  }, [source.x, source.y, source.z, target.x, target.y, target.z]);

  // Determine physical characteristics based on 5 user-requested relationship styles
  // 1) historical: solid muted steel/blue, thin, slower signal pulses
  // 2) conceptual: elegant violet/indigo, smooth curves, standard speed
  // 3) practical: electric green, dashed/broken, high speed
  // 4) resonance: glowing hot amber/gold, thick breathing light, very fast pulses
  // 5) opposition: bright red/crimson, jagged chaotic vibrations, extreme velocity
  const getBaseColorAndSpeeds = () => {
    switch (linkType) {
      case 'historical':
        return {
          hexColor: '#707D94',
          baseSpeed: 0.0016,
          lineWidth: 1,
          baseOpacity: isActive ? 0.45 : 0.12
        };
      case 'practical':
        return {
          hexColor: '#10B981',
          baseSpeed: 0.007,
          lineWidth: 1.5,
          baseOpacity: isActive ? 0.65 : 0.2
        };
      case 'resonance':
        return {
          hexColor: '#FFAE00',
          baseSpeed: 0.012,
          lineWidth: 2.5,
          baseOpacity: isActive ? 0.85 : 0.35
        };
      case 'opposition':
        return {
          hexColor: '#EF4444',
          baseSpeed: 0.018,
          lineWidth: 2.0,
          baseOpacity: isActive ? 0.9 : 0.4
        };
      case 'conceptual':
      default:
        return {
          hexColor: color,
          baseSpeed: 0.0035,
          lineWidth: 1.2,
          baseOpacity: isActive ? 0.55 : 0.18
        };
    }
  };

  const styleSettings = getBaseColorAndSpeeds();

  useFrame((state, delta) => {
    const multiplier = 1 + activity * 0.05;
    const currentSpeed = (isActive ? styleSettings.baseSpeed * 1.8 : styleSettings.baseSpeed) * multiplier;
    progressRef.current = (progressRef.current + currentSpeed) % 1;

    const curve = getCurve();

    if (lineRef.current) {
      // 24 resolution points for standard, higher for opposition so we can trace waves correctly
      const ptsCount = linkType === 'opposition' ? 38 : 24;
      const pts = curve.getPoints(ptsCount);

      // Handle "opposition" link types with real interactive tension waves (vibrations)
      if (linkType === 'opposition') {
        const time = state.clock.getElapsedTime();
        pts.forEach((pt, idx) => {
          // Do not wave anchor start and end nodes to maintain connection continuity
          if (idx > 0 && idx < pts.length - 1) {
            const waveAmt = Math.sin(idx * 0.7 - time * 12.0) * 0.038;
            pt.y += waveAmt;
            pt.x += Math.cos(idx * 0.4 + time * 8.0) * 0.018;
          }
        });
      }

      // Support dynamic pulsing of resonance relationships
      if (lineRef.current.material) {
        const mat = lineRef.current.material as THREE.LineBasicMaterial;
        if (linkType === 'resonance') {
          // Breathing intensity
          mat.opacity = styleSettings.baseOpacity + Math.sin(state.clock.getElapsedTime() * 7) * 0.12;
        } else if (linkType === 'practical') {
          // Alternates pulses for a digital dashed-indicator feel
          mat.opacity = styleSettings.baseOpacity * (Math.sin(state.clock.getElapsedTime() * 15) > 0 ? 1 : 0.4);
        } else {
          mat.opacity = styleSettings.baseOpacity;
        }
      }

      (lineRef.current.geometry as THREE.BufferGeometry).setFromPoints(pts);
    }

    if (particleRef.current) {
      const pt = curve.getPoint(progressRef.current);
      particleRef.current.position.copy(pt);

      // Make resonance signal particle expand and contract
      if (linkType === 'resonance') {
        const scaleAmt = 1.0 + Math.sin(state.clock.getElapsedTime() * 10) * 0.35;
        particleRef.current.scale.set(scaleAmt, scaleAmt, scaleAmt);
      } else {
        particleRef.current.scale.set(1, 1, 1);
      }
    }
    if (particle2Ref.current) {
      const p2 = curve.getPoint((progressRef.current + 0.33) % 1);
      particle2Ref.current.position.copy(p2);
      if (linkType === 'resonance') {
        const s2 = 0.8 + Math.sin(state.clock.getElapsedTime() * 10 + 2) * 0.25;
        particle2Ref.current.scale.setScalar(s2);
      }
    }
    if (particle3Ref.current) {
      const p3 = curve.getPoint((progressRef.current + 0.66) % 1);
      particle3Ref.current.position.copy(p3);
    }
  });

  const finalColor = new THREE.Color(styleSettings.hexColor);

  return (
    <group>
      <line ref={lineRef as any}>
        <bufferGeometry />
        <lineBasicMaterial color={finalColor} transparent opacity={styleSettings.baseOpacity} />
      </line>
      <mesh ref={particleRef}>
        <sphereGeometry args={[
          linkType === 'resonance' ? 0.055 : (isActive ? 0.048 : 0.032),
          LinkTypeArgsSize(linkType),
          LinkTypeArgsSize(linkType)
        ]} />
        <meshBasicMaterial color={finalColor} />
      </mesh>
      <mesh ref={particle2Ref}>
        <sphereGeometry args={[linkType === 'resonance' ? 0.038 : 0.022, 4, 4]} />
        <meshBasicMaterial color={finalColor} transparent opacity={0.5} />
      </mesh>
      <mesh ref={particle3Ref}>
        <sphereGeometry args={[linkType === 'resonance' ? 0.026 : 0.016, 4, 4]} />
        <meshBasicMaterial color={finalColor} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// Low polygon details helper for speed
function LinkTypeArgsSize(t: string): number {
  return t === 'resonance' ? 8 : 5;
}

// ============================================================
// ЗОЛОТЫЕ МОСТЫ СЕМЕЙСТВА ОВЕРЛЕЕВ (Golden Overlap Bridges)
// ============================================================
function GoldenOverlayBridges({ nodes, SCALE }: { nodes: SomaticNode[]; SCALE: number }) {
  const line1Ref = useRef<THREE.Line>(null!);
  const line2Ref = useRef<THREE.Line>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const opacity = 0.45 + Math.sin(t * 3.5) * 0.15;

    const somaticsNode = nodes.find(n => n.id === 'soma-hanna');
    const batesonNode = nodes.find(n => n.id === 'pattern-bateson');
    const gazeNode = nodes.find(n => n.id === 'field-gaze');

    if (somaticsNode && batesonNode && line1Ref.current) {
      const p1 = new THREE.Vector3((somaticsNode.x || 0) * SCALE, (somaticsNode.y || 0) * SCALE, (somaticsNode.z || 0) * SCALE);
      const p2 = new THREE.Vector3((batesonNode.x || 0) * SCALE, (batesonNode.y || 0) * SCALE, (batesonNode.z || 0) * SCALE);
      line1Ref.current.geometry.setFromPoints([p1, p2]);
      const mat = line1Ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = opacity;
    }

    if (batesonNode && gazeNode && line2Ref.current) {
      const p1 = new THREE.Vector3((batesonNode.x || 0) * SCALE, (batesonNode.y || 0) * SCALE, (batesonNode.z || 0) * SCALE);
      const p2 = new THREE.Vector3((gazeNode.x || 0) * SCALE, (gazeNode.y || 0) * SCALE, (gazeNode.z || 0) * SCALE);
      line2Ref.current.geometry.setFromPoints([p1, p2]);
      const mat = line2Ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = opacity;
    }
  });

  const somaticsNode = nodes.find(n => n.id === 'soma-hanna');
  const batesonNode = nodes.find(n => n.id === 'pattern-bateson');
  const gazeNode = nodes.find(n => n.id === 'field-gaze');

  return (
    <>
      {somaticsNode && batesonNode && (
        <line ref={line1Ref as any}>
          <bufferGeometry />
          <lineBasicMaterial color="#DFB757" transparent />
        </line>
      )}
      {batesonNode && gazeNode && (
        <line ref={line2Ref as any}>
          <bufferGeometry />
          <lineBasicMaterial color="#DFB757" transparent />
        </line>
      )}
    </>
  );
}

// ============================================================
// FLOATING SPARKLES - ambient particle field
// ============================================================
function FloatingSparkles() {
  const count = 200;
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 10 + Math.random() * 45;
      const theta = Math.random() * Math.PI;
      const phi = Math.random() * Math.PI * 2;
      positions[i*3]   = Math.sin(theta) * Math.cos(phi) * r;
      positions[i*3+1] = Math.sin(theta) * Math.sin(phi) * r;
      positions[i*3+2] = Math.cos(theta) * r;
      velocities[i*3]   = (Math.random() - 0.5) * 0.003;
      velocities[i*3+1] = (Math.random() - 0.5) * 0.003;
      velocities[i*3+2] = (Math.random() - 0.5) * 0.002;
    }
    return { positions, velocities };
  }, []);
  const attrRef = useRef<THREE.BufferAttribute>(null!);
  useFrame((state) => {
    if (!attrRef.current) return;
    const arr = attrRef.current.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i*3]   += velocities[i*3]   + Math.sin(t * 0.3 + i * 0.7) * 0.0008;
      arr[i*3+1] += velocities[i*3+1] + Math.cos(t * 0.25 + i * 0.5) * 0.0008;
      arr[i*3+2] += velocities[i*3+2];
      const r2 = arr[i*3]**2 + arr[i*3+1]**2 + arr[i*3+2]**2;
      if (r2 > 3025) { arr[i*3] *= 0.997; arr[i*3+1] *= 0.997; arr[i*3+2] *= 0.997; }
    }
    attrRef.current.needsUpdate = true;
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color="#aab8ff" transparent opacity={0.28}
        sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

// ============================================================
// HUB RING PULSE - expanding concentric rings for hub nodes
// ============================================================
function HubRingPulse({ x, y, z, color, isSelected }: {
  x: number; y: number; z: number; color: string; isSelected: boolean;
}) {
  const r1 = useRef<THREE.Mesh>(null!);
  const r2 = useRef<THREE.Mesh>(null!);
  const ph = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + ph.current;
    const speed = isSelected ? 0.7 : 0.45;
    const maxS = isSelected ? 6 : 3.5;
    const baseOp = isSelected ? 0.3 : 0.09;
    [r1, r2].forEach((ref, i) => {
      const p = ((t * speed) + i * 0.5) % 1;
      if (ref.current) {
        ref.current.scale.setScalar(0.3 + p * maxS);
        ref.current.position.set(x, y, z);
        (ref.current.material as THREE.Material).opacity = (1 - p) * baseOp;
      }
    });
  });
  const ringMat = (
    <meshBasicMaterial color={color} transparent opacity={0}
      depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
  );
  const rot: [number, number, number] = [-Math.PI / 2, 0, 0];
  return (
    <>
      <mesh ref={r1} rotation={rot}><ringGeometry args={[0.85, 1.05, 32]} />{ringMat}</mesh>
      <mesh ref={r2} rotation={rot}><ringGeometry args={[0.85, 1.05, 32]} />{ringMat}</mesh>
    </>
  );
}

// ============================================================
// RIPPLE EFFECT - expanding ring on node click
// ============================================================
function RippleEffect({ x, y, z, color, onDone }: {
  x: number; y: number; z: number; color: string; onDone: () => void;
}) {
  const mRef = useRef<THREE.Mesh>(null!);
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const p = Math.min((clock.elapsedTime - t0.current) / 1.0, 1);
    if (p >= 1) { onDone(); return; }
    if (mRef.current) {
      mRef.current.scale.setScalar(0.4 + p * 9);
      (mRef.current.material as THREE.Material).opacity = (1 - p) * 0.55;
    }
  });
  return (
    <mesh ref={mRef} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.55}
        depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// ============================================================
// ВЫРАВНЕННЫЙ БИЛЛБОРД С НАЗВАНИЕМ НОДЫ (Labels Billboard)
// ============================================================
function NodeLabel({ node, language, SCALE, isSelected, isActiveAudio }: {
  node: SomaticNode; language: 'ru' | 'en'; SCALE: number; isSelected: boolean; isActiveAudio: boolean;
}) {
  if (node.status === 'seed' && node.id !== 'central-me') return null; // seed nodes do not have any name label

  const label = language === 'ru' ? node.nameRu : node.nameEn;
  const radius = (node.currentRadius || 10) * SCALE;

  let color = '#D1D7E0'; // standard alive/sprout white
  if (isSelected || isActiveAudio || node.status === 'rooted' || node.id === 'central-me') {
    color = '#DFB757'; // gold label
  } else if (node.status === 'sprout') {
    color = '#6B7280'; // grey label
  }

  return (
    <Billboard position={[
      (node.x || 0) * SCALE,
      (node.y || 0) * SCALE + radius + 0.16,
      (node.z || 0) * SCALE
    ]}>
      <Text
        fontSize={isSelected || isActiveAudio || node.status === 'rooted' ? 0.20 : 0.13}
        color={color}
        anchorX="center"
        anchorY="bottom"
        maxWidth={2.5}
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
      >
        {label}
      </Text>
    </Billboard>
  );
}

export interface VisibleLayers {
  atlas: boolean;
  field: boolean;
  hot: boolean;
  withAudio: boolean;
}

// ============================================================
// ГЛАВНЫЙ СЦЕНИЧЕСКИЙ ОРКЕСТРАТОР (Physical Grid Simulation)
// ============================================================
interface GraphSceneProps {
  nodes: SomaticNode[];
  links: SomaticLink[];
  currentWorld: World;
  language: 'ru' | 'en';
  onNodeSelect: (node: SomaticNode) => void;
  selectedNodeId: string | null;
  overlayUser: string | null;
  resonatedNodeIds: Set<string>;
  carriedNodeIds: Set<string>;
  currentUserName?: string;
  isFilterHot?: boolean;
  activeAudioNodeId: string | null;
  visibleLayers?: VisibleLayers;
  selectedEpoch?: number;
  vibeMode?: 'colour' | 'mono' | 'cinematic';
  ascendingNodeId?: string | null;
  communityUsers?: CommunityUser[];
  fieldSubMode?: 'ideas' | 'people';
  onUserSelect?: (user: CommunityUser) => void;
  onLongPressNode?: (node: SomaticNode, cursorX: number, cursorY: number) => void;
}

// Custom wrapper to bind PointerDown and PointerUp for long tap (circular radial menu) detection
function InteractiveSomaticSphere({
  node, isSelected, isHovered, isActiveAudio, color, onClick, onLongSelect, currentWorld, overlayUser, selectedEpoch, ascendingNodeId, onDragStart
}: {
  node: SomaticNode; isSelected: boolean; isHovered: boolean; isActiveAudio: boolean;
  color: string; onClick: (n: SomaticNode) => void; onLongSelect?: (n: SomaticNode, cx: number, cy: number) => void;
  currentWorld: World; overlayUser: string | null; selectedEpoch?: number; ascendingNodeId?: string | null;
  onDragStart?: (nodeId: string, cx: number, cy: number) => void;
}) {
  const pointerTimeRef = useRef(0);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const isDragRef = useRef(false);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isDragRef.current = false;
    pointerTimeRef.current = Date.now();
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: any) => {
    if (!isDragRef.current) {
      const dx = e.clientX - pointerPosRef.current.x;
      const dy = e.clientY - pointerPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDragRef.current = true;
        onDragStart?.(node.id, e.clientX, e.clientY);
      }
    }
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    if (isDragRef.current) {
      isDragRef.current = false;
      return;
    }
    const duration = Date.now() - pointerTimeRef.current;
    const distance = Math.sqrt((e.clientX - pointerPosRef.current.x) ** 2 + (e.clientY - pointerPosRef.current.y) ** 2);
    if (distance < 15) {
      if (duration > 650) {
        onLongSelect?.(node, e.clientX, e.clientY);
      } else {
        onClick(node);
      }
    }
  };

  return (
    <group onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}>
      <SomaticSphere
        node={node}
        isSelected={isSelected}
        isHovered={isHovered}
        isActiveAudio={isActiveAudio}
        color={color}
        onClick={() => {}} // handled by pointerUp
        currentWorld={currentWorld}
        overlayUser={overlayUser}
        selectedEpoch={selectedEpoch}
      />
    </group>
  );
}

function GraphScene({
  nodes, links, currentWorld, language, onNodeSelect,
  selectedNodeId, overlayUser, resonatedNodeIds, carriedNodeIds,
  currentUserName, isFilterHot, activeAudioNodeId, visibleLayers,
  selectedEpoch, vibeMode, ascendingNodeId, communityUsers, fieldSubMode,
  onUserSelect, onLongPressNode
}: GraphSceneProps) {
  const SCALE = 0.045;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [camDist, setCamDist] = useState(24);

  const { camera, gl, raycaster } = useThree();
  const { controls } = useThree() as any;

  // Physics state representation maintained synchronously inside useRef context to prevent stuttering
  const graphStateRef = useRef<{
    nodes: (SomaticNode & {
      z?: number;
      vz?: number;
      targetZ?: number;
    })[];
    links: SomaticLink[];
    lastWorld: World | null;
    transitionProgress: number;
  }>({ nodes: [], links: [], lastWorld: null, transitionProgress: 1.0 });

  // Users ref tracking for electrostatic layout
  const usersStateRef = useRef<any[]>([]);

  const dragStateRef = useRef<{ nodeId: string | null; plane: THREE.Plane }>({
    nodeId: null, plane: new THREE.Plane()
  });
  const [ripples, setRipples] = useState<{ id: string; x: number; y: number; z: number; color: string }[]>([]);

  const handleDragStart = useCallback((nodeId: string, _cx: number, _cy: number) => {
    const DRAG_SCALE = 0.045;
    const node = graphStateRef.current.nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragStateRef.current.nodeId = nodeId;
    const nodePos = new THREE.Vector3(
      (node.x || 0) * DRAG_SCALE, (node.y || 0) * DRAG_SCALE, (node.z || 0) * DRAG_SCALE
    );
    const planeNormal = camera.position.clone().sub(nodePos).normalize();
    dragStateRef.current.plane.setFromNormalAndCoplanarPoint(planeNormal, nodePos);
    if (controls) controls.enabled = false;
    const onMove = (e: PointerEvent) => {
      const nd = graphStateRef.current.nodes.find(n => n.id === dragStateRef.current.nodeId);
      if (!nd) return;
      const rect = gl.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragStateRef.current.plane, hit)) {
        nd.x = hit.x / DRAG_SCALE; nd.y = hit.y / DRAG_SCALE; nd.z = hit.z / DRAG_SCALE;
        nd.vx = 0; nd.vy = 0; nd.vz = 0;
        nd.targetX = nd.x; nd.targetY = nd.y; nd.targetZ = nd.z;
      }
    };
    const onUp = () => {
      dragStateRef.current.nodeId = null;
      if (controls) controls.enabled = true;
      gl.domElement.removeEventListener('pointermove', onMove);
      gl.domElement.removeEventListener('pointerup', onUp);
    };
    gl.domElement.addEventListener('pointermove', onMove);
    gl.domElement.addEventListener('pointerup', onUp);
  }, [camera, controls, gl, raycaster]);

  useEffect(() => {
    if (communityUsers && communityUsers.length > 0) {
      usersStateRef.current = communityUsers.map((u, idx) => {
        const existing = usersStateRef.current.find(eu => eu.id === u.id);
        if (existing) {
          return { ...u, x: existing.x, y: existing.y, z: existing.z, vx: existing.vx, vy: existing.vy, vz: existing.vz };
        }
        const angle = (idx * Math.PI * 2) / communityUsers.length;
        const r = 35 + Math.random() * 25;
        return {
          ...u,
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          z: (Math.random() - 0.5) * 15,
          vx: 0, vy: 0, vz: 0
        };
      });
    }
  }, [communityUsers]);

  // Update nodes configurations and automatically sync target positions inside graphStateRef
  useEffect(() => {
    const gState = graphStateRef.current;
    const internalNodes = gState.nodes;

    const worldChanged = gState.lastWorld !== currentWorld;
    if (worldChanged) {
      gState.lastWorld = currentWorld;
      gState.transitionProgress = 0.0;
    }

    // Pre-calculate per-domain-level node indices for spiral galaxy layout
    const _dlIdx: Record<string, number> = {};
    const _dlCount: Record<string, number> = {};
    nodes.forEach(n => {
      const key = `${n.domain}-${n.level}`;
      _dlIdx[n.id] = _dlCount[key] || 0;
      _dlCount[key] = (_dlCount[key] || 0) + 1;
    });

    const newNodes = nodes.map((n, idx) => {
      const ex = internalNodes.find(e => e.id === n.id);
      let x = ex?.x;
      let y = ex?.y;
      let z = ex?.z;

      // Calculate target positions dynamically for this currentWorld
      let tx = 0, ty = 0, tz = 0;
      if (currentWorld === 'atlas') {
        // Spiral galaxy: 6 arms, one per domain
        // Macro nodes cluster near center, micro fan outward
        const ARM_ANGLE: Record<string, number> = {
          body: 0,
          science: Math.PI / 3,
          philosophy: (2 * Math.PI) / 3,
          movement: Math.PI,
          cognition: (4 * Math.PI) / 3,
          hybrid: (5 * Math.PI) / 3,
        };
        const armBase = ARM_ANGLE[n.domain] ?? (idx * 1.05);
        const domIdx = _dlIdx[n.id] ?? idx;
        const domTotal = Math.max(1, _dlCount[`${n.domain}-${n.level}`] ?? 1);
        const rMin = n.level === 'macro' ? 6 : n.level === 'meso' ? 36 : 76;
        const rMax = n.level === 'macro' ? 26 : n.level === 'meso' ? 66 : 116;
        const r = rMin + (domIdx / domTotal) * (rMax - rMin);
        const spread = n.level === 'macro' ? 0.22 : n.level === 'meso' ? 0.48 : 0.68;
        const angOffset = domTotal > 1 ? ((domIdx / (domTotal - 1)) - 0.5) * Math.PI * spread : 0;
        const angle = armBase + angOffset;
        tx = Math.cos(angle) * r;
        ty = Math.sin(angle) * r * 0.58;
        const zRange = n.level === 'macro' ? 10 : n.level === 'meso' ? 22 : 36;
        const seed = (n.id.charCodeAt(0) * 17 + (n.id.charCodeAt(1) || 7) * 11) % 100;
        tz = ((seed / 50) - 1) * zRange;
        if (x === undefined || y === undefined || z === undefined) {
          x = tx + (Math.random() - 0.5) * 18;
          y = ty + (Math.random() - 0.5) * 18;
          z = tz + (Math.random() - 0.5) * 12;
        }
      } else if (currentWorld === 'field') {
        const angle = (idx * 0.72) % (Math.PI * 2);
        const dist = 40 + (idx % 12) * 22;
        tx = Math.cos(angle) * dist;
        ty = Math.sin(angle) * dist * 0.6; // Slightly oval disk shape
        tz = Math.cos(idx * 3) * 10;

        if (x === undefined || y === undefined || z === undefined) {
          x = tx + (Math.random() - 0.5) * 15;
          y = ty + (Math.random() - 0.5) * 15;
          z = tz + (Math.random() - 0.5) * 10;
        }
      } else {
        // Personal Universe view
        if (n.id === 'central-me') {
          tx = 0; ty = 0; tz = 0;
          if (x === undefined) { x = 0; y = 0; z = 0; }
        } else {
          // Dynamic emergence from coordinates center (0,0,0) with small offset
          if (x === undefined || y === undefined || z === undefined) {
            x = (Math.random() - 0.5) * 4;
            y = (Math.random() - 0.5) * 4;
            z = (Math.random() - 0.5) * 4;
          }
          const orbitRadius = 45 + (idx % 5) * 20;
          const initialAngle = (idx * 1.2) % (Math.PI * 2);
          tx = Math.cos(initialAngle) * orbitRadius;
          ty = Math.sin(initialAngle) * orbitRadius;
          tz = Math.sin(idx) * 8;
        }
      }

      const lvl = n.level || 'meso';
      const levelFactor = lvl === 'macro' ? 1.6 : lvl === 'meso' ? 1.1 : 0.7;
      const stat = n.status || 'seed';
      const statusFactor = stat === 'rooted' || stat === 'atlas' ? 1.5 : stat === 'alive' ? 1.25 : stat === 'sprout' ? 0.95 : 0.7;
      const bRad = (n.id === 'central-me') ? 18 : Math.round(11 * levelFactor * statusFactor);

      return {
        ...n,
        x, y, z,
        vx: ex?.vx || 0, vy: ex?.vy || 0, vz: ex?.vz || 0,
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        breathPhase: ex?.breathPhase ?? Math.random() * Math.PI * 2,
        breathSpeed: ex?.breathSpeed ?? (0.3 + Math.random() * 0.45),
        baseRadius: bRad,
        currentRadius: ex?.currentRadius ?? bRad,
      };
    });

    gState.nodes = newNodes;
    gState.links = links;
  }, [nodes, links, currentWorld]);

  // Organic physics loops compiled per rendering interval
  useFrame((state) => {
    const gState = graphStateRef.current;
    const time = state.clock.elapsedTime;

    const gravityStrength = 0.045;
    const repulsionStrength = 2200;
    const attractionStrength = 0.038;
    const damping = 0.82; // Perfectly balanced 0.76 to 0.88 damping factor!

    // Orbit coordinates updated in real-time inside Personal Universe
    if (currentWorld === 'me' && gState.nodes.length) {
      gState.nodes.forEach((node, idx) => {
        if (node.id !== 'central-me') {
          const orbitRadius = 45 + (idx % 5) * 20;
          // Inner orbits (closer to center) spin faster than outer ones!
          const orbitSpeed = (120 / orbitRadius) * 0.08 + (idx % 2) * 0.02;
          const currentAngle = (node.breathPhase || 0) + time * orbitSpeed;
          node.targetX = Math.cos(currentAngle) * orbitRadius;
          node.targetY = Math.sin(currentAngle) * orbitRadius;
          node.targetZ = Math.sin(time * 0.4 + idx) * 6;
        }
      });
    }

    // Smooth lerp targeting coordinates
    if (gState.transitionProgress < 1.0) {
      gState.transitionProgress += 0.04;
      gState.nodes.forEach(node => {
        node.x = (node.x || 0) + ((node.targetX || 0) - (node.x || 0)) * 0.12;
        node.y = (node.y || 0) + ((node.targetY || 0) - (node.y || 0)) * 0.12;
        node.z = (node.z || 0) + ((node.targetZ || 0) - (node.z || 0)) * 0.12;
      });
    }

    // Repulsion forces
    for (let i = 0; i < gState.nodes.length; i++) {
      const n1 = gState.nodes[i];
      for (let j = i + 1; j < gState.nodes.length; j++) {
        const n2 = gState.nodes[j];
        if (n1.id === 'central-me' || n2.id === 'central-me') continue;
        let dx = (n2.x || 0) - (n1.x || 0);
        let dy = (n2.y || 0) - (n1.y || 0);
        let dz = (n2.z || 0) - (n1.z || 0);
        if (!dx && !dy && !dz) { dx = 0.1; dy = 0.1; dz = 0.1; }
        const distSq = dx*dx + dy*dy + dz*dz;
        const dist = Math.sqrt(distSq);
        if (dist < 310) {
          const force = repulsionStrength / (distSq + 120);
          n1.vx = (n1.vx || 0) - (dx / dist) * force;
          n1.vy = (n1.vy || 0) - (dy / dist) * force;
          n1.vz = (n1.vz || 0) - (dz / dist) * force;
          n2.vx = (n2.vx || 0) + (dx / dist) * force;
          n2.vy = (n2.vy || 0) + (dy / dist) * force;
          n2.vz = (n2.vz || 0) + (dz / dist) * force;
        }
      }
    }

    // Spring attraction forces along links
    gState.links.forEach(link => {
      const src = gState.nodes.find(n => n.id === link.source);
      const tgt = gState.nodes.find(n => n.id === link.target);
      if (!src || !tgt) return;
      const dx = (tgt.x || 0) - (src.x || 0);
      const dy = (tgt.y || 0) - (src.y || 0);
      const dz = (tgt.z || 0) - (src.z || 0);
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (!dist) return;
      const stretch = dist - 145;
      const pull = stretch * attractionStrength * Math.log(link.resonanceWeight + 1);

      if (src.id !== 'central-me') {
        src.vx = (src.vx || 0) + (dx / dist) * pull;
        src.vy = (src.vy || 0) + (dy / dist) * pull;
        src.vz = (src.vz || 0) + (dz / dist) * pull;
      }
      if (tgt.id !== 'central-me') {
        tgt.vx = (tgt.vx || 0) - (dx / dist) * pull;
        tgt.vy = (tgt.vy || 0) - (dy / dist) * pull;
        tgt.vz = (tgt.vz || 0) - (dz / dist) * pull;
      }
    });

    // Update coordinates and decay velocities using high-damping
    gState.nodes.forEach((node, idx) => {
      if (node.id === 'central-me') {
        node.x = 0; node.y = 0; node.z = 0;
        node.vx = 0; node.vy = 0; node.vz = 0;
      } else {
        // Ascension Drift physics: if a node is currently ascending, direct it upwards continually!
        if (node.id === ascendingNodeId) {
          node.targetY += 1.2;
          node.targetZ += 0.6;
        }

        node.vx = (node.vx || 0) + ((node.targetX || 0) - (node.x || 0)) * gravityStrength;
        node.vy = (node.vy || 0) + ((node.targetY || 0) - (node.y || 0)) * gravityStrength;
        node.vz = (node.vz || 0) + ((node.targetZ || 0) - (node.z || 0)) * gravityStrength;

        node.x = (node.x || 0) + (node.vx || 0);
        node.y = (node.y || 0) + (node.vy || 0);
        node.z = (node.z || 0) + (node.vz || 0);

        node.vx = (node.vx || 0) * damping;
        node.vy = (node.vy || 0) * damping;
        node.vz = (node.vz || 0) * damping;

        // PURE LIVING WAVE SWAY: beautiful deterministic smooth swells of sine/cosine!
        const swellX = Math.sin(time * 1.1 + idx * 0.7) * 0.16;
        const swellY = Math.cos(time * 0.8 + idx * 0.4) * 0.16;
        const swellZ = Math.sin(time * 1.4 + idx * 0.9) * 0.1;

        node.x += swellX;
        node.y += swellY;
        node.z += swellZ;
      }
      const bp = (node.breathPhase || 0) + time * (node.breathSpeed || 0.4) * 0.03;
      node.currentRadius = (node.baseRadius || 10) * (1 + Math.sin(bp) * 0.08);
    });

    // Smooth camera target tracking to pan/fly to selected node
    if (selectedNodeId && controls) {
      const selNode = gState.nodes.find(n => n.id === selectedNodeId);
      if (selNode) {
        const tx = (selNode.x || 0) * SCALE;
        const ty = (selNode.y || 0) * SCALE;
        const tz = (selNode.z || 0) * SCALE;
        controls.target.x += (tx - controls.target.x) * 0.09;
        controls.target.y += (ty - controls.target.y) * 0.09;
        controls.target.z += (tz - controls.target.z) * 0.09;
      }
    }

    // Community Users Physics simulation (Charge-based)
    if (currentWorld === 'field' && fieldSubMode === 'people' && usersStateRef.current.length > 0) {
      const users = usersStateRef.current;
      for (let i = 0; i < users.length; i++) {
        const u1 = users[i];
        for (let j = i + 1; j < users.length; j++) {
          const u2 = users[j];
          let dx = u2.x - u1.x;
          let dy = u2.y - u1.y;
          let dz = u2.z - u1.z;
          if (!dx && !dy && !dz) { dx = 0.1; dy = 0.1; dz = 0.1; }
          const distSq = dx*dx + dy*dy + dz*dz;
          const dist = Math.sqrt(distSq);

          // Electrostatic charge logic: matching domains attract, different repaint
          const isSimilar = u1.dominantDomain === u2.dominantDomain;
          const force = isSimilar
            ? -12 / (distSq + 12)    // attract
            : 420 / (distSq + 30);   // repel

          u1.vx = (u1.vx || 0) - (dx / dist) * force;
          u1.vy = (u1.vy || 0) - (dy / dist) * force;
          u1.vz = (u1.vz || 0) - (dz / dist) * force;

          u2.vx = (u2.vx || 0) + (dx / dist) * force;
          u2.vy = (u2.vy || 0) + (dy / dist) * force;
          u2.vz = (u2.vz || 0) + (dz / dist) * force;
        }
      }

      // Update positions
      users.forEach((u, idx) => {
        // central gravitational pull so they don't disperse infinitely
        const d = Math.sqrt(u.x*u.x + u.y*u.y + u.z*u.z);
        if (d > 1) {
          u.vx -= (u.x / d) * 0.02;
          u.vy -= (u.y / d) * 0.02;
          u.vz -= (u.z / d) * 0.02;
        }

        u.x = (u.x || 0) + (u.vx || 0);
        u.y = (u.y || 0) + (u.vy || 0);
        u.z = (u.z || 0) + (u.vz || 0);

        u.vx *= 0.84;
        u.vy *= 0.84;
        u.vz *= 0.84;

        // micro wave sway
        u.x += Math.sin(time * 0.9 + idx * 0.4) * 0.06;
        u.y += Math.cos(time * 0.8 + idx * 0.7) * 0.06;
        u.z += Math.sin(time * 1.0 + idx * 0.3) * 0.04;
      });
    }
  });

  // Dynamic nodes filtering
  const getFilteredNodes = (): SomaticNode[] => {
    // If we are in PEOPLE view, do NOT render individual ideas cards on the 3D grid
    if (currentWorld === 'field' && fieldSubMode === 'people') {
      return [];
    }

    const gState = graphStateRef.current;
    let base = [...gState.nodes];

    // Ensure central-me representation is present in the Me world state
    if (currentWorld === 'me' && !base.find(n => n.id === 'central-me')) {
      base.unshift({
        id: 'central-me', nameRu: 'Я', nameEn: 'Me',
        type: 'concept', level: 'macro',
        domain: 'hybrid', world: 'me', status: 'rooted', resonances: 0,
        descriptionRu: 'Центр вашей личной вселенной',
        descriptionEn: 'The center of your personal universe',
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        targetX: 0, targetY: 0, targetZ: 0,
        baseRadius: 18, currentRadius: 18, breathPhase: 0, breathSpeed: 0.5
      } as any);
      gState.nodes = base;
    }

    const audioNodeIds = new Set(SAMPLE_AUDIO?.flatMap(a => a.timelineNodes.map(t => t.nodeId)) || []);

    // pre-evaluate Atlas nodes connected directly to field active nodes (so we show them at 0.25 opacity)
    const fieldConnectedAtlasIds = new Set<string>();
    if (currentWorld === 'field') {
      const fieldNodeIds = new Set(base.filter(n => n.world === 'field' || n.id === 'central-me').map(n => n.id));
      links.forEach(link => {
        if (fieldNodeIds.has(link.source) && !fieldNodeIds.has(link.target)) {
          fieldConnectedAtlasIds.add(link.target);
        }
        if (fieldNodeIds.has(link.target) && !fieldNodeIds.has(link.source)) {
          fieldConnectedAtlasIds.add(link.source);
        }
      });
    }

    return base.filter(n => {
      // 1. World matching
      if (currentWorld === 'atlas') {
        if (n.world !== 'atlas') return false;
      }
      if (currentWorld === 'field') {
        if (n.world !== 'field' && n.id !== 'central-me') {
          // Exception: Show connected background atlas nodes
          if (n.world === 'atlas' && fieldConnectedAtlasIds.has(n.id)) {
            return true;
          }
          return false;
        }
      }
      if (currentWorld === 'me') {
        if (n.id === 'central-me') return true;
        const isMine = n.addedBy === currentUserName;
        const isResonated = resonatedNodeIds?.has(n.id);
        const isCarried = carriedNodeIds?.has(n.id);
        if (!isMine && !isResonated && !isCarried) return false;
      }

      // 2. Visible checkboxes layers (visibleLayers)
      if (visibleLayers) {
        if (!visibleLayers.atlas && n.world === 'atlas' && n.id !== 'central-me') return false;
        if (!visibleLayers.field && n.world === 'field' && n.id !== 'central-me') return false;
        if (visibleLayers.hot && n.resonances < 50 && n.id !== 'central-me') return false;
        if (visibleLayers.withAudio && !audioNodeIds.has(n.id) && n.id !== 'central-me') return false;
      }

      // 3. Fallback hot filter button
      if (isFilterHot && n.resonances < 50 && n.id !== 'central-me') return false;

      return true;
    });
  };

  const filteredNodes = getFilteredNodes();
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter links active in current perspective
  const activeLinks = links.filter(link => {
    return filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target);
  });

  return (
    <>
      <Stars radius={110} depth={55} count={1650} factor={4} fade speed={1.2} />
      <FloatingSparkles />

      <ambientLight intensity={0.4} />
      <pointLight position={[15, 15, 15]} intensity={2.2} color="#ccddff" />
      <pointLight position={[-15, -8, -15]} intensity={1.7} color="#9977ee" />
      <pointLight position={[8, -10, 8]} intensity={1.2} color="#7755aa" />

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        zoomSpeed={0.8}
        panSpeed={0.7}
        rotateSpeed={0.5}
        minDistance={3}
        maxDistance={75}
        makeDefault
        autoRotate={vibeMode === 'cinematic'}
        autoRotateSpeed={0.4}
        onChange={(e: any) => {
          if (e?.target?.object) {
            setCamDist(e.target.object.position.length());
          }
        }}
      />

      {/* Render Curved Mycelial links */}
      {activeLinks.map(link => {
        const src = filteredNodes.find(n => n.id === link.source);
        const tgt = filteredNodes.find(n => n.id === link.target);
        if (!src || !tgt) return null;
        const isActive = selectedNodeId === link.source || selectedNodeId === link.target;

        // Hide link in FAR LOD modes to prevent spider-web cluttering
        if (src.level === 'micro' && camDist > 24) return null;
        if (tgt.level === 'micro' && camDist > 24) return null;
        if (src.level === 'meso' && camDist > 38) return null;
        if (tgt.level === 'meso' && camDist > 38) return null;

        // Liquid Chaos Field style: all links are colored blue-green / teal in Field world!
        let color = currentWorld === 'field' ? '#14B8A6' : (DOMAIN_COLORS[src.domain] || '#ffffff');
        if (vibeMode === 'mono') {
          color = '#555A64';
        }

        return (
          <MyceliumEdge
            key={link.id}
            source={src}
            target={tgt}
            color={color}
            activity={link.activity}
            isActive={isActive}
            linkType={link.type}
          />
        );
      })}

      {/* Golden Comparative Bridges */}
      {overlayUser && <GoldenOverlayBridges nodes={filteredNodes} SCALE={SCALE} />}

      {/* Hub ring pulses for high-resonance nodes */}
      {filteredNodes
        .filter(n => n.resonances > 25 || selectedNodeId === n.id)
        .sort((a, b) => b.resonances - a.resonances)
        .slice(0, 8)
        .map(n => (
          <HubRingPulse
            key={`ring-${n.id}`}
            x={(n.x || 0) * SCALE}
            y={(n.y || 0) * SCALE}
            z={(n.z || 0) * SCALE}
            color={DOMAIN_COLORS[n.domain] || '#ffffff'}
            isSelected={selectedNodeId === n.id}
          />
        ))
      }

      {/* Somatic nodes representation */}
      {filteredNodes.map(node => {
        // Field World visual distinction: all non-Me nodes are colored light teal/blue-green!
        let color = node.id === 'central-me'
          ? '#DFB757'
          : currentWorld === 'field'
            ? '#14B8A6'
            : (DOMAIN_COLORS[node.domain] || '#ffffff');

        if (vibeMode === 'mono') {
          color = node.id === 'central-me' ? '#DFB757' : (node.level === 'macro' ? '#E5E7EB' : node.level === 'meso' ? '#9CA3AF' : '#4B5563');
        }

        return (
          <InteractiveSomaticSphere
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            isHovered={hoveredId === node.id}
            isActiveAudio={activeAudioNodeId === node.id}
            color={color}
            onClick={(n) => {
              onNodeSelect(n);
              playNodeTone(n.domain, 0.18);
              const SCALE = 0.045;
              setRipples(prev => [
                ...prev.slice(-4),
                { id: `${n.id}-${Date.now()}`, x: (n.x||0)*SCALE, y: (n.y||0)*SCALE, z: (n.z||0)*SCALE, color: DOMAIN_COLORS[n.domain] || '#ffffff' }
              ]);
            }}
            onLongSelect={onLongPressNode}
            currentWorld={currentWorld}
            overlayUser={overlayUser}
            selectedEpoch={selectedEpoch}
            ascendingNodeId={ascendingNodeId}
            onDragStart={handleDragStart}
          />
        );
      })}

      {/* Render 3D User Stars when in PEOPLE submode */}
      {currentWorld === 'field' && fieldSubMode === 'people' && usersStateRef.current.map((user, idx) => {
        const size = Math.max(0.6, Math.min(2.0, (user.reputation / 100) * 1.5)) * SCALE * 13;
        const finalColor = user.id === 'user-me' ? '#DFB757' : (DOMAIN_COLORS[user.dominantDomain] || '#ffffff');
        const uc = new THREE.Color(finalColor);
        const ux = (user.x || 0) * SCALE;
        const uy = (user.y || 0) * SCALE;
        const uz = (user.z || 0) * SCALE;
        const isUserHovered = hoveredId === user.id;

        return (
          <group key={user.id} onClick={(e) => { e.stopPropagation(); onUserSelect?.(user); }}>
            {/* Rapidly rotating crystal star */}
            <mesh
              position={[ux, uy, uz]}
              rotation={[idx + Date.now() * 0.001 * 0.4, Date.now() * 0.001 * 0.8, idx * 0.5]}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredId(user.id); }}
              onPointerOut={() => setHoveredId(null)}
            >
              <octahedronGeometry args={[size, 0]} />
              <meshStandardMaterial
                color={uc}
                emissive={uc}
                emissiveIntensity={isUserHovered ? 1.9 : 0.8}
                transparent
                opacity={0.92}
              />
            </mesh>
            {/* Holographic light sphere */}
            <mesh position={[ux, uy, uz]}>
              <sphereGeometry args={[size * 1.8, 12, 12]} />
              <meshStandardMaterial color={uc} transparent opacity={0.15} depthWrite={false} />
            </mesh>
            {/* Billboards */}
            <Billboard position={[ux, uy + size + 0.18, uz]}>
              <Text
                fontSize={0.14}
                color={finalColor}
                anchorX="center"
                anchorY="bottom"
                maxWidth={3.0}
              >
                {user.name}
              </Text>
              {isUserHovered && (
                <Text
                  fontSize={0.11}
                  color="#9CA3AF"
                  position={[0, -0.16, 0]}
                  anchorX="center"
                  anchorY="top"
                  maxWidth={4.0}
                >
                  {`♦ ${user.resonances.join(' • ')}`}
                </Text>
              )}
            </Billboard>
          </group>
        );
      })}

      {/* Responsive Text Billboards always looking at the viewport camera */}
      {filteredNodes.map(node => {
        const inEpoch = selectedEpoch === undefined || selectedEpoch === 0 || node.id === 'central-me' || getEpochNumberForNode(node) === selectedEpoch;
        if (!inEpoch) return null; // hide label if faded out of epoch focus

        // LOD rule for labels
        if (node.level === 'micro' && camDist > 20) return null;
        if (node.level === 'meso' && camDist > 34) return null;

        return (
          <NodeLabel
            key={`label-${node.id}`}
            node={node}
            language={language}
            SCALE={SCALE}
            isSelected={selectedNodeId === node.id}
            isActiveAudio={activeAudioNodeId === node.id}
          />
        );
      })}

      {/* Ripple effects on node click */}
      {ripples.map(rip => (
        <RippleEffect
          key={rip.id}
          x={rip.x} y={rip.y} z={rip.z}
          color={rip.color}
          onDone={() => setRipples(prev => prev.filter(r => r.id !== rip.id))}
        />
      ))}
    </>
  );
}

// ============================================================
// MAIN COMPONENT CONTAINER EXPORT (With control overlays)
// ============================================================
interface MyceliumGraphProps {
  nodes: SomaticNode[];
  links: SomaticLink[];
  currentWorld: World;
  language: 'ru' | 'en';
  onNodeSelect: (node: SomaticNode) => void;
  selectedNodeId: string | null;
  themeColor: string;
  overlayUser: string | null;
  onNodeResonate?: (nodeId: string) => void;
  resonatedNodeIds?: Set<string> | string[];
  carriedNodeIds?: Set<string> | string[];
  currentUserName?: string;
  activeAudioNodeId?: string | null;
  visibleLayers?: VisibleLayers;
  selectedEpoch?: number;
  vibeMode?: 'colour' | 'mono' | 'cinematic';
  ascendingNodeId?: string | null;
  communityUsers?: CommunityUser[];
  fieldSubMode?: 'ideas' | 'people';
  onUserSelect?: (user: CommunityUser) => void;
  onLongPressNode?: (node: SomaticNode, cursorX: number, cursorY: number) => void;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; language: 'ru' | 'en' },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; language: 'ru' | 'en' }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error in ThreeJS Canvas rendering: ", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B13] text-gray-300 p-8 text-center z-50 font-sans border border-white/5 rounded-2xl m-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full mb-4 text-rose-400 text-3xl">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            {this.props.language === 'ru' ? 'Ошибка загрузки графа' : 'Error Loading 3D Lattice'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mb-4 leading-relaxed font-mono">
            {this.state.error?.message || (this.props.language === 'ru' ? 'Сбой визуализации Three.js' : 'Three.js runtime visual crash')}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-indigo-600/35 hover:bg-indigo-600 border border-indigo-500 text-xs font-mono text-white rounded-lg cursor-pointer active:scale-95 transition-all"
          >
            {this.props.language === 'ru' ? 'Перезапустить рендер' : 'Restart Renderer'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function MyceliumGraph(props: MyceliumGraphProps) {
  const [isFilterHot, setIsFilterHot] = useState(false);

  // Safely normalize set collections supporting both arrays or sets
  const resSet = props.resonatedNodeIds instanceof Set
    ? props.resonatedNodeIds
    : new Set(props.resonatedNodeIds || []);

  const carrSet = props.carriedNodeIds instanceof Set
    ? props.carriedNodeIds
    : new Set(props.carriedNodeIds || []);

  return (
    <div className="relative w-full h-full select-none" id="webgl-canvas-box-container">
      <ErrorBoundary language={props.language}>
        <Canvas
          camera={{ position: [0, 0, 24], fov: 55, near: 0.1, far: 500 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false
          }}
          dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        >
          <color attach="background" args={['#050508']} />
          <fog attach="fog" args={['#050508', 35, 100]} />

          <GraphScene
            nodes={props.nodes}
            links={props.links}
            currentWorld={props.currentWorld}
            language={props.language}
            onNodeSelect={props.onNodeSelect}
            selectedNodeId={props.selectedNodeId}
            overlayUser={props.overlayUser}
            resonatedNodeIds={resSet}
            carriedNodeIds={carrSet}
            currentUserName={props.currentUserName}
            isFilterHot={isFilterHot}
            activeAudioNodeId={props.activeAudioNodeId || null}
            visibleLayers={props.visibleLayers}
            selectedEpoch={props.selectedEpoch}
            vibeMode={props.vibeMode}
            ascendingNodeId={props.ascendingNodeId}
            communityUsers={props.communityUsers}
            fieldSubMode={props.fieldSubMode}
            onUserSelect={props.onUserSelect}
            onLongPressNode={props.onLongPressNode}
          />
        </Canvas>
      </ErrorBoundary>

      {/* "HOT" resonances filter toggle bar */}
      <div className="absolute bottom-16 left-4 flex gap-1.5 z-20 bg-[#0C111D]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/5 shadow-xl">
        <button
          onClick={() => setIsFilterHot(!isFilterHot)}
          className={`p-2 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 px-3 text-xs font-medium cursor-pointer ${
            isFilterHot ? 'text-amber-400 bg-amber-500/15' : 'text-gray-400 bg-white/5'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{isFilterHot
            ? (props.language === 'ru' ? 'ГОРЯЧИЕ' : 'HOT')
            : (props.language === 'ru' ? 'ВСЕ' : 'ALL')
          }</span>
        </button>
      </div>

      {/* Navigation Help overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/20 pointer-events-none select-none text-center">
        {props.language === 'ru'
          ? 'Вращение: левый клик + drag • Зум: скролл / два пальца • Пан: правый клик + drag'
          : 'Rotate: left-click drag • Zoom: scroll / pinch • Pan: right-click drag'}
      </div>
    </div>
  );
}
