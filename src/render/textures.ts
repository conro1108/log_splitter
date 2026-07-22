import * as THREE from 'three';
import type { LogSpec } from '../core/log';
import { SPECIES } from '../core/log';
import { mulberry32 } from '../core/rng';
import type { PieceState } from '../core/split';
import { isFullRound } from '../core/split';

const S = 256;

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// bark and grain are shared per log; so is a *clean* end cap, since with no
// cracks drawn it depends only on the log's seed. Only a piece that has been
// struck needs a texture of its own — which matters because the woodpile grows
// without bound, and one 256² upload per stacked piece is real memory on a
// phone. Callers must not dispose a shared texture; see EndTexture.shared.
const cache = new Map<string, THREE.CanvasTexture>();

export interface EndTexture {
  texture: THREE.CanvasTexture;
  /** true when this texture is cached and owned by the module, not the caller */
  shared: boolean;
}

export function endTexture(piece: PieceState): EndTexture {
  const clean = Object.keys(piece.cracks).length === 0;
  if (clean) {
    const key = `end:${piece.spec.seed}:${isFullRound(piece) ? 'r' : 's'}`;
    let hit = cache.get(key);
    if (!hit) {
      hit = drawEndTexture(piece);
      cache.set(key, hit);
    }
    return { texture: hit, shared: true };
  }
  return { texture: drawEndTexture(piece), shared: false };
}

/**
 * End-grain face: growth rings around an off-center pith, knots as dark
 * blobs, current cracks drawn along their planes. Canvas y is flipped vs.
 * geometry angle (uv v = 0.5 + sin/2 with flipY), so direction θ maps to
 * canvas (cos θ, -sin θ).
 */
function drawEndTexture(piece: PieceState): THREE.CanvasTexture {
  const spec = piece.spec;
  const info = SPECIES[spec.species];
  const rand = mulberry32(spec.seed ^ 0x5eed);
  const [c, ctx] = makeCanvas();

  ctx.fillStyle = info.woodColor;
  ctx.fillRect(0, 0, S, S);

  const cx = S / 2 + (rand() - 0.5) * S * 0.12;
  const cy = S / 2 + (rand() - 0.5) * S * 0.12;
  const maxR = S / 2;

  const rings = 12 + Math.floor(rand() * 9);
  ctx.strokeStyle = info.ringColor;
  for (let i = 1; i <= rings; i++) {
    const rr = (i / rings) * maxR * 1.15;
    const wobAmp = rr * 0.04 * (1 + Math.abs(spec.twist));
    const wobPhase = rand() * Math.PI * 2;
    const wobK = 2 + Math.floor(rand() * 3);
    ctx.globalAlpha = 0.25 + rand() * 0.3;
    ctx.lineWidth = 0.8 + rand() * 1.6;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.12) {
      const r = rr + Math.sin(a * wobK + wobPhase) * wobAmp;
      const x = cx + Math.cos(a) * r;
      const y = cy - Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const k of spec.knots) {
    const d = (0.45 + k.z * 0.25) * maxR;
    const x = S / 2 + Math.cos(k.angle) * d;
    const y = S / 2 - Math.sin(k.angle) * d;
    const kr = 4 + k.size * 22;
    const g = ctx.createRadialGradient(x, y, 1, x, y, kr);
    g.addColorStop(0, 'rgba(58, 40, 24, 0.9)');
    g.addColorStop(0.6, 'rgba(84, 58, 34, 0.55)');
    g.addColorStop(1, 'rgba(84, 58, 34, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, kr, 0, Math.PI * 2);
    ctx.fill();
  }

  // bark rim
  ctx.strokeStyle = info.barkColor;
  ctx.lineWidth = 7;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, maxR - 3, 0, Math.PI * 2);
  ctx.stroke();

  // cracks: jagged dark lines along each worked plane, length ∝ progress
  ctx.strokeStyle = '#241a10';
  ctx.lineCap = 'round';
  const crand = mulberry32(spec.seed ^ 0xc4ac);
  for (const [bucketKey, prog] of Object.entries(piece.cracks)) {
    if (prog <= 0.02) continue;
    const bucket = Number(bucketKey);
    const theta = (bucket * Math.PI) / 12;
    const dirs = isFullRound(piece) ? [theta, theta + Math.PI] : [theta];
    ctx.globalAlpha = 0.4 + prog * 0.55;
    ctx.lineWidth = 1.5 + prog * 3;
    for (const dir of dirs) {
      const len = prog * maxR * 0.95;
      const dx = Math.cos(dir);
      const dy = -Math.sin(dir);
      ctx.beginPath();
      ctx.moveTo(S / 2, S / 2);
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        const t = (s / steps) * len;
        const j = (crand() - 0.5) * 6;
        ctx.lineTo(S / 2 + dx * t - dy * j, S / 2 + dy * t + dx * j);
      }
      ctx.stroke();
    }
  }

  return toTexture(c);
}

/** Bark: vertical streaks slanted by the grain twist, knot bulges. */
export function barkTexture(spec: LogSpec): THREE.CanvasTexture {
  const key = `bark:${spec.seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const info = SPECIES[spec.species];
  const rand = mulberry32(spec.seed ^ 0xba7c);
  const [c, ctx] = makeCanvas();

  ctx.fillStyle = info.barkColor;
  ctx.fillRect(0, 0, S, S);

  const slant = spec.twist * S * 0.35;
  for (let i = 0; i < 70; i++) {
    const x0 = rand() * S;
    const light = rand() > 0.5;
    ctx.strokeStyle = light ? 'rgba(255, 240, 220, 0.5)' : 'rgba(10, 6, 3, 0.6)';
    ctx.globalAlpha = 0.12 + rand() * 0.25;
    ctx.lineWidth = 1 + rand() * 3;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.bezierCurveTo(
      x0 + slant * 0.3 + (rand() - 0.5) * 10, S * 0.33,
      x0 + slant * 0.7 + (rand() - 0.5) * 10, S * 0.66,
      x0 + slant, S,
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const k of spec.knots) {
    const x = (k.angle / (Math.PI * 2)) * S;
    const y = (1 - k.z) * S;
    const kr = 6 + k.size * 26;
    const g = ctx.createRadialGradient(x, y, 1, x, y, kr);
    g.addColorStop(0, 'rgba(28, 18, 10, 0.85)');
    g.addColorStop(0.5, 'rgba(40, 28, 16, 0.5)');
    g.addColorStop(1, 'rgba(40, 28, 16, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, kr, 0, Math.PI * 2);
    ctx.fill();
    // wrap the seam so knots near u=0 show on both edges
    if (x < kr) { ctx.beginPath(); ctx.arc(x + S, y, kr, 0, Math.PI * 2); ctx.fill(); }
    if (x > S - kr) { ctx.beginPath(); ctx.arc(x - S, y, kr, 0, Math.PI * 2); ctx.fill(); }
  }

  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Split-face grain: pale fresh wood with long fibers. */
export function grainTexture(spec: LogSpec): THREE.CanvasTexture {
  const key = `grain:${spec.seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const info = SPECIES[spec.species];
  const rand = mulberry32(spec.seed ^ 0x62a1);
  const [c, ctx] = makeCanvas();

  ctx.fillStyle = info.woodColor;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255, 248, 230, 0.25)';
  ctx.fillRect(0, 0, S, S);

  const slant = spec.twist * S * 0.25;
  for (let i = 0; i < 46; i++) {
    const x0 = rand() * S;
    ctx.strokeStyle = rand() > 0.35 ? info.ringColor : '#8a6a44';
    ctx.globalAlpha = 0.15 + rand() * 0.3;
    ctx.lineWidth = 0.8 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.quadraticCurveTo(x0 + slant * 0.5 + (rand() - 0.5) * 14, S / 2, x0 + slant, S);
    ctx.stroke();
  }

  const t = toTexture(c);
  cache.set(key, t);
  return t;
}
