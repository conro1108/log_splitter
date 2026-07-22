/**
 * Analog swing: pull back (drag down), then drive through (push up fast).
 * Speed of the drive → power; straightness → accuracy; net sideways drift
 * shifts the strike point off your aim.
 *
 * A gesture nobody can see is a gesture nobody can learn, so the wind-up is
 * reported continuously (see `pullFraction`) for the axe to track live, and a
 * rejected swing says which half of the motion was missing.
 */

export interface SwingSample {
  /** pointer position, pixels; screen coords (y grows downward) */
  x: number;
  y: number;
  /** ms timestamp */
  t: number;
}

/** why a gesture wasn't a swing — surfaced to the player verbatim */
export type SwingFault = 'no-pullback' | 'no-drive' | 'too-slow';

export interface SwingResult {
  valid: boolean;
  /** 0..1.25 */
  power: number;
  /** 0..1 */
  accuracy: number;
  /** net sideways drift of the drive, -1..1 (screen-widths-ish) */
  lateral: number;
  fault?: SwingFault;
}

/** a full wind-up is a quarter of the viewport; used for live axe feedback */
const FULL_PULL = 0.25;
const MIN_PULLBACK = 0.025;
const MIN_DRIVE = 0.05;
const MAX_DRIVE_SECONDS = 1.6;

function fail(fault: SwingFault): SwingResult {
  return { valid: false, power: 0, accuracy: 0, lateral: 0, fault };
}

/**
 * How far the wind-up has been pulled so far, 0..1. Called every pointermove
 * while the button is held so the axe can rise with the drag.
 */
export function pullFraction(samples: SwingSample[], viewHeight: number): number {
  if (samples.length < 2 || viewHeight <= 0) return 0;
  let lowest = samples[0].y;
  for (const s of samples) if (s.y > lowest) lowest = s.y;
  return Math.max(0, Math.min((lowest - samples[0].y) / (viewHeight * FULL_PULL), 1));
}

export function analyzeSwing(samples: SwingSample[], viewHeight: number): SwingResult {
  if (samples.length < 4 || viewHeight <= 0) return fail('no-pullback');

  // bottom of the pullback = start of the drive
  let bottomIdx = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].y >= samples[bottomIdx].y) bottomIdx = i;
  }

  const pullback = samples[bottomIdx].y - samples[0].y;
  if (pullback < viewHeight * MIN_PULLBACK) return fail('no-pullback');

  const drive = samples.slice(bottomIdx);
  if (drive.length < 3) return fail('no-drive');

  const first = drive[0];
  const last = drive[drive.length - 1];
  const travel = first.y - last.y; // upward pixels
  const durSec = (last.t - first.t) / 1000;

  if (travel < viewHeight * MIN_DRIVE) return fail('no-drive');
  if (durSec <= 0 || durSec > MAX_DRIVE_SECONDS) return fail('too-slow');

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

export function faultMessage(fault: SwingFault): string {
  switch (fault) {
    case 'no-pullback': return 'wind up first — drag down, then drive up';
    case 'no-drive': return 'now drive up through the log';
    case 'too-slow': return 'too slow — drive up sharply';
  }
}
