/**
 * Tiered hit sparks for a side-on Three.js scene.
 * `burst` sprays flecks, a shock ring, and (on heavy hits) a streak.
 * Call `update` with real time so the burst keeps moving through hit-stop.
 */
import * as THREE from 'three';
import type { HitTier, Vec3 } from './types';

export interface SparkBurst {
  origin: Vec3;
  /** Travel direction of the strike. Defaults to +X. */
  direction?: Vec3;
  tier: HitTier;
}

export interface SparkField {
  readonly object: THREE.Object3D;
  readonly alive: number;
  burst(burst: SparkBurst): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const COUNT: Record<HitTier, number> = {
  light: 16,
  medium: 34,
  heavy: 58,
  crush: 86,
};

const SPEED: Record<HitTier, number> = {
  light: 2.4,
  medium: 3.6,
  heavy: 4.8,
  crush: 6.2,
};

const PALETTE: Record<HitTier, string[]> = {
  light: ['#fff6d4', '#ffe08a'],
  medium: ['#fff4cc', '#ffb703'],
  heavy: ['#fff1c4', '#ff5a1f'],
  crush: ['#fff6ea', '#ff2f6d', '#7ef0ff'],
};

interface Fleck {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
}

interface Streak {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: number;
}

function roundTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function readDirection(direction: Vec3 | undefined): THREE.Vector3 {
  const vector = new THREE.Vector3(direction?.x ?? 1, direction?.y ?? 0.2, direction?.z ?? 0);
  if (vector.lengthSq() < 1e-6) vector.set(1, 0.2, 0);
  return vector.normalize();
}

export function createSparkField(capacity = 320): SparkField {
  const group = new THREE.Group();
  group.name = 'juice-sparks';

  const map = roundTexture();
  const material = new THREE.MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const flecksMesh = new THREE.InstancedMesh(geometry, material, capacity);
  flecksMesh.frustumCulled = false;
  flecksMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(flecksMesh);

  const flecks: Fleck[] = [];
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < capacity; i += 1) {
    flecks.push({
      x: 0,
      y: -20,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      max: 1,
      size: 0,
      color: new THREE.Color('#ffffff'),
    });
    dummy.position.set(0, -20, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    flecksMesh.setMatrixAt(i, dummy.matrix);
    flecksMesh.setColorAt(i, tint.setRGB(0, 0, 0));
  }
  flecksMesh.instanceMatrix.needsUpdate = true;
  if (flecksMesh.instanceColor) flecksMesh.instanceColor.needsUpdate = true;

  const rings: Ring[] = [];
  const ringGeo = new THREE.RingGeometry(0.1, 0.16, 48);
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff2cc,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.visible = false;
    mesh.position.y = -20;
    group.add(mesh);
    rings.push({ mesh, life: 0, max: 1 });
  }

  const streaks: Streak[] = [];
  const streakGeo = new THREE.PlaneGeometry(1, 0.07);
  for (let i = 0; i < 8; i += 1) {
    const mesh = new THREE.Mesh(
      streakGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    mesh.visible = false;
    group.add(mesh);
    streaks.push({ mesh, life: 0, max: 1, grow: 1 });
  }

  const flashLight = new THREE.PointLight(0xfff1d6, 0, 6, 2);
  group.add(flashLight);
  let lightLife = 0;
  let lightMax = 0.12;
  let lightPeak = 0;

  function spawnFleck(origin: Vec3, velocity: THREE.Vector3, life: number, size: number, color: string) {
    const slot = flecks.find((fleck) => fleck.life <= 0);
    if (!slot) return;
    slot.x = origin.x;
    slot.y = origin.y;
    slot.z = origin.z;
    slot.vx = velocity.x;
    slot.vy = velocity.y;
    slot.vz = velocity.z;
    slot.life = life;
    slot.max = life;
    slot.size = size;
    slot.color.set(color);
  }

  function burst({ origin, direction, tier }: SparkBurst) {
    const travel = readDirection(direction);
    const count = COUNT[tier];
    const speed = SPEED[tier];
    const colors = PALETTE[tier];
    const spread = tier === 'light' ? 0.9 : tier === 'medium' ? 1.15 : 1.45;

    for (let i = 0; i < count; i += 1) {
      const spray = travel.clone();
      spray.x += (Math.random() - 0.35) * spread;
      spray.y += (Math.random() - 0.25) * spread;
      spray.z += (Math.random() - 0.5) * spread * 0.55;
      spray.normalize().multiplyScalar(speed * (0.45 + Math.random() * 0.9));
      const life = 0.18 + Math.random() * (tier === 'crush' ? 0.42 : 0.28);
      const size = (0.05 + Math.random() * 0.08) * (tier === 'crush' ? 1.35 : 1);
      const color = colors[i % colors.length] ?? colors[0];
      spawnFleck(origin, spray, life, size, color);
    }

    if (tier === 'heavy' || tier === 'crush') {
      for (let i = 0; i < 10; i += 1) {
        const drift = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random(), (Math.random() - 0.5) * 0.4);
        spawnFleck(origin, drift, 0.45 + Math.random() * 0.35, 0.04, colors[0] ?? '#fff6ea');
      }
    }

    const ring = rings.find((item) => item.life <= 0);
    if (ring) {
      ring.life = tier === 'light' ? 0.16 : 0.28;
      ring.max = ring.life;
      ring.mesh.visible = true;
      ring.mesh.position.set(origin.x, origin.y, origin.z);
      ring.mesh.scale.setScalar(0.4);
      const ringMat = ring.mesh.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.9;
      ringMat.color.set(colors[1] ?? '#ffe08a');
    }

    if (tier !== 'light') {
      const streak = streaks.find((item) => item.life <= 0);
      if (streak) {
        streak.life = 0.12;
        streak.max = 0.12;
        streak.grow = tier === 'crush' ? 1.7 : tier === 'heavy' ? 1.35 : 0.95;
        streak.mesh.visible = true;
        streak.mesh.position.set(origin.x, origin.y, origin.z + 0.02);
        streak.mesh.scale.set(0.2, 1, 1);
        const streakMat = streak.mesh.material as THREE.MeshBasicMaterial;
        streakMat.opacity = 1;
        streakMat.color.set(colors[0] ?? '#fff6d4');
      }
    }

    lightPeak = { light: 8, medium: 18, heavy: 36, crush: 60 }[tier];
    lightMax = 0.14;
    lightLife = lightMax;
    flashLight.position.set(origin.x, origin.y, origin.z + 0.4);
    flashLight.color.set(colors[1] ?? '#fff1d6');
    flashLight.intensity = lightPeak;
  }

  function update(deltaSeconds: number) {
    const dt = Math.max(0, deltaSeconds);
    let alive = 0;
    for (let i = 0; i < flecks.length; i += 1) {
      const fleck = flecks[i];
      if (!fleck || fleck.life <= 0) {
        dummy.position.set(0, -20, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        flecksMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      fleck.life -= dt;
      fleck.vy -= 3.1 * dt;
      fleck.vx *= 1 - Math.min(1, 1.8 * dt);
      fleck.vy *= 1 - Math.min(1, 0.6 * dt);
      fleck.vz *= 1 - Math.min(1, 1.8 * dt);
      fleck.x += fleck.vx * dt;
      fleck.y += fleck.vy * dt;
      fleck.z += fleck.vz * dt;
      const fade = Math.max(0, fleck.life / fleck.max);
      dummy.position.set(fleck.x, fleck.y, fleck.z);
      dummy.scale.setScalar(fleck.size * (0.4 + fade));
      dummy.updateMatrix();
      flecksMesh.setMatrixAt(i, dummy.matrix);
      tint.copy(fleck.color).multiplyScalar(fade * fade);
      flecksMesh.setColorAt(i, tint);
      if (fleck.life > 0) alive += 1;
    }
    flecksMesh.instanceMatrix.needsUpdate = true;
    if (flecksMesh.instanceColor) flecksMesh.instanceColor.needsUpdate = true;
    flecksMesh.userData.alive = alive;

    for (const ring of rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const fade = Math.max(0, ring.life / ring.max);
      const grow = 1 - fade;
      ring.mesh.scale.setScalar(0.35 + grow * 3.4);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.85;
      if (ring.life <= 0) {
        ring.mesh.visible = false;
        ring.mesh.position.y = -20;
      }
    }

    for (const streak of streaks) {
      if (streak.life <= 0) continue;
      streak.life -= dt;
      const fade = Math.max(0, streak.life / streak.max);
      streak.mesh.scale.set(0.25 + (1 - fade) * streak.grow, 1 + (1 - fade) * 0.4, 1);
      (streak.mesh.material as THREE.MeshBasicMaterial).opacity = fade;
      if (streak.life <= 0) streak.mesh.visible = false;
    }

    if (lightLife > 0) {
      lightLife -= dt;
      flashLight.intensity = Math.max(0, lightLife / lightMax) * lightPeak;
    }
  }

  return {
    object: group,
    get alive() {
      return flecks.reduce((sum, fleck) => sum + (fleck.life > 0 ? 1 : 0), 0);
    },
    burst,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
      map?.dispose();
      ringGeo.dispose();
      streakGeo.dispose();
      for (const ring of rings) (ring.mesh.material as THREE.Material).dispose();
      for (const streak of streaks) (streak.mesh.material as THREE.Material).dispose();
      flashLight.dispose();
    },
  };
}
