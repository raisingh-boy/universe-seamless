import React, { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import rawData from "../data/somatic-complex.json";
import { runForceSimulation } from "../utils/forceLayout";

const COLORS: Record<string, string> = {
  root: "#ffffff", dance: "#e8e8ff", somatic: "#d4d4ff",
  psychology: "#c8c8f0", psychedelic: "#d0c0f0",
  performance: "#e0d8f0", intersection: "#d8e8ff",
  linguistics: "#d8d8e8", ai: "#e0e0f0",
};

const GROUP_NAMES: Record<string, string> = {
  root: "Root", dance: "Dance", somatic: "Somatics",
  psychology: "Psychology", psychedelic: "Psychedelic",
  performance: "Performance", intersection: "Intersection",
  linguistics: "Linguistics", ai: "AI",
};

const GROUP_NAMES_RU: Record<string, string> = {
  root: "Корень", dance: "Танец", somatic: "Соматика",
  psychology: "Психология", psychedelic: "Психоделика",
  performance: "Перформанс", intersection: "Пересечения",
  linguistics: "Лингвистика", ai: "ИИ",
};

const GROUP_SCALE: Record<string, number> = {
  root: 1, dance: 0.7, somatic: 0.7, psychology: 0.7,
  psychedelic: 0.7, performance: 0.7, intersection: 0.85,
};

// === SOUND — iOS-safe: AudioContext created SYNCHRONOUSLY in click handler ===
// Module-level refs to avoid React async state issues breaking iOS gesture chain
let _audioCtx: AudioContext | null = null;
let _audioMaster: GainNode | null = null;
let _audioStarted = false;
let _oscillators: AudioScheduledSourceNode[] = [];

async function buildAudioGraph(muted: boolean) {
  if (_audioStarted && _audioCtx) {
    if (_audioMaster) _audioMaster.gain.value = muted ? 0 : 0.15;
    return;
  }
  if (_audioStarted) return;

  // Step 1: Create AudioContext SYNCHRONOUSLY in gesture context
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  _audioCtx = ctx;

  // Step 2: Resume and WAIT — critical for iOS Safari
  // ctx.resume() returns a Promise, must await before starting oscillators
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      // One more try if still suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
    }
  }

  // Step 3: Build graph (context is now running)
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.15;
  master.connect(ctx.destination);
  _audioMaster = master;

  const allOscs: AudioScheduledSourceNode[] = [];

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine'; osc1.frequency.value = 55;
  const g1 = ctx.createGain(); g1.gain.value = 0.4;
  osc1.connect(g1); g1.connect(master); allOscs.push(osc1);

  const osc1b = ctx.createOscillator();
  osc1b.type = 'sine'; osc1b.frequency.value = 56.5;
  const g1b = ctx.createGain(); g1b.gain.value = 0.3;
  osc1b.connect(g1b); g1b.connect(master); allOscs.push(osc1b);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine'; osc2.frequency.value = 200;
  const g2 = ctx.createGain(); g2.gain.value = 0.2;
  osc2.connect(g2); g2.connect(master); allOscs.push(osc2);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 0.025;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.3;
  lfo.connect(lfoG); lfoG.connect(g1.gain); allOscs.push(lfo);

  const bufSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    ch[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI * 2) * Math.sin(i * 0.001);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const nGain = ctx.createGain(); nGain.gain.value = 0.12;
  const nFilter = ctx.createBiquadFilter();
  nFilter.type = 'lowpass'; nFilter.frequency.value = 600;
  noise.connect(nFilter); nFilter.connect(nGain); nGain.connect(master);
  allOscs.push(noise);

  const sub = ctx.createOscillator();
  sub.type = 'sine'; sub.frequency.value = 0.1;
  const subG = ctx.createGain(); subG.gain.value = 0.15;
  sub.connect(subG); subG.connect(g1.gain); allOscs.push(sub);

  // Step 4: Start all
  allOscs.forEach(o => { try { o.start(); } catch(e) { console.warn('Audio start:', e); } });

  _oscillators = allOscs;
  _audioStarted = true;
}

function toggleSoundMute() {
  if (_audioMaster) {
    const newVal = _audioMaster.gain.value > 0 ? 0 : 0.15;
    _audioMaster.gain.value = newVal;
    return newVal > 0;
  }
  return true;
}

// === SOUND PLAY BUTTON — creates AudioContext SYNCHRONOUSLY in click ===
function SoundPlayButton({ onActivate }: { onActivate: () => void }) {
  const handleTap = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    await buildAudioGraph(false);
    onActivate();
  }, [onActivate]);

  return (
    <div onClick={handleTap} onTouchStart={handleTap} style={{
      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      zIndex: 100, cursor: "pointer", userSelect: "none",
      fontFamily: "Inter, system-ui, sans-serif",
      background: "rgba(10,10,16,0.85)",
      border: "1px solid rgba(255,255,240,0.12)",
      borderRadius: 16, padding: "20px 32px",
      backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      transition: "all 0.3s",
    }}>
      <div style={{ fontSize: 36, filter: "drop-shadow(0 0 8px rgba(255,255,240,0.2))" }}>🎧</div>
      <div style={{
        color: "rgba(255,255,240,0.5)", fontSize: 11, letterSpacing: 1,
        textTransform: "uppercase", fontWeight: 300,
      }}>
        Tap for galactic sound
      </div>
    </div>
  );
}

// === INFO PANEL ===
function InfoPanel({ node, onClose, connections, isMobile, stories, lang, t }: {
  node: any; onClose: () => void; connections: string[]; isMobile: boolean;
  stories: any[]; lang: 'en' | 'ru'; t: (k: any) => string;
}) {
  const color = COLORS[node.group] || "#ffffff";
  const [tab, setTab] = useState<'overview' | 'connections' | 'stories'>('overview');

  // Filter stories where the node's label or connected labels match
  const nodeStories = stories.filter(s => {
    const sl = node.label.toLowerCase();
    const matchLabel = sl.includes(s.figure1?.toLowerCase()?.substring(0,10) || '') ||
      sl.includes(s.figure2?.toLowerCase()?.substring(0,10) || '') ||
      s.figure1?.toLowerCase().includes(sl) ||
      s.figure2?.toLowerCase().includes(sl) ||
      s.title?.toLowerCase().includes(sl);
    const matchSphere = s.spheres?.some((sp: string) => {
      const gn = (GROUP_NAMES[node.group] || node.group).toLowerCase();
      return sp.toLowerCase().includes(gn) || gn.includes(sp.toLowerCase());
    });
    return matchLabel || matchSphere;
  });

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      background: "rgba(10,10,16,0.92)",
      border: `1px solid ${color}44`,
      borderRadius: 14,
      padding: isMobile ? "12px" : "18px 22px",
      minWidth: isMobile ? 200 : 280,
      maxWidth: isMobile ? '90vw' : 340,
      fontFamily: "Inter, system-ui, sans-serif",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      boxShadow: `0 0 60px rgba(0,0,0,0.9), 0 0 30px ${color}15`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ color: "rgba(255,255,240,0.9)", fontSize: isMobile ? 11 : 13, fontWeight: 600, letterSpacing: 0.5 }}>
            {node.label}
          </div>
          <div style={{ color: `${color}aa`, fontSize: isMobile ? 9 : 10, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
            {GROUP_NAMES[node.group] || node.group}
            {node.years ? <span style={{ opacity: 0.5, marginLeft: 8 }}>{node.years}</span> : null}
          </div>
        </div>
        <div onClick={onClose} style={{
          color: "rgba(255,255,240,0.3)", cursor: "pointer", fontSize: 20, lineHeight: 1,
          padding: "0 5px", userSelect: "none", borderRadius: 4,
          transition: "background 0.2s",
        }}>×</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid rgba(255,255,240,0.06)" }}>
        {(['overview', 'connections', 'stories'] as const).map(tabName => (
          <div key={tabName} onClick={() => setTab(tabName)} style={{
            cursor: "pointer", padding: "5px 12px",
            color: tab === tabName ? "rgba(255,255,240,0.7)" : "rgba(255,255,240,0.25)",
            fontSize: isMobile ? 9 : 10, letterSpacing: 1.5, textTransform: "uppercase",
            borderBottom: tab === tabName ? `2px solid ${color}` : "2px solid transparent",
            transition: "all 0.2s",
          }}>
            {tabName === 'overview' ? t('overview') : tabName === 'connections' ? `${t('connections')} ${connections.length}` : `${t('stories')} ${nodeStories.length}`}
          </div>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && <>
        {(lang === 'ru' && node.descRu) ? <div style={{
          color: "rgba(255,255,240,0.55)", fontSize: isMobile ? 9 : 10, lineHeight: 1.5, marginBottom: 8,
        }}>{node.descRu}</div> : node.desc && <div style={{
          color: "rgba(255,255,240,0.55)", fontSize: isMobile ? 9 : 10, lineHeight: 1.5, marginBottom: 8,
        }}>{node.desc}</div>}

        {node.figures && Array.isArray(node.figures) && node.figures.length > 0 && <div style={{ marginBottom: 10 }}>
          <div style={{ color: `${color}88`, fontSize: isMobile ? 8 : 9, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>
            {t('keyFigures')}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {node.figures.map((f: string, i: number) => (
              <span key={i} style={{
                color: "rgba(255,255,240,0.5)", fontSize: isMobile ? 9 : 10,
                padding: "2px 8px", background: `${color}11`, borderRadius: 6, border: `1px solid ${color}22`,
              }}>{f}</span>
            ))}
          </div>
        </div>}

        {node.events && Array.isArray(node.events) && node.events.length > 0 && <div style={{ marginBottom: 6 }}>
          <div style={{ color: `${color}88`, fontSize: isMobile ? 8 : 9, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>
            {t('keyEvents')}
          </div>
          {node.events.slice(0, 4).map((ev: string, i: number) => (
            <div key={i} style={{
              color: "rgba(255,255,240,0.35)", fontSize: isMobile ? 8 : 8, lineHeight: 1.5,
              paddingLeft: 10, borderLeft: `1px solid ${color}22`, marginBottom: 4,
            }}>{ev}</div>
          ))}
        </div>}

        {node.influences && Array.isArray(node.influences) && node.influences.length > 0 && <div>
          <div style={{ color: `${color}88`, fontSize: isMobile ? 8 : 9, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>
            {t('influencedBy')}
          </div>
          <div style={{ color: "rgba(255,255,240,0.35)", fontSize: isMobile ? 8 : 8, lineHeight: 1.5 }}>
            {node.influences.join(" · ")}
          </div>
        </div>}
      </>}

      {/* Connections tab */}
      {tab === 'connections' && <>
        {connections.length === 0 ? <div style={{
          color: "rgba(255,255,240,0.2)", fontSize: isMobile ? 10 : 10, fontStyle: "italic",
        }}>{t('noConnections')}</div> :
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {connections.slice(0, 12).map((c, i) => {
            const connNode = rawData.nodes.find((n: any) => n.label === c);
            const cId = connNode?.id || '';
            const cColor = connNode ? COLORS[connNode.group as string] || "#fff" : "#fff";
            // Find relevant edge between selected and this connection
            const edge = rawData.edges.find((e: any) =>
              (e.source === node.id && e.target === cId) ||
              (e.source === cId && e.target === node.id)
            );
            return (
              <div key={i} style={{
                display: "flex", flexDirection: "column", gap: 2, padding: "5px 0",
                borderBottom: "1px solid rgba(255,255,240,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: cColor, flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,240,0.45)", fontWeight: 400, fontSize: isMobile ? 8 : 9 }}>
                    {c}
                  </span>
                  {connNode && connNode.years && <span style={{
                    color: "rgba(255,255,240,0.15)", fontSize: isMobile ? 8 : 9, marginLeft: "auto",
                  }}>{connNode.years}</span>}
                </div>
                {edge?.desc && <div style={{
                  color: "rgba(255,255,240,0.2)", fontSize: isMobile ? 8 : 8,
                  lineHeight: 1.4, paddingLeft: 11, fontStyle: "italic",
                }}>{(lang === 'ru' && (edge as any).descRu) ? (edge as any).descRu : edge.desc}</div>}
              </div>
            );
          })}
          {connections.length > 12 &&
            <div style={{ color: "rgba(255,255,240,0.15)", fontSize: isMobile ? 8 : 9, textAlign: "center", marginTop: 4 }}>
              +{connections.length - 12} {t('moreConnections')}
            </div>}
        </div>}
      </>}

      {/* Stories tab */}
      {tab === 'stories' && <>
        {nodeStories.length === 0 ? <div style={{
          color: "rgba(255,255,240,0.2)", fontSize: isMobile ? 10 : 10, fontStyle: "italic",
        }}>{t('noStories')}</div> :
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {nodeStories.slice(0, 10).map((s: any, i: number) => (
            <div key={i} style={{
              background: "rgba(255,255,240,0.03)", borderRadius: 8, padding: "8px 10px",
              borderLeft: `2px solid ${color}44`,
            }}>
              <div style={{ color: "rgba(255,255,240,0.6)", fontSize: isMobile ? 8 : 9, fontWeight: 500, marginBottom: 3 }}>
                {s.title || 'Untitled'}
              </div>
              <div style={{ color: "rgba(255,255,240,0.3)", fontSize: isMobile ? 8 : 9, marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,240,0.5)" }}>{s.figure1}</span>
                <span style={{ margin: "0 4px", opacity: 0.3 }}>→</span>
                <span style={{ color: "rgba(255,255,240,0.5)" }}>{s.figure2}</span>
                {s.year && <span style={{ opacity: 0.3, marginLeft: 6 }}>({s.year})</span>}
              </div>
              <div style={{ color: "rgba(255,255,240,0.3)", fontSize: isMobile ? 8 : 9, lineHeight: 1.5 }}>
                {(lang === 'ru' && s.summaryRu) ? s.summaryRu : s.summary || ''}
              </div>
              {s.context && <div style={{
                color: "rgba(255,255,240,0.15)", fontSize: isMobile ? 7 : 8,
                lineHeight: 1.4, marginTop: 4, padding: "4px 6px",
                background: "rgba(255,255,240,0.02)", borderRadius: 4,
                borderLeft: `1px solid ${color}22`, fontStyle: "italic",
              }}>{(lang === 'ru' && s.contextRu) ? s.contextRu : s.context}</div>}
              {s.spheres && s.spheres.length > 0 && <div style={{
                display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4,
              }}>
                {s.spheres.map((sp: string, j: number) => (
                  <span key={j} style={{
                    color: "rgba(255,255,240,0.15)", fontSize: isMobile ? 7 : 8,
                    background: "rgba(255,255,240,0.04)", borderRadius: 3, padding: "1px 5px",
                  }}>{sp}</span>
                ))}
              </div>}
            </div>
          ))}
          {nodeStories.length > 10 && <div style={{
            color: "rgba(255,255,240,0.15)", fontSize: isMobile ? 8 : 9, textAlign: "center",
          }}>+{nodeStories.length - 10} {t('moreStories')}</div>}
        </div>}
      </>}
    </div>
  );
}

// === NODE ===
function EntryNode({ data, color, onSelect, isSelected, isMobile }: {
  data: any; color: string; onSelect: () => void; isSelected: boolean; isMobile: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const [started] = useState(() => Date.now());

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const age = (Date.now() - started) / 1000;
    const entry = Math.min(age * 0.5, 1);
    const ease = 1 - Math.pow(1 - entry, 3);

    if (!groupRef.current || !meshRef.current || !glowRef.current) return;

    const idx = data.id.charCodeAt(0);
    const stagger = Date.now() - started - idx * 15;
    const s = Math.max(0, Math.min(stagger * 0.005, 1));
    const se = 1 - Math.pow(1 - s, 3);

    groupRef.current.position.lerp(
      { x: data.x * se, y: data.y * se, z: data.z * se } as any, 0.08
    );

    // Bob disabled — was causing edges to disconnect from animated nodes
    // const bobY = Math.sin(t * 0.25 + idx) * 0.15;
    // const bobX = Math.cos(t * 0.18 + idx * 0.6) * 0.08;
    // groupRef.current.position.x += bobX * entry;
    // groupRef.current.position.y += bobY * entry;

    const pulse = 1 + Math.sin(t * 0.5 + idx * 0.7) * (isSelected ? 0.25 : 0.12);
    meshRef.current.scale.setScalar(pulse * se * (isSelected ? 1.3 : 1));
    glowRef.current.scale.setScalar((1 + Math.sin(t * 0.35 + idx) * 0.3) * entry * (isSelected ? 1.5 : 1));

    if (glowRef.current.material) {
      (glowRef.current.material as THREE.Material).opacity = (isSelected ? 0.2 : 0.08) * entry;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[data.r * 3, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[data.r, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 0.8 : 0.5} />
      </mesh>
      {!isSelected && <Html position={[0, -data.r - 0.6, 0]} center style={{ pointerEvents: "none" }}>
        <span style={{
          color: `rgba(255,255,240,0.7)`,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: data.r > 0.5 ? (isMobile ? 10 : 16) : (isMobile ? 8 : 12),
          fontWeight: data.r > 0.5 ? 600 : 400,
          letterSpacing: 0.8,
          textShadow: "0 0 8px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}>{data.label}</span>
      </Html>}
    </group>
  );
}

// === EDGE ===
function ConnectionLine({ from, to, selected, srcColor }: {
  from: any; to: any; selected: string | null; srcColor: string;
}) {
  const ref = useRef<any>(null!);
  const particleRef = useRef<any>(null!);
  const isConnected = selected && (selected === from.id || selected === to.id);
  const c = new THREE.Color(isConnected ? srcColor : "#ffffff");

  // Curved bezier points
  const { points, curve } = useMemo(() => {
    const sx = from.x || 0, sy = from.y || 0, sz = from.z || 0;
    const tx = to.x || 0, ty = to.y || 0, tz = to.z || 0;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    const offset = Math.min(dist * 0.25, 3);
    const midX = (sx + tx) / 2 + (dy / (dist || 1)) * offset;
    const midY = (sy + ty) / 2 - (dx / (dist || 1)) * offset;
    const midZ = (sz + tz) / 2 + Math.min(Math.abs(dz) * 0.2, 2);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx, sy, sz),
      new THREE.Vector3(midX, midY, midZ),
      new THREE.Vector3(tx, ty, tz)
    );
    return { points: curve.getPoints(30), curve };
  }, [from.x, from.y, from.z, to.x, to.y, to.z]);

  const positions = useMemo(
    () => new Float32Array(points.flatMap((p: any) => [p.x, p.y, p.z])),
    [points]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Edge breathing
    if (ref.current?.material) {
      const breath = 0.12 + Math.sin(t * 0.3 + from.x * 0.5) * 0.06;
      const targetOpacity = isConnected ? (0.5 + Math.sin(t * 0.6) * 0.2) : breath;
      (ref.current.material as THREE.Material).opacity = Math.max(0.05, Math.min(0.75, targetOpacity));
    }
    // Particle dot flowing along the curve
    if (particleRef.current?.position) {
      const progress = (t * 0.06 + from.x * 0.01) % 1;
      const p = curve.getPoint(progress);
      particleRef.current.position.copy(p);
      (particleRef.current.material as THREE.Material).opacity = isConnected ? 0.8 : 0.2;
    }
  });

  return (
    <group>
      <line ref={ref}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={c}
          transparent
          opacity={0.12}
          depthWrite={false}
          linewidth={isConnected ? 2 : 1}
        />
      </line>
      {/* Flowing particle dot */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshBasicMaterial color={c} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// === STARS ===
function Stars() {
  const count = 3000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) p[i] = (Math.random() - 0.5) * 200;
    return p;
  }, []);
  const ref = useRef<any>(null!);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.005;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.15} color="#ffffff" transparent opacity={0.25} />
    </points>
  );
}

// === CAMERA CONTROLLER ===
let orbitRef: any = null;
function CameraController({ isMobile }: { isMobile: boolean }) {
  const ref = useRef<any>(null!);
  useEffect(() => { orbitRef = ref.current; }, []);
  return (
    <OrbitControls
      ref={ref}
      enablePan={true}
      enableZoom={true}
      maxDistance={isMobile ? 100 : 120}
      minDistance={isMobile ? 0.8 : 0.3}
      autoRotate={false}
      zoomSpeed={isMobile ? 1.0 : 1.5}
    />
  );
}

// === ZOOM CONTROLS ===
function ZoomControls({ isMobile }: { isMobile: boolean }) {
  const zoom = useCallback((dir: number) => {
    if (orbitRef) {
      orbitRef.dollyIn(dir > 0 ? 0.6 : 1.4);
      orbitRef.update();
    }
  }, []);

  const reset = useCallback(() => {
    if (orbitRef) {
      orbitRef.object.position.set(0, 0.5, isMobile ? 12 : 7);
      orbitRef.target.set(0, 0, 0);
      orbitRef.update();
    }
  }, [isMobile]);

  const size = isMobile ? 32 : 36;
  return (
    <div style={{
      position: "absolute", bottom: isMobile ? 60 : 80, right: 16, zIndex: 10,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <button onClick={() => zoom(1)} style={{
        width: size, height: size, borderRadius: "50%", border: "1px solid rgba(255,255,240,0.15)",
        background: "rgba(10,10,16,0.7)", color: "rgba(255,255,240,0.7)",
        cursor: "pointer", fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center",
        justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        transition: "all 0.2s",
      }}>+</button>
      <button onClick={() => zoom(-1)} style={{
        width: size, height: size, borderRadius: "50%", border: "1px solid rgba(255,255,240,0.15)",
        background: "rgba(10,10,16,0.7)", color: "rgba(255,255,240,0.7)",
        cursor: "pointer", fontSize: isMobile ? 14 : 16, display: "flex", alignItems: "center",
        justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        transition: "all 0.2s",
      }}>−</button>
      <button onClick={reset} style={{
        width: size, height: size, borderRadius: "50%", border: "1px solid rgba(255,255,240,0.12)",
        background: "rgba(10,10,16,0.6)", color: "rgba(255,255,240,0.4)",
        cursor: "pointer", fontSize: isMobile ? 11 : 12, display: "flex", alignItems: "center",
        justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        transition: "all 0.2s", marginTop: 4,
      }}>⊙</button>
    </div>
  );
}

// === GRAVITY CONTROLS ===
// === SOUND TOGGLE — uses module-level refs directly ===
function SoundToggle({ visible }: { visible: boolean }) {
  const [mutedUI, setMutedUI] = useState(true);

  if (!visible) return null;

  return (
    <button onClick={(e) => {
      e.stopPropagation();
      const newUnmuted = toggleSoundMute();
      setMutedUI(!newUnmuted);
    }} style={{
      position: "absolute", top: 16, right: 16, zIndex: 10,
      width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,240,0.1)",
      background: "rgba(10,10,16,0.4)", color: "rgba(255,255,240,0.5)",
      cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center",
      justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    }}>
      {mutedUI ? '🔇' : '🔊'}
    </button>
  );
}

// === MAIN SCENE ===
// Simple inline i18n
const LANG = {
  en: {
    overview: "Overview", keyFigures: "Key Figures", keyEvents: "Key Events",
    influencedBy: "Influenced By", connections: "Connections", stories: "Stories",
    noConnections: "No direct connections recorded yet.",
    noStories: "No intersection stories for this node yet.",
    moreConnections: "more", moreStories: "more stories",
    research: "Seamless Movement Research Project",
    subtitle: "September 2026 — Bali",
    connecting: "connecting",
  },
  ru: {
    overview: "Обзор", keyFigures: "Ключевые фигуры", keyEvents: "Ключевые события",
    influencedBy: "Под влиянием", connections: "Связи", stories: "Истории",
    noConnections: "Связи не записаны.",
    noStories: "Историй пересечений для этого узла нет.",
    moreConnections: "ещё", moreStories: "ещё историй",
    research: "Seamless Movement Research Project",
    subtitle: "Сентябрь 2026 — Бали",
    connecting: "связь",
  },
} as const;
type LangKey = keyof typeof LANG.en;

const Scene: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [audioShown, setAudioShown] = useState(false); // play button hidden?
  const [lang, setLang] = useState<'en' | 'ru'>('ru');
  const t = useCallback((k: LangKey) => LANG[lang][k], [lang]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const raw = rawData as any;

  const layout = useMemo(() => {
    return runForceSimulation(raw, 50, 50);
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map<string, any>();
    (layout as any[]).forEach((n: any) => {
      const orig = raw.nodes.find((on: any) => on.id === n.id);
      m.set(n.id, { ...n, group: orig?.group || '' });
    });
    return m;
  }, [layout]);

  // Original data nodes by id lookup (for full group/label)
  const rawNodeMap = useMemo(() => {
    const m = new Map<string, any>();
    raw.nodes.forEach((n: any) => m.set(n.id, n));
    return m;
  }, []);

  const selectedNode = useMemo(() => {
    if (!selected) return null;
    return nodeMap.get(selected) || null;
  }, [selected, nodeMap]);

  const selectedConnections = useMemo(() => {
    if (!selected) return [];
    const names: string[] = [];
    raw.edges.forEach((e: any) => {
      if (e.source === selected) {
        const n = nodeMap.get(e.target);
        if (n) names.push(n.label);
      }
      if (e.target === selected) {
        const n = nodeMap.get(e.source);
        if (n) names.push(n.label);
      }
    });
    return [...new Set(names)];
  }, [selected, nodeMap, raw.edges]);

  const handleSelect = useCallback((id: string) => {
    setSelected(prev => prev === id ? null : id);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelected(null);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {!_audioStarted && <SoundPlayButton onActivate={() => setAudioShown(true)} />}

      <Canvas
        camera={{ position: isMobile ? [0, 1, 12] : [0, 0.5, 7], fov: 50, near: 0.01, far: 150 }}
        style={{ width: "100%", height: "100%" }}
        onPointerMissed={handleDeselect}
      >
        <color attach="background" args={["#07070d"]} />
        <Stars />
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 10, 10]} intensity={2} color="#aabbff" />
        <pointLight position={[-10, -5, -10]} intensity={1.5} color="#8888cc" />
        <pointLight position={[10, -5, 5]} intensity={1.2} color="#6666bb" />

        {raw.edges.map((e: any, i: number) => {
          const sn = nodeMap.get(e.source);
          const tn = nodeMap.get(e.target);
          if (!sn || !tn) return null;
          const eColor = COLORS[tn.group || ''] || COLORS[sn.group || ''] || "#ffffff";
          return <ConnectionLine key={i} from={sn} to={tn} selected={selected} srcColor={eColor} />;
        })}

        {(layout as any[]).map((n: any) => {
          const color = COLORS[n.group] || "#ffffff";
          const s = GROUP_SCALE[n.group] || 0.7;
          return (
            <EntryNode
              key={n.id}
              data={{ ...n, r: 0.3 + 0.4 * s }}
              color={color}
              isSelected={selected === n.id}
              onSelect={() => handleSelect(n.id)}
              isMobile={isMobile}
            />
          );
        })}

        <CameraController isMobile={isMobile} />
      </Canvas>

      {/* UI Overlay */}
      {/* Branding — top center */}
      <div style={{
        position: "absolute", top: isMobile ? 10 : 16, left: 0, right: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{
          color: "rgba(255,255,240,0.25)", fontSize: isMobile ? 8 : 10,
          letterSpacing: isMobile ? 1.5 : 3,
          textTransform: "uppercase", fontWeight: 300,
        }}>
          {t('research')}
        </div>
        <div style={{
          color: "rgba(255,255,240,0.08)", fontSize: isMobile ? 7 : 8,
          letterSpacing: 1, marginTop: 2,
        }}>
          {t('subtitle')}
        </div>
      </div>

      <SoundToggle visible={_audioStarted} />
      <div onClick={() => setLang(l => l === 'en' ? 'ru' : 'en')} style={{
        position: "absolute", top: isMobile ? 54 : 54, right: 16,
        color: "rgba(200,210,255,0.6)", fontSize: isMobile ? 11 : 12,
        cursor: "pointer", zIndex: 10, fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600, padding: "3px 10px", borderRadius: 8, letterSpacing: 1.2,
        border: "1px solid rgba(200,210,255,0.12)",
        background: "rgba(200,210,255,0.04)",
        userSelect: "none", transition: "all 0.2s",
      }}>
        {lang === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
      </div>
      <ZoomControls isMobile={isMobile} />

      {/* Info Panel */}
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: isMobile ? 10 : 60,
          bottom: 'auto',
          left: isMobile ? 10 : 20,
          right: isMobile ? 10 : 'auto',
          maxWidth: isMobile ? 'calc(100vw - 20px)' : 360,
          pointerEvents: "auto", zIndex: 99999,
        }}>
          <InfoPanel
            node={selectedNode}
            connections={selectedConnections}
            onClose={handleDeselect}
            isMobile={isMobile}
            stories={raw.stories || []}
            lang={lang}
            t={t}
          />
        </div>
      )}

      {/* Legend (desktop only) */}
      {!isMobile && <div style={{
        position: "absolute", bottom: 20, left: 20, pointerEvents: "none", zIndex: 5,
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {Object.entries(GROUP_NAMES).filter(([k]) => k !== "root").map(([k, v]) => (
          <div key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 12, marginBottom: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[k] || "#fff" }} />
            <span style={{ color: "rgba(255,255,240,0.15)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>
              {v}
            </span>
          </div>
        ))}
      </div>}
    </div>
  );
};

export default Scene;
