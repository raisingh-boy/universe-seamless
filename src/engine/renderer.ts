// ============================================================
// WebGL2 Graph Renderer for Seamless Universe
// Raw WebGL2 — no Three.js, no external math libraries
// 7 draw passes, all scene geometry in typed arrays
// ============================================================

import { SomaticNode, SomaticLink, Domain, World } from '../types';
import { Camera } from './camera';
import * as SHADERS from './shaders';

// ---- Domain color constants (RGB 0-1, exported for React component use) ----
export const DOMAIN_COLORS_HEX: Record<Domain, string> = {
  body: '#E8A95C',
  science: '#5C9BE8',
  philosophy: '#9B5CE8',
  movement: '#5CE87A',
  cognition: '#EAEAEA',
  hybrid: '#E85C7A',
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export const DOMAIN_COLORS: Record<Domain, [number, number, number, number]> = {
  body:       [...hexToRgb('#E8A95C'), 1.0] as [number,number,number,number],
  science:    [...hexToRgb('#5C9BE8'), 1.0] as [number,number,number,number],
  philosophy: [...hexToRgb('#9B5CE8'), 1.0] as [number,number,number,number],
  movement:   [...hexToRgb('#5CE87A'), 1.0] as [number,number,number,number],
  cognition:  [...hexToRgb('#EAEAEA'), 1.0] as [number,number,number,number],
  hybrid:     [...hexToRgb('#E85C7A'), 1.0] as [number,number,number,number],
};

const EDGE_TYPE_COLORS: Record<string, [number,number,number,number]> = {
  historical:  [0.44, 0.49, 0.58, 1.0],
  conceptual:  [0.61, 0.36, 0.91, 1.0],
  practical:   [0.06, 0.72, 0.51, 1.0],
  resonance:   [1.00, 0.68, 0.00, 1.0],
  opposition:  [0.94, 0.27, 0.27, 1.0],
};

// ---- Physics + visual data for one node ----
export interface RenderNode {
  id: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  targetX: number; targetY: number; targetZ: number;
  color: [number,number,number,number];
  glowColor: [number,number,number,number];
  size: number;
  baseSize: number;
  phase: number;
  breathSpeed: number;
  type: number;
  isSelected: boolean;
  isHub: boolean;
  domain: string;
  level: string;
  world: string;
  resonances: number;
  id_hash: number;
  breathPhase: number;
}

export interface RenderEdge {
  sourceId: string;
  targetId: string;
  color: [number,number,number,number];
  activity: number;
  type: string;
  resonanceWeight: number;
}

// ---- Internal bezier sample ----
function bezierPoint(
  ax: number, ay: number, az: number,
  cx: number, cy: number, cz: number,
  bx: number, by: number, bz: number,
  t: number
): [number,number,number] {
  const mt = 1 - t;
  return [
    mt*mt*ax + 2*mt*t*cx + t*t*bx,
    mt*mt*ay + 2*mt*t*cy + t*t*by,
    mt*mt*az + 2*mt*t*cz + t*t*bz,
  ];
}

// ---- Shader compilation helper ----
function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[WebGLGraph] Shader compile error:', gl.getShaderInfoLog(shader));
    console.error('Source:', src.substring(0, 300));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function compileProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string, fragSrc: string
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[WebGLGraph] Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return prog;
}

// ---- Simple id hash ----
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ---- Particle speeds by edge type ----
const PARTICLE_SPEED: Record<string, number> = {
  resonance: 0.18,
  practical: 0.12,
  conceptual: 0.07,
  opposition: 0.22,
  historical: 0.04,
};

// ---- GAP buffer helpers ----
function createVAO(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  return gl.createVertexArray()!;
}
function createBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  return gl.createBuffer()!;
}

// ---- Uniform setters ----
function setUniform1f(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, v: number) {
  const loc = gl.getUniformLocation(prog, name);
  if (loc !== null) gl.uniform1f(loc, v);
}
function setUniformMat4(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, m: Float32Array) {
  const loc = gl.getUniformLocation(prog, name);
  if (loc !== null) gl.uniformMatrix4fv(loc, false, m);
}
function setUniform3fv(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, v: Float32Array | number[]) {
  const loc = gl.getUniformLocation(prog, name);
  if (loc !== null) gl.uniform3fv(loc, v);
}

// ===========================================================
//  GraphRenderer class
// ===========================================================
export class GraphRenderer {
  private gl!: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;

  // Shader programs
  private starProg!: WebGLProgram;
  private sparkleProg!: WebGLProgram;
  private glowProg!: WebGLProgram;
  private coreProg!: WebGLProgram;
  private edgeProg!: WebGLProgram;
  private particleProg!: WebGLProgram;
  private hubRingProg!: WebGLProgram;

  // Star static geometry
  private starVAO!: WebGLVertexArrayObject;
  private starPosBuf!: WebGLBuffer;
  private starSeedBuf!: WebGLBuffer;
  private starCount = 0;

  // Sparkle dynamic geometry
  private sparkleVAO!: WebGLVertexArrayObject;
  private sparklePosBufGL!: WebGLBuffer;
  private sparkleSeedBufGL!: WebGLBuffer;
  private sparklePosBuf!: Float32Array;
  private sparkleSeedBuf!: Float32Array;
  private sparkleVelBuf!: Float32Array;
  private sparkleCount = 200;

  // Glow dynamic geometry
  private glowVAO!: WebGLVertexArrayObject;
  private glowPosBufGL!: WebGLBuffer;
  private glowColorBufGL!: WebGLBuffer;
  private glowSizeBufGL!: WebGLBuffer;
  private glowPhaseBufGL!: WebGLBuffer;
  private glowSelectedBufGL!: WebGLBuffer;
  private glowPosBuf!: Float32Array;
  private glowColorBuf!: Float32Array;
  private glowSizeBuf!: Float32Array;
  private glowPhaseBuf!: Float32Array;
  private glowSelectedBuf!: Float32Array;

  // Core dynamic geometry
  private coreVAO!: WebGLVertexArrayObject;
  private corePosBufGL!: WebGLBuffer;
  private coreColorBufGL!: WebGLBuffer;
  private coreSizeBufGL!: WebGLBuffer;
  private corePhaseBufGL!: WebGLBuffer;
  private coreTypeBufGL!: WebGLBuffer;
  private coreSelectedBufGL!: WebGLBuffer;
  private corePosBuf!: Float32Array;
  private coreColorBuf!: Float32Array;
  private coreSizeBuf!: Float32Array;
  private corePhaseBuf!: Float32Array;
  private coreTypeBuf!: Float32Array;
  private coreSelectedBuf!: Float32Array;

  // Edge dynamic geometry
  private edgeVAO!: WebGLVertexArrayObject;
  private edgePosBufGL!: WebGLBuffer;
  private edgeColorBufGL!: WebGLBuffer;
  private edgeActiveBufGL!: WebGLBuffer;
  private edgePosBuf!: Float32Array;
  private edgeColorBuf!: Float32Array;
  private edgeActiveBuf!: Float32Array;
  private edgeVertCount = 0;

  // Particle dynamic geometry
  private particleVAO!: WebGLVertexArrayObject;
  private particlePosBufGL!: WebGLBuffer;
  private particleColorBufGL!: WebGLBuffer;
  private particlePhaseBufGL!: WebGLBuffer;
  private particlePosBuf!: Float32Array;
  private particleColorBuf!: Float32Array;
  private particlePhaseBuf!: Float32Array;
  private particleCount = 0;

  // Hub ring dynamic geometry
  private hubRingVAO!: WebGLVertexArrayObject;
  private hubRingBasePosBufGL!: WebGLBuffer;
  private hubRingAngleBufGL!: WebGLBuffer;
  private hubRingRadiusBufGL!: WebGLBuffer;
  private hubRingPhaseBufGL!: WebGLBuffer;
  private hubRingColorBufGL!: WebGLBuffer;
  private hubRingBasePosBuf!: Float32Array;
  private hubRingAngleBuf!: Float32Array;
  private hubRingRadiusBuf!: Float32Array;
  private hubRingPhaseBuf!: Float32Array;
  private hubRingColorBuf!: Float32Array;
  private hubRingVertCount = 0;

  // Physics state
  private physicsNodes: RenderNode[] = [];
  private physicsEdges: RenderEdge[] = [];
  private selectedNodeId: string | null = null;
  private currentWorld: World = 'atlas';

  // Particle travel state
  private particleProgress: Float32Array = new Float32Array(0);
  private particleSpeeds: Float32Array = new Float32Array(0);
  private particlePhaseArr: Float32Array = new Float32Array(0);

  // Bezier control points cache [src_hash, tgt_hash, cx, cy, cz]
  private bezierCache = new Map<string, [number,number,number]>();

  // Ripple effects
  private ripples: Array<{x:number,y:number,z:number,color:[number,number,number],startTime:number}> = [];

  // Max node/edge counts for pre-allocated buffers
  private maxNodes = 512;
  private maxEdgeVerts = 24000;
  private maxParticles = 2000;
  private maxHubRingVerts = 8 * 2 * 64 * 2; // 8 hubs * 2 rings * 64 segments * 2 verts per segment

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      console.error('[WebGLGraph] WebGL2 not supported');
      return false;
    }
    this.gl = gl;

    // Compile all shader programs
    const starProg = compileProgram(gl, SHADERS.STAR_VERT, SHADERS.STAR_FRAG);
    const sparkleProg = compileProgram(gl, SHADERS.SPARKLE_VERT, SHADERS.SPARKLE_FRAG);
    const glowProg = compileProgram(gl, SHADERS.GLOW_VERT, SHADERS.GLOW_FRAG);
    const coreProg = compileProgram(gl, SHADERS.CORE_VERT, SHADERS.CORE_FRAG);
    const edgeProg = compileProgram(gl, SHADERS.EDGE_VERT, SHADERS.EDGE_FRAG);
    const particleProg = compileProgram(gl, SHADERS.PARTICLE_VERT, SHADERS.PARTICLE_FRAG);
    const hubRingProg = compileProgram(gl, SHADERS.HUB_RING_COLOR_VERT, SHADERS.HUB_RING_COLOR_FRAG);

    if (!starProg || !sparkleProg || !glowProg || !coreProg || !edgeProg || !particleProg || !hubRingProg) {
      console.error('[WebGLGraph] One or more shaders failed to compile');
      return false;
    }

    this.starProg = starProg;
    this.sparkleProg = sparkleProg;
    this.glowProg = glowProg;
    this.coreProg = coreProg;
    this.edgeProg = edgeProg;
    this.particleProg = particleProg;
    this.hubRingProg = hubRingProg;

    gl.clearColor(0.02, 0.02, 0.04, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    this._initStarGeometry();
    this._initSparkleGeometry();
    this._initDynamicBuffers();

    return true;
  }

  private _initStarGeometry() {
    const gl = this.gl;
    const count = 2000;
    this.starCount = count;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 80 + Math.random() * 40;
      positions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
      seeds[i] = Math.random();
    }

    this.starVAO = createVAO(gl);
    gl.bindVertexArray(this.starVAO);

    this.starPosBuf = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.starProg, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    this.starSeedBuf = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starSeedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const seedLoc = gl.getAttribLocation(this.starProg, 'a_seed');
    gl.enableVertexAttribArray(seedLoc);
    gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private _initSparkleGeometry() {
    const gl = this.gl;
    const count = this.sparkleCount;
    this.sparklePosBuf = new Float32Array(count * 3);
    this.sparkleSeedBuf = new Float32Array(count);
    this.sparkleVelBuf = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 15 + Math.random() * 35;
      const u = Math.random(), v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      this.sparklePosBuf[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
      this.sparklePosBuf[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      this.sparklePosBuf[i*3+2] = r * Math.cos(phi);
      this.sparkleSeedBuf[i] = Math.random();
      this.sparkleVelBuf[i*3+0] = (Math.random() - 0.5) * 0.003;
      this.sparkleVelBuf[i*3+1] = (Math.random() - 0.5) * 0.003;
      this.sparkleVelBuf[i*3+2] = (Math.random() - 0.5) * 0.002;
    }

    this.sparkleVAO = createVAO(gl);
    gl.bindVertexArray(this.sparkleVAO);

    this.sparklePosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sparklePosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.sparklePosBuf, gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(this.sparkleProg, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    this.sparkleSeedBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkleSeedBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.sparkleSeedBuf, gl.STATIC_DRAW);
    const seedLoc = gl.getAttribLocation(this.sparkleProg, 'a_seed');
    gl.enableVertexAttribArray(seedLoc);
    gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private _initDynamicBuffers() {
    const gl = this.gl;
    const N = this.maxNodes;
    const E = this.maxEdgeVerts;
    const P = this.maxParticles;
    const H = this.maxHubRingVerts;

    // Allocate CPU arrays
    this.glowPosBuf     = new Float32Array(N * 3);
    this.glowColorBuf   = new Float32Array(N * 4);
    this.glowSizeBuf    = new Float32Array(N);
    this.glowPhaseBuf   = new Float32Array(N);
    this.glowSelectedBuf = new Float32Array(N);

    this.corePosBuf     = new Float32Array(N * 3);
    this.coreColorBuf   = new Float32Array(N * 4);
    this.coreSizeBuf    = new Float32Array(N);
    this.corePhaseBuf   = new Float32Array(N);
    this.coreTypeBuf    = new Float32Array(N);
    this.coreSelectedBuf = new Float32Array(N);

    this.edgePosBuf   = new Float32Array(E * 3);
    this.edgeColorBuf = new Float32Array(E * 4);
    this.edgeActiveBuf = new Float32Array(E);

    this.particlePosBuf   = new Float32Array(P * 3);
    this.particleColorBuf = new Float32Array(P * 4);
    this.particlePhaseBuf = new Float32Array(P);

    this.hubRingBasePosBuf = new Float32Array(H * 3);
    this.hubRingAngleBuf   = new Float32Array(H);
    this.hubRingRadiusBuf  = new Float32Array(H);
    this.hubRingPhaseBuf   = new Float32Array(H);
    this.hubRingColorBuf   = new Float32Array(H * 3);

    // ---- GLOW VAO ----
    this.glowVAO = createVAO(gl);
    gl.bindVertexArray(this.glowVAO);

    this.glowPosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowPosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowPosBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.glowProg, 'a_pos', 3);

    this.glowColorBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowColorBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowColorBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.glowProg, 'a_color', 4);

    this.glowSizeBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowSizeBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowSizeBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.glowProg, 'a_size', 1);

    this.glowPhaseBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowPhaseBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowPhaseBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.glowProg, 'a_phase', 1);

    this.glowSelectedBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowSelectedBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.glowSelectedBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.glowProg, 'a_selected', 1);

    gl.bindVertexArray(null);

    // ---- CORE VAO ----
    this.coreVAO = createVAO(gl);
    gl.bindVertexArray(this.coreVAO);

    this.corePosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corePosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.corePosBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_pos', 3);

    this.coreColorBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreColorBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.coreColorBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_color', 4);

    this.coreSizeBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreSizeBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.coreSizeBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_size', 1);

    this.corePhaseBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corePhaseBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.corePhaseBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_phase', 1);

    this.coreTypeBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreTypeBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.coreTypeBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_type', 1);

    this.coreSelectedBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreSelectedBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.coreSelectedBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.coreProg, 'a_selected', 1);

    gl.bindVertexArray(null);

    // ---- EDGE VAO ----
    this.edgeVAO = createVAO(gl);
    gl.bindVertexArray(this.edgeVAO);

    this.edgePosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.edgePosBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.edgeProg, 'a_pos', 3);

    this.edgeColorBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeColorBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.edgeColorBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.edgeProg, 'a_color', 4);

    this.edgeActiveBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeActiveBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.edgeActiveBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.edgeProg, 'a_active', 1);

    gl.bindVertexArray(null);

    // ---- PARTICLE VAO ----
    this.particleVAO = createVAO(gl);
    gl.bindVertexArray(this.particleVAO);

    this.particlePosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particlePosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.particlePosBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.particleProg, 'a_pos', 3);

    this.particleColorBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleColorBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.particleColorBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.particleProg, 'a_color', 4);

    this.particlePhaseBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particlePhaseBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.particlePhaseBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.particleProg, 'a_phase', 1);

    gl.bindVertexArray(null);

    // ---- HUB RING VAO ----
    this.hubRingVAO = createVAO(gl);
    gl.bindVertexArray(this.hubRingVAO);

    this.hubRingBasePosBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingBasePosBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.hubRingBasePosBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.hubRingProg, 'a_basePos', 3);

    this.hubRingAngleBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingAngleBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.hubRingAngleBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.hubRingProg, 'a_angle', 1);

    this.hubRingRadiusBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingRadiusBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.hubRingRadiusBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.hubRingProg, 'a_radius', 1);

    this.hubRingPhaseBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingPhaseBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.hubRingPhaseBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.hubRingProg, 'a_phase', 1);

    this.hubRingColorBufGL = createBuffer(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingColorBufGL);
    gl.bufferData(gl.ARRAY_BUFFER, this.hubRingColorBuf, gl.DYNAMIC_DRAW);
    this._attrib(gl, this.hubRingProg, 'a_color', 3);

    gl.bindVertexArray(null);
  }

  private _attrib(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, size: number) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
  }

  // ----------------------------------------------------------------
  //  setGraphData — initialize/update physics nodes from SomaticNode[]
  // ----------------------------------------------------------------
  setGraphData(
    nodes: SomaticNode[],
    links: SomaticLink[],
    world: World,
    selectedNodeId: string | null,
    visibleNodeIds: Set<string>
  ): void {
    this.selectedNodeId = selectedNodeId;
    this.currentWorld = world;

    // Pre-calc domain/level index for spiral layout
    const dlIdx: Record<string, number> = {};
    const dlCount: Record<string, number> = {};
    nodes.forEach(n => {
      const key = `${n.domain}-${n.level}`;
      dlIdx[n.id] = dlCount[key] || 0;
      dlCount[key] = (dlCount[key] || 0) + 1;
    });

    const existing = new Map(this.physicsNodes.map(n => [n.id, n]));

    this.physicsNodes = nodes.map((n, idx) => {
      const ex = existing.get(n.id);
      const hash = hashId(n.id);
      const seed1 = (hash * 17) % 100 / 100;
      const seed2 = (hash * 31 + 7) % 100 / 100;

      const [tx, ty, tz] = this._computeTarget(n, idx, dlIdx, dlCount, world);

      let x = ex ? ex.x : tx + (seed1 - 0.5) * 18;
      let y = ex ? ex.y : ty + (seed2 - 0.5) * 18;
      let z = ex ? ex.z : tz + (Math.random() - 0.5) * 12;

      const lvl = n.level || 'meso';
      const lvlFactor = lvl === 'macro' ? 1.6 : lvl === 'meso' ? 1.1 : 0.7;
      const stat = n.status || 'seed';
      const statFactor = (stat === 'rooted' || stat === 'atlas') ? 1.5 : stat === 'alive' ? 1.25 : stat === 'sprout' ? 0.95 : 0.7;
      const baseSize = (n.id === 'central-me') ? 18 : Math.round(11 * lvlFactor * statFactor);

      const domColor = (DOMAIN_COLORS[n.domain as Domain] || DOMAIN_COLORS.hybrid);
      const glowC: [number,number,number,number] = [domColor[0], domColor[1], domColor[2], 0.65];

      const typeMap: Record<string, number> = {
        concept: 0, practice: 1, person: 2, movement: 3, event: 4, observation: 5, question: 5
      };

      return {
        id: n.id,
        x, y, z,
        vx: ex ? ex.vx : 0,
        vy: ex ? ex.vy : 0,
        vz: ex ? ex.vz : 0,
        targetX: tx, targetY: ty, targetZ: tz,
        color: [...domColor] as [number,number,number,number],
        glowColor: glowC,
        size: ex ? ex.size : baseSize * 0.045,
        baseSize: baseSize * 0.045,
        phase: ex ? ex.phase : Math.random() * Math.PI * 2,
        breathPhase: ex ? ex.breathPhase : Math.random() * Math.PI * 2,
        breathSpeed: ex ? ex.breathSpeed : 0.3 + Math.random() * 0.45,
        type: typeMap[n.type] ?? 0,
        isSelected: selectedNodeId === n.id,
        isHub: n.resonances > 25,
        domain: n.domain,
        level: n.level,
        world: n.world,
        resonances: n.resonances,
        id_hash: hash,
      } as RenderNode;
    });

    // Rebuild edges
    const nodeMap = new Map(this.physicsNodes.map(n => [n.id, n]));
    this.physicsEdges = links
      .filter(l => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map(l => ({
        sourceId: l.source,
        targetId: l.target,
        color: (EDGE_TYPE_COLORS[l.type] || DOMAIN_COLORS.hybrid) as [number,number,number,number],
        activity: l.activity,
        type: l.type,
        resonanceWeight: l.resonanceWeight,
      }));

    // Build bezier control point cache
    this.bezierCache.clear();
    for (const edge of this.physicsEdges) {
      const key = edge.sourceId + ':' + edge.targetId;
      const sh = hashId(edge.sourceId);
      const th = hashId(edge.targetId);
      const seed = ((sh + th) % 20) / 20;
      this.bezierCache.set(key, [seed - 0.5, (seed * 7 % 1) - 0.5, (seed * 13 % 1) - 0.5]);
    }

    // (Re)allocate particle progress arrays
    const numParticles = Math.min(this.physicsEdges.length * 2, this.maxParticles);
    this.particleProgress = new Float32Array(numParticles);
    this.particleSpeeds = new Float32Array(numParticles);
    this.particlePhaseArr = new Float32Array(numParticles);
    for (let i = 0; i < numParticles; i++) {
      this.particleProgress[i] = Math.random();
      const edgeIdx = Math.floor(i / 2) % this.physicsEdges.length;
      const spd = PARTICLE_SPEED[this.physicsEdges[edgeIdx]?.type] || 0.07;
      this.particleSpeeds[i] = spd * (0.8 + Math.random() * 0.4);
      this.particlePhaseArr[i] = Math.random() * Math.PI * 2;
    }

    // Mark selected
    for (const n of this.physicsNodes) {
      n.isSelected = n.id === selectedNodeId;
    }

    this._buildHubRingGeometry();
  }

  private _computeTarget(
    n: SomaticNode, idx: number,
    dlIdx: Record<string,number>, dlCount: Record<string,number>,
    world: World
  ): [number,number,number] {
    if (world === 'atlas') {
      const ARM_ANGLE: Record<string, number> = {
        body: 0,
        science: Math.PI / 3,
        philosophy: (2 * Math.PI) / 3,
        movement: Math.PI,
        cognition: (4 * Math.PI) / 3,
        hybrid: (5 * Math.PI) / 3,
      };
      const armBase = ARM_ANGLE[n.domain] ?? (idx * 1.05);
      const domIdx = dlIdx[n.id] ?? idx;
      const domTotal = Math.max(1, dlCount[`${n.domain}-${n.level}`] ?? 1);
      const rMin = n.level === 'macro' ? 6 : n.level === 'meso' ? 36 : 76;
      const rMax = n.level === 'macro' ? 26 : n.level === 'meso' ? 66 : 116;
      const r = rMin + (domIdx / domTotal) * (rMax - rMin);
      const spread = n.level === 'macro' ? 0.22 : n.level === 'meso' ? 0.48 : 0.68;
      const angOffset = domTotal > 1 ? ((domIdx / (domTotal - 1)) - 0.5) * Math.PI * spread : 0;
      const angle = armBase + angOffset;
      const tx = Math.cos(angle) * r;
      const ty = Math.sin(angle) * r * 0.58;
      const seed = (n.id.charCodeAt(0) * 17 + (n.id.charCodeAt(1) || 7) * 11) % 100;
      const zRange = n.level === 'macro' ? 10 : n.level === 'meso' ? 22 : 36;
      const tz = ((seed / 50) - 1) * zRange;
      return [tx, ty, tz];
    } else if (world === 'field') {
      const angle = (idx * 0.72) % (Math.PI * 2);
      const dist = 40 + (idx % 12) * 22;
      return [Math.cos(angle) * dist, Math.sin(angle) * dist * 0.6, Math.cos(idx * 3) * 10];
    } else {
      // 'me'
      if (n.id === 'central-me') return [0, 0, 0];
      const orbitRadius = 45 + (idx % 5) * 20;
      const initialAngle = (idx * 1.2) % (Math.PI * 2);
      return [Math.cos(initialAngle) * orbitRadius, Math.sin(initialAngle) * orbitRadius, Math.sin(idx) * 8];
    }
  }

  // ----------------------------------------------------------------
  //  tickPhysics — one physics step
  // ----------------------------------------------------------------
  tickPhysics(time: number, ascendingNodeId?: string | null): void {
    const nodes = this.physicsNodes;
    if (nodes.length === 0) return;

    const gravityStrength = 0.045;
    const repulsionStrength = 2200;
    const attractionStrength = 0.038;
    const damping = 0.82;

    // 'me' world: orbit targets update
    if (this.currentWorld === 'me') {
      nodes.forEach((node, idx) => {
        if (node.id !== 'central-me') {
          const orbitRadius = 45 + (idx % 5) * 20;
          const orbitSpeed = (120 / orbitRadius) * 0.08 + (idx % 2) * 0.02;
          const currentAngle = node.breathPhase + time * orbitSpeed;
          node.targetX = Math.cos(currentAngle) * orbitRadius;
          node.targetY = Math.sin(currentAngle) * orbitRadius;
          node.targetZ = Math.sin(time * 0.4 + idx) * 6;
        }
      });
    }

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      if (n1.id === 'central-me') continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        if (n2.id === 'central-me') continue;
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        let dz = n2.z - n1.z;
        if (!dx && !dy && !dz) { dx = 0.1; dy = 0.1; dz = 0.1; }
        const distSq = dx*dx + dy*dy + dz*dz;
        if (distSq < 310 * 310) {
          const dist = Math.sqrt(distSq);
          const force = repulsionStrength / (distSq + 120);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          n1.vx -= fx; n1.vy -= fy; n1.vz -= fz;
          n2.vx += fx; n2.vy += fy; n2.vz += fz;
        }
      }
    }

    // Spring attraction along edges
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const edge of this.physicsEdges) {
      const src = nodeMap.get(edge.sourceId);
      const tgt = nodeMap.get(edge.targetId);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dz = tgt.z - src.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (!dist) continue;
      const stretch = dist - 145;
      const pull = stretch * attractionStrength * Math.log(edge.resonanceWeight + 1);
      const dpx = (dx / dist) * pull;
      const dpy = (dy / dist) * pull;
      const dpz = (dz / dist) * pull;
      if (src.id !== 'central-me') { src.vx += dpx; src.vy += dpy; src.vz += dpz; }
      if (tgt.id !== 'central-me') { tgt.vx -= dpx; tgt.vy -= dpy; tgt.vz -= dpz; }
    }

    // Integration
    nodes.forEach((node, idx) => {
      if (node.id === 'central-me') {
        node.x = 0; node.y = 0; node.z = 0;
        node.vx = 0; node.vy = 0; node.vz = 0;
      } else {
        // Ascending drift
        if (ascendingNodeId && node.id === ascendingNodeId) {
          node.targetY += 1.2;
          node.targetZ += 0.6;
        }

        node.vx += (node.targetX - node.x) * gravityStrength;
        node.vy += (node.targetY - node.y) * gravityStrength;
        node.vz += (node.targetZ - node.z) * gravityStrength;

        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;

        node.vx *= damping;
        node.vy *= damping;
        node.vz *= damping;

        // Living wave sway
        node.x += Math.sin(time * 1.1 + idx * 0.7) * 0.16;
        node.y += Math.cos(time * 0.8 + idx * 0.4) * 0.16;
        node.z += Math.sin(time * 1.4 + idx * 0.9) * 0.1;
      }

      // Breathing radius
      const bp = node.breathPhase + time * node.breathSpeed * 0.03;
      node.size = node.baseSize * (1 + Math.sin(bp) * 0.08);
    });

    // Advance particle progress
    const numParticles = this.particleProgress.length;
    for (let i = 0; i < numParticles; i++) {
      this.particleProgress[i] = (this.particleProgress[i] + this.particleSpeeds[i] * 0.016) % 1.0;
    }
  }

  // ----------------------------------------------------------------
  //  setSelected
  // ----------------------------------------------------------------
  setSelected(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    for (const n of this.physicsNodes) {
      n.isSelected = n.id === nodeId;
    }
  }

  // ----------------------------------------------------------------
  //  render — all draw passes
  // ----------------------------------------------------------------
  render(camera: Camera, time: number): void {
    const gl = this.gl;
    if (!gl) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update sparkle positions (sine drift)
    for (let i = 0; i < this.sparkleCount; i++) {
      this.sparklePosBuf[i*3+0] += this.sparkleVelBuf[i*3+0] + Math.sin(time * 0.3 + i * 0.7) * 0.0008;
      this.sparklePosBuf[i*3+1] += this.sparkleVelBuf[i*3+1] + Math.cos(time * 0.25 + i * 0.5) * 0.0008;
      this.sparklePosBuf[i*3+2] += this.sparkleVelBuf[i*3+2];
      const r2 = this.sparklePosBuf[i*3]**2 + this.sparklePosBuf[i*3+1]**2 + this.sparklePosBuf[i*3+2]**2;
      if (r2 > 3025) {
        this.sparklePosBuf[i*3] *= 0.997;
        this.sparklePosBuf[i*3+1] *= 0.997;
        this.sparklePosBuf[i*3+2] *= 0.997;
      }
    }

    // Update node/edge GPU buffers
    this._updateNodeBuffers(camera);
    this._updateEdgeBuffers();
    this._updateParticleBuffers(time);
    this._updateHubRingBuffers();

    // Pass 1: Stars (additive)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.starProg);
    setUniformMat4(gl, this.starProg, 'u_viewProj', camera.viewProjMatrix);
    setUniform1f(gl, this.starProg, 'u_time', time);
    gl.bindVertexArray(this.starVAO);
    gl.drawArrays(gl.POINTS, 0, this.starCount);

    // Pass 2: Sparkles (additive)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sparklePosBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sparklePosBuf);
    gl.useProgram(this.sparkleProg);
    setUniformMat4(gl, this.sparkleProg, 'u_viewProj', camera.viewProjMatrix);
    setUniform1f(gl, this.sparkleProg, 'u_time', time);
    gl.bindVertexArray(this.sparkleVAO);
    gl.drawArrays(gl.POINTS, 0, this.sparkleCount);

    // Pass 3: Hub rings (additive)
    if (this.hubRingVertCount > 0) {
      gl.useProgram(this.hubRingProg);
      setUniformMat4(gl, this.hubRingProg, 'u_viewProj', camera.viewProjMatrix);
      setUniform1f(gl, this.hubRingProg, 'u_time', time);
      gl.bindVertexArray(this.hubRingVAO);
      gl.drawArrays(gl.LINES, 0, this.hubRingVertCount);
    }

    // Pass 4: Edges (normal blend)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (this.edgeVertCount > 0) {
      gl.useProgram(this.edgeProg);
      setUniformMat4(gl, this.edgeProg, 'u_viewProj', camera.viewProjMatrix);
      setUniform1f(gl, this.edgeProg, 'u_time', time);
      gl.bindVertexArray(this.edgeVAO);
      gl.drawArrays(gl.LINES, 0, this.edgeVertCount);
    }

    const nodeCount = this.physicsNodes.length;
    if (nodeCount === 0) { gl.bindVertexArray(null); return; }

    // Pass 5: Glows (additive)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(this.glowProg);
    setUniformMat4(gl, this.glowProg, 'u_viewProj', camera.viewProjMatrix);
    setUniform1f(gl, this.glowProg, 'u_time', time);
    gl.bindVertexArray(this.glowVAO);
    gl.drawArrays(gl.POINTS, 0, nodeCount);

    // Pass 6: Cores (normal blend)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.coreProg);
    setUniformMat4(gl, this.coreProg, 'u_viewProj', camera.viewProjMatrix);
    setUniform1f(gl, this.coreProg, 'u_time', time);
    gl.bindVertexArray(this.coreVAO);
    gl.drawArrays(gl.POINTS, 0, nodeCount);

    // Pass 7: Particles (additive)
    if (this.particleCount > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.particleProg);
      setUniformMat4(gl, this.particleProg, 'u_viewProj', camera.viewProjMatrix);
      setUniform1f(gl, this.particleProg, 'u_time', time);
      gl.bindVertexArray(this.particleVAO);
      gl.drawArrays(gl.POINTS, 0, this.particleCount);
    }

    // Reset blend to normal
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(null);
  }

  private _updateNodeBuffers(camera: Camera) {
    const gl = this.gl;
    const nodes = this.physicsNodes;
    const n = nodes.length;
    if (n === 0) return;

    // Scale gl_PointSize by camera distance for perspective-correct sizing
    // The SCALE constant from MyceliumGraph is 0.045 (physics units -> scene units)
    const SCALE = 0.045;
    const camDist = camera.distance;
    // size in physics units -> screen pixels approx
    const pxScale = 600 / camDist; // heuristic: at distance 22, 600/22 ≈ 27 pixels per unit

    for (let i = 0; i < n; i++) {
      const nd = nodes[i];
      const sizeInPx = nd.size * SCALE * pxScale;

      this.glowPosBuf[i*3+0] = nd.x * SCALE;
      this.glowPosBuf[i*3+1] = nd.y * SCALE;
      this.glowPosBuf[i*3+2] = nd.z * SCALE;
      this.glowColorBuf[i*4+0] = nd.glowColor[0];
      this.glowColorBuf[i*4+1] = nd.glowColor[1];
      this.glowColorBuf[i*4+2] = nd.glowColor[2];
      this.glowColorBuf[i*4+3] = nd.glowColor[3];
      this.glowSizeBuf[i] = sizeInPx;
      this.glowPhaseBuf[i] = nd.phase;
      this.glowSelectedBuf[i] = nd.isSelected ? 1.0 : 0.0;

      this.corePosBuf[i*3+0] = nd.x * SCALE;
      this.corePosBuf[i*3+1] = nd.y * SCALE;
      this.corePosBuf[i*3+2] = nd.z * SCALE;
      this.coreColorBuf[i*4+0] = nd.color[0];
      this.coreColorBuf[i*4+1] = nd.color[1];
      this.coreColorBuf[i*4+2] = nd.color[2];
      this.coreColorBuf[i*4+3] = nd.color[3];
      this.coreSizeBuf[i] = sizeInPx;
      this.corePhaseBuf[i] = nd.phase;
      this.coreTypeBuf[i] = nd.type;
      this.coreSelectedBuf[i] = nd.isSelected ? 1.0 : 0.0;
    }

    // Upload to GPU using bufferSubData
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowPosBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowPosBuf, 0, n * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowColorBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowColorBuf, 0, n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowSizeBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowSizeBuf, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowPhaseBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowPhaseBuf, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowSelectedBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.glowSelectedBuf, 0, n);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.corePosBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.corePosBuf, 0, n * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreColorBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.coreColorBuf, 0, n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreSizeBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.coreSizeBuf, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corePhaseBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.corePhaseBuf, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreTypeBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.coreTypeBuf, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coreSelectedBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.coreSelectedBuf, 0, n);
  }

  private _updateEdgeBuffers() {
    const gl = this.gl;
    const nodeMap = new Map(this.physicsNodes.map(n => [n.id, n]));
    const SCALE = 0.045;
    const BEZIER_STEPS = 11; // 12 points, 11 segments -> 22 verts per edge
    const VERTS_PER_EDGE = BEZIER_STEPS * 2;

    let vi = 0;
    for (const edge of this.physicsEdges) {
      const src = nodeMap.get(edge.sourceId);
      const tgt = nodeMap.get(edge.targetId);
      if (!src || !tgt) continue;
      if (vi + VERTS_PER_EDGE > this.maxEdgeVerts) break;

      const isActive = src.isSelected || tgt.isSelected;
      const baseAlpha = isActive ? 0.7 : 0.15;
      const activeFlag = isActive ? 1.0 : 0.0;

      const ax = src.x * SCALE, ay = src.y * SCALE, az = src.z * SCALE;
      const bx = tgt.x * SCALE, by = tgt.y * SCALE, bz = tgt.z * SCALE;

      // Bezier control point from cache
      const key = edge.sourceId + ':' + edge.targetId;
      const cp = this.bezierCache.get(key) || [0, 0, 0];
      const perpLen = 0.6 + (hashId(edge.sourceId) % 20) / 20;
      const midX = (ax + bx) * 0.5;
      const midY = (ay + by) * 0.5;
      const midZ = (az + bz) * 0.5;
      const edgeDX = bx - ax, edgeDY = by - ay;
      const edgeLen = Math.sqrt(edgeDX*edgeDX + edgeDY*edgeDY) + 0.001;
      const perpX = (-edgeDY / edgeLen) * perpLen + cp[0] * 0.5;
      const perpY = (edgeDX / edgeLen) * perpLen + cp[1] * 0.5;
      const perpZ = cp[2] * 0.5;
      const cx = midX + perpX, cy = midY + perpY, cz = midZ + perpZ;

      // Source color and target color (blend along bezier)
      const sc = edge.color;
      const tc = edge.color;

      let prevPt = bezierPoint(ax, ay, az, cx, cy, cz, bx, by, bz, 0);
      for (let s = 1; s <= BEZIER_STEPS; s++) {
        const t = s / BEZIER_STEPS;
        const pt = bezierPoint(ax, ay, az, cx, cy, cz, bx, by, bz, t);
        const alpha = baseAlpha * (isActive ? 1.0 : (0.8 + Math.random() * 0.2));

        // previous point
        this.edgePosBuf[vi*3+0] = prevPt[0];
        this.edgePosBuf[vi*3+1] = prevPt[1];
        this.edgePosBuf[vi*3+2] = prevPt[2];
        this.edgeColorBuf[vi*4+0] = sc[0];
        this.edgeColorBuf[vi*4+1] = sc[1];
        this.edgeColorBuf[vi*4+2] = sc[2];
        this.edgeColorBuf[vi*4+3] = alpha;
        this.edgeActiveBuf[vi] = activeFlag;
        vi++;

        // current point
        this.edgePosBuf[vi*3+0] = pt[0];
        this.edgePosBuf[vi*3+1] = pt[1];
        this.edgePosBuf[vi*3+2] = pt[2];
        this.edgeColorBuf[vi*4+0] = tc[0];
        this.edgeColorBuf[vi*4+1] = tc[1];
        this.edgeColorBuf[vi*4+2] = tc[2];
        this.edgeColorBuf[vi*4+3] = alpha;
        this.edgeActiveBuf[vi] = activeFlag;
        vi++;

        prevPt = pt;
      }
    }
    this.edgeVertCount = vi;

    if (vi > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.edgePosBuf, 0, vi * 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeColorBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.edgeColorBuf, 0, vi * 4);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeActiveBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.edgeActiveBuf, 0, vi);
    }
  }

  private _updateParticleBuffers(time: number) {
    const gl = this.gl;
    const nodeMap = new Map(this.physicsNodes.map(n => [n.id, n]));
    const SCALE = 0.045;

    let pi = 0;
    const numParticles = this.particleProgress.length;

    for (let i = 0; i < numParticles && pi < this.maxParticles; i++) {
      const edgeIdx = Math.floor(i / 2) % this.physicsEdges.length;
      if (edgeIdx >= this.physicsEdges.length) continue;
      const edge = this.physicsEdges[edgeIdx];
      const src = nodeMap.get(edge.sourceId);
      const tgt = nodeMap.get(edge.targetId);
      if (!src || !tgt) continue;

      const ax = src.x * SCALE, ay = src.y * SCALE, az = src.z * SCALE;
      const bx = tgt.x * SCALE, by = tgt.y * SCALE, bz = tgt.z * SCALE;

      const key = edge.sourceId + ':' + edge.targetId;
      const cp = this.bezierCache.get(key) || [0,0,0];
      const perpLen = 0.6 + (hashId(edge.sourceId) % 20) / 20;
      const midX = (ax + bx) * 0.5, midY = (ay + by) * 0.5, midZ = (az + bz) * 0.5;
      const edgeDX = bx - ax, edgeDY = by - ay;
      const edgeLen = Math.sqrt(edgeDX*edgeDX + edgeDY*edgeDY) + 0.001;
      const cx = midX + (-edgeDY / edgeLen) * perpLen + cp[0] * 0.5;
      const cy = midY + (edgeDX / edgeLen) * perpLen + cp[1] * 0.5;
      const cz = midZ + cp[2] * 0.5;

      const t = this.particleProgress[i];
      const pos = bezierPoint(ax, ay, az, cx, cy, cz, bx, by, bz, t);

      const isActive = src.isSelected || tgt.isSelected;
      const alpha = isActive ? 0.95 : 0.45;
      const ec = edge.color;

      this.particlePosBuf[pi*3+0] = pos[0];
      this.particlePosBuf[pi*3+1] = pos[1];
      this.particlePosBuf[pi*3+2] = pos[2];
      this.particleColorBuf[pi*4+0] = ec[0];
      this.particleColorBuf[pi*4+1] = ec[1];
      this.particleColorBuf[pi*4+2] = ec[2];
      this.particleColorBuf[pi*4+3] = alpha;
      this.particlePhaseBuf[pi] = this.particlePhaseArr[i];
      pi++;
    }
    this.particleCount = pi;

    if (pi > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particlePosBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particlePosBuf, 0, pi * 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleColorBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particleColorBuf, 0, pi * 4);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particlePhaseBufGL);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particlePhaseBuf, 0, pi);
    }
  }

  private _buildHubRingGeometry() {
    // Find top 8 hub nodes by resonances
    const hubNodes = [...this.physicsNodes]
      .sort((a, b) => b.resonances - a.resonances)
      .slice(0, 8);

    const SEGS = 64;
    const RINGS_PER_NODE = 2;
    // Each ring = SEGS line segments = SEGS*2 vertices
    const vertsPerNode = RINGS_PER_NODE * SEGS * 2;
    let vi = 0;

    for (const hub of hubNodes) {
      for (let ring = 0; ring < RINGS_PER_NODE; ring++) {
        const phaseOffset = ring * 0.5;
        const hc = hub.color;
        // Build line loop: SEGS line pairs
        for (let s = 0; s < SEGS; s++) {
          const a0 = (s / SEGS) * Math.PI * 2;
          const a1 = ((s + 1) / SEGS) * Math.PI * 2;
          const SCALE = 0.045;
          const bx = hub.x * SCALE;
          const by = hub.y * SCALE;
          const bz = hub.z * SCALE;

          // Vertex 0
          this.hubRingBasePosBuf[vi*3+0] = bx;
          this.hubRingBasePosBuf[vi*3+1] = by;
          this.hubRingBasePosBuf[vi*3+2] = bz;
          this.hubRingAngleBuf[vi] = a0;
          this.hubRingRadiusBuf[vi] = 1.0;
          this.hubRingPhaseBuf[vi] = phaseOffset;
          this.hubRingColorBuf[vi*3+0] = hc[0];
          this.hubRingColorBuf[vi*3+1] = hc[1];
          this.hubRingColorBuf[vi*3+2] = hc[2];
          vi++;

          // Vertex 1
          this.hubRingBasePosBuf[vi*3+0] = bx;
          this.hubRingBasePosBuf[vi*3+1] = by;
          this.hubRingBasePosBuf[vi*3+2] = bz;
          this.hubRingAngleBuf[vi] = a1;
          this.hubRingRadiusBuf[vi] = 1.0;
          this.hubRingPhaseBuf[vi] = phaseOffset;
          this.hubRingColorBuf[vi*3+0] = hc[0];
          this.hubRingColorBuf[vi*3+1] = hc[1];
          this.hubRingColorBuf[vi*3+2] = hc[2];
          vi++;

          if (vi >= this.maxHubRingVerts) break;
        }
        if (vi >= this.maxHubRingVerts) break;
      }
      if (vi >= this.maxHubRingVerts) break;
    }
    this.hubRingVertCount = vi;
  }

  private _updateHubRingBuffers() {
    const gl = this.gl;
    if (this.hubRingVertCount === 0) return;

    // Update base positions every frame since nodes move
    this._buildHubRingGeometry();

    const v = this.hubRingVertCount;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingBasePosBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hubRingBasePosBuf, 0, v * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingAngleBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hubRingAngleBuf, 0, v);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingRadiusBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hubRingRadiusBuf, 0, v);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingPhaseBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hubRingPhaseBuf, 0, v);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hubRingColorBufGL);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.hubRingColorBuf, 0, v * 3);
  }

  // ----------------------------------------------------------------
  //  hitTest
  // ----------------------------------------------------------------
  hitTest(
    screenX: number, screenY: number,
    camera: Camera,
    canvasW: number, canvasH: number
  ): string | null {
    const SCALE = 0.045;
    let bestId: string | null = null;
    let bestDist = 24; // max 24px radius
    const pxScale = 600 / camera.distance;

    for (const node of this.physicsNodes) {
      const sp = camera.projectToScreen(
        node.x * SCALE, node.y * SCALE, node.z * SCALE,
        canvasW, canvasH
      );
      if (!sp) continue;
      const dx = sp[0] - screenX;
      const dy = sp[1] - screenY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      // Larger nodes get larger hit areas
      const hitRadius = Math.max(14, node.size * SCALE * pxScale * 0.6);
      if (dist < hitRadius && dist < bestDist) {
        bestDist = dist;
        bestId = node.id;
      }
    }
    return bestId;
  }

  // ----------------------------------------------------------------
  //  addRipple
  // ----------------------------------------------------------------
  addRipple(x: number, y: number, z: number, color: [number,number,number]): void {
    this.ripples.push({ x, y, z, color, startTime: performance.now() });
    // Clean up old ripples
    this.ripples = this.ripples.filter(r => performance.now() - r.startTime < 1200);
  }

  resize(width: number, height: number): void {
    const gl = this.gl;
    if (!gl) return;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    gl.deleteProgram(this.starProg);
    gl.deleteProgram(this.sparkleProg);
    gl.deleteProgram(this.glowProg);
    gl.deleteProgram(this.coreProg);
    gl.deleteProgram(this.edgeProg);
    gl.deleteProgram(this.particleProg);
    gl.deleteProgram(this.hubRingProg);
  }
}
