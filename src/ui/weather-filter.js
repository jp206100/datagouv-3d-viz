var WEATHER_ID_MAP = { all: 0, normal: 0, rain: 1, fog: 2, snow: 3, night: -1 };

export function setupWeatherFilters(onChange) {
  var container = document.getElementById('weather-filters');
  if (!container) return;
  container.addEventListener('click', function(e) {
    var btn = e.target.closest('.weather-chip');
    if (!btn) return;
    var weather = btn.getAttribute('data-weather');
    var chips = container.querySelectorAll('.weather-chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
    btn.classList.add('active');
    var id = WEATHER_ID_MAP[weather];
    onChange(weather, id !== undefined ? id : 0);
  });
}
