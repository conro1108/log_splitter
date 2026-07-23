import * as THREE from 'three';
import { Sfx } from './audio';
import { unsplitPilePos, UNSPLIT_PILE_SIZE, woodpileSlot } from './core/layout';
import { describeLog, generateLog } from './core/log';
import {
  bundleAssignments, cords, deserialize, newSession, nextBundleSlot, recordStacked,
  serialize, takeSeed, type BundleSlot, type SessionState,
} from './core/session';
import {
  isFullRound, isStackable, makeRound, normalizeAngle, pieceSpan, resolveStrike,
  type PieceState,
} from './core/split';
import { buildPieceMesh, type PieceMesh } from './render/logMesh';
import { buildMaul } from './render/maul';
import { billetPose, lyingQuaternion, PieceSim } from './render/pieces';
import { createYard } from './render/scene';
import { UI } from './ui';

const SAVE_KEY = 'log_splitter_save_v1';
const TAU = Math.PI * 2;

// --- boot ---------------------------------------------------------------

const yard = createYard(document.getElementById('app')!);
const sim = new PieceSim();
const sfx = new Sfx();
const ui = new UI();

const session: SessionState =
  deserialize(localStorage.getItem(SAVE_KEY) ?? '') ?? newSession();
ui.applySettings(session.sound);
ui.stats(cords(session), session.logsSplit);
sfx.enabled = session.sound;

function save(): void {
  localStorage.setItem(SAVE_KEY, serialize(session));
}

// --- game state ---------------------------------------------------------

type Phase = 'idle' | 'swinging' | 'stuck' | 'placing';
let phase: Phase = 'placing';
let current: PieceMesh | null = null;
/** camera orbit angle around the yard; turning the view, not the log */
let viewYaw = 0;
let stuckClicksLeft = 0;
let shakeT = 0;
let hintRetired = false;
let lastOutcome: string | null = null;

const queue: PieceMesh[] = []; // halves waiting on the ground for their turn
const pileMeshes: PieceMesh[] = []; // unsplit rounds, delivery pile
let pendingPieces = 0; // tossed fragments not yet routed
let stackFlights = 0;

// rebuild the woodpile from the save — the pile is the save file
const savedBundles = bundleAssignments(session.stacked);
for (let i = 0; i < session.stacked.length; i++) {
  const p = session.stacked[i];
  const spec = { ...generateLog(p.seed), radius: p.r, length: p.len };
  const piece: PieceState = { spec, arcStart: p.arc, arcEnd: p.arc + p.span, cracks: {} };
  const pm = buildPieceMesh(piece);
  const { bundle, k } = savedBundles[i];
  const pose = billetPose(woodpileSlot(bundle, k), p.arc);
  pm.mesh.position.copy(pose.position);
  pm.mesh.quaternion.copy(pose.quaternion);
  yard.scene.add(pm.mesh);
}

// cursor for where the next stacked piece lands; pieces of one log share a
// bundle, so this advances only when a new round starts reaching the pile
let pileCursor: BundleSlot | null = savedBundles.length
  ? savedBundles[savedBundles.length - 1]
  : null;
let pileCursorSeed: number | null = session.stacked.length
  ? session.stacked[session.stacked.length - 1].seed
  : null;

function deliverPile(): void {
  for (let i = 0; i < UNSPLIT_PILE_SIZE; i++) {
    const spec = generateLog(takeSeed(session));
    const pm = buildPieceMesh(makeRound(spec));
    const slot = unsplitPilePos(i);
    pm.mesh.position.set(slot.x, slot.y, slot.z);
    pm.mesh.quaternion.copy(lyingQuaternion(slot));
    yard.scene.add(pm.mesh);
    pileMeshes.push(pm);
  }
  save();
}

// --- maul ---------------------------------------------------------------

const maul = buildMaul();
// the maul rides a rig that orbits with the camera, so it stays in front of the
// player as the view turns around the yard; its poses are in this rotated frame
const maulRig = new THREE.Group();
maulRig.add(maul);
yard.scene.add(maulRig);

interface Pose { x: number; y: number; z: number; rx: number; ry: number; rz: number }
// standing bit-down on the ground beside the block, handle leaning back against
// it — a 3/4 turn shows the head as an axe instead of a flat dark triangle
const REST_POSE: Pose = { x: 0.34, y: 0.0, z: 0.36, rx: 0.05, ry: 0.72, rz: -0.24 };

function applyPose(p: Pose): void {
  maul.position.set(p.x, p.y, p.z);
  maul.rotation.set(p.rx, p.ry, p.rz);
}
applyPose(REST_POSE);

interface PoseTween { from: Pose; to: Pose; t: number; dur: number; easeIn: boolean; onDone?: () => void }
let maulTween: PoseTween | null = null;
const maulQueue: Array<Omit<PoseTween, 'from' | 't'>> = [];

function currentPose(): Pose {
  return {
    x: maul.position.x, y: maul.position.y, z: maul.position.z,
    rx: maul.rotation.x, ry: maul.rotation.y, rz: maul.rotation.z,
  };
}

function maulGo(to: Pose, dur: number, easeIn = false, onDone?: () => void): void {
  maulQueue.push({ to, dur, easeIn, onDone });
}

function maulMoving(): boolean {
  return maulTween !== null || maulQueue.length > 0;
}

function updateMaul(dt: number): void {
  if (!maulTween && maulQueue.length) {
    const next = maulQueue.shift()!;
    maulTween = { from: currentPose(), t: 0, ...next };
  }
  if (!maulTween) return;
  maulTween.t += dt;
  const k = Math.min(maulTween.t / maulTween.dur, 1);
  const e = maulTween.easeIn ? k * k * k : 1 - (1 - k) ** 3;
  const { from, to } = maulTween;
  applyPose({
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    z: from.z + (to.z - from.z) * e,
    rx: from.rx + (to.rx - from.rx) * e,
    ry: from.ry + (to.ry - from.ry) * e,
    rz: from.rz + (to.rz - from.rz) * e,
  });
  if (k >= 1) {
    const done = maulTween.onDone;
    maulTween = null;
    done?.();
  }
}

// --- aim indicator ------------------------------------------------------

const aimGroup = new THREE.Group();
const aimLineMat = new THREE.MeshBasicMaterial({ color: '#f5ead0', transparent: true, opacity: 0.7 });
const aimLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.002, 0.005), aimLineMat);
const aimDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.012, 12),
  new THREE.MeshBasicMaterial({ color: '#f0c987', transparent: true, opacity: 0.9 }),
);
aimDot.rotation.x = -Math.PI / 2;
aimGroup.add(aimLine, aimDot);
aimGroup.visible = false;
yard.scene.add(aimGroup);

interface Aim { localAngle: number; worldAngle: number; radialFrac: number }
let aim: Aim | null = null;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

function updateAim(clientX: number, clientY: number): void {
  aim = null;
  if (!current || (phase !== 'idle' && phase !== 'stuck')) {
    aimGroup.visible = false;
    return;
  }
  const spec = current.piece.spec;
  const faceY = yard.blockTop + spec.length;
  pointerNdc.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(pointerNdc, yard.camera);
  const ray = raycaster.ray;
  if (Math.abs(ray.direction.y) < 1e-6) { aimGroup.visible = false; return; }
  const t = (faceY - ray.origin.y) / ray.direction.y;
  if (t <= 0) { aimGroup.visible = false; return; }
  const px = ray.origin.x + ray.direction.x * t;
  const pz = ray.origin.z + ray.direction.z * t;
  const dist = Math.hypot(px, pz);
  if (dist > spec.radius * 1.05) { aimGroup.visible = false; return; }

  const worldAngle = Math.atan2(pz, px);
  // the log isn't spun any more — turning orbits the view — so world == local
  const localAngle = normalizeAngle(worldAngle);
  if (!isFullRound(current.piece)) {
    const rel = normalizeAngle(localAngle - current.piece.arcStart);
    if (rel > pieceSpan(current.piece)) { aimGroup.visible = false; return; }
  }
  aim = { localAngle, worldAngle, radialFrac: Math.min(dist / spec.radius, 1) };

  // show the intended split line across the face
  aimGroup.visible = phase === 'idle';
  aimGroup.position.set(0, faceY + 0.004, 0);
  aimLine.rotation.y = -worldAngle;
  if (isFullRound(current.piece)) {
    aimLine.scale.x = spec.radius * 2.05;
    aimLine.position.set(0, 0, 0);
  } else {
    aimLine.scale.x = spec.radius * 1.05;
    aimLine.position.set(Math.cos(worldAngle) * spec.radius * 0.5, 0, Math.sin(worldAngle) * spec.radius * 0.5);
  }
  aimDot.position.set(
    Math.cos(worldAngle) * dist, 0.001, Math.sin(worldAngle) * dist,
  );
}

// --- wood chips ---------------------------------------------------------

interface Chip { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; life: number }
const chips: Chip[] = [];
const chipGeo = new THREE.BoxGeometry(0.02, 0.006, 0.045);

function burstChips(at: THREE.Vector3, color: string, count: number): void {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(chipGeo, mat);
    mesh.position.copy(at);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    yard.scene.add(mesh);
    const a = Math.random() * TAU;
    chips.push({
      mesh,
      vel: new THREE.Vector3(
        Math.cos(a) * (0.6 + Math.random()), 1.2 + Math.random() * 1.6, Math.sin(a) * (0.6 + Math.random()),
      ),
      spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6),
      life: 1.1 + Math.random() * 0.4,
    });
  }
}

function updateChips(dt: number): void {
  for (const c of chips) {
    c.life -= dt;
    c.vel.y -= 9.8 * dt;
    c.mesh.position.addScaledVector(c.vel, dt);
    if (c.mesh.position.y < 0.008) { c.mesh.position.y = 0.008; c.vel.set(0, 0, 0); c.spin.set(0, 0, 0); }
    c.mesh.rotation.x += c.spin.x * dt;
    c.mesh.rotation.z += c.spin.z * dt;
    if (c.life < 0.3) c.mesh.scale.setScalar(Math.max(c.life / 0.3, 0.01));
    if (c.life <= 0) yard.scene.remove(c.mesh);
  }
  for (let i = chips.length - 1; i >= 0; i--) if (chips[i].life <= 0) chips.splice(i, 1);
}

// --- flow: placing, splitting, stacking ---------------------------------

const UPRIGHT = new THREE.Quaternion();

function placeNext(): void {
  if (current || phase === 'swinging' || phase === 'stuck') return;
  phase = 'placing';

  const fromQueue = queue.shift();
  if (fromQueue) {
    sim.release(fromQueue.mesh);
    sim.flyTo(fromQueue.mesh, new THREE.Vector3(0, yard.blockTop, 0), UPRIGHT, 0.55, () => {
      fromQueue.mesh.rotation.set(0, 0, 0);
      current = fromQueue;
      phase = 'idle';
    });
    return;
  }

  if (pileMeshes.length === 0) deliverPile();
  const pm = pileMeshes.pop()!;
  sim.flyTo(pm.mesh, new THREE.Vector3(0, yard.blockTop, 0), UPRIGHT, 0.7, () => {
    pm.mesh.rotation.set(0, 0, 0);
    current = pm;
    phase = 'idle';
    ui.caption(describeLog(pm.piece.spec));
  });
}

function checkAdvance(): void {
  if (!current && phase !== 'placing' && pendingPieces === 0 && stackFlights === 0) {
    placeNext();
  } else if (!current && phase !== 'placing' && queue.length > 0) {
    placeNext();
  }
}

function routeSettled(pm: PieceMesh): void {
  pendingPieces--;
  if (isStackable(pm.piece)) {
    pileCursor = nextBundleSlot(pileCursor, pileCursorSeed, pm.piece.spec.seed);
    pileCursorSeed = pm.piece.spec.seed;
    const pose = billetPose(woodpileSlot(pileCursor.bundle, pileCursor.k), pm.piece.arcStart);
    stackFlights++;
    window.setTimeout(() => {
      sim.flyTo(
        pm.mesh,
        pose.position,
        pose.quaternion,
        0.85,
        () => {
          stackFlights--;
          recordStacked(session, pm.piece);
          save();
          ui.stats(cords(session), session.logsSplit);
          checkAdvance();
        },
      );
    }, 350 + Math.random() * 400);
  } else {
    queue.push(pm);
    checkAdvance();
  }
}

function onSplit(children: [PieceState, PieceState]): void {
  if (!current) return;
  const spec = current.piece.spec;
  const wasRound = isFullRound(current.piece);
  yard.scene.remove(current.mesh);
  current.dispose();
  current = null;

  if (wasRound) {
    session.logsSplit++;
    save();
    ui.stats(cords(session), session.logsSplit);
  }

  for (const child of children) {
    const pm = buildPieceMesh(child);
    pm.mesh.position.set(0, yard.blockTop, 0);
    yard.scene.add(pm.mesh);
    const bisWorld = child.arcStart + pieceSpan(child) / 2;
    const impulse = new THREE.Vector3(
      Math.cos(bisWorld) * (1.0 + Math.random() * 0.5),
      1.3 + Math.random() * 0.5,
      Math.sin(bisWorld) * (1.0 + Math.random() * 0.5),
    );
    const spin = new THREE.Vector3(
      (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5,
    );
    pendingPieces++;
    sim.toss(pm.mesh, impulse, spin, Math.max(spec.radius * 0.7, 0.1), () => routeSettled(pm));
  }

  if (!hintRetired) {
    hintRetired = true;
    ui.hint('');
  }
}

// --- the swing itself ---------------------------------------------------

function doSwing(worldAngle: number, radialFrac: number, power: number, accuracy: number): void {
  if (!current || phase !== 'idle') return;
  phase = 'swinging';
  aimGroup.visible = false;

  const piece = current.piece;
  const spec = piece.spec;
  const localAngle = normalizeAngle(worldAngle); // log unspun: world == local
  const faceY = yard.blockTop + spec.length;
  const hitR = Math.min(radialFrac, 0.95) * spec.radius;
  // where the blow lands in the world (chips, the log itself)
  const worldHit = new THREE.Vector3(
    Math.cos(worldAngle) * hitR, faceY, Math.sin(worldAngle) * hitR,
  );
  // the same point in the maul's orbiting rig frame, where its poses live
  const maulAngle = worldAngle + viewYaw;
  const hit = new THREE.Vector3(
    Math.cos(maulAngle) * hitR, faceY, Math.sin(maulAngle) * hitR,
  );
  const bitYaw = Math.PI / 2 - maulAngle;

  const raised: Pose = {
    x: hit.x + 0.1, y: hit.y + 1.0, z: hit.z + 0.45,
    rx: -2.1, ry: bitYaw, rz: 0.15,
  };
  const struck: Pose = { x: hit.x, y: hit.y - 0.012, z: hit.z, rx: -0.06, ry: bitYaw, rz: 0 };

  maulGo(raised, 0.2 + (1.25 - power) * 0.1);
  maulGo(struck, 0.11, true, () => {
    const result = resolveStrike(piece, { angle: localAngle, radialFrac, power, accuracy });
    lastOutcome = result.outcome;
    const heft = 0.6 + spec.radius * 2;

    switch (result.outcome) {
      case 'split': {
        sfx.pop(heft);
        burstChips(worldHit, '#e6d3a8', 9);
        maulGo({ ...struck, y: struck.y - 0.05 }, 0.1);
        maulGo(REST_POSE, 0.6);
        onSplit(result.pieces!);
        phase = 'idle'; // no current piece yet; settled fragments drive placeNext
        break;
      }
      case 'partial': {
        sfx.thunk(power);
        burstChips(worldHit, '#d9c396', 5);
        current!.refreshCracks();
        shakeT = 0.25;
        maulGo(raised, 0.3);
        maulGo(REST_POSE, 0.5);
        phase = 'idle';
        break;
      }
      case 'knot': {
        sfx.knot();
        shakeT = 0.35;
        maulGo(raised, 0.35);
        maulGo(REST_POSE, 0.5);
        ui.caption('thunk — dead knot', 1400);
        phase = 'idle';
        break;
      }
      case 'glance': {
        sfx.glance();
        maulGo({
          x: hit.x + Math.cos(maulAngle + 1.4) * 0.5, y: yard.blockTop - 0.1,
          z: hit.z + Math.sin(maulAngle + 1.4) * 0.5, rx: -0.4, ry: bitYaw, rz: 0.8,
        }, 0.22, true);
        maulGo(REST_POSE, 0.6);
        phase = 'idle';
        break;
      }
      case 'stuck': {
        sfx.stuck();
        current!.refreshCracks();
        shakeT = 0.2;
        maulGo({ ...struck, rx: -0.3 }, 0.18);
        stuckClicksLeft = 1;
        ui.hint(isTouch ? 'stuck — tap to work it free' : 'stuck — click to work it free');
        phase = 'stuck';
        break;
      }
    }
  });
}

function wiggle(): void {
  sfx.wiggle();
  shakeT = 0.15;
  stuckClicksLeft--;
  const p = currentPose();
  maulGo({ ...p, rx: p.rx - 0.15 }, 0.07);
  maulGo({ ...p, rx: p.rx + 0.1 }, 0.07);
  if (stuckClicksLeft <= 0) {
    maulGo(REST_POSE, 0.5);
    ui.hint(hintRetired ? '' : HINT);
    phase = 'idle';
  }
}

// --- input --------------------------------------------------------------

const isTouch = matchMedia('(hover: none)').matches;

const HINT = isTouch
  ? 'drag to turn the yard · tap where you want the split'
  : 'scroll to turn the yard · click where you want the split';
ui.hint(HINT);

let downAim: Aim | null = null;
let pointerActive = false;
/** horizontal drag orbits the view; only becomes a turn past a small deadzone */
let dragTurning = false;
let dragLastX = 0;
let dragStartX = 0;
let dragStartY = 0;

/** orbit the camera around the yard — everything turns, not just the log */
function turnView(dxPixels: number): void {
  viewYaw = normalizeAngle(viewYaw - dxPixels * 0.006);
}

window.addEventListener('pointermove', (e) => {
  if (pointerActive) {
    // A sideways drag past the deadzone means "turn the log", not "strike"
    if (!dragTurning && Math.abs(e.clientX - dragStartX) > 12
        && Math.abs(e.clientX - dragStartX) > Math.abs(e.clientY - dragStartY)) {
      dragTurning = true;
    }
    if (dragTurning) {
      turnView(e.clientX - dragLastX);
      dragLastX = e.clientX;
    }
    return;
  }
  updateAim(e.clientX, e.clientY);
});

window.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('#panel, #gear')) return;
  sfx.ensure();
  dragTurning = false;
  dragStartX = dragLastX = e.clientX;
  dragStartY = e.clientY;

  if (phase === 'stuck') { wiggle(); return; }
  if (phase !== 'idle') return;
  updateAim(e.clientX, e.clientY);

  pointerActive = true;
  downAim = aim;
});

window.addEventListener('pointerup', () => {
  if (!pointerActive) return;
  pointerActive = false;
  const wasTurning = dragTurning;
  dragTurning = false;
  if (phase !== 'idle') return;
  if (wasTurning) return; // that gesture turned the view; don't strike
  if (!downAim) return;

  doSwing(
    downAim.worldAngle,
    downAim.radialFrac,
    0.82 + Math.random() * 0.13,
    0.9 + Math.random() * 0.1,
  );
});

window.addEventListener('pointercancel', () => {
  pointerActive = false;
  dragTurning = false;
});

window.addEventListener('wheel', (e) => {
  viewYaw = normalizeAngle(viewYaw + e.deltaY * 0.0035);
}, { passive: true });

// keep the page itself inert under a game gesture (pull-to-refresh, zoom)
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// --- settings -----------------------------------------------------------

ui.onSoundChange = (on) => {
  session.sound = on;
  sfx.setEnabled(on);
  save();
};
ui.onReset = () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
};

// --- main loop ----------------------------------------------------------

deliverPile();
placeNext();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}

/**
 * Dev handle for driving the game headless. `strikeAt` aims in log-local
 * coordinates directly, so a test driver never has to hunt for the log by
 * sweeping the mouse across the viewport — that costs one round-trip per
 * probe and keeps a software-rasterized WebGL canvas pinned at full tilt.
 */
Object.defineProperty(window, '__ls', {
  value: {
    get phase() { return phase; },
    get aimValid() { return aim !== null; },
    get aimR() { return aim?.radialFrac ?? null; },
    get cords() { return cords(session); },
    get logsSplit() { return session.logsSplit; },
    get queueLen() { return queue.length; },
    get pending() { return pendingPieces; },
    get lastOutcome() { return lastOutcome; },
    get stacked() { return session.stacked.length; },
    strikeAt(worldAngle: number, radialFrac = 0.45, power = 0.9, accuracy = 0.95) {
      if (phase === 'stuck') { wiggle(); return 'wiggled'; }
      if (phase !== 'idle' || !current) return phase;
      doSwing(worldAngle, radialFrac, power, accuracy);
      return 'struck';
    },
  },
});

const clock = new THREE.Clock();
let elapsed = 0;
let running = true;

// A PWA left in the background must not keep rendering; on a phone that is
// pure battery burn for frames nobody sees.
document.addEventListener('visibilitychange', () => {
  const visible = !document.hidden;
  if (visible && !running) {
    running = true;
    clock.getDelta(); // drop the elapsed background time
    tick();
  }
  running = visible;
});

function tick(): void {
  if (!running) return;
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  elapsed += dt;

  yard.update(dt);
  sim.update(dt);
  updateMaul(dt);
  updateChips(dt);

  // shadows only need redrawing while something is actually in motion
  if (sim.busy || maulMoving() || chips.length > 0 || shakeT > 0) yard.nudgeShadows();

  if (current && shakeT > 0) {
    shakeT = Math.max(shakeT - dt, 0);
    const s = shakeT * 0.02;
    current.mesh.position.set(
      Math.sin(elapsed * 70) * s, yard.blockTop, Math.cos(elapsed * 63) * s,
    );
  }

  // idle camera breath, orbited around the yard by the current view angle
  const f = yard.frame;
  const bx = Math.sin(elapsed * 0.11) * 0.04;
  const by = f.height + Math.sin(elapsed * 0.07) * 0.02;
  const bz = f.dist;
  const c = Math.cos(viewYaw);
  const s = Math.sin(viewYaw);
  yard.camera.position.set(bx * c + bz * s, by, -bx * s + bz * c);
  yard.camera.lookAt(0, f.lookAtY, 0);
  // the maul rig turns with the view so the axe stays in front of the player
  maulRig.rotation.y = viewYaw;

  yard.renderer.render(yard.scene, yard.camera);
}
tick();
