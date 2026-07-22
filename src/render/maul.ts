import * as THREE from 'three';

/**
 * The splitting maul: a simple primitive build. Group origin sits at the
 * striking edge of the head so main.ts can aim it at a point on the log
 * face. Handle trails up and back toward the player.
 */
export function buildMaul(): THREE.Group {
  const g = new THREE.Group();

  const steel = new THREE.MeshStandardMaterial({
    color: '#8d9299', metalness: 0.75, roughness: 0.45,
  });
  const wood = new THREE.MeshStandardMaterial({ color: '#a5763f', roughness: 0.85 });

  // head: a block with a squashed pyramid for the bit
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.17), steel);
  head.position.y = 0.1;
  head.castShadow = true;

  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.055, 0.09, 4, 1), steel);
  bit.rotation.y = Math.PI / 4;
  bit.scale.z = 2.1;
  bit.position.y = 0.028;
  bit.castShadow = true;

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 0.82, 8), wood);
  handle.position.set(0, 0.51, 0.055);
  handle.rotation.x = 0.1;
  handle.castShadow = true;

  g.add(head, bit, handle);
  return g;
}
