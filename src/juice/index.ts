/**
 * Browser juice kit for kkcandc demos.
 * Import the barrel, or import a module directly to skip Three.js
 * (`fightClock`, `hitStop`, `cameraKick`, `layeredHitSfx`, `arcadeHud`).
 */
export type { HitTier, Vec3 } from './types';

export {
  createFightClock,
  createFixedTimestep,
  framesToSeconds,
  FIGHT_FPS,
  type FightClock,
  type FixedTimestep,
  type FightClockOptions,
} from './fightClock';

export { createHitStop, HIT_STOP_FRAMES, type HitStop } from './hitStop';

export {
  createCameraKick,
  type CameraKick,
  type CameraPunch,
  type CameraRest,
  type KickCamera,
} from './cameraKick';

export { createSparkField, type SparkField, type SparkBurst } from './sparks';

export {
  createLayeredHitSfx,
  decodeSample,
  layersForTier,
  type LayeredHitSfx,
  type SfxLayer,
} from './layeredHitSfx';

export {
  createArcadeHud,
  frameAdvantage,
  advantageOnHit,
  advantageOnBlock,
  type ArcadeHud,
  type MoveFrames,
  type FrameAdvantageInput,
} from './arcadeHud';
