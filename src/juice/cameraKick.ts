/**
 * Side-on camera punch-in.
 * Rest pose looks along the fight line from +Z. On a hit the camera kicks
 * opposite the strike, dollies toward the impact, narrows FOV, then eases home.
 */
import type { HitTier, Vec3 } from './types';

/** Structural camera so this module does not import Three. */
export interface KickCamera {
  position: { set(x: number, y: number, z: number): void };
  fov: number;
  lookAt(x: number, y: number, z: number): void;
  updateProjectionMatrix(): void;
}

export interface CameraRest {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
}

const DEFAULT_REST: CameraRest = {
  position: { x: 0, y: 1.42, z: 6.35 },
  lookAt: { x: 0, y: 1.08, z: 0 },
  fov: 36,
};

const TIER_STRENGTH: Record<HitTier, number> = {
  light: 0.34,
  medium: 0.62,
  heavy: 0.95,
  crush: 1.22,
};

export interface CameraPunch {
  /** World position of the contact. */
  impact: Vec3;
  tier: HitTier;
  /** +1 if the strike travels toward +X, -1 toward -X. */
  side: 1 | -1;
}

export interface CameraKick {
  readonly active: boolean;
  setRest(rest: Partial<Omit<CameraRest, 'position' | 'lookAt'>> & {
    position?: Partial<Vec3>;
    lookAt?: Partial<Vec3>;
  }): void;
  /** Start a punch-in. Calling again restarts the envelope from the new hit. */
  punchIn(punch: CameraPunch): void;
  /** Apply the pose. Call every rendered frame, including during hit-stop. */
  update(deltaSeconds: number, camera: KickCamera): void;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function createCameraKick(rest: Partial<CameraRest> = {}): CameraKick {
  const base: CameraRest = {
    position: { ...DEFAULT_REST.position, ...rest.position },
    lookAt: { ...DEFAULT_REST.lookAt, ...rest.lookAt },
    fov: rest.fov ?? DEFAULT_REST.fov,
  };

  let elapsed = 0;
  let duration = 0;
  let active = false;
  let kickX = 0;
  let kickY = 0;
  let dolly = 0;
  let fovDelta = 0;
  let lookX = 0;
  let lookY = 0;

  const attack = 0.065;
  const hold = 0.05;

  function envelope(t: number): number {
    if (t <= attack) return smoothstep(t / attack);
    if (t <= attack + hold) return 1;
    const back = (t - attack - hold) / Math.max(0.0001, duration - attack - hold);
    return 1 - smoothstep(back);
  }

  return {
    get active() {
      return active;
    },
    setRest(next) {
      if (next.position) Object.assign(base.position, next.position);
      if (next.lookAt) Object.assign(base.lookAt, next.lookAt);
      if (next.fov != null) base.fov = next.fov;
    },
    punchIn({ impact, tier, side }) {
      const strength = TIER_STRENGTH[tier];
      kickX = -side * 0.24 * strength;
      kickY = 0.06 * strength;
      dolly = 1.05 * strength;
      fovDelta = -5.4 * strength;
      lookX = (impact.x - base.lookAt.x) * 0.4;
      lookY = (impact.y - base.lookAt.y) * 0.55;
      elapsed = 0;
      duration = attack + hold + 0.24 + 0.05 * strength;
      active = true;
    },
    update(deltaSeconds, camera) {
      let amount = 0;
      if (active) {
        elapsed += Math.max(0, deltaSeconds);
        amount = envelope(elapsed);
        if (elapsed >= duration) {
          active = false;
          amount = 0;
        }
      }
      const shake = amount * Math.sin(elapsed * 74) * 0.02;
      camera.position.set(
        base.position.x + kickX * amount + shake,
        base.position.y + kickY * amount,
        base.position.z - dolly * amount,
      );
      camera.fov = base.fov + fovDelta * amount;
      camera.lookAt(
        base.lookAt.x + lookX * amount,
        base.lookAt.y + lookY * amount,
        base.lookAt.z,
      );
      camera.updateProjectionMatrix();
    },
  };
}
