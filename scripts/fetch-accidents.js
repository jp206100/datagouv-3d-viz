/**
 * Fetch BAAC accident data from data.gouv.fr and save as a packed binary file.
 *
 * Downloads "caracteristiques" (location/time/conditions) and "usagers"
 * (severity per person) CSVs for each year, joins them by accident number,
 * and writes public/data/accidents.bin.gz — the file the app loads at runtime
 * instead of pulling ~95 MB of CSV into the browser.
 *
 * Usage:
 *   node scripts/fetch-accidents.js                 # fetch all years (2020-2024)
 *   node scripts/fetch-accidents.js 2022 2023       # fetch specific years
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { gzipSync, constants as zlibConstants } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { encodeAccidents } from '../src/data/accident-codec.js';

var __dirname = dirname(fileURLToPath(import.meta.url));
var OUTPUT_DIR = join(__dirname, '..', 'public', 'data');

var DATAGOUV_API = 'https://www.data.gouv.fr/api/1';
var BAAC_DATASET_ID = '53698f4ca3a729239d2036df';

var SEVERITY_MAP = { '1': 'uninjured', '2': 'fatal', '3': 'hospitalized', '4': 'minor' };
var SEVERITY_PRIORITY = { fatal: 0, hospitalized: 1, minor: 2, uninjured: 3 };
var LIGHTING_MAP = { '1': 'day', '2': 'dusk', '3': 'night_unlit', '4': 'night_lit', '5': 'night_unlit' };
var WEATHER_MAP = { '1': 'normal', '2': 'rain', '3': 'rain_heavy', '4': 'snow', '5': 'fog', '6': 'wind', '7': 'glare', '8': 'overcast', '9': 'other' };

var DEFAULT_YEARS = [];
for (var y = 2020; y <= 2024; y++) DEFAULT_YEARS.push(y);

function parseCSV(text) {
  var lines = text.split('\n');
  if (lines.length < 2) return [];
  var delimiter = lines[0].includes(';') ? ';' : ',';
  var headers = lines[0].split(delimiter).map(function(h) {
    return h.trim().replace(/^["'\uFEFF]+|["']+$/g, '').toLowerCase();
  });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var values = line.split(delimiter).map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

function getAccidentId(row) {
  return row.num_acc || row['num_acc'] || '';
}

function parseYearField(raw, fallback) {
  var n = parseInt(raw);
  if (isNaN(n)) return fallback;
  if (n >= 2000) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return fallback;
}

// BAAC CSVs are semicolon-delimited with comma decimal separators, so "48,12345"
// has to be normalised before parseFloat, which would otherwise yield 48.
function parseCoord(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(',', '.'));
}

function worstSeverity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (SEVERITY_PRIORITY[a] || 3) < (SEVERITY_PRIORITY[b] || 3) ? a : b;
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

// data.gouv.fr returns intermittent 503s, especially right after a bulk download,
// and they can persist for a minute or two — hence the long, jittered backoff.
async function fetchWithRetry(url, retries) {
  if (retries === undefined) retries = 6;
  var lastReason = '';
  for (var attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      var backoff = Math.min(60000, 2000 * Math.pow(2, attempt - 1));
      var wait = Math.round(backoff * (0.75 + Math.random() * 0.5));
      console.log('  ' + lastReason + ' — retry ' + attempt + '/' + retries + ' in ' + Math.round(wait / 1000) + 's');
      await sleep(wait);
    }
    try {
      var res = await fetch(url);
      if (res.ok) return res;
      lastReason = 'HTTP ' + res.status;
    } catch (err) {
      lastReason = 'Network error (' + (err.cause && err.cause.code || err.message) + ')';
    }
  }
  throw new Error('Failed to fetch after ' + retries + ' retries (' + lastReason + '): ' + url);
}

async function fetchDatasetResources() {
  console.log('Fetching BAAC dataset metadata...');
  var res = await fetchWithRetry(DATAGOUV_API + '/datasets/' + BAAC_DATASET_ID + '/');
  var data = await res.json();
  return data.resources || [];
}

function findResource(resources, keywords, year) {
  if (typeof keywords === 'string') keywords = [keywords];
  var yearStr = String(year);
  var twoDigit = yearStr.slice(2);
  return resources.find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    var matchesKeyword = keywords.some(function(kw) { return name.includes(kw); });
    var matchesYear = name.includes(yearStr) || name.includes('-' + twoDigit + '.') || name.includes('_' + twoDigit + '.') || name.includes('-' + twoDigit + '-');
    var isCSV = name.endsWith('.csv') || r.format === 'csv';
    return matchesKeyword && matchesYear && isCSV;
  });
}

async function downloadCSV(resource) {
  var url = resource.url || resource.latest;
  console.log('  Downloading: ' + (resource.title || url).slice(0, 60) + '...');
  var res = await fetchWithRetry(url);
  return res.text();
}

async function fetchYearData(resources, year) {
  console.log('\n--- Year ' + year + ' ---');

  // 2021/2022 ship as "carcteristiques" — a typo upstream, not one here.
  var caracRes = findResource(resources, ['caract', 'carcteristiques'], year);
  if (!caracRes) {
    console.log('  WARNING: No caracteristiques file found for ' + year + ', skipping');
    return [];
  }

  var caracText = await downloadCSV(caracRes);
  var caracRows = parseCSV(caracText);
  console.log('  Parsed ' + caracRows.length + ' accident records');

  // Build severity map from usagers file
  var severityByAcc = {};
  var usagersRes = findResource(resources, 'usager', year);
  if (usagersRes) {
    var usagersText = await downloadCSV(usagersRes);
    var usagersRows = parseCSV(usagersText);
    console.log('  Parsed ' + usagersRows.length + ' usagers records');
    for (var u = 0; u < usagersRows.length; u++) {
      var accId = getAccidentId(usagersRows[u]);
      var grav = SEVERITY_MAP[String(usagersRows[u].grav || '').trim()] || 'minor';
      if (grav === 'uninjured') grav = 'minor';
      severityByAcc[accId] = worstSeverity(severityByAcc[accId], grav);
    }
    console.log('  Severity map: ' + Object.keys(severityByAcc).length + ' accidents');
  } else {
    console.log('  WARNING: No usagers file found for ' + year + ', defaulting severity to minor');
  }

  var records = [];
  for (var i = 0; i < caracRows.length; i++) {
    var row = caracRows[i];
    var lat = parseCoord(row.lat);
    var lng = parseCoord(row.long);
    if (!lat || !lng) continue;

    // Handle coordinates that may be stored as integers (multiply by 1e-5)
    if (Math.abs(lat) > 90) lat = lat / 100000;
    if (Math.abs(lng) > 180) lng = lng / 100000;

    // Filter to metropolitan France bounds
    if (lat < 41 || lat > 52 || lng < -6 || lng > 10) continue;

    var accId = getAccidentId(row);
    var lumCode = String(row.lum || '1').trim();
    var atmCode = String(row.atm || '1').trim();

    records.push({
      year: parseYearField(row.an || row.annee, year),
      month: parseInt(row.mois || 1),
      hour: parseInt(String(row.hrmn || '0000').slice(0, 2)) || 0,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      severity: severityByAcc[accId] || 'minor',
      department: row.dep || '',
      lighting: LIGHTING_MAP[lumCode] || 'day',
      weather: WEATHER_MAP[atmCode] || 'normal',
    });
  }
  console.log('  Valid geocoded records: ' + records.length);
  return records;
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  var args = process.argv.slice(2);
  var years = args.length > 0 ? args.map(Number).filter(function(n) { return !isNaN(n); }) : DEFAULT_YEARS;

  console.log('Fetching BAAC data for years: ' + years.join(', '));

  var resources = await fetchDatasetResources();
  console.log('Found ' + resources.length + ' resources in dataset');

  var allRecords = [];
  for (var i = 0; i < years.length; i++) {
    var yearRecords = await fetchYearData(resources, years[i]);
    allRecords.push.apply(allRecords, yearRecords);
  }

  console.log('\n=== Total records: ' + allRecords.length + ' ===');

  if (allRecords.length === 0) throw new Error('No records fetched — refusing to write an empty data file');

  // Pack columnar + gzip. This is what the browser downloads.
  var packed = encodeAccidents(allRecords);
  var gzipped = gzipSync(Buffer.from(packed.buffer), { level: zlibConstants.Z_BEST_COMPRESSION });

  var outPath = join(OUTPUT_DIR, 'accidents.bin.gz');
  writeFileSync(outPath, gzipped);

  var rawMB = (packed.buffer.byteLength / 1024 / 1024).toFixed(1);
  var gzMB = (gzipped.length / 1024 / 1024).toFixed(2);
  var jsonMB = (Buffer.byteLength(JSON.stringify(allRecords)) / 1024 / 1024).toFixed(1);
  console.log('Saved ' + outPath + ' (' + gzMB + ' MB gzipped, ' + rawMB + ' MB packed, ' + jsonMB + ' MB as JSON)');

  // Print summary stats
  var bySeverity = { fatal: 0, hospitalized: 0, minor: 0 };
  for (var j = 0; j < allRecords.length; j++) {
    bySeverity[allRecords[j].severity] = (bySeverity[allRecords[j].severity] || 0) + 1;
  }
  console.log('Severity breakdown: fatal=' + bySeverity.fatal + ', hospitalized=' + bySeverity.hospitalized + ', minor=' + bySeverity.minor);
}

main().catch(function(err) {
  console.error('Fetch failed:', err);
  process.exit(1);
});
