import * as THREE from 'three';

/**
 * A splitting axe. Group origin sits at the striking edge of the bit so
 * main.ts can aim it straight at a point on the log face; the head rises and
 * the handle trails back and up toward the player from there.
 *
 * The head is built as an explicit wedge rather than primitives — a box with
 * a cone on it reads as a sledgehammer from the play camera, which is the one
 * silhouette this shape must not have. Profile (seen from the side, +Y up):
 * a thin cutting edge at the bottom flaring back to a thick poll at the top.
 */
export function buildMaul(): THREE.Group {
  const g = new THREE.Group();

  const steel = new THREE.MeshStandardMaterial({
    color: '#9aa0a8', metalness: 0.8, roughness: 0.38,
  });
  const wood = new THREE.MeshStandardMaterial({ color: '#a5763f', roughness: 0.85 });

  const head = new THREE.Mesh(axeHeadGeometry(), steel);
  head.castShadow = true;

  // haft: long, slightly flared, angled back toward the player
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.86, 10), wood);
  handle.position.set(0, 0.6, 0.085);
  handle.rotation.x = 0.13;
  handle.castShadow = true;

  // knob at the end of the haft so it doesn't read as a cut-off stick
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), wood);
  knob.position.set(0, 1.02, 0.195);
  knob.scale.set(1, 0.7, 1);
  knob.castShadow = true;

  g.add(head, handle, knob);
  return g;
}

/**
 * Axe head as a lofted profile: a series of cross-sections stacked from the
 * cutting edge (y=0, razor thin, wide) up to the poll (thick, narrow), then
 * capped. x = along the cutting edge, z = cheek thickness.
 */
function axeHeadGeometry(): THREE.BufferGeometry {
  // [y, halfWidth (along edge), halfThickness (cheek), zCenter]
  // Sized to read as an axe from the play camera, where the head is only a
  // few dozen pixels tall — a scale-accurate head just becomes a dark blob.
  const profile: Array<[number, number, number, number]> = [
    [0.0, 0.105, 0.005, 0.0], // cutting edge — wide, razor thin
    [0.045, 0.11, 0.026, 0.005], // bit flaring back
    [0.105, 0.10, 0.045, 0.015], // cheek, thickest part of the wedge
    [0.175, 0.075, 0.043, 0.027], // waist behind the eye
    [0.23, 0.066, 0.048, 0.037], // poll
    [0.268, 0.054, 0.038, 0.04], // top bevel
  ];

  const positions: number[] = [];
  const indices: number[] = [];

  // four corners per ring: (-x,-z), (+x,-z), (+x,+z), (-x,+z)
  for (const [y, hw, ht, zc] of profile) {
    positions.push(-hw, y, zc - ht);
    positions.push(hw, y, zc - ht);
    positions.push(hw, y, zc + ht);
    positions.push(-hw, y, zc + ht);
  }

  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4;
      indices.push(a + j, a + j2, b + j2);
      indices.push(a + j, b + j2, b + j);
    }
  }

  // cap the bottom (the edge) and the top (the poll)
  indices.push(0, 2, 1, 0, 3, 2);
  const t = (profile.length - 1) * 4;
  indices.push(t, t + 1, t + 2, t, t + 2, t + 3);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
