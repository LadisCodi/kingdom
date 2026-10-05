// THE CLOUD BANK, in one pass of a shader (Docs/art/art-direction.md §8.1).
//
// Every Undiscovered cell on screen, and everything past the map's edge, is
// one tileable cloud texture laid across the projected plane, cut to a mask
// of one texel a cell. It is its own WebGL canvas, stacked under the canvas
// that draws the ground the player can see: what stands on the ground is
// drawn over it.
//
// The bank never covers ground the player can see. Its edge is inside the
// fogged cell: the cloud thins toward a seen neighbour, the tallest puffs
// lasting longest, so the edge is the outline of the clouds and not a line.
//
// The same bank lies on two grids: the province's diamonds (`drawFogLayer`,
// stacked between the floor and the map canvas — `mapLayers` in
// mapRenderer.ts) and the world's hexes (`drawCloudBank` with
// `world/cloudGrid.ts`). A grid is the GLSL that says, for a point of the
// plane, whether it is under the bank and how far it is from seen ground.

import { TILE_H, TILE_W } from '../palette';
import { loadImage } from '../imageLoad';
import cloudTileUrl from './cloud_tile.webp?url';

/** How many projected-plane pixels (at zoom 1) one repeat of the texture
 *  spans — about six cells across, so a puff is about a cell wide. */
const CLOUD_PX = 900;
/** How far into a fogged cell, in cells, the bank takes to reach full
 *  thickness from a seen neighbour. */
const EDGE_CELLS = 0.55;
/** The drift: one repeat of the texture every `DRIFT_S` seconds, and the
 *  slow boil laid over it. The clock wraps at the same period, so the wrap
 *  is a whole repeat and cannot be seen. */
const DRIFT_S = 600;
const BOIL = 0.025;

/** What a frame of the bank is drawn from. */
export interface FogFrame {
  /** CSS px of the map, and the backing scale. */
  w: number;
  h: number;
  dpr: number;
  /** The camera: projected-plane centre and zoom. */
  camX: number;
  camY: number;
  zoom: number;
  /** One byte a cell, 255 under the bank and 0 on ground the player can
   *  see, row-major over `maskW × maskH` cells from cell `(maskX, maskY)` —
   *  in the grid's own coordinates. Past its edge the mask's rim repeats. */
  mask: Uint8Array;
  maskX: number;
  maskY: number;
  maskW: number;
  maskH: number;
  /** Changes when the mask does; the texture is uploaded only then. */
  maskSig: string;
  /** `performance.now()`, for the drift. */
  clock: number;
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * A grid the bank lies on: GLSL defining `float clearance(vec2 proj)` — for
 * a point of the projected plane, -1 on ground the player can see, otherwise
 * how far it is, in cells, to the nearest such ground (2 when none is near).
 * It reads the mask with `fogAt(vec2 cell)`. `edge` is how far into a fogged
 * cell the bank takes to reach full thickness.
 */
export interface BankGrid {
  glsl: string;
  edge: number;
}

/** The province's grid: 2:1 diamonds, cell (x, y). */
const DIAMONDS: BankGrid = {
  edge: EDGE_CELLS,
  glsl: `
float clearance(vec2 proj) {
  float u = proj.x / ${TILE_W.toFixed(1)};
  float v = proj.y / ${TILE_H.toFixed(1)};
  vec2 p = vec2(v + u, v - u);
  vec2 c = floor(p);
  if (fogAt(c) < 0.5) return -1.0;
  float d = 2.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 n = c + vec2(float(dx), float(dy));
      if (fogAt(n) < 0.5) d = min(d, length(max(abs(p - n - 0.5) - 0.5, 0.0)));
    }
  }
  return d;
}
`,
};

const frag = (grid: BankGrid): string => `
precision highp float;
uniform sampler2D uMask;
uniform sampler2D uCloud;
uniform vec2 uMaskOrigin;
uniform vec2 uMaskSize;
uniform vec2 uView;
uniform float uDpr;
uniform vec2 uCam;
uniform float uZoom;
uniform float uTime;

float fogAt(vec2 c) {
  return texture2D(uMask, (c - uMaskOrigin + 0.5) / uMaskSize).r;
}
${grid.glsl}
void main() {
  vec2 css = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 proj = (css - uView * 0.5) / uZoom + uCam;
  float d = clearance(proj);
  if (d < 0.0) discard;

  float drift = uTime / ${DRIFT_S.toFixed(1)};
  vec2 uv = proj / ${CLOUD_PX.toFixed(1)};
  vec2 boil = texture2D(uCloud, uv * 0.5 + vec2(drift * 2.0, drift)).rg - 0.5;
  vec3 col = texture2D(uCloud, uv + vec2(drift, 0.0) + boil * ${BOIL}).rgb;

  // The texture's light is its height: sunlit tops stand tallest. Toward a
  // seen neighbour only the tallest puffs remain.
  float height = clamp((dot(col, vec3(0.299, 0.587, 0.114)) - 0.68) / 0.3, 0.0, 1.0);
  float depth = smoothstep(0.0, ${grid.edge.toFixed(2)}, d);
  float cut = height - (1.0 - depth) * 1.1;
  float a = smoothstep(-0.05, 0.05, cut);
  // A soft shadow under the outline, so the edge is clean.
  col *= mix(0.88, 1.0, smoothstep(0.0, 0.25, cut));
  gl_FragColor = vec4(col * a, a);
}
`;

interface Gl {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  mask: WebGLTexture;
  cloud: WebGLTexture;
  cloudReady: boolean;
  maskSig: string;
  u: Record<string, WebGLUniformLocation | null>;
}

const layers = new WeakMap<HTMLCanvasElement, { gl: Gl | null; lost: boolean }>();

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'fog shader');
  return s;
}

function init(canvas: HTMLCanvasElement, grid: BankGrid): Gl | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(grid)));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'fog program');
  gl.useProgram(prog);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const mask = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const cloud = gl.createTexture()!;
  const g: Gl = { gl, prog, mask, cloud, cloudReady: false, maskSig: '', u: {} };
  for (const name of ['uMask', 'uCloud', 'uMaskOrigin', 'uMaskSize', 'uView', 'uDpr', 'uCam', 'uZoom', 'uTime']) {
    g.u[name] = gl.getUniformLocation(prog, name);
  }
  gl.uniform1i(g.u.uMask, 0);
  gl.uniform1i(g.u.uCloud, 1);
  return g;
}

/** Upload the cloud texture once it has decoded; until then nothing draws. */
function cloudTexture(g: Gl): boolean {
  if (g.cloudReady) return true;
  const img = loadImage(cloudTileUrl);
  if (!img.ready) return false;
  const { gl } = g;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, g.cloud);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img.img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  g.cloudReady = true;
  return true;
}

/**
 * Draw the province's bank into `canvas`, a WebGL canvas of its own. Without
 * WebGL it draws nothing, and the floor's flat cloud tone stands in for it.
 */
export function drawFogLayer(canvas: HTMLCanvasElement, f: FogFrame): void {
  drawCloudBank(canvas, DIAMONDS, f);
}

/** Draw the bank on `grid` into `canvas`. A canvas keeps the grid it was
 *  first drawn with. */
export function drawCloudBank(canvas: HTMLCanvasElement, grid: BankGrid, f: FogFrame): void {
  let layer = layers.get(canvas);
  if (layer === undefined) {
    layer = { gl: null, lost: false };
    const l = layer;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); l.lost = true; l.gl = null; });
    canvas.addEventListener('webglcontextrestored', () => { l.lost = false; l.gl = init(canvas, grid); });
    layer.gl = init(canvas, grid);
    layers.set(canvas, layer);
  }
  const g = layer.gl;
  if (g === null || layer.lost) return;
  const { gl } = g;

  const bw = Math.round(f.w * f.dpr);
  const bh = Math.round(f.h * f.dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  gl.viewport(0, 0, bw, bh);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (!cloudTexture(g)) return;

  if (g.maskSig !== f.maskSig) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.mask);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, f.maskW, f.maskH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, f.mask);
    g.maskSig = f.maskSig;
  }
  gl.uniform2f(g.u.uMaskOrigin, f.maskX, f.maskY);
  gl.uniform2f(g.u.uMaskSize, f.maskW, f.maskH);
  gl.uniform2f(g.u.uView, f.w, f.h);
  gl.uniform1f(g.u.uDpr, f.dpr);
  gl.uniform2f(g.u.uCam, f.camX, f.camY);
  gl.uniform1f(g.u.uZoom, f.zoom);
  gl.uniform1f(g.u.uTime, (f.clock / 1000) % DRIFT_S);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
