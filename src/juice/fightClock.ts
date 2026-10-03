/**
 * Fixed-timestep fight clock.
 * Gameplay advances in discrete frames (60 by default). Call `tick` once per
 * rendered frame, then run that many simulation steps. Skip `markRoundFrame`
 * on hit-stop frames so the round timer freezes with the fighters.
 */

export interface FightClockOptions {
  /** Simulation frames per second. Fighting games use 60. */
  fps?: number;
  /** Max frames consumed in one tick so a stalled tab cannot spiral. */
  maxSteps?: number;
}

export interface FightClock {
  readonly fps: number;
  /** Every stepped frame, including hit-stop. */
  readonly frame: number;
  /** Gameplay frames only. Stays put while the round is frozen. */
  readonly roundFrame: number;
  /** Real seconds not yet spent on a simulation frame. */
  readonly accumulator: number;
  readonly paused: boolean;
  setPaused(paused: boolean): void;
  /** Zero the round counter. The lifetime frame count stays. */
  resetRound(): void;
  /**
   * @param deltaSeconds real time since the previous tick
   * @returns how many simulation frames to run
   */
  tick(deltaSeconds: number): number;
  /** Count one unfrozen gameplay frame toward the round timer. */
  markRoundFrame(): void;
}

export function createFightClock(options: FightClockOptions = {}): FightClock {
  const fps = options.fps ?? 60;
  const frameSeconds = 1 / fps;
  const maxSteps = options.maxSteps ?? 5;
  let accumulator = 0;
  let frame = 0;
  let roundFrame = 0;
  let paused = false;

  return {
    get fps() {
      return fps;
    },
    get frame() {
      return frame;
    },
    get roundFrame() {
      return roundFrame;
    },
    get accumulator() {
      return accumulator;
    },
    get paused() {
      return paused;
    },
    setPaused(next) {
      paused = next;
    },
    resetRound() {
      roundFrame = 0;
      accumulator = 0;
    },
    tick(deltaSeconds) {
      if (paused) return 0;
      accumulator += Math.max(0, deltaSeconds);
      let steps = 0;
      while (accumulator >= frameSeconds && steps < maxSteps) {
        accumulator -= frameSeconds;
        steps += 1;
        frame += 1;
      }
      // Drop leftover time after a long hitch instead of fast-forwarding a round.
      if (steps === maxSteps && accumulator > frameSeconds) accumulator = 0;
      return steps;
    },
    markRoundFrame() {
      roundFrame += 1;
    },
  };
}

/** Same clock, named for code that thinks in timesteps rather than rounds. */
export const createFixedTimestep = createFightClock;

export type FixedTimestep = FightClock;

export const FIGHT_FPS = 60;

export function framesToSeconds(frames: number, fps = FIGHT_FPS): number {
  return frames / fps;
}
