/**
 * Hit-stop. Freeze gameplay for a handful of frames on contact so the hit reads.
 * VFX and the camera keep using real time; only the fight sim should honor `consumeFrame`.
 */
import type { HitTier } from './types';

/** Default freezes. Light is a tap; crush is a short cinematic hold. */
export const HIT_STOP_FRAMES: Record<HitTier, number> = {
  light: 3,
  medium: 6,
  heavy: 9,
  crush: 14,
};

export interface HitStop {
  readonly remaining: number;
  readonly active: boolean;
  readonly tier: HitTier | null;
  /** Freeze for a tier preset, or an explicit frame count. A new trigger replaces the timer. */
  trigger(tierOrFrames: HitTier | number): void;
  /**
   * Call once per simulation frame.
   * Returns true while fighters, round timer, and hitstun should stay frozen.
   */
  consumeFrame(): boolean;
  clear(): void;
}

export function createHitStop(): HitStop {
  let remaining = 0;
  let tier: HitTier | null = null;

  return {
    get remaining() {
      return remaining;
    },
    get active() {
      return remaining > 0;
    },
    get tier() {
      return tier;
    },
    trigger(tierOrFrames) {
      if (typeof tierOrFrames === 'number') {
        remaining = Math.max(0, Math.round(tierOrFrames));
        tier = null;
        return;
      }
      tier = tierOrFrames;
      remaining = HIT_STOP_FRAMES[tierOrFrames];
    },
    consumeFrame() {
      if (remaining <= 0) return false;
      remaining -= 1;
      if (remaining === 0) tier = null;
      return true;
    },
    clear() {
      remaining = 0;
      tier = null;
    },
  };
}
