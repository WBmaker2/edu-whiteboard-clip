import * as THREE from "three";
import { SPECIES } from "./species.js";
import {
  attachmentOffset,
  directionOf,
  studOffset,
  studReach,
  surfaceOffset,
  surfaceReach,
} from "./attach.js";

function material(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88, metalness: 0 });
}

function makeLabel(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }),
  );
  if (!ctx) {
    sprite.material.color.setHex(0x3a2f24);
    sprite.scale.set(1.25, 0.35, 1);
    return sprite;
  }
  ctx.fillStyle = "rgba(255, 252, 245, 0.9)";
  ctx.beginPath();
  ctx.roundRect(4, 8, 248, 52, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(58, 47, 36, 0.16)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3a2f24";
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 35);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.scale.set(1.25, 0.35, 1);
  return sprite;
}

function buildTail(spec, mat) {
  if (spec.kind === "stub") {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 12, 10), mat);
    mesh.castShadow = true;
    return { root: mesh, segs: [] };
  }

  const root = new THREE.Group();
  const segs = [];
  const count = 5;
  const segLen = spec.len / count;
  let parent = root;
  for (let i = 0; i < count; i += 1) {
    const seg = new THREE.Group();
    const radiusTop = spec.r * (1 - i * 0.15);
    const radiusBottom = spec.r * (1 - (i + 1) * 0.15);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, segLen, 8), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = -segLen / 2;
    mesh.castShadow = true;
    seg.add(mesh);
    seg.position.z = i === 0 ? 0 : -segLen;
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }
  return { root, segs };
}

function shortestDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function buildAnimal(speciesId) {
  const spec = SPECIES[speciesId];
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);

  const attachments = [];

  const bodyMaterial = material(spec.colors.body);
  const bellyMaterial = material(spec.colors.belly);
  const accentMaterial = material(spec.colors.accent);
  const darkMaterial = material(spec.colors.dark);

  const bodyY = spec.legLen + spec.body.ry;

  const bodyRoot = new THREE.Group();
  inner.add(bodyRoot);

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bodyMaterial);
  body.scale.set(spec.body.rx, spec.body.ry, spec.body.rz);
  body.position.y = bodyY;
  body.castShadow = true;
  body.receiveShadow = true;
  bodyRoot.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), bellyMaterial);
  belly.scale.set(spec.body.rx * 0.94, spec.body.ry * 0.72, spec.body.rz * 0.95);
  belly.position.y = bodyY - spec.body.ry * 0.4;
  belly.receiveShadow = true;
  bodyRoot.add(belly);

  for (const patch of spec.patches) {
    const target = patch.parent === "body" ? bodyRoot : null;
    if (!target) continue;
    const scale = { x: patch.scale[0], y: patch.scale[1], z: patch.scale[2] };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(patch.r, 16, 12), darkMaterial);
    mesh.scale.set(scale.x, scale.y, scale.z);
    const direction = directionOf(...patch.dir);
    mesh.position.copy(
      surfaceOffset(spec.body.rx, direction, patch.r, scale, patch.protrusion).setY(bodyY),
    );
    mesh.castShadow = true;
    target.add(mesh);
    attachments.push({
      label: "몸 표식",
      hostRadius: spec.body.rx,
      reach: surfaceReach(spec.body.rx, direction, patch.r, scale, patch.protrusion),
    });
  }

  const head = new THREE.Group();
  head.position.set(0, bodyY + spec.head.dy, spec.head.dz);
  inner.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(spec.head.r, 18, 14), bodyMaterial);
  skull.castShadow = true;
  head.add(skull);

  for (const patch of spec.patches) {
    if (patch.parent === "body") continue;
    const scale = { x: patch.scale[0], y: patch.scale[1], z: patch.scale[2] };
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(patch.r, 16, 12), darkMaterial);
    mesh.scale.set(scale.x, scale.y, scale.z);
    const direction = directionOf(...patch.dir);
    mesh.position.copy(surfaceOffset(spec.head.r, direction, patch.r, scale, patch.protrusion));
    head.add(mesh);
    attachments.push({
      label: "얼굴 표식",
      hostRadius: spec.head.r,
      reach: surfaceReach(spec.head.r, direction, patch.r, scale, patch.protrusion),
    });
  }

  if (spec.muzzle) {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(spec.muzzle.r, 16, 12), bellyMaterial);
    muzzle.position.set(0, spec.muzzle.dy, spec.muzzle.dz);
    muzzle.scale.set(1, 0.84, 1);
    muzzle.castShadow = true;
    head.add(muzzle);
  }

  const eyes = [];
  const eyeRadius = spec.head.r * 0.11;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 10, 8), darkMaterial);
    const dir = directionOf(spec.eyeDir[0] * side, spec.eyeDir[1], spec.eyeDir[2]);
    eye.position.copy(studOffset(spec.head.r, dir, eyeRadius));
    head.add(eye);
    eyes.push(eye);
    attachments.push({
      label: "눈",
      hostRadius: spec.head.r,
      reach: studReach(spec.head.r, dir, eyeRadius),
    });
  }

  const noseRadius = spec.head.r * 0.1;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(noseRadius, 10, 8), darkMaterial);
  const noseHostRadius = spec.muzzle ? spec.muzzle.r : spec.head.r;
  const noseHostCenter = spec.muzzle ? new THREE.Vector3(0, spec.muzzle.dy, spec.muzzle.dz) : new THREE.Vector3();
  nose.position
    .copy(noseHostCenter)
    .add(studOffset(noseHostRadius, directionOf(...spec.noseDir), noseRadius));
  head.add(nose);
  attachments.push({
    label: "코",
    hostRadius: noseHostRadius,
    reach: studReach(noseHostRadius, directionOf(...spec.noseDir), noseRadius),
  });

  const ear = spec.ear;
  const ears = [];
  for (const side of [-1, 1]) {
    const dir = directionOf(ear.dir[0] * side, ear.dir[1], ear.dir[2]);
    const base = attachmentOffset(spec.head.r, dir);
    const earReach = base.length() + (ear.kind === "round" ? ear.r * 0.9 : ear.h * 0.3);
    attachments.push({ label: "귀", hostRadius: spec.head.r, reach: earReach });
    if (ear.kind === "cone") {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(ear.r, ear.h, 4), bodyMaterial);
      mesh.position.copy(base);
      mesh.rotation.z = -side * ear.tilt;
      mesh.castShadow = true;
      head.add(mesh);
      ears.push(mesh);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(ear.r * 0.55, ear.h * 0.6, 4), accentMaterial);
      inner.position.copy(base).addScaledVector(dir.clone().normalize(), ear.r * 0.3);
      inner.rotation.z = -side * ear.tilt;
      head.add(inner);
    } else if (ear.kind === "round") {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(ear.r, 14, 10), accentMaterial);
      mesh.position.copy(base);
      mesh.scale.set(0.52, 1, 0.36);
      mesh.castShadow = true;
      head.add(mesh);
      ears.push(mesh);
    } else {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(ear.r, ear.h, 4), bodyMaterial);
      mesh.position.copy(base).addScaledVector(dir.clone().normalize(), ear.h * 0.3);
      mesh.rotation.z = -side * ear.tilt;
      mesh.rotation.x = 0.16;
      mesh.castShadow = true;
      head.add(mesh);
      ears.push(mesh);
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(ear.r * 0.5, ear.h * 0.72, 4), accentMaterial);
      innerEar.position
        .copy(base)
        .addScaledVector(dir.clone().normalize(), ear.h * 0.3 + ear.r * 0.36);
      innerEar.rotation.z = -side * ear.tilt;
      innerEar.rotation.x = 0.16;
      head.add(innerEar);
    }
  }

  const legMaterial = spec.colors.body === 0xf6f3ec ? darkMaterial : bodyMaterial;
  const legSlots = [
    [-spec.legSX, spec.legSZ, 0],
    [spec.legSX, spec.legSZ, Math.PI],
    [-spec.legSX, -spec.legSZ, Math.PI],
    [spec.legSX, -spec.legSZ, 0],
  ];
  const legs = [];
  for (const [x, z, phase] of legSlots) {
    const hip = new THREE.Group();
    hip.position.set(x, spec.legLen, z);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.legR, spec.legR * 0.85, spec.legLen, 8),
      legMaterial,
    );
    mesh.position.y = -spec.legLen / 2;
    mesh.castShadow = true;
    hip.add(mesh);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(spec.legR * 1.18, 10, 8), legMaterial);
    paw.position.y = -spec.legLen;
    paw.scale.set(1, 0.72, 1.15);
    hip.add(paw);
    inner.add(hip);
    legs.push({ hip, phase });
  }

  const tail = buildTail(spec.tail, bodyMaterial);
  if (spec.tail.kind === "curve") {
    tail.root.position.set(0, bodyY + spec.body.ry * 0.34, -spec.body.rz * 0.9);
    tail.root.rotation.x = 0.45;
  } else {
    tail.root.position.set(0, bodyY + spec.body.ry * 0.25, -spec.body.rz * 0.95);
  }
  inner.add(tail.root);

  const label = makeLabel(spec.label);
  label.position.set(0, bodyY + spec.head.dy + spec.head.r + 0.42, spec.head.dz);
  label.scale.set(1.25, 0.35, 1);
  inner.add(label);

  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 12, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  proxy.position.set(0, bodyY + 0.15, 0);
  proxy.userData.animalId = null;
  inner.add(proxy);

  return {
    speciesId,
    spec,
    group,
    inner,
    body,
    head,
    headBaseY: head.position.y,
    legs,
    tail,
    label,
    proxy,
    ears,
    eyes,
    attachments,
    angle: 0,
    orbitRadius: 3.2,
    orbitSpeed: 0.32,
    gait: 0,
    seed: Math.random() * Math.PI * 2,
    walking: false,
    hopTimer: 0,
    hopDuration: 0.85,
    spin: 0,
  };
}

export function updateAnimal(animal, delta, elapsed, camera) {
  const { spec, legs, tail, head, body, group, inner } = animal;

  if (animal.walking) {
    animal.angle += animal.orbitSpeed * delta;
    animal.gait += delta * animal.orbitSpeed * 6.4;
  }
  group.position.x = Math.cos(animal.angle) * animal.orbitRadius;
  group.position.z = Math.sin(animal.angle) * animal.orbitRadius;

  const desiredYaw = animal.walking
    ? -animal.angle
    : Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
  group.rotation.y += shortestDelta(group.rotation.y, desiredYaw) * Math.min(1, delta * 3.4);

  for (const leg of legs) {
    const swing = animal.walking ? Math.sin(animal.gait + leg.phase) * 0.62 : 0;
    leg.hip.rotation.x = swing;
  }

  const breath = 1 + Math.sin(elapsed * 1.9 + animal.seed) * 0.028;
  body.scale.set(spec.body.rx, spec.body.ry * breath, spec.body.rz);

  head.position.y = animal.headBaseY + Math.sin(elapsed * 1.9 + animal.seed) * 0.022;
  head.rotation.y = Math.sin(elapsed * 0.6 + animal.seed) * 0.18;

  for (let i = 0; i < tail.segs.length; i += 1) {
    const seg = tail.segs[i];
    const speed = animal.walking ? 8.5 : 2.3;
    const amount = animal.walking ? 0.26 : 0.12;
    const base = 0.1 * (i + 1);
    seg.rotation.x = base + Math.sin(elapsed * speed - i * 0.5 + animal.seed) * amount * (i + 1) * 0.3;
  }

  if (animal.hopTimer > 0) {
    animal.hopTimer -= delta;
    const progress = 1 - Math.max(animal.hopTimer, 0) / animal.hopDuration;
    group.position.y = Math.sin(progress * Math.PI) * 1.2;
    animal.spin += delta * 6.2;
    inner.rotation.y = animal.spin;
    if (animal.hopTimer <= 0) {
      group.position.y = 0;
      animal.spin = 0;
      inner.rotation.y = 0;
    }
  }
}

export function disposeAnimal(animal) {
  animal.group.traverse((object) => {
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
