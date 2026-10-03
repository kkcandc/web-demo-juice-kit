/** Original training-room fighters. Silhouettes are ours — not a licensed cast. */
import * as THREE from 'three';

export interface Fighter {
  root: THREE.Group;
  fist: THREE.Object3D;
  setArm(extend: number, chamber: number): void;
  setFlinch(amount: number): void;
  bob(time: number): void;
  flash(amount: number): void;
}

function mat(color: string, roughness = 0.55): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

export function createFighter(kind: 'striker' | 'dummy'): Fighter {
  const striker = kind === 'striker';
  const root = new THREE.Group();
  const bob = new THREE.Group();
  root.add(bob);

  const skin = mat(striker ? '#f0c7a8' : '#e6d3c4', 0.72);
  const cloth = mat(striker ? '#ff5a36' : '#314158', 0.62);
  const shorts = mat(striker ? '#1c2430' : '#1a1e28', 0.7);
  const glove = mat(striker ? '#f7f1e4' : '#d5dbe6', 0.4);
  const hair = mat(striker ? '#241820' : '#2a3038', 0.8);
  cloth.emissive = new THREE.Color(striker ? '#ff5a36' : '#8fb4ff');
  cloth.emissiveIntensity = 0;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.3), cloth);
  torso.position.y = 1.12;
  torso.castShadow = true;
  bob.add(torso);

  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.28), shorts);
  hip.position.y = 0.72;
  hip.castShadow = true;
  bob.add(hip);

  const legGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  const legNear = new THREE.Mesh(legGeo, skin);
  legNear.position.set(0.02, 0.32, 0.1);
  legNear.castShadow = true;
  const legFar = new THREE.Mesh(legGeo, shorts);
  legFar.position.set(-0.04, 0.32, -0.08);
  legFar.castShadow = true;
  bob.add(legNear, legFar);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  bob.add(head);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  cap.position.y = 1.66;
  bob.add(cap);

  if (!striker) {
    const target = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 24),
      new THREE.MeshBasicMaterial({ color: '#ffb703' }),
    );
    target.position.set(-0.02, 1.16, 0.16);
    bob.add(target);
    const bull = new THREE.Mesh(
      new THREE.CircleGeometry(0.07, 20),
      new THREE.MeshBasicMaterial({ color: '#1a1208' }),
    );
    bull.position.set(-0.02, 1.16, 0.18);
    bob.add(bull);
  }

  const armPivot = new THREE.Group();
  armPivot.position.set(0.12, 1.28, 0.12);
  const armGeo = new THREE.BoxGeometry(0.56, 0.13, 0.13);
  armGeo.translate(0.28, 0, 0);
  const arm = new THREE.Mesh(armGeo, skin);
  arm.castShadow = true;
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), glove);
  fist.position.x = 0.62;
  fist.castShadow = true;
  armPivot.add(arm, fist);
  bob.add(armPivot);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 24),
    new THREE.MeshBasicMaterial({ color: '#07040a', transparent: true, opacity: 0.45 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  function setArm(extend: number, chamber: number) {
    const e = THREE.MathUtils.clamp(extend, 0, 1);
    const c = THREE.MathUtils.clamp(chamber, 0, 1);
    armPivot.rotation.z = -0.45 + c * 1.2 + e * 0.4;
    armPivot.rotation.y = c * -0.55;
    armPivot.scale.set(1 + e * 0.48, 1 - e * 0.06, 1);
  }

  setArm(0, 0);

  return {
    root,
    fist,
    setArm,
    setFlinch(amount) {
      const n = THREE.MathUtils.clamp(amount, 0, 1);
      torso.rotation.z = -0.45 * n;
      head.position.x = 0.08 * n;
      head.rotation.z = -0.5 * n;
      torso.position.x = 0.06 * n;
    },
    bob(time) {
      bob.position.y = Math.sin(time * 2.4) * 0.028;
    },
    flash(amount) {
      cloth.emissiveIntensity = Math.max(0, amount);
    },
  };
}
