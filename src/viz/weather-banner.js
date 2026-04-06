/* ── Weather Banner: Canvas 2D transparent overlay ──── */

var BANNER_HEIGHT = 120;
var currentWeather = 'none';
var targetOpacity = 0;
var currentOpacity = 0;
var particles = [];
var canvas, ctx, W, H, dpr, animId;
var t = 0;

/* ── Setup ──────────────────────────────────────────── */

function resize() {
  var header = document.querySelector('.header');
  var headerH = header ? header.offsetHeight : 95;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = headerH + BANNER_HEIGHT;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.top = '0px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function initParticles() {
  particles = [];
  if (currentWeather === 'rain') {
    for (var i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * W * 1.2 - W * 0.1,
        y: Math.random() * H,
        len: 10 + Math.random() * 25,
        speed: 5 + Math.random() * 8,
        thickness: 0.4 + Math.random() * 1.2,
        opacity: 0.1 + Math.random() * 0.35,
        drift: -0.3 - Math.random() * 1.2,
      });
    }
  } else if (currentWeather === 'snow') {
    for (var i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 3.5,
        speed: 0.25 + Math.random() * 0.9,
        wobbleSpeed: 0.4 + Math.random() * 1.5,
        wobbleAmp: 0.3 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.12 + Math.random() * 0.45,
        blur: Math.random() > 0.5,
      });
    }
  } else if (currentWeather === 'fog') {
    for (var i = 0; i < 14; i++) {
      particles.push({
        x: Math.random() * W * 2 - W * 0.5,
        y: 5 + Math.random() * (H - 10),
        w: 200 + Math.random() * 500,
        h: 25 + Math.random() * 50,
        speed: 0.1 + Math.random() * 0.3,
        opacity: 0.025 + Math.random() * 0.07,
        phase: Math.random() * Math.PI * 2,
        vertSpeed: 0.06 + Math.random() * 0.18,
      });
    }
  } else if (currentWeather === 'normal') {
    // God rays
    for (var i = 0; i < 8; i++) {
      particles.push({
        type: 'ray',
        angle: -0.55 + i * 0.16,
        width: 18 + Math.random() * 35,
        opacity: 0.02 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
        shimmerSpeed: 0.3 + Math.random() * 0.8,
      });
    }
    // Dust motes
    for (var i = 0; i < 30; i++) {
      particles.push({
        type: 'mote',
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 2,
        speedX: 0.06 + Math.random() * 0.2,
        speedY: -0.02 - Math.random() * 0.1,
        opacity: 0.12 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }
  }
}

/* ── Draw: Rain ─────────────────────────────────────── */

function drawRain() {
  var glow = ctx.createLinearGradient(0, 0, 0, H);
  glow.addColorStop(0, 'rgba(40, 80, 140, 0.05)');
  glow.addColorStop(1, 'rgba(40, 80, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (var i = 0; i < particles.length; i++) {
    var d = particles[i];
    d.y += d.speed;
    d.x += d.drift;
    if (d.y > H + d.len) { d.y = -d.len - Math.random() * 20; d.x = Math.random() * W * 1.2 - W * 0.1; }
    if (d.x < -30) d.x = W + 30;

    var grad = ctx.createLinearGradient(d.x, d.y - d.len, d.x + d.drift * 2.5, d.y);
    grad.addColorStop(0, 'rgba(120, 175, 235, 0)');
    grad.addColorStop(0.4, 'rgba(150, 195, 255, ' + (d.opacity * currentOpacity * 0.4) + ')');
    grad.addColorStop(1, 'rgba(190, 215, 255, ' + (d.opacity * currentOpacity) + ')');

    ctx.beginPath();
    ctx.moveTo(d.x, d.y - d.len);
    ctx.lineTo(d.x + d.drift * 2.5, d.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = d.thickness;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(d.x + d.drift * 2.5, d.y, d.thickness + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 215, 255, ' + (d.opacity * currentOpacity * 0.25) + ')';
    ctx.fill();
  }
}

/* ── Draw: Snow ─────────────────────────────────────── */

function drawSnow() {
  var glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.4);
  glow.addColorStop(0, 'rgba(140, 160, 210, ' + (0.025 * currentOpacity) + ')');
  glow.addColorStop(1, 'rgba(100, 120, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (var i = 0; i < particles.length; i++) {
    var f = particles[i];
    f.y += f.speed;
    f.x += Math.sin(t * f.wobbleSpeed + f.phase) * f.wobbleAmp;
    if (f.y > H + f.r * 4) { f.y = -f.r * 4; f.x = Math.random() * W; }
    if (f.x < -20) f.x = W + 20;
    if (f.x > W + 20) f.x = -20;

    var op = f.opacity * currentOpacity;
    ctx.save();
    if (f.blur) ctx.filter = 'blur(2px)';

    var grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
    grad.addColorStop(0, 'rgba(255, 255, 255, ' + (op * 0.9) + ')');
    grad.addColorStop(0.35, 'rgba(215, 225, 250, ' + (op * 0.4) + ')');
    grad.addColorStop(1, 'rgba(190, 205, 240, 0)');
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 3, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (op * 0.85) + ')';
    ctx.fill();

    ctx.restore();
  }
}

/* ── Draw: Fog ──────────────────────────────────────── */

function drawFog() {
  for (var i = 0; i < particles.length; i++) {
    var l = particles[i];
    l.x += l.speed;
    if (l.x > W + l.w / 2) l.x = -l.w;
    var yOff = Math.sin(t * l.vertSpeed + l.phase) * 8;

    ctx.save();
    ctx.filter = 'blur(22px)';
    var grad = ctx.createRadialGradient(
      l.x + l.w / 2, l.y + yOff + l.h / 2, 0,
      l.x + l.w / 2, l.y + yOff + l.h / 2, l.w / 2
    );
    var op = l.opacity * currentOpacity;
    grad.addColorStop(0, 'rgba(165, 168, 190, ' + (op * 1.5) + ')');
    grad.addColorStop(0.5, 'rgba(145, 148, 175, ' + op + ')');
    grad.addColorStop(1, 'rgba(125, 128, 155, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(l.x, l.y + yOff, l.w, l.h);
    ctx.restore();
  }

  // Overall haze
  ctx.save();
  ctx.filter = 'blur(35px)';
  var hOff = Math.sin(t * 0.1) * 0.01;
  var haze = ctx.createLinearGradient(0, 0, W, 0);
  var ho = currentOpacity;
  haze.addColorStop(0, 'rgba(150, 150, 175, ' + ((0.02 + hOff) * ho) + ')');
  haze.addColorStop(0.5, 'rgba(145, 148, 168, ' + ((0.035 + hOff) * ho) + ')');
  haze.addColorStop(1, 'rgba(135, 138, 162, ' + ((0.015 + hOff) * ho) + ')');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ── Draw: Clear Sky ────────────────────────────────── */

function drawClear() {
  // Warm glow from top-left
  var ambient = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.65);
  ambient.addColorStop(0, 'rgba(255, 220, 100, ' + (0.05 * currentOpacity) + ')');
  ambient.addColorStop(0.5, 'rgba(255, 185, 60, ' + (0.02 * currentOpacity) + ')');
  ambient.addColorStop(1, 'rgba(255, 160, 40, 0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, W, H);

  // God rays
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < particles.length; i++) {
    var ray = particles[i];
    if (ray.type !== 'ray') continue;
    var shimmer = Math.sin(t * ray.shimmerSpeed + ray.phase) * 0.3 + 0.7;
    var a = ray.angle + Math.sin(t * 0.25 + ray.phase) * 0.025;
    var dx = Math.cos(a) * W * 1.5;
    var dy = Math.sin(a) * W * 1.5;
    var nx = -Math.sin(a), ny = Math.cos(a);
    var hw = ray.width * shimmer;

    ctx.beginPath();
    ctx.moveTo(-nx * 3, -ny * 3);
    ctx.lineTo(nx * 3, ny * 3);
    ctx.lineTo(dx + nx * hw, dy + ny * hw);
    ctx.lineTo(dx - nx * hw, dy - ny * hw);
    ctx.closePath();

    var grad = ctx.createLinearGradient(0, 0, dx, dy);
    var ro = ray.opacity * shimmer * currentOpacity;
    grad.addColorStop(0, 'rgba(255, 215, 80, ' + ro + ')');
    grad.addColorStop(0.35, 'rgba(255, 195, 60, ' + (ro * 0.6) + ')');
    grad.addColorStop(1, 'rgba(255, 175, 40, 0)');
    ctx.fillStyle = grad;
    ctx.filter = 'blur(14px)';
    ctx.fill();
  }
  ctx.restore();

  // Dust motes
  for (var i = 0; i < particles.length; i++) {
    var m = particles[i];
    if (m.type !== 'mote') continue;
    m.x += m.speedX;
    m.y += m.speedY + Math.sin(t * 0.8 + m.phase) * 0.08;
    if (m.x > W + 15) { m.x = -15; m.y = Math.random() * H; }
    if (m.y < -15) m.y = H + 15;

    var twinkle = Math.sin(t * m.twinkleSpeed + m.phase) * 0.4 + 0.6;
    var mo = m.opacity * twinkle * currentOpacity;
    var grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3.5);
    grad.addColorStop(0, 'rgba(255, 230, 140, ' + mo + ')');
    grad.addColorStop(0.4, 'rgba(255, 210, 100, ' + (mo * 0.3) + ')');
    grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

/* ── Animation Loop ─────────────────────────────────── */

function animate() {
  animId = requestAnimationFrame(animate);
  t += 0.016;

  // Smooth opacity transition
  var speed = 0.05;
  if (currentOpacity < targetOpacity) {
    currentOpacity = Math.min(targetOpacity, currentOpacity + speed);
  } else if (currentOpacity > targetOpacity) {
    currentOpacity = Math.max(targetOpacity, currentOpacity - speed);
  }

  // Skip rendering when fully hidden
  if (currentOpacity < 0.005 && targetOpacity === 0) {
    if (canvas.style.visibility !== 'hidden') canvas.style.visibility = 'hidden';
    return;
  }
  if (canvas.style.visibility === 'hidden') canvas.style.visibility = 'visible';

  ctx.clearRect(0, 0, W, H);

  if (currentWeather === 'rain') drawRain();
  else if (currentWeather === 'snow') drawSnow();
  else if (currentWeather === 'fog') drawFog();
  else if (currentWeather === 'normal') drawClear();

  // Fade out the bottom edge so the banner blends smoothly
  var fadeH = BANNER_HEIGHT * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  var fadeGrad = ctx.createLinearGradient(0, H - fadeH, 0, H);
  fadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
  fadeGrad.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, H - fadeH, W, fadeH);
  ctx.restore();
}

/* ── Public API ─────────────────────────────────────── */

export function createWeatherBanner() {
  canvas = document.createElement('canvas');
  canvas.id = 'weather-banner-canvas';
  canvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:15;visibility:hidden;';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', function () {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resize();
    initParticles();
  });

  animate();
  return { _canvas: canvas };
}

export function setWeatherBanner(banner, weather) {
  if (weather === currentWeather) return;
  currentWeather = weather;

  if (weather === 'all') {
    targetOpacity = 0;
  } else {
    targetOpacity = 1;
    initParticles();
  }
}

// Keep API compatible — these are no-ops now since the banner runs its own loop
export function updateWeatherBanner() {}
export function renderWeatherBanner() {}
