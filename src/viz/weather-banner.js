import * as THREE from 'three';

var PARTICLE_COUNT = 600;

var WEATHER_COLORS = {
  normal: { primary: [1.0, 0.85, 0.2], secondary: [1.0, 0.65, 0.1] },
  rain:   { primary: [0.35, 0.61, 0.84], secondary: [0.2, 0.4, 0.7] },
  fog:    { primary: [0.7, 0.7, 0.78], secondary: [0.5, 0.5, 0.58] },
  snow:   { primary: [1.0, 1.0, 1.0], secondary: [0.8, 0.88, 0.95] },
};

var WEATHER_TYPE_MAP = { normal: 1.0, rain: 2.0, fog: 3.0, snow: 4.0 };

var vertexShader = [
  'attribute float aSize;',
  'attribute float aOpacity;',
  'attribute float aRandom;',
  'uniform float uTime;',
  'uniform float uWeatherType;',
  'uniform float uPixelRatio;',
  'varying float vOpacity;',
  'varying float vRandom;',
  'void main() {',
  '  vec3 pos = position;',
  '  float r = aRandom;',
  '  float t = uTime;',
  // Clear sky: horizontal light rays sweeping across
  '  if (uWeatherType > 0.5 && uWeatherType < 1.5) {',
  '    float speed = 0.15 + r * 0.12;',
  '    pos.x = mod(pos.x + t * speed + r * 2.5, 2.5) - 1.25;',
  '    pos.y += sin(t * 0.3 + r * 6.28) * 0.04;',
  '  }',
  // Rain: fast downward streaks
  '  else if (uWeatherType > 1.5 && uWeatherType < 2.5) {',
  '    pos.y = mod(pos.y - t * 1.2 - r * 3.0, 2.5) - 1.25;',
  '    pos.x += sin(r * 30.0) * 0.03;',
  '  }',
  // Fog: slow horizontal drift
  '  else if (uWeatherType > 2.5 && uWeatherType < 3.5) {',
  '    pos.x += sin(t * 0.2 + r * 6.28) * 0.35;',
  '    pos.y += cos(t * 0.12 + r * 3.14) * 0.08;',
  '    pos.x = mod(pos.x + 1.25, 2.5) - 1.25;',
  '  }',
  // Snow: gentle fall with horizontal wobble
  '  else if (uWeatherType > 3.5 && uWeatherType < 4.5) {',
  '    pos.y = mod(pos.y - t * 0.18 - r * 0.6, 2.5) - 1.25;',
  '    pos.x += sin(t * 0.5 + r * 6.28) * 0.22;',
  '    pos.x = mod(pos.x + 1.25, 2.5) - 1.25;',
  '  }',
  '  vOpacity = aOpacity;',
  '  vRandom = r;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);',
  '  float sizeMult = (uWeatherType > 0.5 && uWeatherType < 1.5) ? 4.0 : 1.0;',
  '  gl_PointSize = aSize * sizeMult * uPixelRatio;',
  '}',
].join('\n');

var fragmentShader = [
  'uniform float uOpacity;',
  'uniform float uWeatherType;',
  'uniform vec3 uColorPrimary;',
  'uniform vec3 uColorSecondary;',
  'uniform float uTime;',
  'varying float vOpacity;',
  'varying float vRandom;',
  'void main() {',
  '  vec2 center = gl_PointCoord - 0.5;',
  '  float dist = length(center);',
  '  if (dist > 0.5) discard;',
  '  float alpha;',
  // Clear sky: horizontal light-ray streaks
  '  if (uWeatherType > 0.5 && uWeatherType < 1.5) {',
  '    float rayY = abs(center.y);',
  '    float rayFade = smoothstep(0.5, 0.0, abs(center.x));',
  '    alpha = smoothstep(0.18, 0.0, rayY) * rayFade;',
  '    float coreGlow = smoothstep(0.06, 0.0, rayY) * rayFade;',
  '    alpha = alpha * 0.7 + coreGlow * 0.5;',
  '  }',
  // Rain: vertically elongated streak
  '  else if (uWeatherType > 1.5 && uWeatherType < 2.5) {',
  '    float streak = length(vec2(center.x * 3.0, center.y));',
  '    alpha = smoothstep(0.5, 0.05, streak);',
  '  }',
  // Fog: very soft, wide glow
  '  else if (uWeatherType > 2.5 && uWeatherType < 3.5) {',
  '    alpha = smoothstep(0.5, 0.0, dist * 0.7);',
  '    alpha *= 0.6;',
  '  }',
  // Snow: circular glow
  '  else {',
  '    alpha = smoothstep(0.5, 0.0, dist);',
  '  }',
  // Hologram scanline effect (subtle for clear sky to keep rays clean)
  '  float scanStr = (uWeatherType > 0.5 && uWeatherType < 1.5) ? 0.08 : 0.18;',
  '  float scanline = (1.0 - scanStr) + scanStr * sin(gl_FragCoord.y * 2.5 + uTime * 2.0);',
  '  vec3 color = mix(uColorSecondary, uColorPrimary, vRandom);',
  // Inner core brightening (stronger for light rays)
  '  float core = smoothstep(0.3, 0.0, dist);',
  '  float coreBoost = (uWeatherType > 0.5 && uWeatherType < 1.5) ? 0.5 : 0.3;',
  '  color += core * coreBoost;',
  '  alpha *= vOpacity * uOpacity * scanline;',
  '  gl_FragColor = vec4(color, alpha);',
  '}',
].join('\n');

export function createWeatherBanner(mainRenderer) {
  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 5;

  var geometry = new THREE.BufferGeometry();
  var positions = new Float32Array(PARTICLE_COUNT * 3);
  var sizes = new Float32Array(PARTICLE_COUNT);
  var opacities = new Float32Array(PARTICLE_COUNT);
  var randoms = new Float32Array(PARTICLE_COUNT);

  for (var i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 2.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2.5;
    positions[i * 3 + 2] = 0;
    sizes[i] = 2.0 + Math.random() * 5.0;
    opacities[i] = 0.2 + Math.random() * 0.8;
    randoms[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

  var material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorPrimary: { value: new THREE.Vector3(1, 1, 1) },
      uColorSecondary: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
      uWeatherType: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: mainRenderer.getPixelRatio() },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  var points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    scene: scene,
    camera: camera,
    material: material,
    currentWeather: 'all',
    targetOpacity: 0,
    currentOpacity: 0,
    _lastTime: 0,
  };
}

export function setWeatherBanner(banner, weather) {
  banner.currentWeather = weather;

  var backdrop = document.getElementById('weather-banner-backdrop');
  if (backdrop) {
    var header = document.querySelector('.header');
    var headerH = header ? header.offsetHeight : 95;
    backdrop.style.top = headerH + 'px';
  }

  if (weather === 'all') {
    banner.targetOpacity = 0;
    if (backdrop) backdrop.style.opacity = '0';
    return;
  }
  if (backdrop) backdrop.style.opacity = '1';

  banner.targetOpacity = 1;
  var colors = WEATHER_COLORS[weather];
  if (!colors) return;

  var u = banner.material.uniforms;
  u.uColorPrimary.value.set(colors.primary[0], colors.primary[1], colors.primary[2]);
  u.uColorSecondary.value.set(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  u.uWeatherType.value = WEATHER_TYPE_MAP[weather] || 0;
}

export function updateWeatherBanner(banner, elapsed) {
  var dt = elapsed - banner._lastTime;
  banner._lastTime = elapsed;
  if (dt <= 0 || dt > 0.5) dt = 0.016;

  var speed = 3.0;
  if (banner.currentOpacity < banner.targetOpacity) {
    banner.currentOpacity = Math.min(banner.targetOpacity, banner.currentOpacity + speed * dt);
  } else if (banner.currentOpacity > banner.targetOpacity) {
    banner.currentOpacity = Math.max(banner.targetOpacity, banner.currentOpacity - speed * dt);
  }

  banner.material.uniforms.uOpacity.value = banner.currentOpacity;
  banner.material.uniforms.uTime.value = elapsed;
}

var _sizeVec = new THREE.Vector2();

export function renderWeatherBanner(banner, renderer) {
  if (banner.currentOpacity < 0.005) return;

  var size = renderer.getSize(_sizeVec);
  var header = document.querySelector('.header');
  var headerH = header ? header.offsetHeight : 95;
  var bannerH = 120;

  // WebGL y=0 is bottom; scissor in CSS pixels (Three.js handles pixel ratio)
  var scissorY = size.y - headerH - bannerH;

  var oldAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setScissorTest(true);
  renderer.setScissor(0, scissorY, size.x, bannerH);
  renderer.setViewport(0, scissorY, size.x, bannerH);

  renderer.render(banner.scene, banner.camera);

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.setScissor(0, 0, size.x, size.y);
  renderer.autoClear = oldAutoClear;
}
