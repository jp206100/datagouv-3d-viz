import { createScene, resizeScene, getRenderer } from './core/scene.js';
import { createControls, updateControls } from './core/controls.js';
import { processAccidentData } from './data/accident-data.js';
import { createFranceOutline } from './viz/france-outline.js';
import { createParticleSystem, updateParticles, filterByYear, filterByHour, filterByWeather, setTimeOfDay } from './viz/particle-system.js';
import { createPulseWaves, updatePulseWaves } from './viz/pulse-waves.js';
import { updateAtmosphere, getTimeLabel, getTimeIcon } from './viz/atmosphere.js';
import { setupScrubber } from './ui/scrubber.js';
import { updateStats } from './ui/stats.js';
import { setupTooltip } from './ui/tooltip.js';
import { setupWeatherFilters } from './ui/weather-filter.js';

var state = {
  currentYear: 2024, currentHour: -1, autoRotate: false,
  pulseEnabled: true, weatherFilter: 'all',
  allData: null, particleSystem: null, pulseWaves: null,
  scene: null, camera: null, controls: null, clock: null,
};

function setLoadingProgress(pct) {
  var f = document.getElementById('loading-fill');
  if (f) f.style.width = pct + '%';
}

function hideLoading() {
  var el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

function generateFullDataset() {
  var samples = [];
  var cities = [
    { lat: 48.8566, lng: 2.3522, weight: 0.30 },
    { lat: 43.2965, lng: 5.3698, weight: 0.09 },
    { lat: 45.7640, lng: 4.8357, weight: 0.09 },
    { lat: 43.6047, lng: 1.4442, weight: 0.05 },
    { lat: 43.7102, lng: 7.2620, weight: 0.05 },
    { lat: 47.2184, lng: -1.5536, weight: 0.04 },
    { lat: 48.5734, lng: 7.7521, weight: 0.04 },
    { lat: 44.8378, lng: -0.5792, weight: 0.05 },
    { lat: 47.3220, lng: 5.0415, weight: 0.03 },
    { lat: 48.1173, lng: -1.6778, weight: 0.03 },
    { lat: 50.6292, lng: 3.0573, weight: 0.06 },
    { lat: 43.6108, lng: 3.8767, weight: 0.04 },
    { lat: 47.7508, lng: 7.3359, weight: 0.02 },
    { lat: 49.2583, lng: 4.0317, weight: 0.03 },
    { lat: 45.1885, lng: 5.7245, weight: 0.03 },
    { lat: 46.5802, lng: 0.3404, weight: 0.02 },
    { lat: 44.1000, lng: -0.7667, weight: 0.01 },
    { lat: 42.6887, lng: 2.8948, weight: 0.01 },
    { lat: 48.3905, lng: -4.4861, weight: 0.01 },
  ];
  var corridors = [
    { lat1:48.85,lng1:2.35,lat2:45.76,lng2:4.84,density:80 },
    { lat1:48.85,lng1:2.35,lat2:43.30,lng2:5.37,density:60 },
    { lat1:48.85,lng1:2.35,lat2:44.84,lng2:-0.58,density:50 },
    { lat1:48.85,lng1:2.35,lat2:50.63,lng2:3.06,density:50 },
    { lat1:48.85,lng1:2.35,lat2:48.57,lng2:7.75,density:40 },
    { lat1:45.76,lng1:4.84,lat2:43.60,lng2:1.44,density:30 },
    { lat1:43.30,lng1:5.37,lat2:43.71,lng2:7.26,density:40 },
    { lat1:48.85,lng1:2.35,lat2:47.22,lng2:-1.55,density:30 },
    { lat1:48.85,lng1:2.35,lat2:48.12,lng2:-1.68,density:25 },
  ];
  var yearTrend = {
    2005:1.15,2006:1.12,2007:1.10,2008:1.05,2009:1.00,
    2010:0.98,2011:0.95,2012:0.93,2013:0.90,2014:0.88,
    2015:0.87,2016:0.86,2017:0.85,2018:0.83,2019:0.82,
    2020:0.62,2021:0.72,2022:0.78,2023:0.80,2024:0.82,
  };
  var hourDist = [0.02,0.01,0.01,0.01,0.01,0.02,0.04,0.07,0.08,0.06,0.05,0.06,0.07,0.06,0.06,0.06,0.07,0.08,0.07,0.05,0.04,0.03,0.03,0.02];

  function pickHour() {
    var r = Math.random(), cum = 0;
    for (var h = 0; h < 24; h++) { cum += hourDist[h]; if (r < cum) return h; }
    return 12;
  }
  function pickWeather(month) {
    var r = Math.random();
    if (month >= 11 || month <= 2) { if (r<0.15) return 'fog'; if (r<0.25) return 'snow'; if (r<0.45) return 'rain'; return 'normal'; }
    if (month >= 3 && month <= 5) { if (r<0.25) return 'rain'; if (r<0.30) return 'fog'; return 'normal'; }
    if (r<0.10) return 'rain'; if (r<0.12) return 'rain_heavy'; return 'normal';
  }
  function pickLighting(hour) {
    if (hour>=8 && hour<17) return 'day';
    if (hour>=6 && hour<8) return 'dusk';
    if (hour>=17 && hour<20) return 'dusk';
    return Math.random()<0.6 ? 'night_lit' : 'night_unlit';
  }

  for (var year = 2005; year <= 2024; year++) {
    var trend = yearTrend[year] || 0.85;
    var baseCount = Math.floor(600 * trend);
    for (var ci = 0; ci < cities.length; ci++) {
      var city = cities[ci];
      var cityCount = Math.floor(baseCount * city.weight * (0.85 + Math.random()*0.3));
      for (var i = 0; i < cityCount; i++) {
        var spread = 0.3 + Math.random()*1.2;
        var lat = Math.max(42.3, Math.min(51.1, city.lat + (Math.random()-0.5)*spread));
        var lng = Math.max(-4.8, Math.min(8.2, city.lng + (Math.random()-0.5)*spread));
        var month = Math.floor(Math.random()*12)+1;
        var hour = pickHour();
        var sev = Math.random();
        samples.push({ year:year, lat:lat, lng:lng, month:month, hour:hour, severity: sev<0.035?'fatal':sev<0.17?'hospitalized':'minor', weather:pickWeather(month), lighting:pickLighting(hour) });
      }
    }
    for (var ri = 0; ri < corridors.length; ri++) {
      var c = corridors[ri];
      var cnt = Math.floor(c.density * trend * (0.8+Math.random()*0.4));
      for (var j = 0; j < cnt; j++) {
        var t = Math.random();
        var lat = c.lat1+(c.lat2-c.lat1)*t+(Math.random()-0.5)*0.4;
        var lng = c.lng1+(c.lng2-c.lng1)*t+(Math.random()-0.5)*0.4;
        lat = Math.max(42.3, Math.min(51.1, lat));
        lng = Math.max(-4.8, Math.min(8.2, lng));
        var month = Math.floor(Math.random()*12)+1;
        var hour = pickHour();
        var sev = Math.random();
        samples.push({ year:year, lat:lat, lng:lng, month:month, hour:hour, severity: sev<0.05?'fatal':sev<0.20?'hospitalized':'minor', weather:pickWeather(month), lighting:pickLighting(hour) });
      }
    }
  }
  return samples;
}

function updateTimeUI(hour) {
  var iconEl = document.getElementById('time-icon');
  var labelEl = document.getElementById('time-label');
  if (iconEl) iconEl.textContent = getTimeIcon(hour);
  if (labelEl) labelEl.textContent = getTimeLabel(hour);
}

async function init() {
  var container = document.getElementById('canvas-container');
  setLoadingProgress(10);
  var sd = createScene(container);
  state.scene = sd.scene; state.camera = sd.camera; state.clock = sd.clock;
  var renderer = sd.renderer;
  state.controls = createControls(state.camera, renderer.domElement);

  setLoadingProgress(20);
  state.scene.add(await createFranceOutline());

  setLoadingProgress(40);
  var rawData = generateFullDataset();
  console.log('Generated ' + rawData.length + ' records across 2005-2024');

  setLoadingProgress(75);
  state.allData = processAccidentData(rawData);
  setLoadingProgress(90);
  state.particleSystem = createParticleSystem(state.allData, state.scene);
  state.pulseWaves = createPulseWaves(state.scene);
  filterByYear(state.particleSystem, state.currentYear);
  updateStats(state.allData, state.currentYear);
  updateAtmosphere(state.scene, state.currentHour);
  updateTimeUI(state.currentHour);

  setupScrubber(
    function(year) { state.currentYear = year; filterByYear(state.particleSystem, year); updateStats(state.allData, year); },
    function(hour) { state.currentHour = hour; filterByHour(state.particleSystem, hour); var tod = updateAtmosphere(state.scene, hour); setTimeOfDay(state.particleSystem, tod); updateTimeUI(hour); }
  );
  setupTooltip(state.camera, state.particleSystem, state.allData);
  setupWeatherFilters(function(weather, weatherId) { state.weatherFilter = weather; filterByWeather(state.particleSystem, weather === 'all' ? 0 : weatherId); });

  var btnRotate = document.getElementById('btn-rotate');
  if (btnRotate) btnRotate.addEventListener('click', function() { state.autoRotate = !state.autoRotate; state.controls.autoRotate = state.autoRotate; btnRotate.classList.toggle('active', state.autoRotate); });

  var btnPulse = document.getElementById('btn-pulse');
  if (btnPulse) { btnPulse.classList.add('active'); btnPulse.addEventListener('click', function() { state.pulseEnabled = !state.pulseEnabled; state.pulseWaves.enabled = state.pulseEnabled; btnPulse.classList.toggle('active', state.pulseEnabled); }); }

  var btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', function() { if (state.controls) state.controls.reset(); });

  setLoadingProgress(100);
  setTimeout(hideLoading, 400);
  window.addEventListener('resize', function() { resizeScene(state.camera, renderer, container); });

  function animate() {
    requestAnimationFrame(animate);
    var elapsed = state.clock.getElapsedTime();
    updateControls(state.controls);
    if (state.particleSystem) updateParticles(state.particleSystem, elapsed);
    if (state.pulseWaves) updatePulseWaves(state.pulseWaves, elapsed);
    getRenderer().render(state.scene, state.camera);
  }
  animate();
}

init().catch(function(err) { console.error('Init failed:', err); hideLoading(); });
