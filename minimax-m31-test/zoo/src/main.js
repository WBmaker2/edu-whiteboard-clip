import * as THREE from "three";
import { createStage, createPicker } from "./stage.js";
import { createWorld } from "./world.js";
import { SPECIES, SPECIES_ORDER } from "./species.js";
import { buildAnimal, updateAnimal, disposeAnimal } from "./animals.js";
import { checkInvariants } from "./invariants.js";

const canvas = document.getElementById("scene");
const stage = createStage(canvas);
const pick = createPicker(canvas, stage.camera);
createWorld(stage.scene);

const animals = [];
let currentSpecies = "cat";
let walking = false;
let nextId = 1;

const statSpecies = document.getElementById("stat-species");
const statCount = document.getElementById("stat-count");
const statMotion = document.getElementById("stat-motion");
const speciesGroup = document.getElementById("species-group");
const btnWalk = document.getElementById("btn-walk");

function refreshStatus() {
  statSpecies.textContent = SPECIES[currentSpecies].label;
  statCount.textContent = String(animals.length);
  statMotion.textContent = walking ? "걷는 중" : "가만히";
}

function setSpecies(speciesId) {
  currentSpecies = speciesId;
  for (const button of speciesGroup.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.species === speciesId));
  }
  refreshStatus();
}

function addAnimal(speciesId = currentSpecies) {
  const animal = buildAnimal(speciesId);
  const index = animals.length;
  animal.id = nextId;
  nextId += 1;
  const cameraAzimuth = Math.atan2(stage.camera.position.z, stage.camera.position.x);
  animal.angle = cameraAzimuth - Math.PI / 2 + index * 2.399963;
  animal.orbitRadius = 1.9 + Math.sqrt(index) * 0.88;
  animal.orbitSpeed = 0.26 + (index % 4) * 0.06;
  animal.walking = walking;
  animal.proxy.userData.animalId = animal.id;
  stage.scene.add(animal.group);
  animals.push(animal);
  refreshStatus();
  return animal;
}

function removeAll() {
  for (const animal of animals) {
    stage.scene.remove(animal.group);
    disposeAnimal(animal);
  }
  animals.length = 0;
  refreshStatus();
}

for (const speciesId of SPECIES_ORDER) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.species = speciesId;
  button.textContent = SPECIES[speciesId].label;
  button.setAttribute("aria-pressed", String(speciesId === currentSpecies));
  button.addEventListener("click", () => {
    setSpecies(speciesId);
    const existing = animals.find((animal) => animal.speciesId === speciesId);
    if (existing) focusAnimal(existing);
    else addAnimal(speciesId);
  });
  speciesGroup.append(button);
}

document.getElementById("btn-add").addEventListener("click", () => {
  addAnimal(currentSpecies);
});

btnWalk.addEventListener("click", () => {
  walking = !walking;
  btnWalk.setAttribute("aria-pressed", String(walking));
  btnWalk.textContent = walking ? "멈추기" : "모두 걷기";
  for (const animal of animals) animal.walking = walking;
  refreshStatus();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  removeAll();
  addAnimal(currentSpecies);
});

function focusAnimal(animal) {
  const target = new THREE.Vector3();
  animal.group.getWorldPosition(target);
  stage.controls.target.lerp(target, 0.6);
}

let pointerDownAt = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
  pointerDownAt = null;
  if (moved > 5) return;

  const proxies = animals.map((animal) => animal.proxy);
  const hits = pick(event.clientX, event.clientY, proxies);
  if (hits.length === 0) return;
  const id = hits[0].object.userData.animalId;
  const animal = animals.find((entry) => entry.id === id);
  if (!animal) return;
  animal.hopTimer = animal.hopDuration;
  setSpecies(animal.speciesId);
});

const VIEWS = {
  card: { position: [2.9, 2.05, 4.4], target: [0.2, 0.9, 0.1] },
  default: { position: [6.4, 3.6, 7.8], target: [0, 0.85, 0] },
  front: { position: [0, 2.4, 9.5], target: [0, 0.9, 0] },
  side: { position: [9.5, 2.4, 0], target: [0, 0.9, 0] },
  top: { position: [0, 12, 0.02], target: [0, 0.4, 0] },
};

function setView(name) {
  const view = VIEWS[name] ?? VIEWS.default;
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
      "position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:6;padding:7px 14px;border-radius:11px;font:600 12.5px/1.45 system-ui,sans-serif;background:#3a1414;color:#ffb0a5;border:1px solid rgba(255,107,92,.65);display:none;pointer-events:none;max-width:72vw";
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
  invariantProblems = checkInvariants({ animals });
  renderInvariantBadge(invariantProblems);
  if (invariantProblems.length > 0) {
    console.error(`[불변식 위반] ${invariantProblems.map((problem) => problem.message).join(" | ")}`);
  }
}

stage.start((delta, elapsed) => {
  for (const animal of animals) updateAnimal(animal, delta, elapsed, stage.camera);
  updateInvariants(delta);
});

addAnimal("cat");
addAnimal("panda");
refreshStatus();

window.__gameApi = {
  getState: () => ({
    species: currentSpecies,
    count: animals.length,
    walking,
    speciesList: animals.map((animal) => animal.speciesId),
  }),
  getInvariants: () => invariantProblems,
  setChrome: (options = {}) => {
    if (options.labels === false) {
      for (const animal of animals) animal.label.visible = false;
    }
    if (options.labels === true) {
      for (const animal of animals) animal.label.visible = true;
    }
  },
  getScreenPositions: () =>
    animals.map((animal) => {
      const projected = animal.group.position.clone().project(stage.camera);
      return {
        id: animal.id,
        x: projected.x,
        y: projected.y,
        visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z <= 1,
      };
    }),
  setView,
};
