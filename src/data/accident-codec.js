/**
 * Compact columnar binary format for BAAC accident records.
 *
 * The raw CSVs on data.gouv.fr total ~95 MB for 2020-2024, and the equivalent
 * JSON is ~27 MB. Packing the same records column-by-column into typed arrays
 * and gzipping the result gets it to a couple of megabytes, which is what makes
 * a cold page load viable.
 *
 * Layout:
 *   magic    "ACCD"      4 bytes
 *   version  uint16      2 bytes
 *   (pad)                2 bytes
 *   headerLen uint32     4 bytes
 *   header   JSON, UTF-8, padded to a 4-byte boundary
 *   columns  in the order listed by COLUMNS, back to back
 *
 * The header carries the record count plus the string dictionaries, so the
 * columns themselves only ever store small integers.
 */

export var MAGIC = 0x44434341; // "ACCD" little-endian
export var VERSION = 1;

var COLUMNS = [
  { key: 'lat', array: Int32Array, scale: 100000 },
  { key: 'lng', array: Int32Array, scale: 100000 },
  { key: 'year', array: Uint16Array },
  { key: 'month', array: Uint8Array },
  { key: 'hour', array: Uint8Array },
  { key: 'severity', array: Uint8Array, dict: 'severities' },
  { key: 'weather', array: Uint8Array, dict: 'weathers' },
  { key: 'lighting', array: Uint8Array, dict: 'lightings' },
  { key: 'department', array: Uint16Array, dict: 'departments' },
];

function align4(n) {
  return (n + 3) & ~3;
}

/* ── Encode ──────────────────────────────────────────── */

/**
 * Pack an array of accident records into an ArrayBuffer.
 * Returns { buffer, count, dicts }.
 */
export function encodeAccidents(records) {
  var count = records.length;

  // Build a string dictionary per dictionary-backed column.
  var dicts = {};
  var lookups = {};
  for (var c = 0; c < COLUMNS.length; c++) {
    var col = COLUMNS[c];
    if (!col.dict) continue;
    var values = [];
    var index = Object.create(null);
    for (var i = 0; i < count; i++) {
      var v = records[i][col.key];
      v = v === undefined || v === null ? '' : String(v);
      if (index[v] === undefined) {
        index[v] = values.length;
        values.push(v);
      }
    }
    dicts[col.dict] = values;
    lookups[col.key] = index;
  }

  var header = JSON.stringify({ count: count, dicts: dicts });
  var headerBytes = new TextEncoder().encode(header);
  var headerStart = 12;
  var paddedHeaderLen = align4(headerBytes.length);

  var offset = headerStart + paddedHeaderLen;
  var columnOffsets = [];
  for (var k = 0; k < COLUMNS.length; k++) {
    offset = align4(offset);
    columnOffsets.push(offset);
    offset += COLUMNS[k].array.BYTES_PER_ELEMENT * count;
  }

  var buffer = new ArrayBuffer(offset);
  var view = new DataView(buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint32(8, headerBytes.length, true);
  new Uint8Array(buffer, headerStart, headerBytes.length).set(headerBytes);

  for (var m = 0; m < COLUMNS.length; m++) {
    var column = COLUMNS[m];
    var typed = new column.array(buffer, columnOffsets[m], count);
    var lookup = column.dict ? lookups[column.key] : null;
    for (var r = 0; r < count; r++) {
      var raw = records[r][column.key];
      if (lookup) {
        typed[r] = lookup[raw === undefined || raw === null ? '' : String(raw)];
      } else if (column.scale) {
        typed[r] = Math.round((raw || 0) * column.scale);
      } else {
        typed[r] = raw || 0;
      }
    }
  }

  return { buffer: buffer, count: count, dicts: dicts };
}

/* ── Decode ──────────────────────────────────────────── */

/**
 * Unpack a buffer produced by encodeAccidents back into plain record objects,
 * matching the shape that processAccidentData expects.
 */
export function decodeAccidents(buffer) {
  var view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('Bad accident data magic');
  var version = view.getUint16(4, true);
  if (version !== VERSION) throw new Error('Unsupported accident data version: ' + version);

  var headerLen = view.getUint32(8, true);
  var headerStart = 12;
  var header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, headerStart, headerLen)));
  var count = header.count;
  var dicts = header.dicts || {};

  var offset = headerStart + align4(headerLen);
  var columns = {};
  for (var c = 0; c < COLUMNS.length; c++) {
    var col = COLUMNS[c];
    offset = align4(offset);
    columns[col.key] = new col.array(buffer, offset, count);
    offset += col.array.BYTES_PER_ELEMENT * count;
  }

  var records = new Array(count);
  for (var i = 0; i < count; i++) {
    var record = {};
    for (var k = 0; k < COLUMNS.length; k++) {
      var column = COLUMNS[k];
      var value = columns[column.key][i];
      if (column.dict) {
        record[column.key] = dicts[column.dict][value];
      } else if (column.scale) {
        record[column.key] = value / column.scale;
      } else {
        record[column.key] = value;
      }
    }
    records[i] = record;
  }
  return records;
}
