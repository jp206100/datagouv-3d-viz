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
      var label;
      if (hour < 0) {
        label = 'ALL';
      } else if (hour === 0) {
        label = '12AM';
      } else if (hour < 12) {
        label = hour + 'AM';
      } else if (hour === 12) {
        label = '12PM';
      } else {
        label = (hour - 12) + 'PM';
      }
      hourDisplay.textContent = label;
      onHourChange(hour);
    });
  }
}
