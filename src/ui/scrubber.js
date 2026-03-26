export function setupScrubber(onYearChange, onHourChange) {
  var yearSlider = document.getElementById('year-slider');
  var yearDisplay = document.getElementById('scrubber-year');
  if (yearSlider && yearDisplay) {
    function snapYear() {
      var year = Math.round(parseFloat(yearSlider.value));
      yearSlider.value = year;
      yearDisplay.textContent = year;
      onYearChange(year);
    }
    yearSlider.addEventListener('input', snapYear);
    yearSlider.addEventListener('change', snapYear);
  }
  var hourSlider = document.getElementById('hour-slider');
  var hourDisplay = document.getElementById('hour-label');
  if (hourSlider && hourDisplay) {
    hourSlider.addEventListener('input', function() {
      var hour = parseInt(hourSlider.value);
      hourDisplay.textContent = hour < 0 ? 'ALL' : String(hour).padStart(2, '0') + 'h';
      onHourChange(hour);
    });
  }
}
