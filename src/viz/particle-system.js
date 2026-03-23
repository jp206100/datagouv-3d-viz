import * as THREE from 'three';

var vertexShader = [
'uniform float uTime; uniform float uFilterYear; uniform float uFilterHour;',
'uniform float uFilterWeather; uniform float uHeatmap; uniform float uPixelRatio; uniform float uTimeOfDay;',
'attribute float aSize; attribute float aYear; attribute float aOpacity;',
'attribute float aHour; attribute float aWeatherId; attribute float aLightingId;',
'varying vec3 vColor; varying float vOpacity; varying float vSeverityGlow; varying float vWeatherId;',
'void main() {',
'  vColor = color; vWeatherId = aWeatherId; vSeverityGlow = aSize / 0.35;',
'  float yearMatch = 1.0 - smoothstep(0.0, 1.5, abs(aYear - uFilterYear));',
'  float hourMatch = 1.0;',
'  if (uFilterHour >= 0.0) { hourMatch = 1.0 - smoothstep(0.0, 2.5, abs(aHour - uFilterHour)); }',
'  float weatherMatch = 1.0;',
'  if (uFilterWeather > 0.0) { weatherMatch = (abs(aWeatherId - uFilterWeather) < 0.5) ? 1.0 : 0.08; }',
'  vOpacity = yearMatch * hourMatch * weatherMatch * aOpacity;',
'  float nightBoost = (aLightingId > 1.5) ? 1.4 : 1.0;',
'  float floatSpeed = (aWeatherId > 0.5) ? 1.3 : 0.8;',
'  float floatOffset = sin(uTime * floatSpeed + position.x * 3.0 + position.z * 2.0) * 0.18;',
'  float rainDrift = 0.0;',
'  if (aWeatherId > 0.5 && aWeatherId < 1.5) { rainDrift = sin(uTime * 2.5 + position.x * 7.0) * 0.12 - 0.08; }',
'  float fogExpand = (aWeatherId > 1.5 && aWeatherId < 2.5) ? sin(uTime * 0.4 + position.z * 2.0) * 0.1 : 0.0;',
'  float pulseOffset = sin(uTime * 1.5 + position.x * 5.0) * 0.05 * vSeverityGlow;',
'  vec3 pos = position; pos.y += floatOffset + rainDrift + fogExpand + pulseOffset;',
'  pos.y = mix(pos.y, 0.05, uHeatmap);',
'  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
'  float sizeScale = mix(aSize, aSize * 2.5, uHeatmap) * nightBoost;',
'  gl_PointSize = sizeScale * (220.0 / -mvPosition.z) * uPixelRatio;',
'  if (vOpacity < 0.01) gl_PointSize = 0.0;',
'  gl_Position = projectionMatrix * mvPosition;',
'}'
].join('\n');

var fragmentShader = [
'uniform float uHeatmap; uniform float uTimeOfDay;',
'varying vec3 vColor; varying float vOpacity; varying float vSeverityGlow; varying float vWeatherId;',
'void main() {',
'  if (vOpacity < 0.01) discard;',
'  float dist = length(gl_PointCoord - vec2(0.5));',
'  if (dist > 0.5) discard;',
'  float glow = 1.0 - smoothstep(0.0, 0.5, dist);',
'  float innerGlow = 1.0 - smoothstep(0.0, 0.15, dist);',
'  float fogDiffuse = (vWeatherId > 1.5 && vWeatherId < 2.5) ? 0.7 : 1.0;',
'  float fogSpread = (vWeatherId > 1.5 && vWeatherId < 2.5) ? 0.4 : 0.0;',
'  glow = mix(glow, 1.0 - smoothstep(0.0, 0.5, dist * 0.6), fogSpread);',
'  vec3 coreColor = vColor * (1.0 + innerGlow * 1.5 * vSeverityGlow) * fogDiffuse;',
'  vec3 hotspot = vec3(1.0) * innerGlow * vSeverityGlow * 0.4;',
'  float nightFactor = smoothstep(0.3, 0.7, abs(uTimeOfDay - 0.5) * 2.0);',
'  coreColor *= (1.0 + nightFactor * 0.6);',
'  float heatGlow = 1.0 - smoothstep(0.0, 0.5, dist);',
'  vec3 heatColor = mix(coreColor, vColor * heatGlow * 1.8, uHeatmap);',
'  vec3 finalColor = mix(coreColor + hotspot, heatColor, uHeatmap);',
'  gl_FragColor = vec4(finalColor, glow * vOpacity);',
'}'
].join('\n');

export function createParticleSystem(data, scene) {
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1));
  geometry.setAttribute('aYear', new THREE.BufferAttribute(data.years, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(data.opacities, 1));
  geometry.setAttribute('aHour', new THREE.BufferAttribute(data.hours, 1));
  geometry.setAttribute('aWeatherId', new THREE.BufferAttribute(data.weatherIds, 1));
  geometry.setAttribute('aLightingId', new THREE.BufferAttribute(data.lightingIds, 1));
  var material = new THREE.ShaderMaterial({
    vertexShader: vertexShader, fragmentShader: fragmentShader,
    uniforms: { uTime: {value:0}, uFilterYear: {value:2024}, uFilterHour: {value:-1.0}, uFilterWeather: {value:0.0}, uHeatmap: {value:0.0}, uPixelRatio: {value:Math.min(window.devicePixelRatio,2)}, uTimeOfDay: {value:0.5} },
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  var points = new THREE.Points(geometry, material);
  points.name = 'accident-particles';
  scene.add(points);
  return points;
}

export function updateParticles(ps, elapsed) { if (ps && ps.material && ps.material.uniforms) ps.material.uniforms.uTime.value = elapsed; }
export function filterByYear(ps, year) { if (ps && ps.material && ps.material.uniforms) ps.material.uniforms.uFilterYear.value = year; }
export function filterByHour(ps, hour) { if (ps && ps.material && ps.material.uniforms) ps.material.uniforms.uFilterHour.value = hour; }
export function filterByWeather(ps, weatherId) { if (ps && ps.material && ps.material.uniforms) ps.material.uniforms.uFilterWeather.value = weatherId; }
export function setTimeOfDay(ps, t) { if (ps && ps.material && ps.material.uniforms) ps.material.uniforms.uTimeOfDay.value = t; }
