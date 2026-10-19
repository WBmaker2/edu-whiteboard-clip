import * as THREE from "three";
import { cellToWorld } from "./grid.js";

export const TOWER_TYPES = {
  rapid: {
    id: "rapid",
    label: "고속",
    cost: 60,
    damage: 16,
    range: 3,
    cooldown: 0.45,
    color: 0x35d6c0,
    css: "#35d6c0",
    description: "빠르게 쏘지만 한 방의 피해는 낮습니다.",
  },
  heavy: {
    id: "heavy",
    label: "강력",
    cost: 100,
    damage: 48,
    range: 3.3,
    cooldown: 1.5,
    color: 0x8a6cff,
    css: "#8a6cff",
    description: "느리지만 한 방의 피해가 큽니다.",
  },
  splash: {
    id: "splash",
    label: "범위",
    cost: 130,
    damage: 26,
    range: 3,
    cooldown: 1.0,
    splash: 1.35,
    color: 0xffb648,
    css: "#ffb648",
    description: "명중한 지점 주변의 적들을 함께 때립니다.",
  },
};

export const TOWER_ORDER = ["rapid", "heavy", "splash"];

export function createTower(typeId, cell) {
  const spec = TOWER_TYPES[typeId];
  const world = cellToWorld(cell.cx, cell.cz);
  const group = new THREE.Group();
  group.position.set(world.x, 0, world.z);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: 0.35,
    metalness: 0.35,
    emissive: new THREE.Color(spec.color).multiplyScalar(0.18),
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x14242f, roughness: 0.6, metalness: 0.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.24, 8), darkMaterial);
  base.position.y = 0.17;
  base.castShadow = true;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.62, 8), bodyMaterial);
  column.position.y = 0.58;
  column.castShadow = true;
  group.add(column);

  const head = new THREE.Group();
  head.position.y = 0.94;
  group.add(head);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.42), bodyMaterial);
  housing.castShadow = true;
  head.add(housing);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.52, 8), darkMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.28;
  head.add(barrel);

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    new THREE.MeshBasicMaterial({ color: spec.color }),
  );
  tip.position.z = 0.54;
  head.add(tip);

  const proxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 1.2, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  proxy.position.y = 0.6;
  group.add(proxy);

  return {
    id: `tower-${Math.random().toString(36).slice(2, 9)}`,
    type: typeId,
    cell,
    group,
    head,
    tip,
    proxy,
    cooldownTimer: 0,
    angle: 0,
  };
}

export function updateTower(tower, delta, enemies, fire) {
  tower.cooldownTimer -= delta;

  const position = tower.group.position;
  let target = null;
  let bestProgress = -Infinity;
  const range = TOWER_TYPES[tower.type].range;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.group.position.x - position.x;
    const dz = enemy.group.position.z - position.z;
    if (dx * dx + dz * dz > range * range) continue;
    if (enemy.progress > bestProgress) {
      bestProgress = enemy.progress;
      target = enemy;
    }
  }

  if (!target) return;

  const desired = Math.atan2(
    target.group.position.x - position.x,
    target.group.position.z - position.z,
  );
  let difference = (desired - tower.angle) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  tower.angle += difference * Math.min(1, delta * 9);
  tower.head.rotation.y = tower.angle;

  if (tower.cooldownTimer <= 0) {
    tower.cooldownTimer = TOWER_TYPES[tower.type].cooldown;
    fire(tower, target);
  }
}
