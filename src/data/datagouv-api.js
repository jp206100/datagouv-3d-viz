var DATAGOUV_API = 'https://www.data.gouv.fr/api/1';
var TABULAR_API = 'https://tabular-api.data.gouv.fr/api';
var MCP_ENDPOINT = 'https://mcp.data.gouv.fr/mcp';
var BAAC_DATASET_ID = '53698f4ca3a729239d2036df';

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

function parseRow(row, fallbackYear) {
  var lat = parseFloat(row.lat || 0);
  var lng = parseFloat(row.long || 0);
  if (!lat || !lng) return null;
  if (Math.abs(lat) > 90) lat = lat / 100000;
  if (Math.abs(lng) > 180) lng = lng / 100000;
  if (lat < 41 || lat > 52 || lng < -6 || lng > 10) return null;
  var lumCode = String(row.lum || '1').trim();
  var atmCode = String(row.atm || '1').trim();
  return {
    year: parseYearField(row.an || row.annee, fallbackYear),
    month: parseInt(row.mois || 1),
    hour: parseInt(String(row.hrmn || '0000').slice(0, 2)) || 0,
    lat: lat, lng: lng, severity: 'minor',
    department: row.dep || '',
    lighting: LIGHTING_MAP[lumCode] || 'day',
    weather: WEATHER_MAP[atmCode] || 'normal',
  };
}

export async function fetchAccidentDataForYear(year, onProgress) {
  if (!onProgress) onProgress = function(){};
  var resources = await getDatasetResources(BAAC_DATASET_ID);
  var caracResource = resources.find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    return (name.includes('caract') || name.includes('caracteristiques')) && name.includes(String(year)) && (name.endsWith('.csv') || r.format === 'csv');
  });
  if (!caracResource) throw new Error('No data found for year ' + year);
  var allRows = [];
  var page = 1, hasMore = true;
  while (hasMore && page <= 50) {
    var result = await queryResource(caracResource.id, { page: page, pageSize: 200 });
    var rows = result.data || [];
    allRows.push.apply(allRows, rows);
    hasMore = rows.length === 200;
    page++;
    onProgress(Math.min(page, 50) / 50);
  }
  return allRows.map(function(row) { return parseRow(row, year); }).filter(Boolean);
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
