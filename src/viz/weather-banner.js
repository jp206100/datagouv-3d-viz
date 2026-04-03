import * as THREE from 'three';

var WEATHER_TYPE_MAP = { normal: 1.0, rain: 2.0, fog: 3.0, snow: 4.0 };

var bannerVertexShader = 'void main() { gl_Position = vec4(position, 1.0); }';

var bannerFragmentShader = [
  'uniform float uTime;',
  'uniform vec2 uResolution;',
  'uniform float uWeatherType;',
  'uniform float uOpacity;',
  '',
  '// --- Utility ---',
  'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float hash1(float n) { return fract(sin(n) * 43758.5453); }',
  '',
  'float noise(vec2 p) {',
  '  vec2 i = floor(p); vec2 f = fract(p);',
  '  f = f * f * (3.0 - 2.0 * f);',
  '  return mix(',
  '    mix(hash(i), hash(i + vec2(1,0)), f.x),',
  '    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);',
  '}',
  '',
  'float fbm(vec2 p) {',
  '  float v = 0.0; float a = 0.5;',
  '  for (int i = 0; i < 5; i++) {',
  '    v += a * noise(p); p *= 2.1; a *= 0.5;',
  '  }',
  '  return v;',
  '}',
  '',
  '// --- Clear Sky: God Rays ---',
  'vec3 clearSky(vec2 uv, float t) {',
  '  float rays = 0.0;',
  '  for (int i = 0; i < 8; i++) {',
  '    float fi = float(i);',
  '    float angle = -0.4 + fi * 0.15 + sin(t * 0.4 + fi * 0.7) * 0.06;',
  '    vec2 rayDir = vec2(cos(angle), sin(angle));',
  '    vec2 origin = vec2(-0.3, 1.3 - fi * 0.12);',
  '    vec2 toPoint = uv - origin;',
  '    float along = dot(toPoint, rayDir);',
  '    vec2 closest = origin + rayDir * along;',
  '    float dist = length(uv - closest);',
  '    float thickness = 0.012 + 0.01 * sin(t * 0.3 + fi * 2.5);',
  '    float ray = smoothstep(thickness, 0.0, dist);',
  '    ray *= smoothstep(-0.2, 0.4, along) * smoothstep(2.5, 0.3, along);',
  '    float n = noise(vec2(along * 4.0 + t * 0.5, fi * 8.0));',
  '    ray *= 0.5 + 0.5 * n;',
  '    ray *= 0.85 + 0.15 * sin(along * 15.0 - t * 1.5 + fi * 4.0);',
  '    rays += ray * (0.5 + 0.5 * hash1(fi));',
  '  }',
  '  vec3 color = vec3(1.0, 0.85, 0.3) * rays * 0.7;',
  '  color += vec3(1.0, 0.65, 0.1) * rays * rays * 1.5;',
  '  float glow = smoothstep(1.2, 0.0, length(uv - vec2(-0.1, 1.1)));',
  '  color += vec3(1.0, 0.9, 0.5) * glow * 0.08;',
  '  for (int i = 0; i < 20; i++) {',
  '    float fi = float(i);',
  '    float mx = fract(hash1(fi * 7.3) + t * (0.02 + hash1(fi * 3.1) * 0.03));',
  '    float my = hash1(fi * 13.7) * 0.8 + 0.1 + sin(t * 0.3 + fi) * 0.05;',
  '    float mote = smoothstep(0.01, 0.0, length(uv - vec2(mx, my)));',
  '    color += vec3(1.0, 0.92, 0.6) * mote * 0.35;',
  '  }',
  '  return color;',
  '}',
  '',
  '// --- Rain: Layered Procedural Streaks ---',
  'float rainLayer(vec2 uv, float speed, float density, float seed) {',
  '  float t = uTime * speed;',
  '  uv *= vec2(density, 3.5);',
  '  vec2 id = floor(uv);',
  '  float h = hash(id + seed * 100.0);',
  '  vec2 cell = fract(uv);',
  '  cell.x += (h - 0.5) * 0.4;',
  '  cell.y = fract(cell.y + t * (0.5 + h * 0.5) + h * 10.0);',
  '  vec2 center = cell - vec2(0.5, 0.65);',
  '  float streak = length(vec2(center.x * 8.0, center.y * 0.7));',
  '  float drop = smoothstep(0.5, 0.0, streak) * smoothstep(0.0, 0.25, cell.y);',
  '  return drop * (0.4 + h * 0.6);',
  '}',
  '',
  'vec3 rain(vec2 uv, float t) {',
  '  float r = 0.0;',
  '  r += rainLayer(uv, 1.4, 60.0, 0.0) * 0.5;',
  '  r += rainLayer(uv + 0.17, 1.0, 40.0, 1.0) * 0.7;',
  '  r += rainLayer(uv + 0.41, 1.8, 90.0, 2.0) * 0.35;',
  '  vec3 color = vec3(0.3, 0.55, 0.85) * r;',
  '  color += vec3(0.15, 0.3, 0.6) * r * r * 0.8;',
  '  float splash = smoothstep(0.0, 0.15, uv.y);',
  '  color *= splash;',
  '  float vig = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);',
  '  color *= vig;',
  '  return color;',
  '}',
  '',
  '// --- Fog: Layered FBM Mist ---',
  'vec3 fog(vec2 uv, float t) {',
  '  float f1 = fbm(uv * vec2(4.0, 2.5) + vec2(t, t * 0.3));',
  '  float f2 = fbm(uv * vec2(3.0, 1.8) + vec2(-t * 0.7, t * 0.2) + 50.0);',
  '  float f3 = fbm(uv * vec2(6.0, 3.5) + vec2(t * 0.5, -t * 0.15) + 100.0);',
  '  float f = f1 * 0.5 + f2 * 0.35 + f3 * 0.15;',
  '  float yShape = smoothstep(0.0, 0.35, uv.y) * smoothstep(1.0, 0.55, uv.y);',
  '  f *= yShape;',
  '  float band = sin(uv.y * 10.0 + t * 1.5) * 0.08 + 0.92;',
  '  f *= band;',
  '  vec3 color1 = vec3(0.65, 0.65, 0.72);',
  '  vec3 color2 = vec3(0.4, 0.38, 0.5);',
  '  vec3 color = mix(color2, color1, f) * f * 0.65;',
  '  float glow = smoothstep(0.7, 0.0, abs(uv.x - 0.5)) * 0.06;',
  '  color += vec3(0.6, 0.6, 0.7) * glow;',
  '  return color;',
  '}',
  '',
  '// --- Snow: Multi-Layer Falling Flakes ---',
  'float snowLayer(vec2 uv, float scale, float speed, float seed) {',
  '  float t = uTime * speed;',
  '  uv *= scale;',
  '  uv.y += t;',
  '  uv.x += sin(t * 0.3 + seed) * 0.5;',
  '  vec2 id = floor(uv);',
  '  vec2 f = fract(uv) - 0.5;',
  '  float snow = 0.0;',
  '  for (int y = -1; y <= 1; y++) {',
  '    for (int x = -1; x <= 1; x++) {',
  '      vec2 neighbor = vec2(float(x), float(y));',
  '      vec2 cellId = id + neighbor;',
  '      float h = hash(cellId + seed);',
  '      vec2 offset = vec2(hash(cellId * 1.7 + seed), hash(cellId * 2.3 + seed + 50.0)) - 0.5;',
  '      offset *= 0.7;',
  '      offset.x += sin(uTime * (0.4 + h * 0.3) + h * 6.28) * 0.18;',
  '      vec2 diff = neighbor + offset - f;',
  '      float dist = length(diff);',
  '      float size = 0.06 + h * 0.09;',
  '      float flake = smoothstep(size, size * 0.15, dist);',
  '      flake += smoothstep(size * 3.5, 0.0, dist) * 0.12;',
  '      snow += flake * (0.4 + h * 0.6);',
  '    }',
  '  }',
  '  return snow;',
  '}',
  '',
  'vec3 snow(vec2 uv, float t) {',
  '  float s = 0.0;',
  '  s += snowLayer(uv, 8.0, 0.22, 0.0) * 0.55;',
  '  s += snowLayer(uv, 5.0, 0.32, 50.0) * 0.75;',
  '  s += snowLayer(uv, 3.5, 0.45, 100.0) * 1.0;',
  '  vec3 color = mix(vec3(0.7, 0.82, 0.95), vec3(1.0), s) * s * 0.55;',
  '  color += vec3(0.06, 0.08, 0.14) * smoothstep(1.0, 0.2, length(uv - 0.5));',
  '  return color;',
  '}',
  '',
  '// --- Main ---',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / uResolution;',
  '  float t = uTime * 0.15;',
  '  vec3 color = vec3(0.0);',
  '',
  '  if (uWeatherType > 0.5 && uWeatherType < 1.5) {',
  '    color = clearSky(uv, uTime * 0.3);',
  '  } else if (uWeatherType > 1.5 && uWeatherType < 2.5) {',
  '    color = rain(uv, uTime);',
  '  } else if (uWeatherType > 2.5 && uWeatherType < 3.5) {',
  '    color = fog(uv, uTime * 0.15);',
  '  } else if (uWeatherType > 3.5 && uWeatherType < 4.5) {',
  '    color = snow(uv, uTime);',
  '  }',
  '',
  '  float scan = 0.92 + 0.08 * sin(gl_FragCoord.y * 2.5 + uTime * 1.5);',
  '  color *= scan;',
  '  color *= uOpacity;',
  '  gl_FragColor = vec4(color, 1.0);',
  '}',
].join('\n');

export function createWeatherBanner(mainRenderer) {
  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var size = mainRenderer.getSize(new THREE.Vector2());

  var material = new THREE.ShaderMaterial({
    depthTest: false,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.x, 120) },
      uWeatherType: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: bannerVertexShader,
    fragmentShader: bannerFragmentShader,
  });

  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

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
  banner.material.uniforms.uWeatherType.value = WEATHER_TYPE_MAP[weather] || 0;
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

  // Update resolution uniform for correct UV mapping
  banner.material.uniforms.uResolution.value.set(size.x, bannerH);

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
