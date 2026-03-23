import * as THREE from 'three';
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
raycaster.params.Points.threshold = 0.5;
var WEATHER_LABELS = { normal: 'Clear', rain: 'Rain', rain_heavy: 'Heavy rain', fog: 'Fog', snow: 'Snow/Hail', wind: 'Strong wind', overcast: 'Overcast', glare: 'Glare', other: '' };
var LIGHTING_LABELS = { day: 'Daylight', dusk: 'Dusk/Dawn', night_lit: 'Night (lit)', night_unlit: 'Night (dark)' };

export function setupTooltip(camera, particleSystem, processedData) {
  var tooltip = document.getElementById('tooltip');
  var container = document.getElementById('canvas-container');
  if (!tooltip || !container || !particleSystem) return;
  container.addEventListener('pointermove', function(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObject(particleSystem);
    if (intersects.length > 0) {
      var record = processedData.records[intersects[0].index];
      if (record) {
        var sevLabels = { fatal: 'Fatal', hospitalized: 'Hospitalized', minor: 'Minor injury' };
        var weatherStr = WEATHER_LABELS[record.weather] || '';
        var lightStr = LIGHTING_LABELS[record.lighting] || '';
        var conditions = [weatherStr, lightStr].filter(Boolean).join(' / ');
        tooltip.innerHTML = '<strong>' + (sevLabels[record.severity] || record.severity) + '</strong><br>' +
          record.lat.toFixed(4) + ' N, ' + record.lng.toFixed(4) + ' E<br>' +
          '<span style="color:var(--text-secondary)">' + conditions + '</span><br>' +
          '<span style="color:var(--text-muted)">Month ' + record.month + ' at ' + String(record.hour).padStart(2,'0') + ':00</span>';
        tooltip.style.left = (e.clientX + 16) + 'px';
        tooltip.style.top = (e.clientY - 16) + 'px';
        tooltip.classList.add('visible');
      }
    } else { tooltip.classList.remove('visible'); }
  });
  container.addEventListener('pointerleave', function() { tooltip.classList.remove('visible'); });
}
