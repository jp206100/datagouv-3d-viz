import * as THREE from 'three';

let renderer = null;

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.012);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 35, 40);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x1a1e28, 0.8));
  const dir = new THREE.DirectionalLight(0x4fc3f7, 0.3);
  dir.position.set(10, 20, 15);
  scene.add(dir);
  const fill = new THREE.PointLight(0xff6b3b, 0.15, 60);
  fill.position.set(0, -5, 0);
  scene.add(fill);

  const grid = new THREE.GridHelper(80, 80, 0x1a1e28, 0x151820);
  grid.position.y = -0.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);

  return { scene, camera, renderer, clock: new THREE.Clock() };
}

export function getRenderer() { return renderer; }

export function resizeScene(camera, renderer, container) {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}
