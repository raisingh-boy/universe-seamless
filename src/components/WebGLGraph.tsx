// ============================================================
// WebGLGraph — drop-in replacement for MyceliumGraph
// Uses the raw WebGL2 renderer (no Three.js / @react-three/fiber)
// ============================================================
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Flame } from 'lucide-react';
import { SomaticNode, SomaticLink, Domain, World, CommunityUser } from '../types';
import { GraphRenderer, DOMAIN_COLORS_HEX } from '../engine/renderer';
import { Camera } from '../engine/camera';
import { playNodeTone } from '../api/nodeSounds';
import { SAMPLE_AUDIO } from '../data/nodesData';
import { getEpochNumberForNode } from './MyceliumGraph';

// Re-export VisibleLayers from MyceliumGraph so consumers can import from either file
export type { VisibleLayers } from './MyceliumGraph';
import type { VisibleLayers } from './MyceliumGraph';

// ================================================================
// Props interface — identical to MyceliumGraphProps
// ================================================================
export interface MyceliumGraphProps {
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

// ================================================================
// Label data for the HTML overlay
// ================================================================
interface LabelEntry {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  opacity: number;
}

// ================================================================
// Filtering logic (ported from MyceliumGraph.getFilteredNodes)
// ================================================================
function filterNodes(
  nodes: SomaticNode[],
  links: SomaticLink[],
  currentWorld: World,
  currentUserName: string | undefined,
  resonatedNodeIds: Set<string>,
  carriedNodeIds: Set<string>,
  isFilterHot: boolean,
  visibleLayers?: VisibleLayers,
  selectedEpoch?: number,
  fieldSubMode?: 'ideas' | 'people'
): SomaticNode[] {
  if (currentWorld === 'field' && fieldSubMode === 'people') return [];

  // For field world: find atlas nodes directly connected to field nodes
  const fieldConnectedAtlasIds = new Set<string>();
  if (currentWorld === 'field') {
    const fieldNodeIds = new Set(nodes.filter(n => n.world === 'field' || n.id === 'central-me').map(n => n.id));
    links.forEach(link => {
      if (fieldNodeIds.has(link.source) && !fieldNodeIds.has(link.target)) fieldConnectedAtlasIds.add(link.target);
      if (fieldNodeIds.has(link.target) && !fieldNodeIds.has(link.source)) fieldConnectedAtlasIds.add(link.source);
    });
  }

  const audioNodeIds = new Set(SAMPLE_AUDIO?.flatMap(a => a.timelineNodes.map(t => t.nodeId)) || []);

  return nodes.filter(n => {
    // 1. World filter
    if (currentWorld === 'atlas') {
      if (n.world !== 'atlas') return false;
    }
    if (currentWorld === 'field') {
      if (n.world !== 'field' && n.id !== 'central-me') {
        if (n.world === 'atlas' && fieldConnectedAtlasIds.has(n.id)) return true;
        return false;
      }
    }
    if (currentWorld === 'me') {
      if (n.id === 'central-me') return true;
      const isMine = n.addedBy === currentUserName;
      const isResonated = resonatedNodeIds.has(n.id);
      const isCarried = carriedNodeIds.has(n.id);
      if (!isMine && !isResonated && !isCarried) return false;
    }

    // 2. Visible layer toggles
    if (visibleLayers) {
      if (!visibleLayers.atlas && n.world === 'atlas' && n.id !== 'central-me') return false;
      if (!visibleLayers.field && n.world === 'field' && n.id !== 'central-me') return false;
      if (visibleLayers.hot && n.resonances < 50 && n.id !== 'central-me') return false;
      if (visibleLayers.withAudio && !audioNodeIds.has(n.id) && n.id !== 'central-me') return false;
    }

    // 3. Hot filter button
    if (isFilterHot && n.resonances < 50 && n.id !== 'central-me') return false;

    return true;
  });
}

// ================================================================
// Main component
// ================================================================
export default function WebGLGraph(props: MyceliumGraphProps) {
  const {
    nodes,
    links,
    currentWorld,
    language,
    onNodeSelect,
    selectedNodeId,
    overlayUser,
    resonatedNodeIds,
    carriedNodeIds,
    currentUserName,
    activeAudioNodeId,
    visibleLayers,
    selectedEpoch,
    vibeMode,
    ascendingNodeId,
    communityUsers,
    fieldSubMode,
    onUserSelect,
    onLongPressNode,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GraphRenderer | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const cleanupCameraRef = useRef<(() => void) | null>(null);

  const [isFilterHot, setIsFilterHot] = useState(false);
  const [labels, setLabels] = useState<LabelEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Normalize set inputs
  const resSet = resonatedNodeIds instanceof Set
    ? resonatedNodeIds
    : new Set(resonatedNodeIds || []);
  const carrSet = carriedNodeIds instanceof Set
    ? carriedNodeIds
    : new Set(carriedNodeIds || []);

  // ---- Compute filtered node list ----
  const allNodes = React.useMemo(() => {
    // Ensure central-me exists in me world
    if (currentWorld === 'me' && !nodes.find(n => n.id === 'central-me')) {
      const central: SomaticNode = {
        id: 'central-me', nameRu: 'Я', nameEn: 'Me',
        type: 'concept', level: 'macro',
        domain: 'hybrid', world: 'me', status: 'rooted', resonances: 0,
        descriptionRu: 'Центр вашей личной вселенной',
        descriptionEn: 'The center of your personal universe',
      };
      return [central, ...nodes];
    }
    return nodes;
  }, [nodes, currentWorld]);

  const filteredNodes = React.useMemo(() => filterNodes(
    allNodes, links, currentWorld, currentUserName,
    resSet, carrSet, isFilterHot, visibleLayers, selectedEpoch, fieldSubMode
  ), [allNodes, links, currentWorld, currentUserName, resSet, carrSet,
      isFilterHot, visibleLayers, selectedEpoch, fieldSubMode]);

  const filteredNodeIds = React.useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const filteredLinks = React.useMemo(() => links.filter(
    l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target)
  ), [links, filteredNodeIds]);

  // ---- Initialize WebGL renderer on mount ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new GraphRenderer(canvas);
    const ok = renderer.init();
    if (!ok) {
      console.error('[WebGLGraph] Failed to initialize WebGL2 renderer');
      return;
    }
    rendererRef.current = renderer;

    const camera = new Camera(canvas);
    cameraRef.current = camera;
    const cleanupListeners = camera.attachListeners();
    cleanupCameraRef.current = cleanupListeners;

    // Initial size
    const container = containerRef.current;
    if (container) {
      const { clientWidth, clientHeight } = container;
      canvas.width = clientWidth * Math.min(window.devicePixelRatio, 2);
      canvas.height = clientHeight * Math.min(window.devicePixelRatio, 2);
      canvas.style.width = clientWidth + 'px';
      canvas.style.height = clientHeight + 'px';
      camera.updateMatrices(canvas.width / canvas.height);
    }

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = Math.min(window.devicePixelRatio, 2);
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        if (canvas.width > 0 && canvas.height > 0) {
          camera.updateMatrices(canvas.width / canvas.height);
        }
      }
    });
    if (container) resizeObserver.observe(container);

    // RAF loop
    let prevTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const time = (now - startTimeRef.current) / 1000;

      const cam = cameraRef.current;
      const ren = rendererRef.current;
      if (cam && ren && canvas.width > 0 && canvas.height > 0) {
        cam.updateMatrices(canvas.width / canvas.height);
        ren.tickPhysics(time, ascendingNodeId);
        ren.render(cam, time);
        // Update label overlay
        _updateLabels(ren, cam, canvas.width, canvas.height, time);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cleanupListeners();
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      cameraRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update graph data whenever props change ----
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setGraphData(filteredNodes, filteredLinks, currentWorld, selectedNodeId, filteredNodeIds);
  }, [filteredNodes, filteredLinks, currentWorld, selectedNodeId, filteredNodeIds]);

  // ---- Update selected state ----
  useEffect(() => {
    rendererRef.current?.setSelected(selectedNodeId);
  }, [selectedNodeId]);

  // ---- Label update function (called each frame) ----
  const _updateLabels = useCallback((
    renderer: GraphRenderer,
    camera: Camera,
    canvasW: number,
    canvasH: number,
    time: number
  ) => {
    if (!labelContainerRef.current) return;

    const newLabels: LabelEntry[] = [];
    // Access physics nodes via renderer - they're not directly exposed,
    // so we store a reference to filteredNodes and use camera projection
    for (const node of filteredNodes) {
      // LOD: hide micro labels when far, meso labels at medium distance
      const dist = camera.distance;
      if (node.level === 'micro' && dist > 20) continue;
      if (node.level === 'meso' && dist > 34) continue;
      if (node.status === 'seed' && node.id !== 'central-me') continue;

      // Epoch filter
      if (selectedEpoch && selectedEpoch !== 0 && node.id !== 'central-me') {
        if (getEpochNumberForNode(node) !== selectedEpoch) continue;
      }

      // Only show labels for selected, macro nodes, rooted nodes, and central-me
      const isSelected = selectedNodeId === node.id;
      const isActiveAudio = activeAudioNodeId === node.id;
      const showLabel = isSelected || isActiveAudio || node.level === 'macro' ||
                        node.status === 'rooted' || node.id === 'central-me';
      if (!showLabel) continue;

      // Use node physics coords if available (from renderer's internal state)
      // We approximate with the node's stored coords — renderer updates them each tick
      const nx = (node.x || 0) * 0.045;
      const ny = (node.y || 0) * 0.045;
      const nz = (node.z || 0) * 0.045;

      // Convert physical canvas coordinates to CSS coordinates
      const dpr = Math.min(window.devicePixelRatio, 2);
      const cssW = canvasW / dpr;
      const cssH = canvasH / dpr;

      const sp = camera.projectToScreen(nx, ny, nz, canvasW, canvasH);
      if (!sp) continue;
      const sx = sp[0] / dpr;
      const sy = sp[1] / dpr;

      // Cull labels outside viewport
      if (sx < -20 || sx > cssW + 20 || sy < -20 || sy > cssH + 20) continue;

      const label = language === 'ru' ? node.nameRu : node.nameEn;
      let color = '#D1D7E0';
      if (isSelected || isActiveAudio || node.status === 'rooted' || node.id === 'central-me') {
        color = '#DFB757';
      } else if (node.status === 'sprout') {
        color = '#6B7280';
      }

      const fontSize = (isSelected || isActiveAudio || node.status === 'rooted') ? 11 : 9;
      const lvl = node.level === 'macro' ? 1.0 : node.level === 'meso' ? 0.85 : 0.7;

      newLabels.push({
        id: node.id,
        text: label,
        x: sx,
        y: sy - 10,
        color,
        fontSize,
        opacity: lvl,
      });
    }

    setLabels(newLabels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, selectedNodeId, activeAudioNodeId, language, selectedEpoch]);

  // ---- Click handler ----
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!canvas || !renderer || !camera) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    const sx = (e.clientX - rect.left) * dpr;
    const sy = (e.clientY - rect.top) * dpr;

    const nodeId = renderer.hitTest(sx, sy, camera, canvas.width, canvas.height);
    if (nodeId) {
      const node = filteredNodes.find(n => n.id === nodeId);
      if (node) {
        onNodeSelect(node);
        playNodeTone(node.domain, 0.18);
        const SCALE = 0.045;
        renderer.addRipple(
          (node.x || 0) * SCALE,
          (node.y || 0) * SCALE,
          (node.z || 0) * SCALE,
          hexToRgbArr(DOMAIN_COLORS_HEX[node.domain as Domain] || '#ffffff')
        );
      }
    }
  }, [filteredNodes, onNodeSelect]);

  // ---- Long press handler ----
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerDownPos = useRef<{x:number,y:number} | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      if (!canvas || !renderer || !camera || !onLongPressNode) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * dpr;
      const sy = (e.clientY - rect.top) * dpr;
      const nodeId = renderer.hitTest(sx, sy, camera, canvas.width, canvas.height);
      if (nodeId) {
        const node = filteredNodes.find(n => n.id === nodeId);
        if (node) onLongPressNode(node, e.clientX, e.clientY);
      }
    }, 650);
  }, [filteredNodes, onLongPressNode]);

  const handlePointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Cancel long press on move
    if (pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.sqrt(dx*dx + dy*dy) > 8 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Hover detection
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!canvas || !renderer || !camera) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 2);
    const sx = (e.clientX - rect.left) * dpr;
    const sy = (e.clientY - rect.top) * dpr;
    const nodeId = renderer.hitTest(sx, sy, camera, canvas.width, canvas.height);
    setHoveredId(nodeId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      id="webgl-canvas-box-container"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      {/* Main WebGL canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          display: 'block',
          cursor: hoveredId ? 'pointer' : 'default',
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      />

      {/* HTML label overlay */}
      <div
        ref={labelContainerRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {labels.map(lbl => (
          <div
            key={lbl.id}
            style={{
              position: 'absolute',
              left: lbl.x,
              top: lbl.y,
              transform: 'translateX(-50%)',
              color: lbl.color,
              fontSize: lbl.fontSize + 'px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: lbl.id === 'central-me' ? 700 : 400,
              opacity: lbl.opacity,
              whiteSpace: 'nowrap',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              letterSpacing: '0.02em',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
            }}
          >
            {lbl.text}
          </div>
        ))}
      </div>

      {/* HOT filter toggle button */}
      <div className="absolute bottom-16 left-4 flex gap-1.5 z-20 bg-[#0C111D]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/5 shadow-xl">
        <button
          onClick={() => setIsFilterHot(f => !f)}
          className={`p-2 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 px-3 text-xs font-medium cursor-pointer ${
            isFilterHot ? 'text-amber-400 bg-amber-500/15' : 'text-gray-400 bg-white/5'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>
            {isFilterHot
              ? (language === 'ru' ? 'ГОРЯЧИЕ' : 'HOT')
              : (language === 'ru' ? 'ВСЕ' : 'ALL')
            }
          </span>
        </button>
      </div>

      {/* Navigation hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-white/20 pointer-events-none select-none text-center">
        {language === 'ru'
          ? 'Вращение: левый клик + drag • Зум: скролл / два пальца • Пан: правый клик + drag'
          : 'Rotate: left-click drag • Zoom: scroll / pinch • Pan: right-click drag'}
      </div>
    </div>
  );
}

// ---- Helper ----
function hexToRgbArr(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}
