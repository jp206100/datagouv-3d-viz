var DATAGOUV_API = 'https://www.data.gouv.fr/api/1';
var MCP_ENDPOINT = 'https://mcp.data.gouv.fr/mcp';
var BAAC_DATASET_ID = '53698f4ca3a729239d2036df';

var SEVERITY_MAP = { '1': 'minor', '2': 'fatal', '3': 'hospitalized', '4': 'minor' };
var SEVERITY_PRIORITY = { fatal: 0, hospitalized: 1, minor: 2 };
var LIGHTING_MAP = { '1': 'day', '2': 'dusk', '3': 'night_unlit', '4': 'night_lit', '5': 'night_unlit' };
var WEATHER_MAP = { '1': 'normal', '2': 'rain', '3': 'rain_heavy', '4': 'snow', '5': 'fog', '6': 'wind', '7': 'glare', '8': 'overcast', '9': 'other' };

/* ── Dataset resource discovery ──────────────────────── */

var _resourcesCache = null;

export async function getDatasetResources(datasetId) {
  if (_resourcesCache) return _resourcesCache;
  var res = await fetch(DATAGOUV_API + '/datasets/' + datasetId + '/');
  if (!res.ok) throw new Error('Dataset fetch failed: ' + res.status);
  _resourcesCache = (await res.json()).resources || [];
  return _resourcesCache;
}

function findResource(resources, keywords, year) {
  if (typeof keywords === 'string') keywords = [keywords];
  var yearStr = String(year);
  var twoDigit = yearStr.slice(2);
  return resources.find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    var matchesKeyword = keywords.some(function(kw) { return name.includes(kw); });
    return matchesKeyword &&
      (name.includes(yearStr) || name.includes('-' + twoDigit + '.') || name.includes('_' + twoDigit + '.') || name.includes('-' + twoDigit + '-')) &&
      (name.endsWith('.csv') || r.format === 'csv');
  });
}

/* ── CSV parser (runs in browser) ────────────────────── */

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

/* ── Row parsing ─────────────────────────────────────── */

function parseYearField(raw, fallbackYear) {
  var n = parseInt(raw);
  if (isNaN(n)) return fallbackYear;
  if (n >= 2000) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return fallbackYear;
}

function parseCoord(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(',', '.'));
}

function parseRow(row, fallbackYear, severityOverride) {
  var lat = parseCoord(row.lat);
  var lng = parseCoord(row.long);
  if (!lat || !lng) return null;
  if (Math.abs(lat) > 90) lat = lat / 100000;
  if (Math.abs(lng) > 180) lng = lng / 100000;
  if (lat < 41 || lat > 52 || lng < -6 || lng > 10) return null;
  var lumCode = String(row.lum || '1').trim();
  var atmCode = String(row.atm || '1').trim();
  var severity = severityOverride || 'minor';
  if (!severityOverride && row.grav) {
    severity = SEVERITY_MAP[String(row.grav).trim()] || 'minor';
  }
  return {
    year: parseYearField(row.an || row.annee, fallbackYear),
    month: parseInt(row.mois || 1),
    hour: parseInt(String(row.hrmn || '0000').slice(0, 2)) || 0,
    lat: lat, lng: lng, severity: severity,
    department: row.dep || '',
    lighting: LIGHTING_MAP[lumCode] || 'day',
    weather: WEATHER_MAP[atmCode] || 'normal',
  };
}

function worstSeverity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (SEVERITY_PRIORITY[a] || 2) < (SEVERITY_PRIORITY[b] || 2) ? a : b;
}

/* ── Direct CSV download (replaces paginated tabular API) ── */

async function downloadCSV(resource) {
  var url = resource.url || resource.latest;
  var res = await fetch(url);
  if (!res.ok) throw new Error('CSV download failed: ' + res.status);
  return res.text();
}

/**
 * Fetch a single year by downloading CSV files directly.
 * Downloads carac + usagers in parallel — just 2 HTTP requests per year.
 */
export async function fetchAccidentDataForYear(year, onStatus) {
  if (!onStatus) onStatus = function(){};
  var resources = await getDatasetResources(BAAC_DATASET_ID);

  var caracResource = findResource(resources, ['caract', 'carcteristiques'], year);
  if (!caracResource) throw new Error('No data found for year ' + year);
  var usagersResource = findResource(resources, 'usager', year);

  // Download both CSVs in parallel
  onStatus({ year: year, phase: 'downloading' });
  var downloads = [downloadCSV(caracResource)];
  if (usagersResource) downloads.push(downloadCSV(usagersResource));
  var results = await Promise.all(downloads);

  // Parse CSVs
  onStatus({ year: year, phase: 'parsing' });
  var caracRows = parseCSV(results[0]);

  // Build severity map from usagers
  var severityByAcc = {};
  if (results[1]) {
    var usagersRows = parseCSV(results[1]);
    for (var u = 0; u < usagersRows.length; u++) {
      var accId = usagersRows[u].num_acc || usagersRows[u]['num_acc'] || '';
      var grav = SEVERITY_MAP[String(usagersRows[u].grav || '').trim()] || 'minor';
      severityByAcc[accId] = worstSeverity(severityByAcc[accId], grav);
    }
  }

  var parsed = caracRows.map(function(row) {
    var accId = row.num_acc || row['num_acc'] || '';
    return parseRow(row, year, severityByAcc[accId]);
  }).filter(Boolean);

  onStatus({ year: year, phase: 'done', records: parsed.length });
  return parsed;
}

/* ── Cached data loader ──────────────────────────────── */

export async function loadCachedAccidentData(onStatus) {
  if (!onStatus) onStatus = function(){};
  onStatus({ phase: 'cache', message: 'Loading cached data...' });
  var res = await fetch('/data/accidents.json');
  if (!res.ok) return null;
  onStatus({ phase: 'cache', message: 'Parsing JSON...' });
  var data = await res.json();
  onStatus({ phase: 'done', records: data.length });
  return data;
}

/* ── Main entry point ────────────────────────────────── */

/**
 * Load accident data with streaming callbacks.
 * onYearData(records) is called each time a year's data finishes,
 * allowing progressive rendering.
 */
export async function loadAccidentData(onStatus, onYearData) {
  if (!onStatus) onStatus = function(){};
  if (!onYearData) onYearData = function(){};

  // Try pre-fetched data first
  try {
    var cached = await loadCachedAccidentData(onStatus);
    if (cached && cached.length > 0) {
      console.log('Loaded ' + cached.length + ' cached accident records');
      onYearData(cached);
      onStatus({ phase: 'done', records: cached.length });
      return cached;
    }
  } catch (e) {
    console.log('No cached data, falling back to CSV download');
  }

  // Fall back to downloading CSVs directly (2 requests per year)
  console.log('Downloading accident CSVs from data.gouv.fr...');
  var allRecords = [];
  var yearsToFetch = [2024, 2023, 2022, 2021, 2020];
  for (var i = 0; i < yearsToFetch.length; i++) {
    var year = yearsToFetch[i];
    try {
      var yearData = await fetchAccidentDataForYear(year, function(info) {
        onStatus({
          phase: 'api',
          year: info.year,
          yearPhase: info.phase,
          yearIndex: i,
          totalYears: yearsToFetch.length,
          records: allRecords.length + (info.records || 0),
        });
      });
      allRecords.push.apply(allRecords, yearData);
      console.log('Fetched ' + yearData.length + ' records for ' + year);
      onYearData(yearData);
    } catch (err) {
      console.warn('Could not fetch year ' + year + ':', err.message);
    }
  }
  onStatus({ phase: 'done', records: allRecords.length });
  return allRecords;
}

/* ── MCP helpers ─────────────────────────────────────── */

export async function callMCP(method, params) {
  var res = await fetch(MCP_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: method, arguments: params } }),
  });
  if (!res.ok) throw new Error('MCP call failed: ' + res.status);
  var result = await res.json();
  if (result.error) throw new Error('MCP error: ' + result.error.message);
  return result.result;
}

export async function mcpSearchDatasets(query) { return callMCP('search_datasets', { query: query }); }
export async function mcpQueryData(resourceId, question) { return callMCP('query_resource_data', { resource_id: resourceId, question: question, page_size: 200 }); }
