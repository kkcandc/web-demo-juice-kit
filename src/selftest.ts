/**
 * Pure checks for the clock, hit-stop, frame advantage, camera envelope, and spark pool.
 * Run with `npm test`. The playground covers the rendered punch.
 */
import * as THREE from 'three';
import { advantageOnBlock, advantageOnHit, frameAdvantage } from './juice/arcadeHud';
import { createCameraKick } from './juice/cameraKick';
import { createFightClock } from './juice/fightClock';
import { HIT_STOP_FRAMES, createHitStop } from './juice/hitStop';
import { layersForTier } from './juice/layeredHitSfx';
import { createSparkField } from './juice/sparks';

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error('FAIL', message);
    return;
  }
  console.log('ok', message);
}

const clock = createFightClock();
let steps = 0;
for (let i = 0; i < 60; i += 1) steps += clock.tick(1 / 60);
assert(steps === 60, '60 real ticks at 60fps advance 60 sim frames');
assert(clock.frame === 60, 'lifetime frame counter matches');
for (let i = 0; i < 60; i += 1) clock.markRoundFrame();
assert(clock.roundFrame === 60, 'round timer counts only marked gameplay frames');

clock.setPaused(true);
assert(clock.tick(1) === 0, 'paused clock does not step');
clock.setPaused(false);

const hitch = createFightClock({ maxSteps: 5 });
assert(hitch.tick(1) === 5, 'a one-second hitch is capped at maxSteps');

const stop = createHitStop();
stop.trigger('medium');
assert(stop.remaining === HIT_STOP_FRAMES.medium, 'medium hit-stop uses the preset');
let frozen = 0;
while (stop.consumeFrame()) frozen += 1;
assert(frozen === 6, 'medium hit-stop holds for 6 frames');
assert(stop.consumeFrame() === false, 'hit-stop releases after the preset');
stop.trigger(4);
assert(stop.remaining === 4, 'a numeric trigger sets an explicit freeze');
stop.trigger('light');
assert(stop.remaining === 3, 'a new trigger replaces the timer');

const plus = frameAdvantage({ hitstun: 20, recovery: 14, activeFramesAfterHit: 0 });
assert(plus === 6, 'last-frame connect of the playground straight is +6');
assert(advantageOnHit({ hitstun: 20, recovery: 14 }) === 6, 'advantageOnHit matches');
assert(advantageOnBlock({ startup: 8, active: 3, recovery: 14, hitstun: 20, blockstun: 8 }) === -6, 'block is minus when blockstun is shorter than recovery');
assert(layersForTier('light').includes('sub') === false, 'light hits skip the sub layer');
assert(layersForTier('crush').includes('sub') === true, 'crush hits include the sub layer');

const kick = createCameraKick();
const cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 40);
kick.update(0, cam);
const restFov = cam.fov;
kick.punchIn({ impact: { x: 0.4, y: 1.2, z: 0 }, tier: 'heavy', side: 1 });
kick.update(0.08, cam);
assert(cam.fov < restFov - 1, 'punch-in narrows FOV');
assert(cam.position.z < 6.35, 'punch-in dollies toward the fighters');
assert(cam.position.x < 0, 'side-on kick shifts opposite a +X strike');
for (let i = 0; i < 40; i += 1) kick.update(0.05, cam);
assert(Math.abs(cam.fov - restFov) < 0.05, 'camera FOV returns after the envelope');
assert(Math.abs(cam.position.z - 6.35) < 0.05, 'camera dolly returns home');

const sparks = createSparkField();
sparks.burst({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 1, y: 0, z: 0 }, tier: 'heavy' });
assert(sparks.alive > 20, 'a heavy burst spawns a flock of flecks');
for (let i = 0; i < 90; i += 1) sparks.update(1 / 60);
assert(sparks.alive === 0, 'sparks die out');
sparks.dispose();

if (failures > 0) {
  throw new Error(`${failures} juice checks failed`);
}
console.log('juice kit selftest passed');
