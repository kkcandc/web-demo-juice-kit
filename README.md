# web-demo-juice-kit

Reusable browser juice for kkcandc Vercel demos. Copy the modules into a Vite + Three.js app instead of rebuilding hit-stop, camera kick, sparks, sound, and the arcade HUD for every game.

The page in this repo is **Juice Pit**: an original training room where a striker throws a straight punch at a dummy. The punch runs the whole kit — fixed 60fps clock, hit-stop, a side-on camera punch-in that returns home, tiered sparks, layered Web Audio, and a score / round / frame-advantage HUD.

[Live playground](https://web-demo-juice-kit.vercel.app)

## Modules

| Module | Import | What it does |
| --- | --- | --- |
| `fightClock` | `createFightClock` / `createFixedTimestep` | Fixed timestep (default 60fps) with a hitch cap. `markRoundFrame()` only on unfrozen frames. |
| `hitStop` | `createHitStop` | Freezes the sim on contact. Presets: light 3, medium 6, heavy 9, crush 14. |
| `cameraKick` | `createCameraKick` | Side-on rest pose, then a punch-in (kick opposite the strike, dolly, narrower FOV) and a return. |
| `sparks` | `createSparkField` | Tiered hit VFX: flecks, shock ring, streak, and a contact light. Add `field.object` to the scene. |
| `layeredHitSfx` | `createLayeredHitSfx` | Procedural swing + tick / body / spark / sub. Swap any layer for your own sample. |
| `arcadeHud` | `createArcadeHud` | Score, round, combo, and a `+6F` / `-6F` callout. |

Frame math lives next to the HUD: `frameAdvantage`, `advantageOnHit`, `advantageOnBlock`. Positive means the attacker recovers first.

`fightClock`, `hitStop`, `cameraKick`, `layeredHitSfx`, and `arcadeHud` do not import Three.js. `sparks` does.

## Drop into another Vite app

1. Install Three.js in that app: `npm install three`
2. Copy `src/juice/` into the other project (same folder name is fine).
3. Wire one hit:

```ts
import { createFightClock } from './juice/fightClock';
import { createHitStop } from './juice/hitStop';
import { createCameraKick } from './juice/cameraKick';
import { createSparkField } from './juice/sparks';
import { createLayeredHitSfx } from './juice/layeredHitSfx';
import { createArcadeHud, advantageOnHit } from './juice/arcadeHud';

const clock = createFightClock();
const hitStop = createHitStop();
const cameraKick = createCameraKick();
const sparks = createSparkField();
const sfx = createLayeredHitSfx();
const hud = createArcadeHud();
scene.add(sparks.object);

const straight = { startup: 8, active: 3, recovery: 14, hitstun: 20 };
const onHit = advantageOnHit(straight); // +6 when it connects on the last active frame

// Inside the render loop:
const steps = clock.tick(deltaSeconds);
for (let i = 0; i < steps; i += 1) {
  if (hitStop.consumeFrame()) continue; // fighters stay frozen
  clock.markRoundFrame();
  stepGameplay();
}
sparks.update(deltaSeconds);             // VFX keep moving through the freeze
cameraKick.update(deltaSeconds, camera); // punch-in plays in real time

// On the connecting frame:
hitStop.trigger('heavy');
cameraKick.punchIn({ impact, tier: 'heavy', side: 1 });
sparks.burst({ origin: impact, direction: { x: 1, y: 0.3, z: 0 }, tier: 'heavy' });
sfx.playHit('heavy');
hud.addScore(250);
hud.setFrameAdvantage(onHit);
```

Call `sfx.unlock()` from a click or key press before you expect audio. `side` is `1` when the strike travels toward +X and `-1` toward -X.

You can also depend on this repo and import `web-demo-juice-kit` (or a subpath such as `web-demo-juice-kit/hitStop`). The package `exports` point at the TypeScript source, which Vite compiles. Copying `src/juice` is the path of least resistance.

### Dropping in samples

Procedural layers are the default so a demo makes sound with zero assets. To replace one layer, add your file under `public/sfx/` and swap it:

```ts
await sfx.unlock();
const response = await fetch('/sfx/body.wav');
const buffer = await decodeSample(sfx.context!, await response.arrayBuffer());
sfx.setSample('body', buffer); // tick, spark, sub, and swing work the same way
```

`setSample('body', null)` restores the synthesizer for that layer.

## Scripts

```bash
npm install
npm run dev      # playground at http://localhost:5173
npm test         # clock, hit-stop, frame data, camera envelope, spark lifetime
npm run build    # tsc --noEmit && vite build → dist/
```

Juice Pit loops a straight punch on its own. Click, press J, or press Space to punch early and to turn sound on.

## Vercel

`vercel.json` is the Vite setup used by the other kkcandc demos:

- Framework: Vite
- Build: `npm run build`
- Output: `dist`

Team: **kenny-klines-projects**. Production alias: [web-demo-juice-kit.vercel.app](https://web-demo-juice-kit.vercel.app).

This playground is meant to be public. Leave **Vercel Authentication (SSO) off** and **password protection off** so a shared link opens straight into Juice Pit.

`main` only holds the empty repo stub. Deploy the working branch to production (the branch that contains `src/juice` and the playground). A production deploy from `main` would publish a blank page.

```bash
npx vercel deploy --prod --scope kenny-klines-projects --yes
```

## Original IP only

Juice Pit, the striker, and the training dummy are original. Use original names, silhouettes, stages, UI, and audio in anything you build on this kit. Do not ship characters, logos, stages, fonts, or sound effects from commercial games. Record or synthesize your own samples, or use audio you have rights to.
