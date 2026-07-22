import { mulberry32 } from './rng';

export type Species = 'pine' | 'oak' | 'elm';

export interface Knot {
  /** angle around the log, radians [0, 2π) */
  angle: number;
  /** height along the log, fraction [0, 1] */
  z: number;
  /** radius of influence, radians of arc it protects */
  size: number;
  /** how strongly it arrests a crack, 0..1 */
  hardness: number;
}

export interface LogSpec {
  seed: number;
  species: Species;
  /** meters */
  radius: number;
  /** meters */
  length: number;
  /** grain twist end-to-end, radians. Elm gets ugly here. */
  twist: number;
  seasoned: boolean;
  knots: Knot[];
}

export interface SpeciesInfo {
  label: string;
  /** base resistance to splitting; pine pops, elm fights */
  toughness: number;
  knotsMean: number;
  twistMax: number;
  woodColor: string;
  barkColor: string;
  ringColor: string;
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  pine: {
    label: 'Pine', toughness: 0.55, knotsMean: 1.4, twistMax: 0.18,
    woodColor: '#e8cf9a', barkColor: '#7a5c42', ringColor: '#c9a86b',
  },
  oak: {
    label: 'Oak', toughness: 1.0, knotsMean: 0.9, twistMax: 0.35,
    woodColor: '#d9b98c', barkColor: '#5a4a3c', ringColor: '#a67f52',
  },
  elm: {
    label: 'Elm', toughness: 1.35, knotsMean: 1.8, twistMax: 1.0,
    woodColor: '#d8c1a0', barkColor: '#6b6156', ringColor: '#a88f6e',
  },
};

const SPECIES_WEIGHTS: Array<[Species, number]> = [
  ['pine', 0.45],
  ['oak', 0.35],
  ['elm', 0.2],
];

export function generateLog(seed: number): LogSpec {
  const rand = mulberry32(seed);

  let pick = rand();
  let species: Species = 'pine';
  for (const [s, w] of SPECIES_WEIGHTS) {
    if (pick < w) { species = s; break; }
    pick -= w;
  }
  const info = SPECIES[species];

  const radius = 0.13 + rand() * 0.07;
  const length = 0.34 + rand() * 0.1;
  const twist = (rand() * 2 - 1) * info.twistMax;
  const seasoned = rand() < 0.6;

  const knotCount = Math.floor(rand() * (info.knotsMean + 1) + rand() * info.knotsMean * 0.6);
  const knots: Knot[] = [];
  for (let i = 0; i < knotCount; i++) {
    knots.push({
      angle: rand() * Math.PI * 2,
      z: 0.15 + rand() * 0.7,
      size: 0.18 + rand() * 0.3,
      hardness: 0.5 + rand() * 0.5,
    });
  }

  return { seed, species, radius, length, twist, seasoned, knots };
}

/** e.g. "Green Elm · 13in" — shown briefly when a round lands on the block */
export function describeLog(spec: LogSpec): string {
  const inches = Math.round(spec.radius * 2 * 39.37);
  const cond = spec.seasoned ? 'Seasoned' : 'Green';
  return `${cond} ${SPECIES[spec.species].label} · ${inches}in`;
}
