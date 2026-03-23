import * as THREE from 'three';

var TIME_COLORS = [
  { hour: 0, bg: [0.02,0.03,0.07], fog: [0.02,0.03,0.07], ambient: [0.08,0.10,0.20], fill: [0.05,0.08,0.18] },
  { hour: 5, bg: [0.04,0.04,0.10], fog: [0.04,0.04,0.10], ambient: [0.12,0.10,0.18], fill: [0.10,0.08,0.15] },
  { hour: 6, bg: [0.12,0.06,0.08], fog: [0.15,0.08,0.06], ambient: [0.40,0.25,0.15], fill: [0.50,0.30,0.10] },
  { hour: 8, bg: [0.06,0.07,0.12], fog: [0.08,0.09,0.14], ambient: [0.30,0.30,0.35], fill: [0.20,0.18,0.15] },
  { hour: 12, bg: [0.06,0.07,0.10], fog: [0.06,0.07,0.10], ambient: [0.25,0.28,0.35], fill: [0.15,0.12,0.10] },
  { hour: 17, bg: [0.10,0.06,0.06], fog: [0.12,0.07,0.05], ambient: [0.45,0.30,0.15], fill: [0.55,0.30,0.08] },
  { hour: 19, bg: [0.06,0.04,0.08], fog: [0.08,0.05,0.09], ambient: [0.20,0.12,0.18], fill: [0.30,0.15,0.10] },
  { hour: 21, bg: [0.03,0.03,0.08], fog: [0.03,0.03,0.08], ambient: [0.10,0.10,0.20], fill: [0.08,0.06,0.15] },
  { hour: 24, bg: [0.02,0.03,0.07], fog: [0.02,0.03,0.07], ambient: [0.08,0.10,0.20], fill: [0.05,0.08,0.18] },
];

function lerpColor(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }

function getTimeColors(hour) {
  if (hour < 0) return TIME_COLORS[4];
  for (var i = 0; i < TIME_COLORS.length - 1; i++) {
    if (hour >= TIME_COLORS[i].hour && hour < TIME_COLORS[i+1].hour) {
      var t = (hour - TIME_COLORS[i].hour) / (TIME_COLORS[i+1].hour - TIME_COLORS[i].hour);
      return { bg: lerpColor(TIME_COLORS[i].bg, TIME_COLORS[i+1].bg, t), fog: lerpColor(TIME_COLORS[i].fog, TIME_COLORS[i+1].fog, t), ambient: lerpColor(TIME_COLORS[i].ambient, TIME_COLORS[i+1].ambient, t), fill: lerpColor(TIME_COLORS[i].fill, TIME_COLORS[i+1].fill, t) };
    }
  }
  return TIME_COLORS[4];
}

export function updateAtmosphere(scene, hour) {
  var colors = getTimeColors(hour);
  scene.background = new THREE.Color(colors.bg[0], colors.bg[1], colors.bg[2]);
  if (scene.fog) scene.fog.color.setRGB(colors.fog[0], colors.fog[1], colors.fog[2]);
  scene.traverse(function(child) {
    if (child.isAmbientLight) child.color.setRGB(colors.ambient[0], colors.ambient[1], colors.ambient[2]);
    if (child.isPointLight && child.position.y < 0) {
      child.color.setRGB(colors.fill[0], colors.fill[1], colors.fill[2]);
      child.intensity = (hour >= 6 && hour <= 19) ? 0.08 : 0.25;
    }
  });
  return (hour >= 0) ? hour / 24.0 : 0.5;
}

export function getTimeLabel(hour) {
  if (hour < 0) return 'ALL';
  return String(hour).padStart(2, '0') + ':00';
}

export function getTimeIcon(hour) {
  if (hour < 0) return '\u263E';
  if (hour >= 6 && hour < 8) return '\u2600';
  if (hour >= 8 && hour < 17) return '\u2600';
  if (hour >= 17 && hour < 20) return '\u263D';
  return '\u263E';
}
