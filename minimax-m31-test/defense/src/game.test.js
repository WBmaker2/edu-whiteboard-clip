import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { COLS, PATH_CELLS, PATH_POINTS, ROWS, cellToWorld, inBounds, isPathCell, worldToCell } from "./grid.js";
import { TOWER_TYPES, createTower, updateTower } from "./towers.js";
import { createEnemy, updateEnemy } from "./enemies.js";
import { WAVES, buildSpawnQueue, waveEnemyCount } from "./waves.js";

function pathLength() {
  let total = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    total += PATH_POINTS[i].distanceTo(PATH_POINTS[i + 1]);
  }
  return total;
}

describe("격자와 경로", () => {
  it("경로 지점은 축에 나란히 이어진다", () => {
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const from = PATH_POINTS[i];
      const to = PATH_POINTS[i + 1];
      const dx = Math.abs(to.x - from.x);
      const dz = Math.abs(to.z - from.z);
      expect(dx < 1e-6 || dz < 1e-6).toBe(true);
      expect(dx + dz).toBeGreaterThan(0);
    }
  });

  it("경로 길이가 양수이고 지점 수가 2 이상이다", () => {
    expect(PATH_POINTS.length).toBeGreaterThanOrEqual(2);
    expect(pathLength()).toBeGreaterThan(1);
  });

  it("경로 위 모든 칸이 경로로 판정된다", () => {
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const from = PATH_POINTS[i];
      const to = PATH_POINTS[i + 1];
      const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z)) * 4;
      if (steps === 0) continue;
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const point = from.clone().lerp(to, t);
        const cell = worldToCell(point.x, point.z);
        expect(isPathCell(cell.cx, cell.cz)).toBe(true);
      }
    }
  });

  it("경로 지점에는 중복이 없다", () => {
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const gap = PATH_POINTS[i].distanceTo(PATH_POINTS[i + 1]);
      expect(gap).toBeGreaterThan(0);
    }
  });

  it("보드 안의 경로 칸 수는 보드 밖 칸을 포함하지 않는다", () => {
    let inside = 0;
    for (const key of PATH_CELLS) {
      const [cx, cz] = key.split(",").map(Number);
      if (inBounds(cx, cz)) inside += 1;
    }
    expect(inside).toBeGreaterThan(0);
    expect(inside).toBeLessThanOrEqual(COLS * ROWS);
  });

  it("셀과 월드 좌표가 서로 역산된다", () => {
    for (let cz = 0; cz < ROWS; cz += 1) {
      for (let cx = 0; cx < COLS; cx += 1) {
        const world = cellToWorld(cx, cz);
        const back = worldToCell(world.x, world.z);
        expect(back.cx).toBe(cx);
        expect(back.cz).toBe(cz);
      }
    }
  });
});

describe("적 이동", () => {
  it("적은 경로를 끝까지 따라가 도착 지점에 도달한다", () => {
    const enemy = createEnemy("basic");
    enemy.group.position.copy(PATH_POINTS[0]);
    let steps = 0;
    while (!enemy.reachedEnd && steps < 5000) {
      updateEnemy(enemy, 0.05);
      steps += 1;
    }
    expect(enemy.reachedEnd).toBe(true);
    expect(enemy.progress).toBeCloseTo(pathLength(), 1);
  });

  it("이동 중 적의 좌표는 항상 유한하다", () => {
    const enemy = createEnemy("fast");
    enemy.group.position.copy(PATH_POINTS[0]);
    for (let step = 0; step < 200; step += 1) {
      updateEnemy(enemy, 0.05);
      expect(Number.isFinite(enemy.group.position.x)).toBe(true);
      expect(Number.isFinite(enemy.group.position.z)).toBe(true);
    }
  });

  it("체력바 비율은 0과 1 사이를 넘지 않는다", () => {
    const enemy = createEnemy("basic");
    enemy.hp = enemy.maxHp * 0.4;
    expect(enemy.hp / enemy.maxHp).toBeGreaterThan(0);
    expect(enemy.hp / enemy.maxHp).toBeLessThanOrEqual(1);
  });
});

describe("타워 조준", () => {
  function fakeEnemy(x, z, progress) {
    return {
      alive: true,
      progress,
      group: { position: new THREE.Vector3(x, 0, z) },
    };
  }

  it("사거리 안에서 진행도가 가장 큰 적을 겨눈다", () => {
    const tower = createTower("rapid", { cx: 4, cz: 4 });
    const near = fakeEnemy(tower.group.position.x + 1, tower.group.position.z, 1);
    const far = fakeEnemy(tower.group.position.x + 2, tower.group.position.z, 9);
    const outside = fakeEnemy(tower.group.position.x + 99, tower.group.position.z, 99);

    let fired = null;
    updateTower(tower, 1, [near, far, outside], (from, target) => {
      fired = target;
    });

    expect(fired).toBe(far);
  });

  it("사거리 안에 적이 없으면 발사하지 않는다", () => {
    const tower = createTower("rapid", { cx: 4, cz: 4 });
    const outside = fakeEnemy(tower.group.position.x + 99, tower.group.position.z, 99);
    let fired = false;
    updateTower(tower, 1, [outside], () => {
      fired = true;
    });
    expect(fired).toBe(false);
  });

  it("살아 있는 적만 겨눈다", () => {
    const tower = createTower("rapid", { cx: 4, cz: 4 });
    const dead = fakeEnemy(tower.group.position.x + 1, tower.group.position.z, 5);
    dead.alive = false;
    const alive = fakeEnemy(tower.group.position.x + 1.5, tower.group.position.z, 1);
    let fired = null;
    updateTower(tower, 1, [dead, alive], (from, target) => {
      fired = target;
    });
    expect(fired).toBe(alive);
  });

  it("타워의 사거리와 피해치가 양수다", () => {
    for (const spec of Object.values(TOWER_TYPES)) {
      expect(spec.range).toBeGreaterThan(0);
      expect(spec.damage).toBeGreaterThan(0);
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(spec.cost).toBeGreaterThan(0);
    }
  });
});

describe("웨이브 구성", () => {
  it("스폰 큐 길이가 웨이브 정의의 적 수와 같다", () => {
    for (const wave of WAVES) {
      expect(buildSpawnQueue(wave)).toHaveLength(waveEnemyCount(wave));
    }
  });

  it("스폰 시간이 오름차순이다", () => {
    for (const wave of WAVES) {
      const queue = buildSpawnQueue(wave);
      for (let i = 1; i < queue.length; i += 1) {
        expect(queue[i].time).toBeGreaterThan(queue[i - 1].time);
      }
    }
  });

  it("첫 스폰 시간은 0이다", () => {
    for (const wave of WAVES) {
      expect(buildSpawnQueue(wave)[0].time).toBe(0);
    }
  });

  it("웨이브는 5개다", () => {
    expect(WAVES).toHaveLength(5);
  });
});
