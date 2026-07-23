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

  // dark forged steel for the body, a brighter honed strip for the bit so the
  // cutting edge catches light and the head doesn't read as one flat blob
  const steel = new THREE.MeshStandardMaterial({
    color: '#54585f', metalness: 0.85, roughness: 0.45,
  });
  const honed = new THREE.MeshStandardMaterial({
    color: '#c7ccd4', metalness: 0.9, roughness: 0.25,
  });
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5326', roughness: 0.8 });

  const head = new THREE.Mesh(axeHeadGeometry(), steel);
  head.scale.setScalar(1.2);
  head.castShadow = true;

  // the sharpened bevel: a thin bright wedge riding the cutting edge
  const bit = new THREE.Mesh(honeGeometry(), honed);
  bit.scale.setScalar(1.2);
  bit.castShadow = true;

  // haft: long and stout, angled back toward the player, a touch of taper
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.9, 12), wood);
  handle.position.set(0, 0.62, 0.09);
  handle.rotation.x = 0.14;
  handle.castShadow = true;

  // a slight fawn's-foot swell at the butt — a shaped haft end, not a cut stick,
  // kept small so it never reads as a hammer poll
  const swell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.05, 12), wood);
  swell.position.set(0, 1.05, 0.2);
  swell.rotation.x = 0.14;
  swell.castShadow = true;

  g.add(head, bit, handle, swell);
  return g;
}

/**
 * A thin bright sliver hugging the cutting edge (y≈0), a hair proud of the
 * steel so it reads as a freshly honed bevel rather than z-fighting the head.
 */
function honeGeometry(): THREE.BufferGeometry {
  const hw = 0.108; // just wider than the head's edge, so it rims it
  const positions = [
    -hw, 0.0, 0.0, hw, 0.0, 0.0, hw, 0.05, 0.028, -hw, 0.05, 0.028,
    -hw, 0.0, 0.0, hw, 0.0, 0.0, hw, 0.05, -0.028, -hw, 0.05, -0.028,
  ];
  const indices = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
