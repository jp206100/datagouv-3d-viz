import { createScene, resizeScene, getRenderer } from './core/scene.js';
import { createControls, updateControls } from './core/controls.js';
import { processAccidentData } from './data/accident-data.js';
import { loadAccidentData } from './data/datagouv-api.js';
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

function setLoadingText(text) {
  var el = document.querySelector('.loading__text');
  if (el) el.textContent = text;
}

function hideLoading() {
  var el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
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

  setLoadingProgress(30);
  setLoadingText('FETCHING ACCIDENT DATA');
  var rawData = await loadAccidentData(function(p) {
    setLoadingProgress(30 + Math.floor(p * 40));
  });
  console.log('Loaded ' + rawData.length + ' real BAAC records');

  setLoadingProgress(75);
  state.allData = processAccidentData(rawData);
  setLoadingProgress(85);
  setLoadingText('BUILDING VISUALIZATION');
  state.particleSystem = createParticleSystem(state.allData, state.scene);
  state.pulseWaves = createPulseWaves(state.scene);

  // Set year range from actual data
  var yr = state.allData.yearRange;
  state.currentYear = yr.max;
  var yearSlider = document.getElementById('year-slider');
  if (yearSlider) { yearSlider.min = yr.min; yearSlider.max = yr.max; yearSlider.value = yr.max; }
  var yearLabel = document.getElementById('scrubber-year');
  if (yearLabel) yearLabel.textContent = yr.max;

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
