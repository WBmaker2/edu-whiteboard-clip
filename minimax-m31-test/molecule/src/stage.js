import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08131c);
  scene.fog = new THREE.Fog(0x08131c, 16, 42);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  camera.position.set(0, 4.1, 9.8);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 1.9, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0x9fe8ff, 0x051016, 1.1));

  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(5, 9, 6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x35d6c0, 1.5);
  rim.position.set(-6, 3, -7);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b1d27, roughness: 0.95, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(28, 56, 0x1d6b6a, 0x123c44);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  grid.position.y = 0.01;
  scene.add(grid);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 0.08, 64),
    new THREE.MeshStandardMaterial({ color: 0x103340, roughness: 0.8, metalness: 0.1 }),
  );
  platform.position.y = 0.04;
  scene.add(platform);

  const platformRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.035, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x35d6c0 }),
  );
  platformRing.rotation.x = -Math.PI / 2;
  platformRing.position.y = 0.09;
  scene.add(platformRing);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  const STEP = 1 / 60;

  function start(update) {
    let accumulator = 0;
    let elapsed = 0;
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.1);
      accumulator = Math.min(accumulator + delta, 0.25);
      while (accumulator >= STEP) {
        elapsed += STEP;
        update(STEP, elapsed);
        accumulator -= STEP;
      }
      controls.update();
      renderer.render(scene, camera);
      if (window.__gameReady !== true) window.__gameReady = true;
    });
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const material = object.material;
      if (!material) return;
      const list = Array.isArray(material) ? material : [material];
      for (const entry of list) {
        if (entry.map) entry.map.dispose();
        entry.dispose();
      }
    });
    renderer.dispose();
  }

  return { renderer, scene, camera, controls, start, dispose };
}

export function createPicker(canvas, camera) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function setPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  }

  return {
    pick(clientX, clientY, targets) {
      if (!setPointer(clientX, clientY)) return [];
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(targets, false);
    },
    pickPlane(clientX, clientY, height) {
      if (!setPointer(clientX, clientY)) return null;
      raycaster.setFromCamera(pointer, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, point)) return null;
      return point;
    },
  };
}
