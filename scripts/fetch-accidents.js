/**
 * Fetch BAAC accident data from data.gouv.fr and save as JSON.
 *
 * Downloads "caracteristiques" (location/time/conditions) and "usagers"
 * (severity per person) CSVs for each year, joins them by accident number,
 * and writes a combined JSON file to public/data/.
 *
 * Usage:
 *   node scripts/fetch-accidents.js                 # fetch all years (2005-2023)
 *   node scripts/fetch-accidents.js 2022 2023       # fetch specific years
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var OUTPUT_DIR = join(__dirname, '..', 'public', 'data');

var DATAGOUV_API = 'https://www.data.gouv.fr/api/1';
var BAAC_DATASET_ID = '53698f4ca3a729239d2036df';

var SEVERITY_MAP = { '1': 'uninjured', '2': 'fatal', '3': 'hospitalized', '4': 'minor' };
var SEVERITY_PRIORITY = { fatal: 0, hospitalized: 1, minor: 2, uninjured: 3 };
var LIGHTING_MAP = { '1': 'day', '2': 'dusk', '3': 'night_unlit', '4': 'night_lit', '5': 'night_unlit' };
var WEATHER_MAP = { '1': 'normal', '2': 'rain', '3': 'rain_heavy', '4': 'snow', '5': 'fog', '6': 'wind', '7': 'glare', '8': 'overcast', '9': 'other' };

var DEFAULT_YEARS = [];
for (var y = 2005; y <= 2023; y++) DEFAULT_YEARS.push(y);

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

function worstSeverity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (SEVERITY_PRIORITY[a] || 3) < (SEVERITY_PRIORITY[b] || 3) ? a : b;
}

async function fetchWithRetry(url, retries) {
  if (retries === undefined) retries = 3;
  for (var attempt = 0; attempt <= retries; attempt++) {
    try {
      var res = await fetch(url);
      if (res.ok) return res;
      if (attempt < retries) {
        console.log('  Retry ' + (attempt + 1) + ' for ' + url.slice(0, 80) + '...');
        await new Promise(function(r) { setTimeout(r, 1000 * Math.pow(2, attempt)); });
      }
    } catch (err) {
      if (attempt === retries) throw err;
      console.log('  Network error, retry ' + (attempt + 1) + '...');
      await new Promise(function(r) { setTimeout(r, 1000 * Math.pow(2, attempt)); });
    }
  }
  throw new Error('Failed to fetch after retries: ' + url);
}

async function fetchDatasetResources() {
  console.log('Fetching BAAC dataset metadata...');
  var res = await fetchWithRetry(DATAGOUV_API + '/datasets/' + BAAC_DATASET_ID + '/');
  var data = await res.json();
  return data.resources || [];
}

function findResource(resources, keyword, year) {
  var yearStr = String(year);
  var twoDigit = yearStr.slice(2);
  return resources.find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    var matchesKeyword = name.includes(keyword);
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

  var caracRes = findResource(resources, 'caract', year);
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
    var lat = parseFloat(row.lat || 0);
    var lng = parseFloat(row.long || 0);
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

  // Save combined file
  var outPath = join(OUTPUT_DIR, 'accidents.json');
  writeFileSync(outPath, JSON.stringify(allRecords));
  var sizeMB = (Buffer.byteLength(JSON.stringify(allRecords)) / 1024 / 1024).toFixed(1);
  console.log('Saved ' + outPath + ' (' + sizeMB + ' MB)');

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
