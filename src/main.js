import { createScene, resizeScene, getRenderer } from './core/scene.js';
import { createControls, updateControls } from './core/controls.js';
import { processAccidentData } from './data/accident-data.js';
import { loadAccidentData } from './data/datagouv-api.js';
import { createFranceOutline } from './viz/france-outline.js';
import { createFranceRoads } from './viz/france-roads.js';
import { createParticleSystem, rebuildParticleSystem, updateParticles, filterByYear, filterByHour, filterByWeather, setTimeOfDay } from './viz/particle-system.js';
import { createPulseWaves, updatePulseWaves } from './viz/pulse-waves.js';
import { updateAtmosphere, getTimeLabel, getTimeIcon } from './viz/atmosphere.js';
import { setupScrubber } from './ui/scrubber.js';
import { updateStats } from './ui/stats.js';
import { setupTooltip } from './ui/tooltip.js';
import { setupWeatherFilters } from './ui/weather-filter.js';
import { createWeatherBanner, setWeatherBanner } from './viz/weather-banner.js';

var state = {
  currentYear: 2024, currentHour: -1, autoRotate: false,
  pulseEnabled: true, weatherFilter: 'all',
  allData: null, particleSystem: null, pulseWaves: null,
  scene: null, camera: null, controls: null, clock: null,
  allRawRecords: [],
  weatherBanner: null,
};

/* ── Loading overlay ─────────────────────────────────── */

function setLoadingProgress(pct) {
  var f = document.getElementById('loading-fill');
  if (f) f.style.width = Math.min(100, pct) + '%';
}

function setLoadingText(text) {
  var el = document.querySelector('.loading__text');
  if (el) el.textContent = text;
}

function setLoadingDetail(text) {
  var el = document.getElementById('loading-detail');
  if (el) el.textContent = text;
}

function hideLoading() {
  var el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

/* ── Formatting helpers ──────────────────────────────── */

function formatNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function updateTimeUI(hour) {
  var iconEl = document.getElementById('time-icon');
  var labelEl = document.getElementById('time-label');
  if (iconEl) iconEl.textContent = getTimeIcon(hour);
  if (labelEl) labelEl.textContent = getTimeLabel(hour);
}

/* ── Sync year slider to data range ──────────────────── */

function syncYearRange() {
  if (!state.allData) return;
  var yr = state.allData.yearRange;
  var yearSlider = document.getElementById('year-slider');
  if (yearSlider) {
    yearSlider.min = yr.min;
    yearSlider.max = yr.max;
    // Only set the value if current year is outside the new range
    var cur = parseInt(yearSlider.value);
    if (cur < yr.min || cur > yr.max) {
      yearSlider.value = yr.max;
      state.currentYear = yr.max;
      var yearLabel = document.getElementById('scrubber-year');
      if (yearLabel) yearLabel.textContent = yr.max;
    }
  }
  // Update the min/max label spans
  var labelsEl = yearSlider && yearSlider.parentElement && yearSlider.parentElement.querySelector('.scrubber__labels');
  if (labelsEl) {
    var spans = labelsEl.querySelectorAll('span');
    if (spans.length >= 2) {
      spans[0].textContent = yr.min;
      spans[spans.length - 1].textContent = yr.max;
      if (spans.length === 3) spans[1].textContent = Math.round((yr.min + yr.max) / 2);
    }
  }
}

/* ── Rebuild viz from current raw records ────────────── */

function rebuildViz() {
  state.allData = processAccidentData(state.allRawRecords);
  if (!state.particleSystem) {
    state.particleSystem = createParticleSystem(state.allData, state.scene);
  } else {
    rebuildParticleSystem(state.particleSystem, state.allData);
  }
  syncYearRange();
  filterByYear(state.particleSystem, state.currentYear);
  updateStats(state.allData, state.currentYear);
}

/* ── Main init ───────────────────────────────────────── */

async function init() {
  var container = document.getElementById('canvas-container');
  setLoadingProgress(5);
  setLoadingText('INITIALIZING');

  // Set up 3D scene immediately
  var sd = createScene(container);
  state.scene = sd.scene; state.camera = sd.camera; state.clock = sd.clock;
  var renderer = sd.renderer;
  state.controls = createControls(state.camera, renderer.domElement);

  setLoadingProgress(10);
  state.scene.add(await createFranceOutline());
  try { state.scene.add(createFranceRoads()); } catch (e) { console.warn('Roads layer failed:', e); }
  state.pulseWaves = createPulseWaves(state.scene);
  updateAtmosphere(state.scene, state.currentHour);
  updateTimeUI(state.currentHour);

  state.weatherBanner = createWeatherBanner();

  // Start the render loop right away so the scene is visible
  function animate() {
    requestAnimationFrame(animate);
    var elapsed = state.clock.getElapsedTime();
    updateControls(state.controls);
    if (state.particleSystem) updateParticles(state.particleSystem, elapsed);
    if (state.pulseWaves) updatePulseWaves(state.pulseWaves, elapsed);
    getRenderer().render(state.scene, state.camera);
  }
  animate();

  window.addEventListener('resize', function() { resizeScene(state.camera, renderer, container); });

  // Wire up UI controls (they work even with no data yet)
  setupScrubber(
    function(year) { state.currentYear = year; if (state.particleSystem) filterByYear(state.particleSystem, year); if (state.allData) updateStats(state.allData, year); },
    function(hour) { state.currentHour = hour; if (state.particleSystem) filterByHour(state.particleSystem, hour); var tod = updateAtmosphere(state.scene, hour); if (state.particleSystem) setTimeOfDay(state.particleSystem, tod); updateTimeUI(hour); }
  );
  setupWeatherFilters(function(weather, weatherId) { state.weatherFilter = weather; if (state.particleSystem) filterByWeather(state.particleSystem, weather === 'all' ? 0 : weatherId); if (state.weatherBanner) setWeatherBanner(state.weatherBanner, weather); });

  var btnRotate = document.getElementById('btn-rotate');
  if (btnRotate) btnRotate.addEventListener('click', function() { state.autoRotate = !state.autoRotate; state.controls.autoRotate = state.autoRotate; btnRotate.classList.toggle('active', state.autoRotate); });

  var btnPulse = document.getElementById('btn-pulse');
  if (btnPulse) { btnPulse.classList.add('active'); btnPulse.addEventListener('click', function() { state.pulseEnabled = !state.pulseEnabled; state.pulseWaves.enabled = state.pulseEnabled; btnPulse.classList.toggle('active', state.pulseEnabled); }); }

  var btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', function() { if (state.controls) state.controls.reset(); });

  // Mobile panel toggle
  var mobileToggle = document.getElementById('mobile-toggle');
  var sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    // Start collapsed on mobile
    if (window.innerWidth <= 768) sidebar.classList.add('collapsed');
    mobileToggle.addEventListener('click', function() {
      sidebar.classList.toggle('collapsed');
      mobileToggle.textContent = sidebar.classList.contains('collapsed') ? '\u2630 Panel' : '\u2715 Close';
    });
  }

  // Now fetch data with live status feedback
  setLoadingProgress(15);
  setLoadingText('CONNECTING TO DATA.GOUV.FR');
  setLoadingDetail('');

  await loadAccidentData(
    // onStatus: update loading overlay text
    function(info) {
      if (info.phase === 'cache') {
        setLoadingText('LOADING CACHED DATA');
        setLoadingDetail(info.message || '');
        setLoadingProgress(40);
      } else if (info.phase === 'api') {
        var yearPct = ((info.yearIndex || 0) / (info.totalYears || 1)) * 80;
        setLoadingProgress(15 + yearPct);
        if (info.yearPhase === 'downloading') {
          setLoadingText('DOWNLOADING ' + info.year + ' DATA');
          setLoadingDetail('Fetching data...');
        } else if (info.yearPhase === 'parsing') {
          setLoadingText('PROCESSING ' + info.year);
          setLoadingDetail('Parsing records...');
        } else if (info.yearPhase === 'done') {
          setLoadingText('LOADED ' + info.year);
          setLoadingDetail(formatNum(info.records) + ' records');
        }
      } else if (info.phase === 'done') {
        setLoadingText('READY');
        setLoadingDetail(formatNum(info.records) + ' total records');
        setLoadingProgress(95);
      }
    },
    // onYearData: progressively add data to the scene
    function(yearRecords) {
      state.allRawRecords.push.apply(state.allRawRecords, yearRecords);
      rebuildViz();
    }
  );

  // Final setup
  setupTooltip(state.camera, state.particleSystem, state.allData);
  setLoadingProgress(100);
  setTimeout(hideLoading, 300);
}

init().catch(function(err) { console.error('Init failed:', err); hideLoading(); });
