// ============================================================
// Arcball Camera for WebGL2 Graph Engine
// Pure TypeScript, no external math library
// ============================================================

// --------------- Mat4 helpers (column-major, WebGL convention) ---------------

function mat4identity(): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

function mat4multiply(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[1]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[2]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[3]  = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  const b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7];
  out[4]  = b4*a00 + b5*a10 + b6*a20 + b7*a30;
  out[5]  = b4*a01 + b5*a11 + b6*a21 + b7*a31;
  out[6]  = b4*a02 + b5*a12 + b6*a22 + b7*a32;
  out[7]  = b4*a03 + b5*a13 + b6*a23 + b7*a33;

  const b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11];
  out[8]  = b8*a00 + b9*a10 + b10*a20 + b11*a30;
  out[9]  = b8*a01 + b9*a11 + b10*a21 + b11*a31;
  out[10] = b8*a02 + b9*a12 + b10*a22 + b11*a32;
  out[11] = b8*a03 + b9*a13 + b10*a23 + b11*a33;

  const b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
  out[12] = b12*a00 + b13*a10 + b14*a20 + b15*a30;
  out[13] = b12*a01 + b13*a11 + b14*a21 + b15*a31;
  out[14] = b12*a02 + b13*a12 + b14*a22 + b15*a32;
  out[15] = b12*a03 + b13*a13 + b14*a23 + b15*a33;
  return out;
}

function mat4perspective(out: Float32Array, fovYRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0]  = f / aspect;
  out[5]  = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
}

function mat4lookAt(
  out: Float32Array,
  eyeX: number, eyeY: number, eyeZ: number,
  centerX: number, centerY: number, centerZ: number,
  upX: number, upY: number, upZ: number
): Float32Array {
  let fx = centerX - eyeX;
  let fy = centerY - eyeY;
  let fz = centerZ - eyeZ;
  let len = Math.sqrt(fx*fx + fy*fy + fz*fz);
  if (len === 0) { out.set(mat4identity()); return out; }
  fx /= len; fy /= len; fz /= len;

  let rx = fy * upZ - fz * upY;
  let ry = fz * upX - fx * upZ;
  let rz = fx * upY - fy * upX;
  len = Math.sqrt(rx*rx + ry*ry + rz*rz);
  if (len === 0) { rx = 0; ry = 0; rz = 0; }
  else { rx /= len; ry /= len; rz /= len; }

  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;

  out[0]  = rx;   out[1]  = ux;   out[2]  = -fx;  out[3]  = 0;
  out[4]  = ry;   out[5]  = uy;   out[6]  = -fy;  out[7]  = 0;
  out[8]  = rz;   out[9]  = uz;   out[10] = -fz;  out[11] = 0;
  out[12] = -(rx*eyeX + ry*eyeY + rz*eyeZ);
  out[13] = -(ux*eyeX + uy*eyeY + uz*eyeZ);
  out[14] =  (fx*eyeX + fy*eyeY + fz*eyeZ);
  out[15] = 1;
  return out;
}

function mat4inverse(out: Float32Array, m: Float32Array): boolean {
  const a00=m[0], a01=m[1], a02=m[2], a03=m[3];
  const a10=m[4], a11=m[5], a12=m[6], a13=m[7];
  const a20=m[8], a21=m[9], a22=m[10],a23=m[11];
  const a30=m[12],a31=m[13],a32=m[14],a33=m[15];

  const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10;
  const b02=a00*a13-a03*a10, b03=a01*a12-a02*a11;
  const b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
  const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30;
  const b08=a20*a33-a23*a30, b09=a21*a32-a22*a31;
  const b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;

  let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
  if (!det) return false;
  det = 1.0 / det;

  out[0]  = (a11*b11 - a12*b10 + a13*b09) * det;
  out[1]  = (a02*b10 - a01*b11 - a03*b09) * det;
  out[2]  = (a31*b05 - a32*b04 + a33*b03) * det;
  out[3]  = (a22*b04 - a21*b05 - a23*b03) * det;
  out[4]  = (a12*b08 - a10*b11 - a13*b07) * det;
  out[5]  = (a00*b11 - a02*b08 + a03*b07) * det;
  out[6]  = (a32*b02 - a30*b05 - a33*b01) * det;
  out[7]  = (a20*b05 - a22*b02 + a23*b01) * det;
  out[8]  = (a10*b10 - a11*b08 + a13*b06) * det;
  out[9]  = (a01*b08 - a00*b10 - a03*b06) * det;
  out[10] = (a30*b04 - a31*b02 + a33*b00) * det;
  out[11] = (a21*b02 - a20*b04 - a23*b00) * det;
  out[12] = (a11*b07 - a10*b09 - a12*b06) * det;
  out[13] = (a00*b09 - a01*b07 + a02*b06) * det;
  out[14] = (a31*b01 - a30*b03 - a32*b00) * det;
  out[15] = (a20*b03 - a21*b01 + a22*b00) * det;
  return true;
}

// --------------- Vec3 helpers ---------------

function vec3cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number): [number,number,number] {
  return [ay*bz - az*by, az*bx - ax*bz, ax*by - ay*bx];
}

function vec3normalize(x: number, y: number, z: number): [number,number,number] {
  const len = Math.sqrt(x*x + y*y + z*z);
  if (len < 1e-10) return [0,0,1];
  return [x/len, y/len, z/len];
}

function vec3dot(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return ax*bx + ay*by + az*bz;
}

// --------------- Camera class ---------------

export class Camera {
  theta = 0;
  phi = 0.3;
  distance = 22;
  target: [number,number,number] = [0,0,0];

  viewMatrix: Float32Array = mat4identity();
  projMatrix: Float32Array = mat4identity();
  viewProjMatrix: Float32Array = mat4identity();
  camRight: Float32Array = new Float32Array([1,0,0]);
  camUp: Float32Array = new Float32Array([0,1,0]);
  camPos: Float32Array = new Float32Array([0,0,22]);

  private canvas: HTMLCanvasElement;
  private pointers = new Map<number, {x:number, y:number}>();
  private lastPinchDist = 0;
  private onChangeCallbacks: Array<()=>void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  updateMatrices(aspectRatio: number): void {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    const eyeX = this.target[0] + this.distance * cosPhi * sinTheta;
    const eyeY = this.target[1] + this.distance * sinPhi;
    const eyeZ = this.target[2] + this.distance * cosPhi * cosTheta;

    this.camPos[0] = eyeX;
    this.camPos[1] = eyeY;
    this.camPos[2] = eyeZ;

    const fovRad = (55 * Math.PI) / 180;
    mat4perspective(this.projMatrix, fovRad, aspectRatio, 0.1, 500);
    mat4lookAt(this.viewMatrix,
      eyeX, eyeY, eyeZ,
      this.target[0], this.target[1], this.target[2],
      0, 1, 0
    );
    mat4multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

    // Extract camera right and up from view matrix columns
    // Right = first column of view matrix (transposed from row-major world-space)
    this.camRight[0] = this.viewMatrix[0];
    this.camRight[1] = this.viewMatrix[4];
    this.camRight[2] = this.viewMatrix[8];

    this.camUp[0] = this.viewMatrix[1];
    this.camUp[1] = this.viewMatrix[5];
    this.camUp[2] = this.viewMatrix[9];
  }

  attachListeners(): () => void {
    const canvas = this.canvas;
    let isDragging = false;
    let isRightDrag = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      isRightDrag = e.button === 2 || e.ctrlKey;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const prev = this.pointers.get(e.pointerId);

      // Two-finger pinch zoom
      if (this.pointers.size === 2) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const pts = Array.from(this.pointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (this.lastPinchDist > 0) {
          const delta = this.lastPinchDist - dist;
          this.distance = Math.min(80, Math.max(2, this.distance + delta * 0.05));
          this._fireChange();
        }
        this.lastPinchDist = dist;
        return;
      }

      this.lastPinchDist = 0;
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (isRightDrag) {
        // Pan: move target
        const rect = canvas.getBoundingClientRect();
        const panSpeed = this.distance * 0.0012;
        // Right vector from camera
        const rx = this.camRight[0], ry = this.camRight[1], rz = this.camRight[2];
        const ux = this.camUp[0], uy = this.camUp[1], uz = this.camUp[2];
        this.target[0] -= (dx * rx - dy * ux) * panSpeed;
        this.target[1] -= (dx * ry - dy * uy) * panSpeed;
        this.target[2] -= (dx * rz - dy * uz) * panSpeed;
      } else {
        // Orbit
        this.theta -= dx * 0.005;
        this.phi = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this.phi + dy * 0.005));
      }
      this._fireChange();
    };

    const onPointerUp = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        isDragging = false;
        this.lastPinchDist = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.08 : 0.92;
      this.distance = Math.min(80, Math.max(2, this.distance * delta));
      this._fireChange();
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onDblClick = (_e: MouseEvent) => {
      this.theta = 0;
      this.phi = 0.3;
      this.distance = 22;
      this.target = [0,0,0];
      this._fireChange();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('dblclick', onDblClick);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }

  projectToNDC(worldX: number, worldY: number, worldZ: number): [number,number] | null {
    const vp = this.viewProjMatrix;
    const w = vp[3]*worldX + vp[7]*worldY + vp[11]*worldZ + vp[15];
    if (w <= 0) return null;
    const x = (vp[0]*worldX + vp[4]*worldY + vp[8]*worldZ  + vp[12]) / w;
    const y = (vp[1]*worldX + vp[5]*worldY + vp[9]*worldZ  + vp[13]) / w;
    return [x, y];
  }

  projectToScreen(
    worldX: number, worldY: number, worldZ: number,
    canvasW: number, canvasH: number
  ): [number,number] | null {
    const ndc = this.projectToNDC(worldX, worldY, worldZ);
    if (!ndc) return null;
    return [
      (ndc[0] * 0.5 + 0.5) * canvasW,
      (1 - (ndc[1] * 0.5 + 0.5)) * canvasH
    ];
  }

  onChange(cb: () => void): void {
    this.onChangeCallbacks.push(cb);
  }

  private _fireChange(): void {
    for (const cb of this.onChangeCallbacks) cb();
  }
}
