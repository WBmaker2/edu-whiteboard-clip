import * as THREE from "three";

export const COLS = 12;
export const ROWS = 9;

export const WAYPOINTS = [
  { x: -1, z: 1 },
  { x: 3, z: 1 },
  { x: 3, z: 4 },
  { x: 6, z: 4 },
  { x: 6, z: 7 },
  { x: 9, z: 7 },
  { x: 9, z: 2 },
  { x: 12, z: 2 },
];

export function cellToWorld(cx, cz) {
  return { x: cx - (COLS - 1) / 2, z: cz - (ROWS - 1) / 2 };
}

export function worldToCell(x, z) {
  return {
    cx: Math.round(x + (COLS - 1) / 2),
    cz: Math.round(z + (ROWS - 1) / 2),
  };
}

export function inBounds(cx, cz) {
  return cx >= 0 && cx < COLS && cz >= 0 && cz < ROWS;
}

function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

function expandPath() {
  const cells = [];
  const seen = new Set();
  for (let i = 0; i < WAYPOINTS.length - 1; i += 1) {
    const from = WAYPOINTS[i];
    const to = WAYPOINTS[i + 1];
    const stepX = Math.sign(to.x - from.x);
    const stepZ = Math.sign(to.z - from.z);
    let { x, z } = from;
    if (i === 0) {
      cells.push({ x, z });
      seen.add(cellKey(x, z));
    }
    while (x !== to.x || z !== to.z) {
      x += stepX;
      z += stepZ;
      cells.push({ x, z });
      seen.add(cellKey(x, z));
    }
  }
  return { cells, seen };
}

const expanded = expandPath();

export const PATH_CELLS = expanded.seen;
export const PATH_POINTS = expanded.cells.map((cell) => {
  const world = cellToWorld(cell.x, cell.z);
  return new THREE.Vector3(world.x, 0, world.z);
});

export function isPathCell(cx, cz) {
  return PATH_CELLS.has(cellKey(cx, cz));
}

export function createBoard(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(COLS + 2, 0.4, ROWS + 2),
    new THREE.MeshStandardMaterial({ color: 0x0b1c28, roughness: 0.85, metalness: 0.15 }),
  );
  base.position.y = -0.22;
  base.receiveShadow = true;
  group.add(base);

  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(COLS + 0.8, 0.16, ROWS + 0.8),
    new THREE.MeshStandardMaterial({ color: 0x14384a, roughness: 0.5, metalness: 0.4 }),
  );
  rim.position.y = -0.42;
  group.add(rim);

  const grid = new THREE.GridHelper(COLS, COLS, 0x1c5f6b, 0x14414c);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = 0.01;
  group.add(grid);

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a6a3c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const roadEdge = new THREE.MeshStandardMaterial({
    color: 0xc79a55,
    roughness: 0.8,
    metalness: 0.1,
  });

  for (const cell of expanded.cells) {
    const world = cellToWorld(cell.x, cell.z);
    const road = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.1, 0.98), roadMaterial);
    road.position.set(world.x, 0.04, world.z);
    road.receiveShadow = true;
    group.add(road);
  }

  const start = PATH_POINTS[0];
  const end = PATH_POINTS[PATH_POINTS.length - 1];

  const spawnRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.07, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x35d6c0 }),
  );
  spawnRing.rotation.x = -Math.PI / 2;
  spawnRing.position.set(start.x, 0.14, start.z);
  group.add(spawnRing);

  const goal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.9, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff6b5c, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  goal.position.set(end.x, 0.45, end.z);
  group.add(goal);

  const goalRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.07, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xff6b5c }),
  );
  goalRing.rotation.x = -Math.PI / 2;
  goalRing.position.set(end.x, 0.14, end.z);
  group.add(goalRing);

  const towerPadMaterial = new THREE.MeshStandardMaterial({
    color: 0x14313f,
    roughness: 0.7,
    metalness: 0.2,
  });
  const pads = new THREE.Group();
  for (let cz = 0; cz < ROWS; cz += 1) {
    for (let cx = 0; cx < COLS; cx += 1) {
      if (isPathCell(cx, cz)) continue;
      const world = cellToWorld(cx, cz);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.05, 0.86), towerPadMaterial);
      pad.position.set(world.x, 0.03, world.z);
      pad.receiveShadow = true;
      pads.add(pad);
    }
  }
  group.add(pads);

  return group;
}
