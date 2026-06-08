// ============================================================
// WebGL2 GLSL Shader Sources for the Seamless Universe Graph Engine
// All shaders use #version 300 es
// ============================================================

// ------------------------------------------------------------
// STAR shaders — 2000 background star points on a sphere
// ------------------------------------------------------------
export const STAR_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in float a_seed;

uniform mat4 u_viewProj;
uniform float u_time;

out float v_seed;

void main() {
  v_seed = a_seed;
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  float twinkle = 1.0 + sin(u_time * 1.3 + a_seed * 6.28) * 0.4;
  gl_PointSize = clamp((1.2 + a_seed * 1.8) * twinkle, 0.5, 4.0);
}
`;

export const STAR_FRAG = `#version 300 es
precision mediump float;

in float v_seed;
uniform float u_time;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 8.0);
  float twinkle = 0.6 + sin(u_time * 2.1 + v_seed * 12.56) * 0.4;
  float brightness = core * twinkle;
  // Slight color variation: blue-white to warm-white
  float warm = v_seed;
  vec3 color = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.95, 0.8), warm * warm);
  fragColor = vec4(color * brightness, brightness * 0.9);
}
`;

// ------------------------------------------------------------
// SPARKLE shaders — 200 ambient floating particles
// ------------------------------------------------------------
export const SPARKLE_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in float a_seed;

uniform mat4 u_viewProj;
uniform float u_time;

out float v_seed;
out float v_alpha;

void main() {
  v_seed = a_seed;
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  float sizePulse = 3.0 + sin(u_time * 0.4 + a_seed * 6.28) * 1.5;
  gl_PointSize = clamp(sizePulse, 1.0, 6.0);
  v_alpha = 0.15 + sin(u_time * 0.6 + a_seed * 9.42) * 0.1;
}
`;

export const SPARKLE_FRAG = `#version 300 es
precision mediump float;

in float v_seed;
in float v_alpha;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float glow = exp(-d * d * 8.0);
  vec3 color = mix(vec3(0.6, 0.7, 1.0), vec3(0.8, 0.6, 1.0), v_seed);
  fragColor = vec4(color, glow * v_alpha);
}
`;

// ------------------------------------------------------------
// GLOW shaders — large soft halos behind nodes (additive blend)
// ------------------------------------------------------------
export const GLOW_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in vec4 a_color;
in float a_size;
in float a_phase;
in float a_selected;

uniform mat4 u_viewProj;
uniform float u_time;

out vec4 v_color;
out float v_phase;
out float v_selected;

void main() {
  v_color = a_color;
  v_phase = a_phase;
  v_selected = a_selected;

  float breathe = 1.0 + sin(u_time * 0.7 + a_phase) * 0.12;
  float selMult = a_selected > 0.5 ? 2.2 : 1.0;
  float pointSize = a_size * breathe * 5.0 * selMult;

  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  gl_PointSize = clamp(pointSize, 2.0, 512.0);
}
`;

export const GLOW_FRAG = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_phase;
in float v_selected;
uniform float u_time;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float glow = exp(-d * d * 3.5);
  float breathe = 0.5 + sin(u_time * 1.2 + v_phase) * 0.5;
  float selBoost = v_selected > 0.5 ? 1.6 : 1.0;
  float alpha = glow * 0.25 * breathe * v_color.a * selBoost;
  fragColor = vec4(v_color.rgb, alpha);
}
`;

// ------------------------------------------------------------
// CORE shaders — node core sphere with galaxy/spiral pattern
// ------------------------------------------------------------
export const CORE_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in vec4 a_color;
in float a_size;
in float a_phase;
in float a_type;
in float a_selected;

uniform mat4 u_viewProj;
uniform float u_time;

out vec4 v_color;
out float v_phase;
out float v_type;
out float v_isSelected;

void main() {
  v_color = a_color;
  v_phase = a_phase;
  v_type = a_type;
  v_isSelected = a_selected;

  float breathe = 1.0 + sin(u_time * 0.8 + a_phase) * 0.1;
  float selMult = a_selected > 0.5 ? 1.35 : 1.0;
  float pointSize = a_size * breathe * selMult;

  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  gl_PointSize = clamp(pointSize, 2.0, 256.0);
}
`;

export const CORE_FRAG = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_phase;
in float v_type;
in float v_isSelected;
uniform float u_time;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);
  if (d > 1.0) discard;

  float breathe = 0.7 + sin(u_time * 0.8 + v_phase) * 0.3;

  // Core sphere gradient
  float core = smoothstep(1.0, 0.6, d);

  // Rim highlight ring
  float rim = smoothstep(0.55, 0.45, d) * (1.0 - smoothstep(0.85, 0.7, d));

  // Spiral galaxy pattern
  float angle = atan(uv.y, uv.x);
  float spiral = sin(angle * 3.0 + d * 8.0 - u_time * 0.4 + v_phase) * 0.5 + 0.5;
  float spiralMask = smoothstep(0.8, 0.2, d) * spiral * 0.35;

  // Inner glow
  float innerGlow = exp(-d * d * 4.0) * 0.5 * breathe;

  float intensity = core + rim * 0.6 + spiralMask + innerGlow;
  float alpha = (core * 0.95 + rim * 0.5) * v_color.a;

  // Selected node: extra bright pulsing ring
  if (v_isSelected > 0.5) {
    float selRing = smoothstep(0.72, 0.68, d) * (1.0 - smoothstep(0.82, 0.78, d));
    intensity += selRing * 1.5 * (0.7 + sin(u_time * 4.0) * 0.3);
    alpha = max(alpha, selRing * 0.8);
  }

  fragColor = vec4(v_color.rgb * intensity, alpha);
}
`;

// ------------------------------------------------------------
// EDGE shaders — bezier curve line segments
// ------------------------------------------------------------
export const EDGE_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in vec4 a_color;
in float a_active;

uniform mat4 u_viewProj;
uniform float u_time;

out vec4 v_color;
out float v_active;

void main() {
  v_color = a_color;
  v_active = a_active;
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
}
`;

export const EDGE_FRAG = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_active;
uniform float u_time;
out vec4 fragColor;

void main() {
  float alpha = v_color.a;
  if (v_active > 0.5) {
    float pulse = 0.85 + sin(u_time * 3.0) * 0.15;
    alpha = alpha * pulse;
  }
  fragColor = vec4(v_color.rgb, alpha);
}
`;

// ------------------------------------------------------------
// PARTICLE shaders — signal particles traveling along edges
// ------------------------------------------------------------
export const PARTICLE_VERT = `#version 300 es
precision mediump float;

in vec3 a_pos;
in vec4 a_color;
in float a_phase;

uniform mat4 u_viewProj;
uniform float u_time;

out vec4 v_color;
out float v_phase;

void main() {
  v_color = a_color;
  v_phase = a_phase;
  float sizePulse = 6.0 + sin(u_time * 8.0 + a_phase) * 2.0;
  gl_Position = u_viewProj * vec4(a_pos, 1.0);
  gl_PointSize = clamp(sizePulse, 2.0, 12.0);
}
`;

export const PARTICLE_FRAG = `#version 300 es
precision mediump float;

in vec4 v_color;
in float v_phase;
uniform float u_time;
out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float glow = exp(-d * d * 5.0);
  float pulse = 0.8 + sin(u_time * 6.0 + v_phase) * 0.2;
  fragColor = vec4(v_color.rgb, glow * v_color.a * pulse);
}
`;

// ------------------------------------------------------------
// HUB_RING shaders — expanding rings for hub nodes (GL_LINES)
// ------------------------------------------------------------
export const HUB_RING_VERT = `#version 300 es
precision mediump float;

in vec3 a_basePos;
in float a_angle;
in float a_radius;
in float a_phase;

uniform mat4 u_viewProj;
uniform float u_time;

out float v_phase;
out float v_progress;

void main() {
  v_phase = a_phase;
  float progress = mod(u_time * 0.5 + a_phase, 1.0);
  v_progress = progress;
  float scale = a_radius * progress * 4.0;
  // Ring expands in the XZ plane (horizontal)
  vec3 offset = vec3(cos(a_angle) * scale, 0.0, sin(a_angle) * scale);
  vec3 worldPos = a_basePos + offset;
  gl_Position = u_viewProj * vec4(worldPos, 1.0);
}
`;

export const HUB_RING_FRAG = `#version 300 es
precision mediump float;

in float v_phase;
in float v_progress;
uniform float u_time;
out vec4 fragColor;

void main() {
  float alpha = (1.0 - v_progress) * 0.4;
  // Color shifts from ring color (set by caller) to transparent
  fragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`;

// ------------------------------------------------------------
// HUB_RING_COLOR shaders — color variant with per-ring color uniform
// Uses the same geometry but outputs tinted color
// ------------------------------------------------------------
export const HUB_RING_COLOR_VERT = `#version 300 es
precision mediump float;

in vec3 a_basePos;
in float a_angle;
in float a_radius;
in float a_phase;
in vec3 a_color;

uniform mat4 u_viewProj;
uniform float u_time;

out float v_phase;
out float v_progress;
out vec3 v_color;

void main() {
  v_phase = a_phase;
  v_color = a_color;
  float progress = mod(u_time * 0.5 + a_phase, 1.0);
  v_progress = progress;
  float scale = a_radius * progress * 4.0;
  vec3 offset = vec3(cos(a_angle) * scale, 0.0, sin(a_angle) * scale);
  vec3 worldPos = a_basePos + offset;
  gl_Position = u_viewProj * vec4(worldPos, 1.0);
}
`;

export const HUB_RING_COLOR_FRAG = `#version 300 es
precision mediump float;

in float v_phase;
in float v_progress;
in vec3 v_color;
uniform float u_time;
out vec4 fragColor;

void main() {
  float alpha = (1.0 - v_progress) * 0.45;
  fragColor = vec4(v_color, alpha);
}
`;
