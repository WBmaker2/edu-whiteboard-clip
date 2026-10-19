import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SPECIES, SPECIES_ORDER } from "./species.js";
import { buildAnimal, updateAnimal } from "./animals.js";
import { studReach, surfaceOffset, surfaceReach } from "./attach.js";

const camera = { position: new THREE.Vector3(0, 5, 10) };

function patchSpecOf(speciesId) {
  return SPECIES[speciesId].patches;
}

describe("동물 조립", () => {
  it("4종 모두 예외 없이 만들어진다", () => {
    for (const id of SPECIES_ORDER) {
      expect(() => buildAnimal(id)).not.toThrow();
    }
  });

  it("모든 동물은 다리 4개와 귀 2개를 갖는다", () => {
    for (const id of SPECIES_ORDER) {
      const animal = buildAnimal(id);
      expect(animal.legs).toHaveLength(4);
      expect(animal.ears).toHaveLength(2);
      expect(animal.eyes).toHaveLength(2);
    }
  });

  it("다리 힙은 어깨 높이에 놓여 바닥에 닿지 않는다", () => {
    for (const id of SPECIES_ORDER) {
      const animal = buildAnimal(id);
      for (const leg of animal.legs) {
        expect(leg.hip.position.y).toBeCloseTo(SPECIES[id].legLen, 6);
      }
    }
  });
});

describe("표면 부착 회귀 — 몸체 안으로 파묻히지 않는다", () => {
  it("모든 표식(patch)이몸체 표면 밖으로 돌출된다", () => {
    for (const id of SPECIES_ORDER) {
      const spec = SPECIES[id];
      for (const patch of patchSpecOf(id)) {
        const hostRadius = patch.parent === "body" ? spec.body.rx : spec.head.r;
        const scale = { x: patch.scale[0], y: patch.scale[1], z: patch.scale[2] };
        const direction = new THREE.Vector3(...patch.dir);
        const reach = surfaceReach(hostRadius, direction, patch.r, scale, patch.protrusion);
        expect(reach).toBeGreaterThanOrEqual(hostRadius);
        expect(reach).toBeGreaterThan(hostRadius + patch.protrusion - 1e-6);
      }
    }
  });

  it("판다의 눈자국이 머리 반지름 안에 완전히 들어가지 않는다", () => {
    const spec = SPECIES.panda;
    for (const patch of spec.patches) {
      const scale = { x: patch.scale[0], y: patch.scale[1], z: patch.scale[2] };
      const reach = surfaceReach(spec.head.r, new THREE.Vector3(...patch.dir), patch.r, scale, patch.protrusion);
      expect(reach).toBeGreaterThan(spec.head.r);
    }
  });

  it("눈과 코 역시 머리 표면 밖으로 나온다", () => {
    for (const id of SPECIES_ORDER) {
      const spec = SPECIES[id];
      const eyeRadius = spec.head.r * 0.11;
      const reach = studReach(spec.head.r, new THREE.Vector3(...spec.eyeDir), eyeRadius);
      expect(reach).toBeGreaterThan(spec.head.r);
    }
  });
});

describe("표면 부착 헬퍼", () => {
  it("작은 표식은몸체 표면에서 밀려나 않는다", () => {
    const offset = surfaceOffset(0.4, new THREE.Vector3(0, 0, 1), 0.1, { x: 1, y: 1, z: 1 }, 0.02);
    expect(offset.length()).toBeCloseTo(0.32, 5);
  });

  it("몸체보다 큰 표식은 중심이몸체 안에 있어도 밖으로 튀어나온다", () => {
    const scale = { x: 1, y: 1, z: 1 };
    const reach = surfaceReach(0.4, new THREE.Vector3(0, 0, 1), 1, scale, 0.02);
    expect(reach).toBeGreaterThan(0.42);
  });

  it("방향 벡터는 정규화된다", () => {
    const offset = surfaceOffset(0.4, new THREE.Vector3(0, 0, 5), 0.1, { x: 1, y: 1, z: 1 }, 0.02);
    expect(offset.z).toBeCloseTo(0.32, 5);
  });
});

describe("정지 상태 위치 회귀", () => {
  it("걷지 않아도 궤도 위치가 반영된다", () => {
    const animal = buildAnimal("cat");
    animal.angle = 1.0;
    animal.orbitRadius = 2.5;
    animal.walking = false;
    animal.group.position.set(0, 0, 0);

    updateAnimal(animal, 1 / 60, 0, camera);

    expect(animal.group.position.x).toBeCloseTo(Math.cos(1.0) * 2.5, 5);
    expect(animal.group.position.z).toBeCloseTo(Math.sin(1.0) * 2.5, 5);
  });

  it("걷기 상태에서는 각도가 진행된다", () => {
    const animal = buildAnimal("cat");
    animal.angle = 0;
    animal.orbitRadius = 2.5;
    animal.walking = true;

    updateAnimal(animal, 1 / 60, 0, camera);
    const first = animal.angle;
    updateAnimal(animal, 1 / 60, 0, camera);

    expect(first).toBeGreaterThan(0);
    expect(animal.angle).toBeGreaterThan(first);
  });

  it("정지한 동물도 카메라 쪽을 본다", () => {
    const animal = buildAnimal("cat");
    animal.angle = 0;
    animal.orbitRadius = 2.5;
    animal.walking = false;

    for (let i = 0; i < 120; i += 1) updateAnimal(animal, 1 / 60, i / 60, camera);

    const toCamera = Math.atan2(camera.position.x - animal.group.position.x, camera.position.z - animal.group.position.z);
    const difference = Math.abs(((animal.group.rotation.y - toCamera + Math.PI) % (Math.PI * 2)) - Math.PI);
    expect(difference).toBeLessThan(0.1);
  });
});
