import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { blockBarkTexture, blockTopTexture } from './textures';

/** where the camera sits for the current viewport shape */
export interface CameraFrame {
  height: number;
  dist: number;
  lookAtY: number;
}

export interface Yard {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** world y of the top of the chopping block */
  blockTop: number;
  /** current framing; recomputed on resize, read by the idle camera drift */
  frame: CameraFrame;
  /**
   * Re-render the shadow map on this frame. Call while anything is actually
   * moving; the sun drifts too slowly to need it otherwise.
   */
  nudgeShadows(): void;
  /** advance ambient time-of-day drift */
  update(dt: number): void;
}

/**
 * Framing has to work from a phone held upright to a wide desktop window.
 * A narrow viewport can't fit the pile across its width, so portrait trades
 * sideways room for a higher, steeper camera — the semicircle then reads up
 * the screen, which is the axis a phone actually has to spare.
 */
export function cameraFrameFor(aspect: number): CameraFrame {
  const t = Math.max(0, Math.min((aspect - 0.5) / 1.1, 1)); // 0 = tall, 1 = wide
  return {
    height: 1.9 + t * 0.15,
    dist: 2.6 + t * 0.45,
    lookAtY: 0.6 - t * 0.05,
  };
}

export function fovFor(aspect: number): number {
  const t = Math.max(0, Math.min((aspect - 0.5) / 1.1, 1));
  return 60 - t * 10;
}

/** in-game day length, seconds. Long enough that the light just... drifts. */
const DAY_SECONDS = 60 * 12;

const SKY_NOON = new THREE.Color('#9fc3dd');
const SKY_GOLDEN = new THREE.Color('#dfae84');
const SUN_NOON = new THREE.Color('#fff5e0');
const SUN_GOLDEN = new THREE.Color('#ffb877');

export function createYard(container: HTMLElement): Yard {
  // Phones are fill-rate bound long before they're triangle bound, so cap the
  // pixel ratio harder on small screens and shrink the shadow map to match.
  const small = Math.min(window.innerWidth, window.innerHeight) < 640;
  const renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 2 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = small ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Filmic tone mapping is what pulls the look off "flat digital render" toward
  // the warm, softly-rolled-off highlights of the reference photo. Nearly free,
  // and it rescales every material below, so it comes first.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = SKY_NOON.clone();
  scene.fog = new THREE.Fog(SKY_NOON.clone(), 12, 42);

  const startAspect = window.innerWidth / window.innerHeight;
  const frame = cameraFrameFor(startAspect);
  const camera = new THREE.PerspectiveCamera(fovFor(startAspect), startAspect, 0.05, 100);
  camera.position.set(0, frame.height, frame.dist);
  camera.lookAt(0, frame.lookAtY, 0);

  const hemi = new THREE.HemisphereLight('#cfe4f5', '#4a4234', 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(SUN_NOON.clone(), 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0005;
  // The woodpile only grows, so a per-frame shadow pass gets steadily more
  // expensive forever — for a scene that is static between swings. Redraw it
  // on demand instead (see nudgeShadows) plus a slow tick for the sun's drift.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
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

  // chopping block: a fat old weathered stump. Grey fissured bark on the sides,
  // a checked end-grain face on top — the hero surface the round is split on.
  const blockHeight = 0.52;
  const blockBark = blockBarkTexture(9001);
  blockBark.repeat.set(5, 1);
  const block = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.39, blockHeight, 32),
    new THREE.MeshStandardMaterial({
      map: blockBark, bumpMap: blockBark, bumpScale: 1.4, roughness: 1,
    }),
  );
  block.position.y = blockHeight / 2;
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
  const blockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.335, 32),
    new THREE.MeshStandardMaterial({
      map: blockTopTexture(9001), roughness: 0.92,
    }),
  );
  blockFace.rotation.x = -Math.PI / 2;
  blockFace.position.y = blockHeight + 0.001;
  blockFace.receiveShadow = true;
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

  const yard: Yard = {
    renderer, scene, camera, blockTop: blockHeight, frame,
    nudgeShadows: () => { sun.shadow.needsUpdate = true; },
    update: () => {},
  };

  function relayout(): void {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.fov = fovFor(aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    yard.frame = cameraFrameFor(aspect);
  }
  window.addEventListener('resize', relayout);
  // iOS fires orientationchange before the new innerWidth lands
  window.addEventListener('orientationchange', () => setTimeout(relayout, 120));

  let dayT = DAY_SECONDS * 0.28; // start mid-morning
  const skyColor = new THREE.Color();
  const sunColor = new THREE.Color();

  let shadowTick = 0;
  yard.update = (dt: number) => {
    // slow heartbeat so the sun's drift still reaches the shadows
    shadowTick -= dt;
    if (shadowTick <= 0) {
      sun.shadow.needsUpdate = true;
      shadowTick = 0.6;
    }
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
  };

  return yard;
}

function groundTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const rand = mulberry32(777);
  ctx.fillStyle = '#55643d';
  ctx.fillRect(0, 0, 512, 512);
  // broad worn dirt/leaf-litter patches under the splitting area, so it isn't
  // a uniform lawn — the reference ground is grass shot through with dead leaves
  for (let i = 0; i < 40; i++) {
    const x = rand() * 512, y = rand() * 512, r = 20 + rand() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(120, 96, 58, 0.4)' : 'rgba(92, 78, 50, 0.35)');
    g.addColorStop(1, 'rgba(120, 96, 58, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 5;
    const shade = rand();
    // greens, plus a fraction of tan/brown flecks reading as scattered dead leaves
    ctx.fillStyle =
      shade < 0.32 ? 'rgba(66, 84, 44, 0.5)'
      : shade < 0.6 ? 'rgba(104, 120, 64, 0.45)'
      : shade < 0.8 ? 'rgba(150, 130, 82, 0.4)'
      : 'rgba(120, 88, 52, 0.4)';
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
