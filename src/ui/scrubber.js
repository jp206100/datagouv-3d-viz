export function setupScrubber(onYearChange, onHourChange) {
  var yearSlider = document.getElementById('year-slider');
  var yearDisplay = document.getElementById('scrubber-year');
  if (yearSlider && yearDisplay) {
    yearSlider.addEventListener('input', function() {
      var year = parseInt(yearSlider.value);
      yearDisplay.textContent = year;
      onYearChange(year);
    });
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
