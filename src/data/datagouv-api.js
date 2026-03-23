var DATAGOUV_API = 'https://www.data.gouv.fr/api/1';
var TABULAR_API = 'https://tabular-api.data.gouv.fr/api';
var MCP_ENDPOINT = 'https://mcp.data.gouv.fr/mcp';
var BAAC_DATASET_ID = '53698f4ca3a729239d2036df';

var SEVERITY_MAP = { '1': 'minor', '2': 'fatal', '3': 'hospitalized', '4': 'minor' };
var SEVERITY_PRIORITY = { fatal: 0, hospitalized: 1, minor: 2 };
var LIGHTING_MAP = { '1': 'day', '2': 'dusk', '3': 'night_unlit', '4': 'night_lit', '5': 'night_unlit' };
var WEATHER_MAP = { '1': 'normal', '2': 'rain', '3': 'rain_heavy', '4': 'snow', '5': 'fog', '6': 'wind', '7': 'glare', '8': 'overcast', '9': 'other' };

export async function getDatasetResources(datasetId) {
  var res = await fetch(DATAGOUV_API + '/datasets/' + datasetId + '/');
  if (!res.ok) throw new Error('Dataset fetch failed: ' + res.status);
  return (await res.json()).resources || [];
}

export async function queryResource(resourceId, opts) {
  var page = (opts && opts.page) || 1;
  var pageSize = (opts && opts.pageSize) || 100;
  var res = await fetch(TABULAR_API + '/resources/' + resourceId + '/data/?page=' + page + '&page_size=' + pageSize);
  if (!res.ok) throw new Error('Tabular query failed: ' + res.status);
  return res.json();
}

function parseYearField(raw, fallbackYear) {
  var n = parseInt(raw);
  if (isNaN(n)) return fallbackYear;
  if (n >= 2000) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return fallbackYear;
}

function parseRow(row, fallbackYear, severityOverride) {
  var lat = parseFloat(row.lat || 0);
  var lng = parseFloat(row.long || 0);
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

function findResource(resources, keyword, year) {
  var yearStr = String(year);
  var twoDigit = yearStr.slice(2);
  return resources.find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    return (name.includes(keyword)) &&
      (name.includes(yearStr) || name.includes('-' + twoDigit + '.') || name.includes('_' + twoDigit + '.')) &&
      (name.endsWith('.csv') || r.format === 'csv');
  });
}

function worstSeverity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (SEVERITY_PRIORITY[a] || 2) < (SEVERITY_PRIORITY[b] || 2) ? a : b;
}

export async function fetchAccidentDataForYear(year, onProgress) {
  if (!onProgress) onProgress = function(){};
  var resources = await getDatasetResources(BAAC_DATASET_ID);

  // Find caracteristiques resource
  var caracResource = findResource(resources, 'caract', year);
  if (!caracResource) throw new Error('No data found for year ' + year);

  // Fetch caracteristiques via tabular API
  var allCaracRows = [];
  var page = 1, hasMore = true;
  while (hasMore && page <= 100) {
    var result = await queryResource(caracResource.id, { page: page, pageSize: 200 });
    var rows = result.data || [];
    allCaracRows.push.apply(allCaracRows, rows);
    hasMore = rows.length === 200;
    page++;
    onProgress(Math.min(page, 100) / 200); // first half of progress
  }

  // Try to fetch usagers for severity data
  var severityByAcc = {};
  var usagersResource = findResource(resources, 'usager', year);
  if (usagersResource) {
    var uPage = 1, uHasMore = true;
    while (uHasMore && uPage <= 100) {
      var uResult = await queryResource(usagersResource.id, { page: uPage, pageSize: 200 });
      var uRows = uResult.data || [];
      for (var u = 0; u < uRows.length; u++) {
        var accId = uRows[u].num_acc || uRows[u].Num_Acc || '';
        var grav = SEVERITY_MAP[String(uRows[u].grav || '').trim()] || 'minor';
        severityByAcc[accId] = worstSeverity(severityByAcc[accId], grav);
      }
      uHasMore = uRows.length === 200;
      uPage++;
      onProgress(0.5 + Math.min(uPage, 100) / 200); // second half of progress
    }
  }

  return allCaracRows.map(function(row) {
    var accId = row.num_acc || row.Num_Acc || '';
    return parseRow(row, year, severityByAcc[accId]);
  }).filter(Boolean);
}

/**
 * Load pre-fetched accident data from /data/accidents.json.
 * Run `npm run fetch-data` to generate this file.
 */
export async function loadCachedAccidentData(onProgress) {
  if (!onProgress) onProgress = function(){};
  onProgress(0.1);
  var res = await fetch('/data/accidents.json');
  if (!res.ok) return null;
  onProgress(0.5);
  var data = await res.json();
  onProgress(1.0);
  return data;
}

/**
 * Load accident data: try cached JSON first, then fall back to API.
 * For full data, run `npm run fetch-data` first.
 */
export async function loadAccidentData(onProgress) {
  if (!onProgress) onProgress = function(){};

  // Try pre-fetched data first
  try {
    var cached = await loadCachedAccidentData(function(p) { onProgress(p * 0.9); });
    if (cached && cached.length > 0) {
      console.log('Loaded ' + cached.length + ' cached accident records');
      onProgress(1.0);
      return cached;
    }
  } catch (e) {
    console.log('No cached data, falling back to API fetch');
  }

  // Fall back to fetching recent years via API (limited by pagination)
  console.log('Fetching accident data from API (limited subset)...');
  var allRecords = [];
  var yearsToFetch = [2022, 2023];
  for (var i = 0; i < yearsToFetch.length; i++) {
    var year = yearsToFetch[i];
    try {
      var yearData = await fetchAccidentDataForYear(year, function(p) {
        onProgress((i + p) / yearsToFetch.length * 0.9);
      });
      allRecords.push.apply(allRecords, yearData);
      console.log('Fetched ' + yearData.length + ' records for ' + year);
    } catch (err) {
      console.warn('Could not fetch year ' + year + ':', err.message);
    }
  }
  onProgress(1.0);
  return allRecords;
}

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
