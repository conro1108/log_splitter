import * as THREE from 'three';
import { hash2 } from '../core/rng';
import type { PieceState } from '../core/split';
import { isFullRound, pieceSpan } from '../core/split';
import { barkTexture, endTexture, grainTexture } from './textures';

export interface PieceMesh {
  mesh: THREE.Mesh;
  piece: PieceState;
  /** redraw the end-grain texture after crack progress changes */
  refreshCracks(): void;
  dispose(): void;
}

/**
 * A cylinder sector: bark shell, two end caps, and (for split pieces) two
 * jagged flat faces. Local axis is +Y with the base at y=0; angle 0 is +X.
 * Materials: [0] bark, [1] end grain, [2] split faces.
 */
export function buildPieceMesh(piece: PieceState): PieceMesh {
  const geo = buildGeometry(piece);
  const spec = piece.spec;

  // The color canvases double as bump sources: their light/dark streaks are
  // exactly the ridges and fissures we want in relief, so side-light catches
  // real surface instead of a flat decal. Free — no extra textures uploaded.
  const bark = barkTexture(spec);
  const matBark = new THREE.MeshStandardMaterial({
    map: bark, bumpMap: bark, bumpScale: 1.1, roughness: 0.95, side: THREE.DoubleSide,
  });
  let end = endTexture(piece);
  const matEnd = new THREE.MeshStandardMaterial({
    map: end.texture, roughness: 0.85, side: THREE.DoubleSide,
  });
  const grain = grainTexture(spec);
  const matSplit = new THREE.MeshStandardMaterial({
    map: grain, bumpMap: grain, bumpScale: 0.6, roughness: 0.9, side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, [matBark, matEnd, matSplit]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // bark and grain maps are module-cached; only a bespoke end cap is ours to free
  const releaseEnd = () => { if (!end.shared) end.texture.dispose(); };

  return {
    mesh,
    piece,
    refreshCracks() {
      releaseEnd();
      end = endTexture(piece);
      matEnd.map = end.texture;
      matEnd.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      releaseEnd();
      matBark.dispose();
      matEnd.dispose();
      matSplit.dispose();
    },
  };
}

function buildGeometry(piece: PieceState): THREE.BufferGeometry {
  const { spec } = piece;
  const R = spec.radius;
  const L = spec.length;
  const a0 = piece.arcStart;
  const span = pieceSpan(piece);
  const full = isFullRound(piece);

  const n = Math.max(10, Math.round((span / (Math.PI * 2)) * 48)); // arc segs
  const m = 6; // height segs

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: Array<{ start: number; count: number; mat: number }> = [];

  const vert = (x: number, y: number, z: number, u: number, v: number): number => {
    positions.push(x, y, z);
    uvs.push(u, v);
    return positions.length / 3 - 1;
  };

  const beginGroup = (mat: number) => ({ start: indices.length, mat });
  const endGroup = (g: { start: number; mat: number }) =>
    groups.push({ start: g.start, count: indices.length - g.start, mat: g.mat });

  // --- bark shell ---
  let g = beginGroup(0);
  const barkRing: number[][] = [];
  for (let j = 0; j <= m; j++) {
    const row: number[] = [];
    const y = (j / m) * L;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (span * i) / n;
      const bump = 1 + (hash2(spec.seed * 97 + i, j) - 0.5) * 0.06;
      row.push(vert(Math.cos(a) * R * bump, y, Math.sin(a) * R * bump, a / (Math.PI * 2), j / m));
    }
    barkRing.push(row);
  }
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const v00 = barkRing[j][i];
      const v01 = barkRing[j][i + 1];
      const v10 = barkRing[j + 1][i];
      const v11 = barkRing[j + 1][i + 1];
      indices.push(v00, v01, v11, v00, v11, v10);
    }
  }
  endGroup(g);

  // --- end caps (fan from center; uv maps the face to the ring texture) ---
  g = beginGroup(1);
  for (const y of [0, L]) {
    const center = vert(0, y, 0, 0.5, 0.5);
    const ring: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (span * i) / n;
      ring.push(vert(Math.cos(a) * R, y, Math.sin(a) * R, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5));
    }
    for (let i = 0; i < n; i++) {
      if (y === 0) indices.push(center, ring[i], ring[i + 1]);
      else indices.push(center, ring[i + 1], ring[i]);
    }
  }
  endGroup(g);

  // --- split faces (only sectors have them) ---
  if (!full) {
    g = beginGroup(2);
    const p = 4; // radial segs
    const q = 6; // height segs
    for (const af of [a0, a0 + span]) {
      const nx = Math.sin(af);
      const nz = -Math.cos(af);
      const grid: number[][] = [];
      for (let j = 0; j <= q; j++) {
        const row: number[] = [];
        const y = (j / q) * L;
        for (let i = 0; i <= p; i++) {
          const rr = (i / p) * R;
          // jag the interior so the face reads as torn fiber, not a saw cut
          const interior = i > 0 && i < p && j > 0 && j < q;
          const off = interior
            ? (hash2(spec.seed * 31 + i + j * 7, Math.round(af * 100)) - 0.5) * 0.018
            : 0;
          row.push(vert(
            Math.cos(af) * rr + nx * off, y, Math.sin(af) * rr + nz * off,
            i / p, j / q,
          ));
        }
        grid.push(row);
      }
      for (let j = 0; j < q; j++) {
        for (let i = 0; i < p; i++) {
          indices.push(grid[j][i], grid[j][i + 1], grid[j + 1][i + 1]);
          indices.push(grid[j][i], grid[j + 1][i + 1], grid[j + 1][i]);
        }
      }
    }
    endGroup(g);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  for (const grp of groups) geo.addGroup(grp.start, grp.count, grp.mat);
  geo.computeVertexNormals();
  return geo;
}
