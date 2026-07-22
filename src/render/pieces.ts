import * as THREE from 'three';
import type { Slot } from '../core/layout';

/**
 * Just enough physics for firewood: gravity, a bouncy ground plane, then a
 * guided arc to wherever the piece belongs (the block or the woodpile).
 * Nothing here needs to be exact — it needs to feel like wood falling over.
 */

interface Body {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  /** effective ground-contact radius */
  radius: number;
  settleTimer: number;
  onSettled?: (body: Body) => void;
  done: boolean;
}

interface Flight {
  mesh: THREE.Object3D;
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toPos: THREE.Vector3;
  toQuat: THREE.Quaternion;
  arcHeight: number;
  t: number;
  duration: number;
  onDone?: () => void;
}

const GRAVITY = -9.8;

export class PieceSim {
  private bodies: Body[] = [];
  private flights: Flight[] = [];

  /** toss a mesh with an impulse; calls onSettled once it stops moving */
  toss(
    mesh: THREE.Object3D,
    impulse: THREE.Vector3,
    spin: THREE.Vector3,
    radius: number,
    onSettled?: (body: Body) => void,
  ): void {
    this.bodies.push({
      mesh, vel: impulse.clone(), angVel: spin.clone(),
      radius, settleTimer: 0, onSettled, done: false,
    });
  }

  /** fly a mesh along a gentle arc to a layout slot */
  flyToSlot(mesh: THREE.Object3D, slot: Slot, duration: number, onDone?: () => void): void {
    const toQuat = quatForSlot(slot);
    this.flights.push({
      mesh,
      fromPos: mesh.position.clone(),
      fromQuat: mesh.quaternion.clone(),
      toPos: new THREE.Vector3(slot.x, slot.y, slot.z),
      toQuat,
      arcHeight: 0.7 + Math.random() * 0.3,
      t: 0,
      duration,
      onDone,
    });
  }

  /** fly a mesh to an explicit pose (e.g. back onto the block) */
  flyTo(
    mesh: THREE.Object3D,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    duration: number,
    onDone?: () => void,
  ): void {
    this.flights.push({
      mesh,
      fromPos: mesh.position.clone(),
      fromQuat: mesh.quaternion.clone(),
      toPos: pos.clone(),
      toQuat: quat.clone(),
      arcHeight: 0.35,
      t: 0,
      duration,
      onDone,
    });
  }

  /** stop physics on a mesh (e.g. it was picked up mid-tumble) */
  release(mesh: THREE.Object3D): void {
    for (const b of this.bodies) if (b.mesh === mesh) b.done = true;
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.05);

    for (const b of this.bodies) {
      if (b.done) continue;
      b.vel.y += GRAVITY * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.angVel.x * dt;
      b.mesh.rotation.y += b.angVel.y * dt;
      b.mesh.rotation.z += b.angVel.z * dt;

      if (b.mesh.position.y < b.radius) {
        b.mesh.position.y = b.radius;
        if (b.vel.y < 0) b.vel.y *= -0.28;
        b.vel.x *= 0.72;
        b.vel.z *= 0.72;
        b.angVel.multiplyScalar(0.6);
      }

      const speed = b.vel.length() + b.angVel.length() * 0.3;
      const grounded = b.mesh.position.y <= b.radius + 0.01;
      if (grounded && speed < 0.25) {
        b.settleTimer += dt;
        if (b.settleTimer > 0.35) {
          b.done = true;
          b.onSettled?.(b);
        }
      } else {
        b.settleTimer = 0;
      }
    }
    this.bodies = this.bodies.filter((b) => !b.done);

    for (const f of this.flights) {
      f.t += dt;
      const k = Math.min(f.t / f.duration, 1);
      const e = k * k * (3 - 2 * k); // smoothstep
      f.mesh.position.lerpVectors(f.fromPos, f.toPos, e);
      f.mesh.position.y += Math.sin(e * Math.PI) * f.arcHeight;
      f.mesh.quaternion.slerpQuaternions(f.fromQuat, f.toQuat, e);
      if (k >= 1) {
        f.mesh.position.copy(f.toPos);
        f.mesh.quaternion.copy(f.toQuat);
        f.onDone?.();
      }
    }
    this.flights = this.flights.filter((f) => f.t < f.duration);
  }
}

/**
 * Orientation for a piece lying in a slot: cylinder axis (local +Y)
 * horizontal along the slot yaw, arc bisector pointing up so wedges rest on
 * their flat faces. `bisector` is the piece's local arc-middle angle.
 */
export function lyingQuaternion(slot: Slot, bisector = 0): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    bisector + Math.PI / 2,
  );
  const tip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const yaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(slot.tilt, slot.rotY, 0, 'YXZ'));
  q.multiply(yaw).multiply(tip).multiply(spin);
  return q;
}

function quatForSlot(slot: Slot): THREE.Quaternion {
  return lyingQuaternion(slot);
}

/** slot-quat but with a known arc bisector (wedges land bark-up) */
export function quatForSlotWithBisector(slot: Slot, bisector: number): THREE.Quaternion {
  return lyingQuaternion(slot, bisector);
}
