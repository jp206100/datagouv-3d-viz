import * as THREE from 'three';
import { latLngToScene } from '../utils/geo.js';

var HOTSPOTS = [
  { lat: 48.8566, lng: 2.3522, intensity: 1.0 },
  { lat: 43.2965, lng: 5.3698, intensity: 0.6 },
  { lat: 45.7640, lng: 4.8357, intensity: 0.7 },
  { lat: 43.6047, lng: 1.4442, intensity: 0.5 },
  { lat: 43.7102, lng: 7.2620, intensity: 0.45 },
  { lat: 44.8378, lng: -0.5792, intensity: 0.5 },
  { lat: 47.2184, lng: -1.5536, intensity: 0.4 },
  { lat: 48.5734, lng: 7.7521, intensity: 0.35 },
];
var PULSE_PERIOD = 4.0;
var MAX_RADIUS = 6.0;
var RING_COUNT = 3;

export function createPulseWaves(scene) {
  var group = new THREE.Group();
  group.name = 'pulse-waves';
  var rings = [];
  for (var h = 0; h < HOTSPOTS.length; h++) {
    var hotspot = HOTSPOTS[h];
    var center = latLngToScene(hotspot.lat, hotspot.lng);
    for (var r = 0; r < RING_COUNT; r++) {
      var geometry = new THREE.RingGeometry(0.1, 0.15, 64);
      var material = new THREE.MeshBasicMaterial({ color: 0xff6b3b, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(center.x, 0.02, center.z);
      group.add(mesh);
      rings.push({ mesh: mesh, center: center, intensity: hotspot.intensity, phaseOffset: (r / RING_COUNT) * PULSE_PERIOD });
    }
  }
  scene.add(group);
  return { group: group, rings: rings, enabled: true };
}

export function updatePulseWaves(pulseData, elapsed) {
  if (!pulseData) return;
  for (var j = 0; j < pulseData.rings.length; j++) {
    var ring = pulseData.rings[j];
    if (!pulseData.enabled) { ring.mesh.material.opacity = 0; continue; }
    var t = ((elapsed + ring.phaseOffset) % PULSE_PERIOD) / PULSE_PERIOD;
    var radius = t * MAX_RADIUS * ring.intensity;
    ring.mesh.scale.set(radius / 0.125, radius / 0.125, 1);
    ring.mesh.material.opacity = Math.max(0, (1.0 - t) * 0.25 * ring.intensity);
  }
}
