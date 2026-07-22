/**
 * Analog swing: pull back (drag down), then drive through (push up fast).
 * Speed of the drive → power; straightness → accuracy; net sideways drift
 * shifts the strike point off your aim.
 */

export interface SwingSample {
  /** pointer position, pixels; screen coords (y grows downward) */
  x: number;
  y: number;
  /** ms timestamp */
  t: number;
}

export interface SwingResult {
  valid: boolean;
  /** 0..1.25 */
  power: number;
  /** 0..1 */
  accuracy: number;
  /** net sideways drift of the drive, -1..1 (screen-widths-ish) */
  lateral: number;
}

const INVALID: SwingResult = { valid: false, power: 0, accuracy: 0, lateral: 0 };

export function analyzeSwing(samples: SwingSample[], viewHeight: number): SwingResult {
  if (samples.length < 4 || viewHeight <= 0) return INVALID;

  // bottom of the pullback = start of the drive
  let bottomIdx = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].y >= samples[bottomIdx].y) bottomIdx = i;
  }
  const drive = samples.slice(bottomIdx);
  if (drive.length < 3) return INVALID;

  const first = drive[0];
  const last = drive[drive.length - 1];
  const travel = first.y - last.y; // upward pixels
  const durSec = (last.t - first.t) / 1000;

  const pullback = first.y - samples[0].y; // downward pixels before the drive
  if (travel < viewHeight * 0.06 || pullback < viewHeight * 0.03) return INVALID;
  if (durSec <= 0 || durSec > 1.2) return INVALID;

  // power: drive speed in screen-heights per second
  const speed = travel / viewHeight / durSec;
  const power = Math.min(speed / 2.2, 1.25);

  // accuracy: lateral wobble relative to drive length
  const meanX = drive.reduce((s, p) => s + p.x, 0) / drive.length;
  const devX = Math.sqrt(
    drive.reduce((s, p) => s + (p.x - meanX) ** 2, 0) / drive.length,
  );
  const accuracy = Math.max(0, Math.min(1, 1 - (devX / travel) * 5));

  const lateral = Math.max(-1, Math.min(1, (last.x - first.x) / travel));

  return { valid: true, power, accuracy, lateral };
}
