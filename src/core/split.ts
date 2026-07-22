import type { Knot, LogSpec } from './log';
import { SPECIES } from './log';

/**
 * A piece of wood on (or off) the block. A full round spans 2π; splitting
 * produces sectors. Splits always pass through the center axis — which is how
 * real splitting works, and keeps every piece a cylinder sector.
 */
export interface PieceState {
  spec: LogSpec;
  /** radians; arcEnd > arcStart, span = arcEnd - arcStart (2π for a round) */
  arcStart: number;
  arcEnd: number;
  /** persistent crack progress per plane bucket, 0..1 */
  cracks: Record<number, number>;
}

export interface StrikeInput {
  /** plane angle: direction of the aim point on the face, log-local radians */
  angle: number;
  /** aim point distance from center, 0 (center) .. 1 (bark edge) */
  radialFrac: number;
  /** swing power 0..~1.25 */
  power: number;
  /** swing accuracy 0..1; low accuracy glances off */
  accuracy: number;
}

export type Outcome = 'split' | 'stuck' | 'partial' | 'glance' | 'knot';

export interface StrikeResult {
  outcome: Outcome;
  /** crack progress on the struck plane after this hit, 0..1 */
  progress: number;
  bucket: number;
  toughness: number;
  /** present when outcome === 'split' */
  pieces?: [PieceState, PieceState];
  /** the knot that ate the blow, when outcome === 'knot' */
  knotHit?: Knot;
}

const TAU = Math.PI * 2;
const FULL_EPS = 1e-3;
const BUCKET_STEP = Math.PI / 12; // 15°

export function normalizeAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

/** shortest angular distance between two directions */
export function angDist(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(d, TAU - d);
}

export function pieceSpan(p: PieceState): number {
  return p.arcEnd - p.arcStart;
}

export function isFullRound(p: PieceState): boolean {
  return pieceSpan(p) >= TAU - FULL_EPS;
}

/** stackable = quarter-or-smaller, or a genuinely skinny round */
export function isStackable(p: PieceState): boolean {
  return pieceSpan(p) <= Math.PI / 2 + 0.01 || p.spec.radius < 0.09;
}

/** m³ of the sector */
export function pieceVolume(p: PieceState): number {
  return 0.5 * pieceSpan(p) * p.spec.radius ** 2 * p.spec.length;
}

export function makeRound(spec: LogSpec): PieceState {
  return { spec, arcStart: 0, arcEnd: TAU, cracks: {} };
}

/**
 * Bucket a plane angle so repeated blows on "the same line" accumulate.
 * On a full round the plane θ and θ+π are the same crack.
 */
export function crackBucket(p: PieceState, angle: number): number {
  if (isFullRound(p)) {
    const half = normalizeAngle(angle) % Math.PI;
    return Math.round(half / BUCKET_STEP) % 12;
  }
  return Math.round(normalizeAngle(angle) / BUCKET_STEP) % 24;
}

/** does this piece's arc contain the direction `a`? */
function arcContains(p: PieceState, a: number): boolean {
  if (isFullRound(p)) return true;
  const rel = normalizeAngle(a - p.arcStart);
  return rel <= pieceSpan(p);
}

/**
 * Knots near the strike plane raise toughness; a hard knot square in the
 * path eats the blow entirely. Returns [toughnessMultiplier, worstKnot].
 */
function knotEffect(p: PieceState, angle: number): [number, Knot | undefined] {
  let mult = 1;
  let worst: Knot | undefined;
  let worstProx = 0;
  for (const k of p.spec.knots) {
    if (!arcContains(p, k.angle)) continue;
    const d = isFullRound(p)
      ? Math.min(angDist(k.angle, angle), angDist(k.angle, angle + Math.PI))
      : angDist(k.angle, angle);
    if (d >= k.size) continue;
    const prox = 1 - d / k.size; // 0 at edge of influence, 1 dead-on
    mult *= 1 + k.hardness * 1.6 * prox;
    if (prox * k.hardness > worstProx) {
      worstProx = prox * k.hardness;
      worst = k;
    }
  }
  return [mult, worstProx > 0.45 ? worst : undefined];
}

/** how hard this piece resists a split on the given plane */
export function planeToughness(p: PieceState, angle: number): number {
  const info = SPECIES[p.spec.species];
  let t = info.toughness;
  if (!p.spec.seasoned) t *= 1.35;
  t *= 1 + 0.6 * Math.abs(p.spec.twist);
  t *= (p.spec.radius / 0.165) ** 1.5;
  t *= 0.3 + (0.7 * pieceSpan(p)) / TAU;
  const [knotMult] = knotEffect(p, angle);
  return t * knotMult;
}

function splitPiece(p: PieceState, angle: number): [PieceState, PieceState] {
  if (isFullRound(p)) {
    const a0 = normalizeAngle(angle);
    return [
      { spec: p.spec, arcStart: a0, arcEnd: a0 + Math.PI, cracks: {} },
      { spec: p.spec, arcStart: a0 + Math.PI, arcEnd: a0 + TAU, cracks: {} },
    ];
  }
  // clamp so we never shave off an unusable sliver
  const span = pieceSpan(p);
  const minSliver = Math.max(0.15 * span, 0.12);
  const rel = normalizeAngle(angle - p.arcStart);
  const cut =
    p.arcStart + Math.min(Math.max(rel, minSliver), span - minSliver);
  return [
    { spec: p.spec, arcStart: p.arcStart, arcEnd: cut, cracks: {} },
    { spec: p.spec, arcStart: cut, arcEnd: p.arcEnd, cracks: {} },
  ];
}

/**
 * Resolve one blow. Mutates p.cracks (partial progress persists on the log).
 * `rand` is injectable for deterministic tests.
 */
export function resolveStrike(
  p: PieceState,
  strike: StrikeInput,
  rand: () => number = Math.random,
): StrikeResult {
  const bucket = crackBucket(p, strike.angle);
  const toughness = planeToughness(p, strike.angle);

  // sloppy swing, or clipping the far edge of the bark: glance-off
  if (strike.accuracy < 0.3 || (strike.radialFrac > 0.9 && rand() < (strike.radialFrac - 0.9) * 6)) {
    return { outcome: 'glance', progress: p.cracks[bucket] ?? 0, bucket, toughness };
  }

  let effective = strike.power * (0.45 + 0.55 * strike.accuracy);
  const existing = p.cracks[bucket] ?? 0;
  if (existing >= 0.2) effective *= 1.4; // landing in the opened crack

  const [, knotHit] = knotEffect(p, strike.angle);
  const gain = (effective * 0.9) / toughness;
  const progress = Math.min(existing + gain, 1);

  if (progress >= 1) {
    const pieces = splitPiece(p, strike.angle);
    return { outcome: 'split', progress: 1, bucket, toughness, pieces };
  }

  p.cracks[bucket] = progress;

  if (knotHit && gain < 0.3) {
    return { outcome: 'knot', progress, bucket, toughness, knotHit };
  }
  if (progress >= 0.5 && gain > 0.2 && rand() < 0.6) {
    return { outcome: 'stuck', progress, bucket, toughness };
  }
  return { outcome: 'partial', progress, bucket, toughness };
}
