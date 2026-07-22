import * as THREE from 'three';
import { mulberry32 } from '../core/rng';

export interface Yard {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** world y of the top of the chopping block */
  blockTop: number;
  /** advance ambient time-of-day drift */
  update(dt: number): void;
}

/** in-game day length, seconds. Long enough that the light just... drifts. */
const DAY_SECONDS = 60 * 12;

const SKY_NOON = new THREE.Color('#9fc3dd');
const SKY_GOLDEN = new THREE.Color('#dfae84');
const SUN_NOON = new THREE.Color('#fff5e0');
const SUN_GOLDEN = new THREE.Color('#ffb877');

export function createYard(container: HTMLElement): Yard {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = SKY_NOON.clone();
  scene.fog = new THREE.Fog(SKY_NOON.clone(), 12, 42);

  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.05, 100,
  );
  camera.position.set(0, 2.05, 3.05);
  camera.lookAt(0, 0.55, 0);

  const hemi = new THREE.HemisphereLight('#cfe4f5', '#4a4234', 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(SUN_NOON.clone(), 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  // ground: a big grassy disc with splotchy color noise
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(36, 48),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // chopping block: a fat old stump
  const blockHeight = 0.5;
  const block = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, blockHeight, 20),
    new THREE.MeshStandardMaterial({ color: '#6b5138', roughness: 0.95 }),
  );
  block.position.y = blockHeight / 2;
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
  const blockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.235, 20),
    new THREE.MeshStandardMaterial({ color: '#a8895f', roughness: 0.9 }),
  );
  blockFace.rotation.x = -Math.PI / 2;
  blockFace.position.y = blockHeight + 0.001;
  scene.add(blockFace);

  // a few background trees so the horizon isn't empty
  const treeRand = mulberry32(4242);
  for (let i = 0; i < 24; i++) {
    const a = treeRand() * Math.PI * 2;
    const d = 14 + treeRand() * 16;
    const h = 3 + treeRand() * 4;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, h * 0.35, 6),
      new THREE.MeshStandardMaterial({ color: '#5c4632', roughness: 1 }),
    );
    trunk.position.y = h * 0.175;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(h * 0.28, h * 0.75, 7),
      new THREE.MeshStandardMaterial({ color: treeRand() > 0.5 ? '#3e5c34' : '#48663a', roughness: 1 }),
    );
    crown.position.y = h * 0.35 + h * 0.35;
    tree.add(trunk, crown);
    tree.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    scene.add(tree);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let dayT = DAY_SECONDS * 0.28; // start mid-morning
  const skyColor = new THREE.Color();
  const sunColor = new THREE.Color();

  return {
    renderer,
    scene,
    camera,
    blockTop: blockHeight,
    update(dt: number) {
      dayT = (dayT + dt) % DAY_SECONDS;
      const p = dayT / DAY_SECONDS;
      // golden-ness swells at the ends of the loop, noon in the middle
      const golden = 0.5 + 0.5 * Math.cos(p * Math.PI * 2);
      skyColor.lerpColors(SKY_NOON, SKY_GOLDEN, golden * 0.8);
      sunColor.lerpColors(SUN_NOON, SUN_GOLDEN, golden * 0.9);
      (scene.background as THREE.Color).copy(skyColor);
      scene.fog!.color.copy(skyColor);
      sun.color.copy(sunColor);
      sun.intensity = 1.7 - golden * 0.7;
      hemi.intensity = 0.75 - golden * 0.25;

      const az = p * Math.PI * 2 + Math.PI * 0.25;
      const el = (0.35 + 0.3 * (1 - golden)) * Math.PI * 0.5;
      sun.position.set(
        Math.cos(az) * Math.cos(el) * 14,
        Math.sin(el) * 14,
        Math.sin(az) * Math.cos(el) * 14,
      );
    },
  };
}

function groundTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const rand = mulberry32(777);
  ctx.fillStyle = '#57683f';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 5;
    const shade = rand();
    ctx.fillStyle =
      shade < 0.4 ? 'rgba(70, 88, 48, 0.5)'
      : shade < 0.75 ? 'rgba(104, 118, 66, 0.45)'
      : 'rgba(128, 116, 74, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  return t;
}
