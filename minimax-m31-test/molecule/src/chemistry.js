import * as THREE from "three";

export const TARGETS = [
  {
    id: "water",
    label: "물 (H₂O)",
    formula: "H₂O",
    center: "O",
    counts: { H: 2, O: 1 },
    neighbors: ["H", "H"],
    angleDeg: 104.5,
    shape: "굽은형",
    description: "산소 원자에 비공유 전자쌍 2개가 있어 결합각이 104.5°인 굽은형입니다.",
  },
  {
    id: "methane",
    label: "메테인 (CH₄)",
    formula: "CH₄",
    center: "C",
    counts: { H: 4, C: 1 },
    neighbors: ["H", "H", "H", "H"],
    angleDeg: 109.5,
    shape: "정사면체",
    description: "탄소 원자에 비공유 전자쌍이 없어 결합각 109.5°의 정사면체형입니다.",
  },
  {
    id: "ammonia",
    label: "암모니아 (NH₃)",
    formula: "NH₃",
    center: "N",
    counts: { H: 3, N: 1 },
    neighbors: ["H", "H", "H"],
    angleDeg: 107,
    shape: "삼각뿔",
    description: "질소 원자의 비공유 전자쌍 1개가 결합각을 107°로 좁혀 삼각뿔형이 됩니다.",
  },
  {
    id: "co2",
    label: "이산화탄소 (CO₂)",
    formula: "CO₂",
    center: "C",
    counts: { O: 2, C: 1 },
    neighbors: ["O", "O"],
    angleDeg: 180,
    shape: "직선형",
    description: "탄소가 두 산소와 이중 결합을 이루어 결합각 180°의 직선형입니다.",
  },
];

const VALENCE_ELECTRONS = { H: 1, C: 4, N: 5, O: 6 };

const BOND_LENGTHS = {
  "H-H": 0.74,
  "C-H": 1.09,
  "C-C": 1.54,
  "N-H": 1.01,
  "N-C": 1.47,
  "N-N": 1.45,
  "N-O": 1.4,
  "O-H": 0.96,
  "O-O": 1.48,
  "C-O": 1.43,
};

const TETRAHEDRAL = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(1, -1, -1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(-1, -1, 1),
].map((vector) => vector.normalize());

const TRIGONAL = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-0.5, 0, Math.sqrt(3) / 2),
  new THREE.Vector3(-0.5, 0, -Math.sqrt(3) / 2),
];

export function bondLength(a, b) {
  return BOND_LENGTHS[[a, b].sort().join("-")] ?? 1.3;
}

export function bondKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function findBond(bonds, a, b) {
  const key = bondKey(a, b);
  return bonds.find((bond) => bondKey(bond.a, bond.b) === key) ?? null;
}

export function bondOrderSum(bonds, atomId) {
  let sum = 0;
  for (const bond of bonds) {
    if (bond.a === atomId) sum += bond.order;
    if (bond.b === atomId) sum += bond.order;
  }
  return sum;
}

export function neighborIds(bonds, atomId) {
  const result = [];
  for (const bond of bonds) {
    if (bond.a === atomId) result.push(bond.b);
    else if (bond.b === atomId) result.push(bond.a);
  }
  return result;
}

export function findCenter(atoms, bonds) {
  let best = null;
  let bestSum = -1;
  for (const atom of atoms) {
    const sum = bondOrderSum(bonds, atom.id);
    if (sum > bestSum) {
      bestSum = sum;
      best = atom;
    }
  }
  return bestSum > 0 ? best : (atoms[0] ?? null);
}

export function orthogonalBasis(axis) {
  const helper = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  return { u, v };
}

function electronSlots(domains) {
  if (domains <= 1) return [new THREE.Vector3(0, 1, 0)];
  if (domains === 2) return [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
  if (domains === 3) return TRIGONAL.map((vector) => vector.clone());
  return TETRAHEDRAL.map((vector) => vector.clone());
}

export function targetBondAngleDeg(domains, lonePairs) {
  if (domains === 4) {
    if (lonePairs === 2) return 104.5;
    if (lonePairs === 1) return 107;
    return 109.47;
  }
  if (domains === 3) return lonePairs === 1 ? 118 : 120;
  if (domains === 2) return 180;
  return 0;
}

export function targetBondAngleRad(domains, lonePairs) {
  return (targetBondAngleDeg(domains, lonePairs) * Math.PI) / 180;
}

function measureAngle(directions) {
  let smallest = Math.PI;
  for (let i = 0; i < directions.length; i += 1) {
    for (let j = i + 1; j < directions.length; j += 1) {
      smallest = Math.min(smallest, directions[i].angleTo(directions[j]));
    }
  }
  return smallest;
}

function rotateAroundAxis(direction, axis, angle) {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  return direction.clone().applyQuaternion(quaternion).normalize();
}

function compress(directions, targetAngle) {
  if (directions.length < 2) return directions;
  const current = measureAngle(directions);
  if (Math.abs(current - targetAngle) < 0.002) return directions;

  const centroid = directions.reduce((sum, vector) => sum.add(vector), new THREE.Vector3());
  if (centroid.lengthSq() < 1e-8) return directions;
  centroid.normalize();

  const evaluate = (direction, alpha) => {
    const axis = new THREE.Vector3().crossVectors(direction, centroid);
    if (axis.lengthSq() < 1e-8) return direction.clone();
    axis.normalize();
    return rotateAroundAxis(direction, axis, alpha);
  };

  let best = directions;
  let bestError = Math.abs(current - targetAngle);
  let bestAlpha = 0;
  let bestSign = 1;
  const coarseStep = 0.95 / 120;

  for (const sign of [1, -1]) {
    for (let step = 0; step <= 120; step += 1) {
      const alpha = step * coarseStep;
      const candidate = directions.map((direction) => evaluate(direction, sign * alpha));
      const error = Math.abs(measureAngle(candidate) - targetAngle);
      if (error < bestError) {
        bestError = error;
        best = candidate;
        bestAlpha = alpha;
        bestSign = sign;
      }
    }
  }

  for (let step = -12; step <= 12; step += 1) {
    const alpha = bestAlpha + step * coarseStep * 0.08;
    if (alpha < 0 || alpha > 0.95) continue;
    const candidate = directions.map((direction) => evaluate(direction, bestSign * alpha));
    const error = Math.abs(measureAngle(candidate) - targetAngle);
    if (error < bestError) {
      bestError = error;
      best = candidate;
    }
  }

  return best;
}

function orientToViewer(positions, centerId, neighbors) {
  if (neighbors.length < 2 || neighbors.length > 3) return;
  const center = positions.get(centerId);
  if (!center) return;
  const directions = neighbors
    .map((id) => positions.get(id))
    .filter(Boolean)
    .map((position) => position.clone().sub(center).normalize());
  if (directions.length < 2) return;

  let normal;
  if (directions.length === 2) {
    normal = new THREE.Vector3().crossVectors(directions[0], directions[1]);
  } else {
    const edgeA = new THREE.Vector3().subVectors(directions[0], directions[1]);
    const edgeB = new THREE.Vector3().subVectors(directions[0], directions[2]);
    normal = new THREE.Vector3().crossVectors(edgeA, edgeB);
  }
  if (normal.lengthSq() < 1e-8) return;
  normal.normalize();

  const quaternion = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
  for (const [id, position] of positions) {
    positions.set(id, position.clone().applyQuaternion(quaternion));
  }
}

export function computeLayout(atoms, bonds) {
  const center = findCenter(atoms, bonds);
  if (!center) return null;

  const neighbors = neighborIds(bonds, center.id);
  const orderSum = bondOrderSum(bonds, center.id);
  const lonePairs = Math.max(0, (VALENCE_ELECTRONS[center.element] - orderSum) / 2);
  const domains = neighbors.length + lonePairs;

  const slots = electronSlots(domains);
  const bondSlots = slots.slice(0, neighbors.length);

  const angleRad = targetBondAngleRad(domains, lonePairs);
  const directions = compress(bondSlots, angleRad);

  const positions = new Map();
  positions.set(center.id, new THREE.Vector3(0, 0, 0));

  neighbors.forEach((neighborId, index) => {
    const neighbor = atoms.find((atom) => atom.id === neighborId);
    if (!neighbor) return;
    const direction = directions[index] ?? new THREE.Vector3(0, 1, 0);
    positions.set(neighborId, direction.clone().multiplyScalar(bondLength(center.element, neighbor.element)));
  });

  for (const neighborId of neighbors) {
    const neighbor = atoms.find((atom) => atom.id === neighborId);
    if (!neighbor) continue;
    const extras = neighborIds(bonds, neighborId).filter((id) => id !== center.id);
    if (extras.length === 0) continue;
    const axis = (positions.get(neighborId) ?? new THREE.Vector3()).clone().normalize();
    const { u, v } = orthogonalBasis(axis);
    extras.forEach((extraId, index) => {
      const extraAtom = atoms.find((atom) => atom.id === extraId);
      if (!extraAtom) return;
      const theta = (index / extras.length) * Math.PI * 2;
      const direction = u
        .clone()
        .multiplyScalar(Math.cos(theta))
        .add(v.clone().multiplyScalar(Math.sin(theta)))
        .multiplyScalar(Math.sin(Math.PI / 4))
        .add(axis.clone().multiplyScalar(Math.cos(Math.PI / 4)));
      const origin = positions.get(neighborId) ?? new THREE.Vector3();
      positions.set(
        extraId,
        origin.clone().add(direction.multiplyScalar(bondLength(neighbor.element, extraAtom.element))),
      );
    });
  }

  const midpoint = new THREE.Vector3();
  for (const atom of atoms) midpoint.add(positions.get(atom.id) ?? new THREE.Vector3());
  midpoint.divideScalar(Math.max(atoms.length, 1));
  for (const atom of atoms) {
    const position = positions.get(atom.id) ?? new THREE.Vector3();
    positions.set(atom.id, position.clone().sub(midpoint));
  }

  orientToViewer(positions, center.id, neighbors);

  const centered = new THREE.Vector3();
  for (const atom of atoms) centered.add(positions.get(atom.id) ?? new THREE.Vector3());
  centered.divideScalar(Math.max(atoms.length, 1));
  for (const atom of atoms) {
    const position = positions.get(atom.id) ?? new THREE.Vector3();
    positions.set(atom.id, position.clone().sub(centered));
  }

  return {
    centerId: center.id,
    positions,
    angleRad,
    angleDeg: targetBondAngleDeg(domains, lonePairs),
    lonePairs,
    domains,
    neighbors,
  };
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of right) {
    const remaining = counts.get(item) ?? 0;
    if (remaining === 0) return false;
    counts.set(item, remaining - 1);
  }
  return true;
}

export function validate(atoms, bonds, target) {
  const counts = {};
  for (const atom of atoms) counts[atom.element] = (counts[atom.element] ?? 0) + 1;

  const targetKeys = Object.keys(target.counts);
  const countOk =
    Object.keys(counts).length === targetKeys.length &&
    targetKeys.every((element) => (counts[element] ?? 0) === target.counts[element]);

  const center = findCenter(atoms, bonds);
  const centerOk = Boolean(center) && center.element === target.center;

  const neighbors = center
    ? neighborIds(bonds, center.id)
        .map((id) => atoms.find((atom) => atom.id === id)?.element)
        .filter(Boolean)
    : [];
  const neighborOk = sameMultiset(neighbors, target.neighbors);

  return {
    ok: countOk && centerOk && neighborOk,
    countOk,
    centerOk,
    neighborOk,
    counts,
    centerElement: center?.element ?? null,
    neighbors,
  };
}

export function buildTargetSkeleton(target) {
  const atoms = [{ id: "atom-1", element: target.center }];
  target.neighbors.forEach((element, index) => {
    atoms.push({ id: `atom-${index + 2}`, element });
  });
  const bonds = target.neighbors.map((_, index) => ({
    id: `bond-${index + 1}`,
    a: "atom-1",
    b: `atom-${index + 2}`,
    order: target.id === "co2" ? 2 : 1,
  }));
  return { atoms, bonds };
}
