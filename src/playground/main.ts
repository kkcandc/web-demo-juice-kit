/**
 * Juice Pit — a dummy straight punch that runs the whole kit:
 * fixed clock, hit-stop, side-on camera punch-in, sparks, layered SFX, arcade HUD.
 */
import * as THREE from 'three';
import '../style.css';
import { advantageOnHit, createArcadeHud } from '../juice/arcadeHud';
import { createCameraKick } from '../juice/cameraKick';
import { createFightClock } from '../juice/fightClock';
import { createHitStop } from '../juice/hitStop';
import { createLayeredHitSfx } from '../juice/layeredHitSfx';
import { createSparkField } from '../juice/sparks';
import type { HitTier } from '../juice/types';
import { createFighter } from './fighters';

const STRAIGHT = {
  name: 'STRAIGHT',
  startup: 8,
  active: 3,
  recovery: 14,
  hitstun: 20,
};

const ON_HIT = advantageOnHit(STRAIGHT);

const STRIKER_X = -0.62;
const DUMMY_X = 0.62;

const canvas = document.querySelector<HTMLCanvasElement>('#view');
if (!canvas) throw new Error('Missing #view canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x120c16, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x120c16, 8, 18);
scene.background = new THREE.Color(0x120c16);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
const cameraKick = createCameraKick();
cameraKick.update(0, camera);

const hemi = new THREE.HemisphereLight(0xffe4c8, 0x261432, 1.35);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff6ea, 2.6);
key.position.set(-3.2, 6.5, 4.2);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 18;
key.shadow.camera.left = -5;
key.shadow.camera.right = 5;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
scene.add(key);
const rim = new THREE.DirectionalLight(0x7ef0ff, 0.55);
rim.position.set(2, 3, -3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(8, 72),
  new THREE.MeshStandardMaterial({ color: '#1a1424', roughness: 0.92, metalness: 0.08 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12, 24, 0x6a4a78, 0x2a1c36);
grid.position.y = 0.01;
scene.add(grid);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 6),
  new THREE.MeshStandardMaterial({ color: '#1c1228', roughness: 1 }),
);
wall.position.set(0, 2.4, -2.4);
wall.receiveShadow = true;
scene.add(wall);

const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), new THREE.MeshBasicMaterial({ map: makeSign() }));
sign.position.set(0, 3.15, -2.32);
scene.add(sign);

function lamp(x: number) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: '#2a2433', roughness: 0.6, metalness: 0.2 }),
  );
  pole.position.y = 1.2;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffb703' }),
  );
  bulb.position.y = 2.45;
  group.add(pole, bulb);
  group.position.set(x, 0, -1.6);
  scene.add(group);
}
lamp(-3.4);
lamp(3.4);

const striker = createFighter('striker');
striker.root.position.x = STRIKER_X;
const dummy = createFighter('dummy');
dummy.root.position.x = DUMMY_X;
scene.add(striker.root, dummy.root);

const sparks = createSparkField();
scene.add(sparks.object);

const clock = createFightClock();
const hitStop = createHitStop();
const sfx = createLayeredHitSfx();
const hud = createArcadeHud(document.body);
hud.setRound(1);

const frameReadout = document.querySelector<HTMLElement>('#sim');
const moveReadout = document.querySelector<HTMLElement>('#move');
const soundReadout = document.querySelector<HTMLElement>('#sound');
const flashEl = document.querySelector<HTMLElement>('#flash');
const punchButton = document.querySelector<HTMLButtonElement>('#punch');

if (moveReadout) {
  moveReadout.textContent = `${STRAIGHT.name}  ${STRAIGHT.startup}/${STRAIGHT.active}/${STRAIGHT.recovery}  ON HIT ${ON_HIT >= 0 ? '+' : ''}${ON_HIT}`;
}

type Phase = 'idle' | 'startup' | 'active' | 'recovery';
let phase: Phase = 'idle';
let phaseFrame = 0;
let queued = false;
let hitThisSwing = false;
let dummyStun = 0;
let hits = 0;
let combo = 0;
let idleFrames = 70;
let strikerFlash = 0;
let dummyFlash = 0;

function tierForCombo(nextCombo: number): HitTier {
  if (nextCombo >= 4) return 'crush';
  if (nextCombo >= 2) return 'heavy';
  return 'medium';
}

function scoreFor(tier: HitTier): number {
  if (tier === 'crush') return 400;
  if (tier === 'heavy') return 250;
  return 150;
}

function requestPunch() {
  queued = true;
}

async function punchFromUser() {
  const audible = await sfx.unlock();
  if (soundReadout) soundReadout.textContent = audible ? 'SOUND ON' : 'TAP AGAIN FOR SOUND';
  requestPunch();
}

punchButton?.addEventListener('click', () => {
  void punchFromUser();
});
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code !== 'KeyJ' && event.code !== 'Space') return;
  event.preventDefault();
  void punchFromUser();
});
canvas.addEventListener('pointerdown', () => {
  void punchFromUser();
});

function startPunch() {
  queued = false;
  phase = 'startup';
  phaseFrame = 0;
  hitThisSwing = false;
  idleFrames = 0;
  sfx.playSwing();
}

function connect() {
  hitThisSwing = true;
  combo += 1;
  hits += 1;
  const tier = tierForCombo(combo);
  hitStop.trigger(tier);
  const impact = new THREE.Vector3();
  striker.fist.getWorldPosition(impact);
  impact.x += 0.06;
  cameraKick.punchIn({
    impact: { x: impact.x, y: impact.y, z: impact.z },
    tier,
    side: 1,
  });
  sparks.burst({
    origin: { x: impact.x, y: impact.y, z: impact.z },
    direction: { x: 1, y: 0.35, z: 0 },
    tier,
  });
  sfx.playHit(tier);
  dummyStun = STRAIGHT.hitstun;
  dummy.root.position.x = DUMMY_X;
  strikerFlash = 1;
  dummyFlash = 1;
  hud.addScore(scoreFor(tier));
  hud.setCombo(combo);
  hud.setRound(Math.floor((hits - 1) / 4) + 1);
  hud.setFrameAdvantage(ON_HIT);
  hud.setBanner(tier);
  if (flashEl) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = tier === 'crush' ? '0.7' : '0.45';
    requestAnimationFrame(() => {
      if (!flashEl) return;
      flashEl.style.transition = 'opacity 180ms linear';
      flashEl.style.opacity = '0';
    });
  }
}

function stepGameplay() {
  if (dummyStun > 0) {
    dummyStun -= 1;
    const amount = Math.min(1, dummyStun / 8);
    dummy.setFlinch(amount);
    dummy.root.position.x = DUMMY_X + (1 - dummyStun / STRAIGHT.hitstun) * 0.42;
    if (dummyStun === 0) dummy.setFlinch(0);
  } else {
    dummy.root.position.x += (DUMMY_X - dummy.root.position.x) * 0.2;
    dummy.setFlinch(0);
  }

  if (phase === 'idle') {
    idleFrames += 1;
    striker.setArm(0, 0);
    if (idleFrames > 50) {
      hud.setFrameAdvantage(null);
      hud.setBanner(null);
    }
    if (idleFrames > 240) {
      combo = 0;
      hud.setCombo(0);
    }
    if (queued || idleFrames >= 110) startPunch();
    return;
  }

  phaseFrame += 1;

  if (phase === 'startup') {
    striker.setArm(0, phaseFrame / STRAIGHT.startup);
    if (phaseFrame >= STRAIGHT.startup) {
      phase = 'active';
      phaseFrame = 0;
    }
    return;
  }

  if (phase === 'active') {
    const along = Math.min(1, phaseFrame / STRAIGHT.active);
    striker.setArm(along, 1 - along);
    if (!hitThisSwing && phaseFrame >= STRAIGHT.active) connect();
    if (phaseFrame >= STRAIGHT.active) {
      phase = 'recovery';
      phaseFrame = 0;
    }
    return;
  }

  const returning = 1 - phaseFrame / STRAIGHT.recovery;
  striker.setArm(Math.max(0, returning), 0);
  if (phaseFrame >= STRAIGHT.recovery) {
    phase = 'idle';
    phaseFrame = 0;
    striker.setArm(0, 0);
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const steps = clock.tick(dt);
  for (let i = 0; i < steps; i += 1) {
    if (hitStop.consumeFrame()) continue;
    clock.markRoundFrame();
    stepGameplay();
  }

  const time = now / 1000;
  if (dummyStun === 0) dummy.bob(time + 0.6);
  if (phase === 'idle') striker.bob(time);
  strikerFlash = Math.max(0, strikerFlash - dt * 3.2);
  dummyFlash = Math.max(0, dummyFlash - dt * 2.4);
  striker.flash(strikerFlash);
  dummy.flash(dummyFlash);
  sparks.update(dt);
  cameraKick.update(dt, camera);
  if (frameReadout) {
    const hold = hitStop.remaining > 0 ? `  ·  HIT STOP ${hitStop.remaining}F` : '';
    frameReadout.textContent = `SIM ${clock.roundFrame.toString().padStart(4, '0')}${hold}`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function makeSign(): THREE.CanvasTexture {
  const board = document.createElement('canvas');
  board.width = 1024;
  board.height = 384;
  const ctx = board.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(board);
  ctx.fillStyle = '#241432';
  ctx.fillRect(0, 0, 1024, 384);
  ctx.strokeStyle = '#ffb703';
  ctx.lineWidth = 12;
  ctx.strokeRect(24, 24, 976, 336);
  ctx.fillStyle = '#ffb703';
  ctx.font = '700 150px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JUICE PIT', 512, 168);
  ctx.fillStyle = '#f6efe4';
  ctx.font = '36px sans-serif';
  ctx.fillText('ORIGINAL TRAINING ROOM', 512, 268);
  const texture = new THREE.CanvasTexture(board);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
