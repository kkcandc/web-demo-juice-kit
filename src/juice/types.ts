/** Hit strength shared by stop, camera, sparks, and sound. */
export type HitTier = 'light' | 'medium' | 'heavy' | 'crush';

/** Plain 3D point so callers are not forced to construct a Three vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
