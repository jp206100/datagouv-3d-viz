import * as THREE from 'three';
import { latLngToScene } from '../utils/geo.js';

const FRANCE_BORDER = [
  [51.05,2.54],[50.95,1.58],[49.98,1.27],[49.44,0.17],[49.65,-1.14],[49.72,-1.94],
  [48.65,-1.78],[48.58,-2.85],[48.49,-4.77],[48.09,-4.32],[47.85,-4.26],[47.63,-3.50],
  [47.29,-2.47],[47.20,-2.10],[46.90,-2.30],[46.33,-1.73],[46.15,-1.23],[45.95,-1.33],
  [45.58,-1.18],[44.64,-1.25],[43.70,-1.78],[43.35,-1.79],[42.70,-1.81],[42.35,0.67],
  [42.34,3.17],[43.23,3.27],[43.28,3.60],[43.13,4.87],[43.38,6.38],[43.73,7.53],
  [43.79,7.50],[44.13,8.11],[44.65,7.37],[45.02,6.63],[45.80,7.04],[46.45,6.84],
  [46.88,6.44],[47.58,7.50],[47.59,7.59],[48.52,7.78],[48.85,8.23],[49.02,8.14],
  [49.21,6.84],[49.48,6.37],[49.52,5.82],[49.80,5.15],[50.09,4.68],[50.33,3.90],
  [50.83,3.15],[51.05,2.54],
];
const CORSICA_BORDER = [
  [43.01,9.40],[42.97,9.56],[42.56,9.38],[42.13,9.23],[41.39,9.20],[41.38,9.01],
  [41.55,8.80],[42.04,8.57],[42.37,8.57],[42.55,8.72],[42.69,9.36],[43.01,9.40],
];

function createBorderLine(coords, color, linewidth) {
  const points = coords.map(([lat, lng]) => { const p = latLngToScene(lat, lng); return new THREE.Vector3(p.x, 0.01, p.z); });
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, linewidth }));
}

export async function createFranceOutline() {
  const group = new THREE.Group();
  group.name = 'france-outline';
  group.add(createBorderLine(FRANCE_BORDER, 0x252a36, 1.5));
  const glow = createBorderLine(FRANCE_BORDER, 0x4fc3f7, 3.0);
  glow.material.transparent = true; glow.material.opacity = 0.08; glow.position.y = -0.05;
  group.add(glow);
  group.add(createBorderLine(CORSICA_BORDER, 0x252a36, 1.5));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(35, 35), new THREE.MeshBasicMaterial({ color: 0x0e1118, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3;
  group.add(ground);
  return group;
}
