import * as THREE from "three";

const DEG = 180 / Math.PI;
export const MAX_CAMERA_TILT_DEG = 30;
export const ANGLE_TOLERANCE_DEG = 1;

export function canonicalAxis(positions, neighborIds, centerId) {
  const points = neighborIds.map((id) => positions.get(id)).filter(Boolean);
  if (points.length < 2) return null;
  const center = positions.get(centerId);
  if (!center) return null;

  if (points.length === 2) {
    const first = points[0].clone().sub(center);
    const second = points[1].clone().sub(center);
    const normal = new THREE.Vector3().crossVectors(first, second);
    if (normal.length() > 1e-4) {
      return { vector: normal.normalize(), mode: "normal" };
    }
    return { vector: first.clone().normalize(), mode: "axis" };
  }

  const normal = new THREE.Vector3()
    .crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0]))
    .normalize();
  return { vector: normal, mode: "normal" };
}

export function checkInvariants({ atoms, bonds, layout, camera, target, view = "default" }) {
  const problems = [];

  for (const atom of atoms) {
    const position = atom.group.position;
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      problems.push({ code: "position-not-finite", message: `${atom.element} 원자의 위치가 유한하지 않습니다.` });
    }
  }

  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const a = atoms[i].group.position;
      const b = atoms[j].group.position;
      const distance = a.distanceTo(b);
      const minimum = (atoms[i].radius ?? 0.4) + (atoms[j].radius ?? 0.4);
      if (distance < minimum * 0.6) {
        problems.push({
          code: "atom-overlap",
          message: `두 원자가 겹쳐 있습니다 (${atoms[i].element}-${atoms[j].element}, 거리 ${distance.toFixed(2)}).`,
        });
      }
    }
  }

  if (layout && layout.neighbors.length >= 2) {
    const center = layout.positions.get(layout.centerId);
    const directions = layout.neighbors
      .map((id) => layout.positions.get(id))
      .filter(Boolean)
      .map((position) => position.clone().sub(center).normalize());
    let measured = Math.PI;
    for (let i = 0; i < directions.length; i += 1) {
      for (let j = i + 1; j < directions.length; j += 1) {
        measured = Math.min(measured, directions[i].angleTo(directions[j]));
      }
    }
    const measuredDeg = measured * DEG;
    if (Math.abs(measuredDeg - layout.angleDeg) > ANGLE_TOLERANCE_DEG) {
      problems.push({
        code: "bond-angle-mismatch",
        message: `실측 결합각 ${measuredDeg.toFixed(1)}°가 목표 ${layout.angleDeg}°와 다릅니다.`,
      });
    }
  }

  if (layout && camera && view === "default") {
    const canonical = canonicalAxis(layout.positions, layout.neighbors, layout.centerId);
    if (canonical) {
      const viewDirection = new THREE.Vector3();
      camera.getWorldDirection(viewDirection);
      const cosine = Math.min(1, Math.abs(canonical.vector.dot(viewDirection)));
      const tilt = Math.acos(cosine) * DEG;
      if (canonical.mode === "normal" && tilt > MAX_CAMERA_TILT_DEG) {
        problems.push({
          code: "not-readable",
          message: `분자 평면이 시선에서 ${tilt.toFixed(0)}° 어긋나 있습니다 (${MAX_CAMERA_TILT_DEG}° 초과). 결합각이 화면에 보이지 않을 수 있습니다.`,
        });
      }
      if (canonical.mode === "axis" && tilt < 60) {
        problems.push({
          code: "not-readable",
          message: `직선형 분자의 축이 시선과 ${tilt.toFixed(0)}° 어긋나 있습니다. 끝에서 보여 각도가 읽히지 않을 수 있습니다.`,
        });
      }
    }
  }

  if (target && atoms.length > 0) {
    const hasBond = bonds.length > 0;
    if (!hasBond) {
      problems.push({ code: "no-bond", message: "결합이 하나도 없습니다." });
    }
  }

  return problems;
}
