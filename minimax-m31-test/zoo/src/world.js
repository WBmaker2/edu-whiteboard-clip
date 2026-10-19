import * as THREE from "three";

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: options.flat ?? true,
    roughness: options.roughness ?? 0.9,
    metalness: 0,
  });
}

function seeded(index) {
  const value = Math.sin(index * 91.7) * 43758.5453;
  return value - Math.floor(value);
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const lawn = new THREE.Mesh(new THREE.CircleGeometry(26, 72), standard(0x8fb573));
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  group.add(lawn);

  const meadow = new THREE.Mesh(new THREE.CircleGeometry(8.4, 64), standard(0x9cc47f));
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = 0.012;
  meadow.receiveShadow = true;
  group.add(meadow);

  const trail = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.4, 72), standard(0xd9c9a5));
  trail.rotation.x = -Math.PI / 2;
  trail.position.y = 0.02;
  trail.receiveShadow = true;
  group.add(trail);

  const trunkMaterial = standard(0x8a6340);
  const leafMaterial = standard(0x4f8a4a);
  const leafLightMaterial = standard(0x63a055);

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + seeded(i) * 0.4;
    const radius = 9.2 + seeded(i + 11) * 2.4;
    const tree = new THREE.Group();
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.rotation.y = seeded(i + 5) * Math.PI;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 8), trunkMaterial);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    tree.add(trunk);

    const lower = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.6, 7), leafMaterial);
    lower.position.y = 1.85;
    lower.castShadow = true;
    tree.add(lower);

    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 7), leafLightMaterial);
    upper.position.y = 2.65;
    upper.castShadow = true;
    tree.add(upper);

    group.add(tree);
  }

  const rockMaterial = standard(0x9d9689);
  for (let i = 0; i < 12; i += 1) {
    const angle = seeded(i + 21) * Math.PI * 2;
    const radius = 6.6 + seeded(i + 31) * 5.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + seeded(i + 3) * 0.26, 0), rockMaterial);
    rock.position.set(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius);
    rock.rotation.set(seeded(i) * 3, seeded(i + 1) * 3, seeded(i + 2) * 3);
    rock.scale.y = 0.7 + seeded(i + 4) * 0.4;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const bushMaterial = standard(0x6da35c);
  for (let i = 0; i < 10; i += 1) {
    const angle = seeded(i + 41) * Math.PI * 2;
    const radius = 6.2 + seeded(i + 51) * 6;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34 + seeded(i + 7) * 0.24, 0), bushMaterial);
    bush.position.set(Math.cos(angle) * radius, 0.24, Math.sin(angle) * radius);
    bush.scale.y = 0.8;
    bush.castShadow = true;
    group.add(bush);
  }

  const flowerColors = [0xf2a0a0, 0xf5d76e, 0xf7f3e8, 0xb7a5e8];
  for (let i = 0; i < 26; i += 1) {
    const angle = seeded(i + 61) * Math.PI * 2;
    const radius = 1.2 + seeded(i + 71) * 3.4;
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      standard(flowerColors[i % flowerColors.length]),
    );
    flower.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
    group.add(flower);
  }

  return group;
}
