/**
 * Fetch France administrative boundary GeoJSON from data.gouv.fr.
 * Saves a simplified outline to public/data/france-outline.json.
 *
 * Usage: node scripts/fetch-france-geo.js
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

var __dirname = dirname(fileURLToPath(import.meta.url));
var OUTPUT_DIR = join(__dirname, '..', 'public', 'data');

// Simplified France metropolitan border (admin boundary from Natural Earth)
var GEO_URL = 'https://www.data.gouv.fr/api/1/datasets/contours-des-regions-francaises-sur-openstreetmap/';

async function main() {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Fetching France administrative boundaries dataset...');
  var res = await fetch(GEO_URL);
  if (!res.ok) throw new Error('Failed to fetch dataset: ' + res.status);
  var dataset = await res.json();

  // Find GeoJSON resource
  var geoResource = (dataset.resources || []).find(function(r) {
    var name = (r.title || r.url || '').toLowerCase();
    return name.includes('geojson') || name.endsWith('.geojson') || r.format === 'geojson';
  });

  if (!geoResource) {
    console.log('No GeoJSON resource found. Available resources:');
    (dataset.resources || []).forEach(function(r) { console.log('  - ' + r.title + ' (' + r.format + ')'); });
    return;
  }

  console.log('Downloading: ' + geoResource.title);
  var geoRes = await fetch(geoResource.url);
  if (!geoRes.ok) throw new Error('Download failed: ' + geoRes.status);
  var geojson = await geoRes.json();

  var outPath = join(OUTPUT_DIR, 'france-outline.json');
  writeFileSync(outPath, JSON.stringify(geojson));
  console.log('Saved ' + outPath);
}

main().catch(function(err) {
  console.error('Fetch failed:', err);
  process.exit(1);
});
