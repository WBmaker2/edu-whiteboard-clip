import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  TARGETS,
  buildTargetSkeleton,
  computeLayout,
  findCenter,
  targetBondAngleDeg,
  targetBondAngleRad,
  validate,
} from "./chemistry.js";

const DEG = 180 / Math.PI;

function bondAngleDeg(layout) {
  const center = layout.positions.get(layout.centerId);
  const directions = layout.neighbors
    .map((id) => layout.positions.get(id))
    .filter(Boolean)
    .map((position) => position.clone().sub(center).normalize());
  let smallest = Math.PI;
  for (let i = 0; i < directions.length; i += 1) {
    for (let j = i + 1; j < directions.length; j += 1) {
      smallest = Math.min(smallest, directions[i].angleTo(directions[j]));
    }
  }
  return smallest * DEG;
}

function layoutFor(target) {
  const skeleton = buildTargetSkeleton(target);
  return computeLayout(skeleton.atoms, skeleton.bonds);
}

describe("VSEPR 배치 — 결합각 회귀", () => {
  it("목표 분자의 결합각이 명세와 0.5° 이내로 일치한다", () => {
    for (const target of TARGETS) {
      const layout = layoutFor(target);
      const measured = bondAngleDeg(layout);
      expect(Math.abs(measured - target.angleDeg)).toBeLessThanOrEqual(0.5);
    }
  });

  it("물의 결합각은 104.5°이며 180°로 펴지지 않는다", () => {
    const water = TARGETS.find((target) => target.id === "water");
    const measured = bondAngleDeg(layoutFor(water));
    expect(measured).toBeGreaterThan(103);
    expect(measured).toBeLessThan(106);
  });

  it("전자 영역 수와 비공유 전자쌍 수가 규칙과 일치한다", () => {
    const cases = [
      { id: "water", domains: 4, lonePairs: 2 },
      { id: "ammonia", domains: 4, lonePairs: 1 },
      { id: "methane", domains: 4, lonePairs: 0 },
      { id: "co2", domains: 2, lonePairs: 0 },
    ];
    for (const entry of cases) {
      const target = TARGETS.find((item) => item.id === entry.id);
      const layout = layoutFor(target);
      expect(layout.domains).toBe(entry.domains);
      expect(layout.lonePairs).toBe(entry.lonePairs);
    }
  });
});

describe("VSEPR 배치 — 가독성 회귀", () => {
  function canonicalAxisTiltDeg(layout) {
    const points = layout.neighbors.map((id) => layout.positions.get(id));
    const center = layout.positions.get(layout.centerId);
    let normal;
    if (points.length === 2) {
      normal = new THREE.Vector3()
        .crossVectors(points[0].clone().sub(center), points[1].clone().sub(center))
        .normalize();
    } else {
      normal = new THREE.Vector3()
        .crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]))
        .normalize();
    }
    const axis = new THREE.Vector3(0, 0, 1);
    const cosine = Math.abs(normal.dot(axis));
    return Math.acos(Math.min(1, cosine)) * DEG;
  }

  it("굽은형 분자의 결합 평면이 카메라를 향한다", () => {
    const water = TARGETS.find((target) => target.id === "water");
    expect(canonicalAxisTiltDeg(layoutFor(water))).toBeLessThan(3);
  });

  it("삼각뿔 분자의 대칭축이 카메라를 향한다", () => {
    const ammonia = TARGETS.find((target) => target.id === "ammonia");
    expect(canonicalAxisTiltDeg(layoutFor(ammonia))).toBeLessThan(3);
  });

  it("이산화탄소는 직선형이다", () => {
    const co2 = TARGETS.find((target) => target.id === "co2");
    const layout = layoutFor(co2);
    const center = layout.positions.get(layout.centerId);
    const directions = layout.neighbors.map((id) => layout.positions.get(id).clone().sub(center).normalize());
    expect(directions[0].angleTo(directions[1]) * DEG).toBeGreaterThan(179);
  });
});

describe("단위 계약", () => {
  it("수학 함수는 라디안, 표시값 함수는 도로 반환한다", () => {
    const rad = targetBondAngleRad(4, 2);
    const deg = targetBondAngleDeg(4, 2);
    expect(rad).toBeLessThan(Math.PI * 2);
    expect(deg).toBeGreaterThan(1);
    expect(rad).not.toBeCloseTo(deg, 3);
  });

  it("표적 각도가 라디안 변환과 정확히 대응한다", () => {
    for (const domains of [2, 3, 4]) {
      for (const lonePairs of [0, 1, 2]) {
        const rad = targetBondAngleRad(domains, lonePairs);
        const deg = targetBondAngleDeg(domains, lonePairs);
        expect(rad * DEG).toBeCloseTo(deg, 6);
      }
    }
  });

  it("모든 목표가 각도 필드에 단위 sufffix를 갖는다", () => {
    for (const target of TARGETS) {
      expect(target.angleDeg).toBeTypeOf("number");
      expect(target.angle).toBeUndefined();
    }
  });
});

describe("분자 판정", () => {
  const water = TARGETS.find((target) => target.id === "water");

  it("완성된 물은 정답으로 판정한다", () => {
    const skeleton = buildTargetSkeleton(water);
    const result = validate(skeleton.atoms, skeleton.bonds, water);
    expect(result.ok).toBe(true);
  });

  it("원자 수가 다르면 실패한다", () => {
    const skeleton = buildTargetSkeleton(water);
    const atoms = [...skeleton.atoms, { id: "atom-9", element: "H" }];
    const result = validate(atoms, skeleton.bonds, water);
    expect(result.ok).toBe(false);
    expect(result.countOk).toBe(false);
  });

  it("중심 원자가 다르면 실패한다", () => {
    const skeleton = buildTargetSkeleton(water);
    const atoms = skeleton.atoms.map((atom) =>
      atom.id === "atom-1" ? { ...atom, element: "C" } : atom,
    );
    const result = validate(atoms, skeleton.bonds, water);
    expect(result.ok).toBe(false);
    expect(result.centerOk).toBe(false);
  });

  it("결합 인접 관계가 다르면 실패한다", () => {
    const skeleton = buildTargetSkeleton(water);
    const bonds = [
      { id: "b1", a: "atom-1", b: "atom-2", order: 1 },
      { id: "b2", a: "atom-2", b: "atom-3", order: 1 },
    ];
    const result = validate(skeleton.atoms, bonds, water);
    expect(result.ok).toBe(false);
    expect(result.neighborOk).toBe(false);
  });

  it("중심 원자는 결합 차수 합이 가장 큰 원자다", () => {
    const skeleton = buildTargetSkeleton(water);
    const center = findCenter(skeleton.atoms, skeleton.bonds);
    expect(center.element).toBe("O");
  });
});

describe("분자 뼈대", () => {
  it("물은 산소 하나와 수소 둘로 구성된다", () => {
    const skeleton = buildTargetSkeleton(TARGETS.find((target) => target.id === "water"));
    expect(skeleton.atoms.map((atom) => atom.element).sort()).toEqual(["H", "H", "O"]);
    expect(skeleton.bonds).toHaveLength(2);
  });

  it("이산화탄소의 결합 차수는 2다", () => {
    const skeleton = buildTargetSkeleton(TARGETS.find((target) => target.id === "co2"));
    expect(skeleton.bonds.every((bond) => bond.order === 2)).toBe(true);
  });
});
