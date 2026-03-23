import { getYearStats } from '../data/accident-data.js';
export function updateStats(processedData, year) {
  var stats = getYearStats(processedData, year);
  var fmt = function(n) { return n === 0 ? '\u2014' : n.toLocaleString('fr-FR'); };
  var el = function(id) { return document.getElementById(id); };
  if (el('stat-total')) el('stat-total').textContent = fmt(stats.total);
  if (el('stat-fatal')) el('stat-fatal').textContent = fmt(stats.fatal);
  if (el('stat-hospitalized')) el('stat-hospitalized').textContent = fmt(stats.hospitalized);
  if (el('stat-weather')) el('stat-weather').textContent = fmt(stats.badWeather);
}
