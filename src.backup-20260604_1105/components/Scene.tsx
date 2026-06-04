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

const GROUP_ORDER = ["dance", "somatic", "psychology", "psychedelic", "performance", "intersection", "linguistics", "ai"];

// === SOUND — iOS-safe: AudioContext created SYNCHRONOUSLY in click handler ===
let _audioCtx: AudioContext | null = null;
let _audioMaster: GainNode | null = null;
let _audioStarted = false;
let _audioPhase = { value: 0 }; // shared module-level phase for visual sync
// Animation frame loop to update _audioPhase
if (typeof window !== 'undefined') {
  (function updatePhase() {
    _audioPhase.value = (Date.now() / 1000) % (Math.PI * 2);
    requestAnimationFrame(updatePhase);
  })();
}
function getAudioPhase() { return _audioPhase.value; }
let _oscillators: AudioScheduledSourceNode[] = [];

async function buildAudioGraph(muted: boolean) {
  if (_audioStarted && _audioCtx) {
    if (_audioMaster) _audioMaster.gain.value = muted ? 0 : 0.15;
    return;
  }
  if (_audioStarted) return;

  const AC = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AC();
  _audioCtx = ctx;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext resume failed:', e);
    }
  }

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
        }}>×</div>
      </div>

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

      {tab === 'connections' && <>
        {connections.length === 0 ? <div style={{
          color: "rgba(255,255,240,0.2)", fontSize: isMobile ? 10 : 10, fontStyle: "italic",
        }}>{t('noConnections')}</div> :
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {connections.slice(0, 12).map((c, i) => {
            const connNode = rawData.nodes.find((n: any) => n.label === c);
            const cId = connNode?.id || '';
            const cColor = connNode ? COLORS[connNode.group as string] || "#fff" : "#fff";
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
function EntryNode({ data, color, onSelect, isSelected, isMobile, highlight, hidden }: {
  data: any; color: string; onSelect: () => void; isSelected: boolean; isMobile: boolean;
  highlight?: boolean; hidden?: boolean;
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
    const phase = getAudioPhase();

    if (!groupRef.current || !meshRef.current || !glowRef.current) return;

    const idx = data.id.charCodeAt(0);
    const stagger = Date.now() - started - idx * 15;
    const s = Math.max(0, Math.min(stagger * 0.005, 1));
    const se = 1 - Math.pow(1 - s, 3);

    groupRef.current.position.lerp(
      { x: data.x * se, y: data.y * se, z: data.z * se } as any, 0.08
    );

    // Audio-synced pulse: combine natural pulse with audio phase
    const audioWave = 0.5 + Math.sin(phase * 3 + idx) * 0.5;
    const naturalPulse = Math.sin(t * 0.5 + idx * 0.7);
    const combinedPulse = naturalPulse * 0.5 + audioWave * 0.5;
    const pulseAmp = isSelected ? 0.35 : 0.18;
    const pulse = 1 + combinedPulse * pulseAmp;

    const degNorm = data._degreeNorm || 0;
    const hubBoost = 1 + degNorm * 0.4;  // hubs are bigger
    const scale = pulse * se * (isSelected ? 1.3 : 1) * hubBoost;
    meshRef.current.scale.setScalar(scale);

    // Glow follows audio + degree (hubs glow brighter)
    const degGlow = 1 + degNorm * 0.5;
    const glowAmp = 1 + combinedPulse * 0.4;
    glowRef.current.scale.setScalar(glowAmp * (1 + Math.sin(t * 0.35 + idx) * 0.3) * entry * (isSelected ? 1.5 : 1) * degGlow);

    if (glowRef.current.material) {
      (glowRef.current.material as THREE.Material).opacity = (isSelected ? 0.3 : 0.1) * entry * (0.6 + audioWave * 0.4);
    }

    // Node emissive pulse with audio
    if (meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const baseIntensity = isSelected ? 0.8 : 0.4;
      const degEmiss = 1 + (data._degreeNorm || 0) * 0.6;
      mat.emissiveIntensity = baseIntensity * (0.7 + audioWave * 0.3) * degEmiss;
    }

    // Search highlight + group filter
    const h = highlight !== false;
    const v = hidden !== true;
    if (meshRef.current.material) {
      (meshRef.current.material as THREE.MeshStandardMaterial).opacity = v ? (h ? 1 : 0.12) : 0;
      (meshRef.current.material as THREE.MeshStandardMaterial).transparent = !v || !h;
    }
    if (groupRef.current) {
      groupRef.current.visible = v;
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
      {(!isSelected && !hidden) && <Html position={[0, -data.r - 0.6, 0]} center style={{ pointerEvents: "none" }}>
        <span style={{
          color: highlight !== false ? `rgba(255,255,240,0.7)` : `rgba(255,255,240,0.08)`,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: data.r > 0.5 ? (isMobile ? 10 : (data._degreeNorm > 0.5 ? 18 : 16)) : (isMobile ? 8 : (data._degreeNorm > 0.5 ? 14 : 12)),
          fontWeight: (highlight !== false && data.r > 0.5) ? 600 : 400,
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
    const phase = getAudioPhase();
    if (ref.current?.material) {
      const breath = 0.12 + Math.sin(t * 0.3 + from.x * 0.5) * 0.06;
      // Audio-reactive pulse: sync breath with audio phase
      const audioSync = 0.5 + Math.sin(phase * 2 + from.x) * 0.5;
      const targetOpacity = isConnected
        ? (0.6 + Math.sin(t * 0.8) * 0.25 + audioSync * 0.15)
        : (breath + audioSync * 0.04);
      (ref.current.material as THREE.Material).opacity = Math.max(0.04, Math.min(0.85, targetOpacity));
      // Scale line brightness with music
      const color = new THREE.Color(srcColor);
      const bright = isConnected ? 1.5 : 1;
      color.multiplyScalar(0.6 + audioSync * 0.3 * bright);
      (ref.current.material as THREE.Material).color = color;
    }
    if (particleRef.current?.position) {
      const progress = (t * 0.06 + from.x * 0.01) % 1;
      const p = curve.getPoint(progress);
      particleRef.current.position.copy(p);
      if (particleRef.current.material) {
        const pBright = isConnected ? (0.6 + Math.sin(t * 1.2 + from.x) * 0.3) : (0.15 + Math.sin(t * 0.3) * 0.1);
        (particleRef.current.material as THREE.Material).opacity = Math.min(0.9, pBright);
        // Particle size pulse
        if (particleRef.current.scale) {
          const ps = 0.8 + Math.sin(phase * 1.5 + from.x) * 0.3;
          particleRef.current.scale.setScalar(ps);
        }
      }
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
      <mesh ref={particleRef}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshBasicMaterial color={c} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// === HUB RING PULSE ===
function HubRingPulse({ position, color, active }: { position: [number, number, number]; color: string; active: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const [phase] = useState(() => Math.random() * Math.PI * 2);
  
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime() + phase;
    // Expanding ring that fades
    const progress = (t * 0.08) % 1;
    const radius = 0.5 + progress * 3;
    const opacity = (1 - progress) * (active ? 0.15 : 0.04);
    
    ringRef.current.scale.setScalar(radius / 0.5);
    if (ringRef.current.material) {
      (ringRef.current.material as THREE.Material).opacity = opacity;
    }
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.5, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

// === HUB RINGS (decorative) ===
function HubRings({ nodeMap, selected }: { nodeMap: Map<string, any>; selected: string | null }) {
  // Find top 6 most connected nodes to show rings
  const topNodes = useMemo(() => {
    const entries = Array.from(nodeMap.entries());
    entries.sort((a, b) => (b[1]._degreeNorm || 0) - (a[1]._degreeNorm || 0));
    return entries.slice(0, 6);
  }, [nodeMap]);

  return (
    <group>
      {topNodes.map(([id, n]) => (
        <HubRingPulse
          key={id}
          position={[n.x, n.y, n.z]}
          color={COLORS[n.group] || "#ffffff"}
          active={selected === id}
        />
      ))}
    </group>
  );
}

// === 3D GROUP LABELS ===
function GroupLabels3D({ nodeMap, lang }: { nodeMap: Map<string, any>; lang: "en" | "ru" }) {
  // Calculate group centroids from node positions
  const groups = useMemo(() => {
    const centroids: Record<string, { x: number; y: number; z: number; count: number; color: string }> = {};
    nodeMap.forEach((n, id) => {
      const g = n.group || "unknown";
      if (!centroids[g]) centroids[g] = { x: 0, y: 0, z: 0, count: 0, color: COLORS[g] || "#fff" };
      centroids[g].x += n.x;
      centroids[g].y += n.y;
      centroids[g].z += n.z;
      centroids[g].count++;
    });
    return Object.entries(centroids)
      .filter(([_, c]) => c.count > 1)
      .map(([g, c]) => ({
        group: g,
        x: c.x / c.count,
        y: c.y / c.count,
        z: c.z / c.count,
        label: lang === "ru" ? GROUP_NAMES_RU[g] || g : GROUP_NAMES[g] || g,
        color: c.color,
        count: c.count,
      }));
  }, [nodeMap, lang]);

  return (
    <group>
      {groups.map((g) => (
        <Html key={g.group} position={[g.x, g.y + 4, g.z]} center style={{ pointerEvents: "none", opacity: 0.5 }}>
          <span style={{
            color: g.color,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 10,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            fontWeight: 200,
            textShadow: "0 0 20px rgba(0,0,0,0.9)",
            opacity: 0.4,
          }}>
            {g.label}
            <span style={{ opacity: 0.15, marginLeft: 6, fontSize: 8 }}>✦ {g.count}</span>
          </span>
        </Html>
      ))}
    </group>
  );
}

// === AMBIENT SPARKLES ===
function FloatingSparkles() {
  const count = 200;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      const range = 40;
      p[i] = (Math.random() - 0.5) * range;
    }
    return p;
  }, []);
  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) s[i] = 0.02 + Math.random() * 0.06;
    return s;
  }, []);
  const ref = useRef<any>(null!);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.003;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.001) * 0.02;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#aabbff" transparent opacity={0.15} sizeAttenuation blending={THREE.AdditiveBlending} />
    </points>
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
function CameraController({ isMobile, autoRotate }: { isMobile: boolean; autoRotate: boolean }) {
  const ref = useRef<any>(null!);
  useEffect(() => { orbitRef = ref.current; }, []);
  useEffect(() => {
    if (ref.current) {
      ref.current.autoRotate = autoRotate;
      ref.current.autoRotateSpeed = 0.6;
    }
  }, [autoRotate]);
  return (
    <OrbitControls
      ref={ref}
      enablePan={true}
      enableZoom={true}
      maxDistance={isMobile ? 100 : 120}
      minDistance={isMobile ? 0.8 : 0.3}
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
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

// === SOUND TOGGLE ===
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
    search: "Search nodes...", nodes: "nodes", edges: "connections",
    rotate: "⟳",
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
    search: "Поиск узлов...", nodes: "узлов", edges: "связей",
    rotate: "⟳",
  },
} as const;
type LangKey = keyof typeof LANG.en;

const Scene: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [audioShown, setAudioShown] = useState(false);
  const [lang, setLang] = useState<'en' | 'ru'>('ru');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroups, setActiveGroups] = useState<Set<string>>(() => new Set(GROUP_ORDER));
  const [autoRotate, setAutoRotate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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

  const toggleGroup = useCallback((group: string) => {
    setActiveGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      // Sync module-level for Canvas access
      return next;
    });
  }, []);

  // Sync module-level set
  useEffect(() => {
    const map = new Map<string, any>();
    activeGroups.forEach(g => {
      const n = raw.nodes.find((n: any) => n.group === g);
      if (n) map.set(g, n.group);
    });
  }, [activeGroups]);

  // Compute visible label counts
  const totalNodes = raw.nodes.length;
  const totalEdges = raw.edges.length;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      {!_audioStarted && <SoundPlayButton onActivate={() => setAudioShown(true)} />}

      <Canvas
        camera={{ position: isMobile ? [0, 1, 12] : [0, 0.5, 7], fov: 50, near: 0.01, far: 150 }}
        style={{ width: "100%", height: "100%" }}
        onPointerMissed={handleDeselect}
        fog={new THREE.FogExp2(0x07070d, 0.006)}
      >
        <color attach="background" args={["#07070d"]} />
        <Stars />
        <FloatingSparkles />
        <HubRings nodeMap={nodeMap} selected={selected} />
        <GroupLabels3D nodeMap={nodeMap} lang={lang} />
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
          const vis = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rawNodeMap.get(n.id)?.label?.toLowerCase().includes(searchQuery.toLowerCase());
          const hidden = !Array.from(activeGroups).some(g => g === n.group);
          const degBoost = n._degreeNorm || 0;
          const nodeR = 0.3 + 0.4 * s + degBoost * 0.6;
          return (
            <EntryNode
              key={n.id}
              data={{ ...n, r: nodeR }}
              color={color}
              isSelected={selected === n.id}
              onSelect={() => handleSelect(n.id)}
              isMobile={isMobile}
              highlight={vis}
              hidden={hidden}
            />
          );
        })}

        <CameraController isMobile={isMobile} autoRotate={autoRotate} />
      </Canvas>

      {/* Branding */}
      <div style={{
        position: "absolute", top: isMobile ? 10 : 12, left: 0, right: 0,
        textAlign: "center", pointerEvents: "none", zIndex: 5,
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{
          color: "rgba(255,255,240,0.25)", fontSize: isMobile ? 8 : 10,
          letterSpacing: isMobile ? 1.5 : 3, textTransform: "uppercase", fontWeight: 300,
        }}>
          {t('research')}
        </div>
        <div style={{
          color: "rgba(255,255,240,0.08)", fontSize: isMobile ? 7 : 8, letterSpacing: 1, marginTop: 2,
        }}>
          {t('subtitle')}
        </div>
      </div>

      {/* Sound toggle */}
      <SoundToggle visible={_audioStarted} />

      {/* Language toggle */}
      <div onClick={() => setLang(l => l === 'en' ? 'ru' : 'en')} style={{
        position: "absolute", top: 54, right: 16,
        color: "rgba(200,210,255,0.6)", fontSize: isMobile ? 11 : 12,
        cursor: "pointer", zIndex: 10, fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 600, padding: "3px 10px", borderRadius: 8, letterSpacing: 1.2,
        border: "1px solid rgba(200,210,255,0.12)",
        background: "rgba(200,210,255,0.04)",
        userSelect: "none", transition: "all 0.2s",
      }}>
        {lang === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN'}
      </div>

      {/* Auto-rotate toggle */}
      <div onClick={() => setAutoRotate(a => !a)} style={{
        position: "absolute", top: 54, right: 56,
        color: autoRotate ? "rgba(200,210,255,0.8)" : "rgba(255,255,240,0.3)",
        fontSize: isMobile ? 16 : 18, cursor: "pointer", zIndex: 10,
        padding: "2px 6px", borderRadius: 8,
        border: autoRotate ? "1px solid rgba(200,210,255,0.25)" : "1px solid rgba(255,255,240,0.08)",
        background: autoRotate ? "rgba(200,210,255,0.06)" : "transparent",
        userSelect: "none", transition: "all 0.2s", lineHeight: 1,
      }}>
        {t('rotate')}
      </div>

      {/* Search bar */}
      <div style={{
        position: "absolute", top: isMobile ? 90 : 12, left: "50%",
        transform: "translateX(-50%)", zIndex: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('search')}
          style={{
            background: "rgba(10,10,16,0.7)", border: searchQuery ? "1px solid rgba(200,210,255,0.25)" : "1px solid rgba(255,255,240,0.08)",
            borderRadius: 8, padding: isMobile ? "4px 8px" : "5px 12px",
            color: "rgba(255,255,240,0.6)", fontFamily: "Inter, system-ui, sans-serif",
            fontSize: isMobile ? 9 : 11, outline: "none", width: isMobile ? 140 : 180,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            transition: "all 0.2s",
          }}
        />
        <div style={{
          color: "rgba(255,255,240,0.12)", fontSize: isMobile ? 8 : 9,
          fontFamily: "Inter, system-ui, sans-serif", whiteSpace: "nowrap",
        }}>
          {raw.nodes.length} {t('nodes')} · {raw.edges.length} {t('edges')}
        </div>
      </div>

      {/* Filter toggle button */}
      <div onClick={() => setShowFilters(s => !s)} style={{
        position: "absolute", bottom: isMobile ? 120 : 150, right: 16,
        color: showFilters ? "rgba(200,210,255,0.6)" : "rgba(255,255,240,0.3)",
        fontSize: isMobile ? 10 : 11, cursor: "pointer", zIndex: 10,
        fontFamily: "Inter, system-ui, sans-serif", letterSpacing: 1.2,
        background: "rgba(10,10,16,0.6)", border: "1px solid rgba(255,255,240,0.1)",
        borderRadius: 6, padding: "4px 10px",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", userSelect: "none",
      }}>
        {showFilters ? (lang === 'ru' ? 'Группы ✕' : 'Groups ✕') : (lang === 'ru' ? 'Группы ☰' : 'Groups ☰')}
      </div>

      {/* Group filter panel */}
      {showFilters && <div style={{
        position: "absolute", bottom: isMobile ? 170 : 200, right: 16, zIndex: 10,
        background: "rgba(10,10,16,0.85)", border: "1px solid rgba(255,255,240,0.08)",
        borderRadius: 10, padding: "8px 10px",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {GROUP_ORDER.map(g => {
          const active = activeGroups.has(g);
          const color = COLORS[g] || "#ffffff";
          return (
            <div key={g} onClick={() => toggleGroup(g)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "3px 6px", cursor: "pointer", borderRadius: 4,
              transition: "all 0.15s", opacity: active ? 1 : 0.35,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: color,
                flexShrink: 0, border: active ? "none" : "1px solid rgba(255,255,240,0.2)",
              }} />
              <span style={{
                fontSize: isMobile ? 9 : 10, color: "rgba(255,255,240,0.5)",
                letterSpacing: 1,
              }}>
                {lang === 'ru' ? GROUP_NAMES_RU[g] || g : GROUP_NAMES[g] || g}
              </span>
            </div>
          );
        })}
      </div>}

      {/* Zoom */}
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

      {/* Legend (desktop only) — shown when group filter is closed */}
      {!isMobile && !showFilters && <div style={{
        position: "absolute", bottom: 20, left: 20, pointerEvents: "none", zIndex: 5,
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {GROUP_ORDER.map(k => (
          <div key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginRight: 12, marginBottom: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[k] || "#fff" }} />
            <span style={{ color: "rgba(255,255,240,0.15)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>
              {GROUP_NAMES[k]}
            </span>
          </div>
        ))}
      </div>}
    </div>
  );
};

export default Scene;
