import * as THREE from "three";
import { PATH_POINTS } from "./grid.js";

export const ENEMY_TYPES = {
  basic: {
    id: "basic",
    label: "기본",
    hp: 50,
    speed: 1.45,
    reward: 10,
    radius: 0.34,
    color: 0xffa53c,
    shape: "box",
  },
  fast: {
    id: "fast",
    label: "고속",
    hp: 40,
    speed: 2.2,
    reward: 14,
    radius: 0.28,
    color: 0xff6b4a,
    shape: "octa",
  },
  tank: {
    id: "tank",
    label: "단단",
    hp: 150,
    speed: 0.9,
    reward: 22,
    radius: 0.46,
    color: 0xd9455f,
    shape: "dodeca",
  },
  boss: {
    id: "boss",
    label: "보스",
    hp: 600,
    speed: 0.65,
    reward: 80,
    radius: 0.62,
    color: 0xb45cff,
    shape: "icosa",
  },
};

function makeGeometry(shape, radius) {
  if (shape === "box") return new THREE.BoxGeometry(radius * 1.6, radius * 1.6, radius * 1.6);
  if (shape === "octa") return new THREE.OctahedronGeometry(radius * 1.15, 0);
  if (shape === "dodeca") return new THREE.DodecahedronGeometry(radius * 1.05, 0);
  return new THREE.IcosahedronGeometry(radius * 1.1, 0);
}

export function createEnemy(typeId, scale = 1) {
  const spec = ENEMY_TYPES[typeId];
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: 0.4,
    metalness: 0.2,
    emissive: new THREE.Color(spec.color).multiplyScalar(0.25),
    flatShading: true,
  });

  const body = new THREE.Mesh(makeGeometry(spec.shape, spec.radius), material);
  body.position.y = spec.radius;
  body.castShadow = true;
  group.add(body);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(spec.radius * 1.35, 12, 10),
    new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.y = spec.radius;
  group.add(glow);

  const barBackground = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x10202a, depthTest: false, transparent: true }),
  );
  barBackground.position.y = spec.radius * 1.9 + 0.2;
  barBackground.renderOrder = 2;
  group.add(barBackground);

  const barFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x54e0a0, depthTest: false, transparent: true }),
  );
  barFill.position.set(0, 0, 0.01);
  barFill.renderOrder = 3;
  barBackground.add(barFill);

  const maxHp = Math.round(spec.hp * scale);

  return {
    id: `enemy-${Math.random().toString(36).slice(2, 9)}`,
    type: typeId,
    spec,
    group,
    body,
    barBackground,
    barFill,
    hp: maxHp,
    maxHp,
    speed: spec.speed,
    reward: Math.round(spec.reward * scale),
    radius: spec.radius,
    pathIndex: 1,
    progress: 0,
    alive: true,
    reachedEnd: false,
    spin: Math.random() * Math.PI * 2,
  };
}

export function updateEnemy(enemy, delta) {
  if (!enemy.alive) return;
  const target = PATH_POINTS[enemy.pathIndex];
  const position = enemy.group.position;
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  const step = enemy.speed * delta;

  if (distance <= step) {
    position.x = target.x;
    position.z = target.z;
    enemy.progress += distance;
    enemy.pathIndex += 1;
    if (enemy.pathIndex >= PATH_POINTS.length) {
      enemy.reachedEnd = true;
      enemy.alive = false;
    }
    return;
  }

  position.x += (dx / distance) * step;
  position.z += (dz / distance) * step;
  enemy.progress += step;

  enemy.spin += delta * 2.2;
  enemy.body.rotation.y = enemy.spin;
  enemy.body.rotation.x = Math.sin(enemy.spin * 1.3) * 0.18;
}

export function updateHealthBar(enemy, camera) {
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
  enemy.barFill.scale.x = Math.max(ratio, 0.001);
  enemy.barFill.position.x = -(1 - ratio) * 0.29;
  enemy.barFill.material.color.setHex(ratio > 0.5 ? 0x54e0a0 : ratio > 0.25 ? 0xffc451 : 0xff6b5c);
  enemy.barBackground.quaternion.copy(camera.quaternion);
}

export function disposeEnemy(enemy) {
  enemy.group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const material = object.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const entry of list) {
      if (entry.map) entry.map.dispose();
      entry.dispose();
    }
  });
}
