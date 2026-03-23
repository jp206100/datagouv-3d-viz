import { latLngToScene } from '../utils/geo.js';

var WEATHER_COLORS = {
  normal: null, rain: [0.357, 0.608, 0.835], rain_heavy: [0.255, 0.459, 0.729],
  fog: [0.620, 0.553, 0.780], snow: [0.700, 0.830, 0.950],
  wind: [0.600, 0.700, 0.600], overcast: null, glare: null, other: null,
};

export function processAccidentData(rawData) {
  if (!rawData || rawData.length === 0) return { records: [], positions: [], colors: [], sizes: [], years: [], hours: [], weatherIds: [], lightingIds: [], yearStats: {}, yearRange: { min: 2005, max: 2024 } };
  var records = [], positions = [], colors = [], sizes = [], years = [], opacities = [];
  var hours = [], weatherIds = [], lightingIds = [];
  var severityConfig = {
    fatal: { color: [1.0, 0.231, 0.188], size: 0.35, height: 2.0 },
    hospitalized: { color: [1.0, 0.584, 0.0], size: 0.22, height: 1.0 },
    minor: { color: [0.188, 0.820, 0.345], size: 0.12, height: 0.3 },
  };
  var weatherIdMap = { normal: 0, rain: 1, rain_heavy: 1, fog: 2, snow: 3, wind: 4, overcast: 0, glare: 0, other: 0 };
  var lightingIdMap = { day: 0, dusk: 1, night_lit: 2, night_unlit: 3 };

  for (var i = 0; i < rawData.length; i++) {
    var record = rawData[i];
    var config = severityConfig[record.severity] || severityConfig.minor;
    var pos = latLngToScene(record.lat, record.lng);
    pos.y = config.height + (Math.random() - 0.5) * 0.3;
    var weatherColor = WEATHER_COLORS[record.weather];
    var baseColor = config.color;
    var finalColor = weatherColor ? [baseColor[0]*0.5+weatherColor[0]*0.5, baseColor[1]*0.5+weatherColor[1]*0.5, baseColor[2]*0.5+weatherColor[2]*0.5] : baseColor;
    positions.push(pos.x, pos.y, pos.z);
    colors.push(finalColor[0], finalColor[1], finalColor[2]);
    sizes.push(record.weather === 'fog' ? config.size * 1.8 : (record.weather === 'rain' || record.weather === 'rain_heavy') ? config.size * 1.2 : config.size);
    years.push(record.year || 2024);
    hours.push(record.hour || 0);
    weatherIds.push(weatherIdMap[record.weather] || 0);
    lightingIds.push(lightingIdMap[record.lighting] || 0);
    opacities.push(1.0);
    records.push(Object.assign({}, record, { sceneX: pos.x, sceneY: pos.y, sceneZ: pos.z }));
  }
  var yearStats = {};
  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    if (!yearStats[r.year]) yearStats[r.year] = { total: 0, fatal: 0, hospitalized: 0, minor: 0, badWeather: 0 };
    yearStats[r.year].total++;
    yearStats[r.year][r.severity]++;
    if (r.weather !== 'normal' && r.weather !== 'overcast' && r.weather !== 'glare' && r.weather !== 'other') yearStats[r.year].badWeather++;
  }
  return {
    records: records, positions: new Float32Array(positions), colors: new Float32Array(colors),
    sizes: new Float32Array(sizes), years: new Float32Array(years), opacities: new Float32Array(opacities),
    hours: new Float32Array(hours), weatherIds: new Float32Array(weatherIds), lightingIds: new Float32Array(lightingIds),
    yearStats: yearStats, yearRange: { min: Math.min.apply(null, Object.keys(yearStats).map(Number)), max: Math.max.apply(null, Object.keys(yearStats).map(Number)) },
  };
}

export function getYearStats(data, year) {
  return data.yearStats[year] || { total: 0, fatal: 0, hospitalized: 0, minor: 0, badWeather: 0 };
}
