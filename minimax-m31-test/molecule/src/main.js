import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { ELEMENTS, ELEMENT_ORDER } from "./elements.js";
import {
  TARGETS,
  buildTargetSkeleton,
  computeLayout,
  findBond,
  orthogonalBasis,
  validate,
} from "./chemistry.js";
import { checkInvariants } from "./invariants.js";

const WORK_Y = 2.0;
const MOLECULE_SCALE = 1.45;
const UP = new THREE.Vector3(0, 1, 0);

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const pick = createPicker(canvas, stage.camera);

const atoms = [];
const bonds = [];
let nextAtomId = 1;
let nextBondId = 1;
let selectedAtomId = null;
let placeElement = null;
let currentTarget = TARGETS[0];
let pointerStart = null;
let lastLayout = null;

const statusPanel = document.getElementById("status");
const targetButtons = document.getElementById("target-buttons");
const elementRow = document.getElementById("element-row");

const selectionRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.66, 0.035, 8, 44),
  new THREE.MeshBasicMaterial({ color: 0x35d6c0 }),
);
selectionRing.visible = false;
stage.scene.add(selectionRing);

function setStatus(html, isBad = false) {
  statusPanel.innerHTML = html;
  statusPanel.classList.toggle("bad", isBad);
}

function makeLabel(symbol) {
  const canvas2d = document.createElement("canvas");
  canvas2d.width = 128;
  canvas2d.height = 128;
  const ctx = canvas2d.getContext("2d");
  ctx.font = "700 68px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(6, 20, 26, 0.92)";
  ctx.strokeText(symbol, 64, 68);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(symbol, 64, 68);
  const texture = new THREE.CanvasTexture(canvas2d);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  );
  sprite.scale.set(0.46, 0.46, 1);
  return sprite;
}

function createAtomGroup(element) {
  const info = ELEMENTS[element];
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: info.color,
    roughness: 0.3,
    metalness: 0.14,
    emissive: new THREE.Color(info.color).multiplyScalar(0.3),
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(info.radius, 26, 20), material);
  group.add(mesh);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(info.radius * 1.3, 18, 14),
    new THREE.MeshBasicMaterial({
      color: info.color,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(glow);

  const label = makeLabel(info.symbol);
  label.position.y = info.radius + 0.3;
  group.add(label);

  return { group, mesh, label };
}

function createBondGroup(order) {
  const group = new THREE.Group();
  const radius = order === 1 ? 0.16 : order === 2 ? 0.11 : 0.095;
  const cylinders = [];
  for (let i = 0; i < order; i += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xa8ecff,
      roughness: 0.22,
      metalness: 0.25,
      emissive: 0x1b5c78,
    });
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14), material);
    group.add(cylinder);
    cylinders.push(cylinder);
  }
  const proxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  cylinders[0].add(proxy);
  return { group, cylinders, proxy };
}

function addAtom(element, position) {
  const id = `atom-${nextAtomId}`;
  nextAtomId += 1;
  const { group, mesh, label } = createAtomGroup(element);
  group.position.copy(position);
  mesh.userData.atomId = id;
  stage.scene.add(group);
  const atom = {
    id,
    element,
    group,
    mesh,
    label,
    radius: ELEMENTS[element].radius,
    target: position.clone(),
  };
  atoms.push(atom);
  return atom;
}

function removeAtom(atomId) {
  const index = atoms.findIndex((atom) => atom.id === atomId);
  if (index === -1) return;
  const [atom] = atoms.splice(index, 1);
  stage.scene.remove(atom.group);
  disposeGroup(atom.group);
  for (const bond of bonds.filter((entry) => entry.a === atomId || entry.b === atomId)) {
    removeBond(bond.id);
  }
  if (selectedAtomId === atomId) selectedAtomId = null;
}

function addBond(a, b, order = 1) {
  const id = `bond-${nextBondId}`;
  nextBondId += 1;
  const { group, cylinders, proxy } = createBondGroup(order);
  proxy.userData.bondId = id;
  stage.scene.add(group);
  const bond = { id, a, b, order, group, cylinders, proxy };
  bonds.push(bond);
  return bond;
}

function removeBond(bondId) {
  const index = bonds.findIndex((bond) => bond.id === bondId);
  if (index === -1) return;
  const [bond] = bonds.splice(index, 1);
  stage.scene.remove(bond.group);
  disposeGroup(bond.group);
}

function disposeGroup(group) {
  group.traverse((object) => {
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

function clearAll() {
  for (const bond of [...bonds]) removeBond(bond.id);
  for (const atom of [...atoms]) {
    stage.scene.remove(atom.group);
    disposeGroup(atom.group);
  }
  atoms.length = 0;
  bonds.length = 0;
  selectedAtomId = null;
  lastLayout = null;
  nextAtomId = 1;
  nextBondId = 1;
}

function atomById(id) {
  return atoms.find((atom) => atom.id === id) ?? null;
}

function updateBondTransform(bond) {
  const a = atomById(bond.a);
  const b = atomById(bond.b);
  if (!a || !b) return;
  const from = a.group.position;
  const to = b.group.position;
  const delta = new THREE.Vector3().subVectors(to, from);
  const length = delta.length();
  if (length < 1e-5) return;
  const axis = delta.clone().normalize();
  const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const { u } = orthogonalBasis(axis);
  const count = bond.cylinders.length;
  bond.cylinders.forEach((cylinder, index) => {
    let offset = 0;
    if (count === 2) offset = index === 0 ? 0.14 : -0.14;
    else if (count === 3) offset = index === 1 ? 0 : index === 0 ? 0.14 : -0.14;
    cylinder.position.copy(midpoint).addScaledVector(u, offset);
    cylinder.scale.set(1, length, 1);
    cylinder.quaternion.setFromUnitVectors(UP, axis);
  });
}

function applyLayout() {
  if (atoms.length === 0) {
    setStatus("<strong>원자가 없습니다.</strong> 원자 팔레트에서 원자를 골라 작업대를 클릭하세요.", true);
    return false;
  }
  const layout = computeLayout(atoms, bonds);
  if (!layout) return false;
  lastLayout = layout;

  const centerPosition = layout.positions.get(layout.centerId) ?? new THREE.Vector3();
  const neighborPositions = layout.neighbors
    .map((id) => layout.positions.get(id))
    .filter(Boolean);

  for (const [atomId, position] of layout.positions) {
    const atom = atomById(atomId);
    if (!atom) continue;
    const scaled = position.clone().multiplyScalar(MOLECULE_SCALE);
    atom.target.copy(scaled).add(new THREE.Vector3(0, WORK_Y, 0));

    let direction;
    if (atomId === layout.centerId) {
      const away = new THREE.Vector3();
      for (const neighborPosition of neighborPositions) away.add(neighborPosition);
      direction = away.lengthSq() > 1e-8 ? away.normalize().multiplyScalar(-1) : new THREE.Vector3(0, 1, 0);
    } else {
      direction = position.clone().sub(centerPosition);
      direction = direction.lengthSq() > 1e-8 ? direction.normalize() : new THREE.Vector3(0, 1, 0);
    }
    atom.label.position.copy(direction.multiplyScalar(ELEMENTS[atom.element].radius + 0.3));
  }
  const shape = layout.domains === 4
    ? layout.lonePairs === 0 ? "정사면체" : layout.lonePairs === 1 ? "삼각뿔" : "굽은형"
    : layout.domains === 3 ? "평면 삼각형" : "직선";
  setStatus(
    `<strong>배치 완료.</strong> 전자 영역 ${layout.domains}개 · 비공유 전자쌍 ${layout.lonePairs}쌍 · 결합각 ${layout.angleDeg.toFixed(1)}° (${shape}).`,
  );
  return true;
}

function loadExample() {
  clearAll();
  const skeleton = buildTargetSkeleton(currentTarget);
  const spacing = 1.25;
  const offset = ((skeleton.atoms.length - 1) * spacing) / 2;
  skeleton.atoms.forEach((entry, index) => {
    const position = new THREE.Vector3(index * spacing - offset, WORK_Y, 0);
    addAtom(entry.element, position);
  });
  skeleton.bonds.forEach((entry) => {
    addBond(entry.a, entry.b, entry.order);
  });
  setStatus(
    `<strong>${currentTarget.label}</strong> 예시를 불러왔습니다. 원자가 일직선으로 늘어져 있으니 <em>자동 배치</em>를 눌러 모양을 정리하세요.`,
  );
}

function checkMolecule() {
  if (atoms.length === 0) {
    setStatus("<strong>아직 만든 분자가 없습니다.</strong>", true);
    return;
  }
  const result = validate(atoms, bonds, currentTarget);
  if (result.ok) {
    setStatus(
      `<strong>정답입니다.</strong> ${currentTarget.label} 완성. ${currentTarget.shape} · 결합각 ${currentTarget.angleDeg}°. ${currentTarget.description}`,
    );
    return;
  }
  const problems = [];
  if (!result.countOk) problems.push("원자 종류와 개수가 목표와 다릅니다");
  if (!result.centerOk) problems.push(`중심 원자가 ${currentTarget.center}가 아닙니다 (현재 ${result.centerElement ?? "없음"})`);
  if (!result.neighborOk) problems.push("중심 원자에 연결된 원자의 종류·수가 다릅니다");
  setStatus(`<strong>아직 다릅니다.</strong> ${problems.join(" · ")}.`, true);
}

function setPlaceElement(element) {
  placeElement = element;
  for (const button of elementRow.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.element === element));
  }
  if (element) {
    selectedAtomId = null;
    setStatus(`<strong>${ELEMENTS[element].name}(${element})</strong>를 놓을 준비가 되었습니다. 작업대를 클릭하세요.`);
  }
}

function setTarget(target) {
  currentTarget = target;
  for (const button of targetButtons.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.target === target.id));
  }
  setStatus(`<strong>목표: ${target.label}</strong> ${target.shape} · 결합각 ${target.angleDeg}°.`);
}

for (const target of TARGETS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.target = target.id;
  button.textContent = target.label;
  button.setAttribute("aria-pressed", String(target.id === currentTarget.id));
  button.addEventListener("click", () => setTarget(target));
  targetButtons.append(button);
}

for (const element of ELEMENT_ORDER) {
  const info = ELEMENTS[element];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "element";
  button.dataset.element = element;
  button.setAttribute("aria-pressed", "false");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = info.css;
  const symbol = document.createElement("span");
  symbol.className = "symbol";
  symbol.textContent = info.symbol;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = info.name;
  button.append(dot, symbol, name);
  button.addEventListener("click", () => {
    setPlaceElement(placeElement === element ? null : element);
  });
  elementRow.append(button);
}

document.getElementById("btn-example").addEventListener("click", loadExample);
document.getElementById("btn-layout").addEventListener("click", applyLayout);
document.getElementById("btn-check").addEventListener("click", checkMolecule);
document.getElementById("btn-clear").addEventListener("click", () => {
  clearAll();
  setPlaceElement(null);
  setStatus("<strong>초기화했습니다.</strong> 원자 팔레트에서 원자를 골라 작업대를 클릭하세요.");
});

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart = null;
  if (moved > 5) return;

  const atomMeshes = atoms.map((atom) => atom.mesh);
  const atomHit = pick(event.clientX, event.clientY, atomMeshes)[0];

  if (placeElement && (!atomHit || !atomHit.object.userData.atomId)) {
    const point = pick.pickPlane(event.clientX, event.clientY, WORK_Y);
    if (!point) return;
    const distance = Math.hypot(point.x, point.z);
    if (distance > 3.3) {
      setStatus("<strong>작업대 바깥입니다.</strong> 원형 작업대 안쪽을 클릭하세요.", true);
      return;
    }
    addAtom(placeElement, new THREE.Vector3(point.x, WORK_Y, point.z));
    setStatus(`<strong>${ELEMENTS[placeElement].name}</strong> 원자를 놓았습니다. 다른 원자를 클릭하면 결합됩니다.`);
    return;
  }

  if (atomHit && atomHit.object.userData.atomId) {
    const id = atomHit.object.userData.atomId;
    if (placeElement) setPlaceElement(null);
    if (selectedAtomId && selectedAtomId !== id) {
      const existing = findBond(bonds, selectedAtomId, id);
      if (existing) {
        if (existing.order < 3) {
          removeBond(existing.id);
          addBond(existing.a, existing.b, existing.order + 1);
          setStatus(`<strong>결합 차수를 ${existing.order + 1}중으로 올렸습니다.</strong>`);
        } else {
          setStatus("<strong>최대 3중 결합입니다.</strong>", true);
        }
      } else {
        addBond(selectedAtomId, id, 1);
        setStatus("<strong>결합을 만들었습니다.</strong> 같은 두 원자를 다시 누르면 결합 차수가 올라갑니다.");
      }
      selectedAtomId = null;
    } else {
      selectedAtomId = selectedAtomId === id ? null : id;
      if (selectedAtomId) setStatus("<strong>원자를 선택했습니다.</strong> 다른 원자를 누르면 결합이 만들어집니다.");
    }
    return;
  }

  const bondProxies = bonds.map((bond) => bond.proxy);
  const bondHit = pick(event.clientX, event.clientY, bondProxies)[0];
  if (bondHit && bondHit.object.userData.bondId) {
    removeBond(bondHit.object.userData.bondId);
    setStatus("<strong>결합을 삭제했습니다.</strong>");
    return;
  }

  selectedAtomId = null;
});

const VIEWS = {
  card: { position: [0, 2.45, 5.4], target: [0, 2.0, 0] },
  default: { position: [0, 4.1, 9.8], target: [0, 1.9, 0] },
  front: { position: [0, 2.1, 10.5], target: [0, 2, 0] },
  side: { position: [10.5, 2.1, 0], target: [0, 2, 0] },
  top: { position: [0, 11, 0.02], target: [0, 1.6, 0] },
};

let currentView = "default";

function setView(name) {
  currentView = VIEWS[name] ? name : "default";
  const view = VIEWS[currentView];
  stage.camera.position.set(...view.position);
  stage.controls.target.set(...view.target);
  stage.controls.update();
}

let invariantBadge = null;
let invariantProblems = [];
let invariantTimer = 0;

function renderInvariantBadge(problems) {
  if (!invariantBadge) {
    invariantBadge = document.createElement("div");
    invariantBadge.style.cssText =
      "position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:6;padding:7px 14px;border-radius:11px;font:600 12.5px/1.45 system-ui,sans-serif;background:#3a1414;color:#ffb0a5;border:1px solid rgba(255,107,92,.65);display:none;pointer-events:none;max-width:72vw";
    document.body.append(invariantBadge);
  }
  if (problems.length === 0) {
    invariantBadge.style.display = "none";
    return;
  }
  invariantBadge.style.display = "block";
  invariantBadge.textContent = `불변식 위반 ${problems.length}건 · ${problems[0].message}`;
}

function updateInvariants(delta) {
  invariantTimer += delta;
  if (invariantTimer < 0.5) return;
  invariantTimer = 0;
  invariantProblems = checkInvariants({
    atoms,
    bonds,
    layout: lastLayout,
    camera: stage.camera,
    target: currentTarget,
    view: currentView,
  });
  renderInvariantBadge(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta) => {
  const smoothing = Math.min(1, delta * 7);
  for (const atom of atoms) {
    atom.group.position.lerp(atom.target, smoothing);
  }
  for (const bond of bonds) updateBondTransform(bond);

  updateInvariants(delta);

  const selected = selectedAtomId ? atomById(selectedAtomId) : null;
  if (selected) {
    selectionRing.visible = true;
    selectionRing.position.copy(selected.group.position);
    selectionRing.quaternion.copy(stage.camera.quaternion);
  } else {
    selectionRing.visible = false;
  }
});

setTarget(currentTarget);
setStatus("<strong>준비됨.</strong> 목표 분자를 고르고 <em>예시 불러오기</em>를 눌러 시작하세요.");

window.__gameApi = {
  getState: () => ({
    target: currentTarget.id,
    atoms: atoms.map((atom) => atom.element),
    bonds: bonds.map((bond) => ({ a: bond.a, b: bond.b, order: bond.order })),
    selected: selectedAtomId,
    placeElement,
  }),
  getInvariants: () => invariantProblems,
  getScreenPositions: () =>
    atoms.map((atom) => {
      const projected = atom.group.position.clone().project(stage.camera);
      return {
        id: atom.id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    }),
  setView,
};
