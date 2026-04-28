import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const W = 2000, H = 1125;

const C = {
  bgDeep: '#0a0c10',
  bgSurface: '#12151c',
  bgElevated: '#1a1e28',
  border: '#252a36',
  textPrimary: '#e8e6e1',
  textSecondary: '#8a8b8e',
  textMuted: '#55575c',
  fatal: '#ff3b30',
  severe: '#ff9500',
  minor: '#30d158',
  blue: '#4fc3f7',
  glow: '#ff6b3b',
  rain: '#5b9bd5',
  fog: '#9e8dc7',
  headerBg: '#1a2744',
  tileTop: '#ffffff',
  tileBottom: '#d4dceb',
  tileText: '#2a2d36',
  tileSub: '#6b7280',
};

const stages = [
  {
    num: '01', tag: 'SOURCE', title: 'data.gouv.fr',
    sub: 'ONISR / BAAC',
    accent: C.blue,
    bullets: [
      'French open data portal',
      'CSV per year 2020 — 2024',
      'Semicolon delimited',
      '~360 K accident records',
    ],
    icon: 'globe',
  },
  {
    num: '02', tag: 'FETCH', title: 'CSV Download',
    sub: 'Node + browser fallback',
    accent: C.glow,
    bullets: [
      'fetch-accidents.js · Node',
      'datagouv-api.js · in-browser',
      'ZIP unpack + parse',
      'Progressive year stream',
    ],
    icon: 'download',
  },
  {
    num: '03', tag: 'CACHE', title: 'accidents.json',
    sub: 'public/data/',
    accent: C.minor,
    bullets: [
      'Normalized JSON cache',
      'lat / lng coordinates',
      'severity · hour · weather',
      'Loaded on app boot',
    ],
    icon: 'json',
  },
  {
    num: '04', tag: 'PROCESS', title: 'BufferGeometry',
    sub: 'particle-system.js',
    accent: C.severe,
    bullets: [
      'One geometry · all years',
      'Per-particle attributes',
      'position · severity · year',
      'hour · weather (uint8)',
    ],
    icon: 'mesh',
  },
  {
    num: '05', tag: 'SHADER', title: 'GLSL Filter',
    sub: 'Vertex + fragment',
    accent: C.fatal,
    bullets: [
      'Uniforms drive filtering',
      'No CPU geometry rebuild',
      'Severity → particle color',
      'Hour → atmosphere blend',
    ],
    icon: 'shader',
  },
  {
    num: '06', tag: 'RENDER', title: 'Three.js Scene',
    sub: 'WebGL composite',
    accent: C.fog,
    bullets: [
      'France outline + autoroutes',
      'GPU particle hotspots',
      'City pulse waves',
      'Day / night atmosphere',
    ],
    icon: 'scene',
  },
];

function escape(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tspan(text, attrs = '') {
  return `<tspan ${attrs}>${escape(text)}</tspan>`;
}

function icon(kind, cx, cy, color) {
  const g = (body) => `<g transform="translate(${cx},${cy})" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  if (kind === 'globe') {
    return g(`
      <circle cx="0" cy="0" r="44" />
      <ellipse cx="0" cy="0" rx="44" ry="18" />
      <ellipse cx="0" cy="0" rx="18" ry="44" />
      <path d="M-44 0 L44 0" />
      <circle cx="0" cy="0" r="3" fill="${color}" />
    `);
  }
  if (kind === 'download') {
    return g(`
      <path d="M-32 -42 L-32 14 L32 14 L32 -42" />
      <path d="M0 -34 L0 30" />
      <path d="M-18 12 L0 30 L18 12" />
      <path d="M-44 38 L44 38" />
    `);
  }
  if (kind === 'json') {
    return g(`
      <path d="M-22 -42 Q-44 -42 -44 -22 Q-44 0 -54 0 Q-44 0 -44 22 Q-44 42 -22 42" />
      <path d="M22 -42 Q44 -42 44 -22 Q44 0 54 0 Q44 0 44 22 Q44 42 22 42" />
      <circle cx="-12" cy="0" r="3" fill="${color}" />
      <circle cx="0" cy="0" r="3" fill="${color}" />
      <circle cx="12" cy="0" r="3" fill="${color}" />
    `);
  }
  if (kind === 'mesh') {
    let pts = '';
    const r = 7;
    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 3; col++) {
        const ox = col * 16 + (row % 2 ? 8 : 0);
        const oy = row * 16;
        if (Math.abs(ox) > 50 || Math.abs(oy) > 36) continue;
        pts += `<circle cx="${ox}" cy="${oy}" r="${r * 0.35}" fill="${color}" stroke="none"/>`;
      }
    }
    return `<g transform="translate(${cx},${cy})" stroke="${color}" stroke-width="1.2" fill="none">
      <path d="M-46 -16 L-30 -32 L-14 -16 L0 -32 L14 -16 L30 -32 L46 -16 L30 0 L46 16 L30 32 L14 16 L0 32 L-14 16 L-30 32 L-46 16 L-30 0 Z" stroke-linejoin="round"/>
      <path d="M-30 -32 L-30 0 L-14 -16 L0 -32 M0 -32 L0 32 M14 -16 L14 16 M30 -32 L30 32 M-30 0 L-14 16 L0 0 L14 -16 M0 0 L14 16 L30 0 L14 -16 M-46 -16 L-30 0 L-46 16" stroke-linejoin="round"/>
      ${pts}
    </g>`;
  }
  if (kind === 'shader') {
    return g(`
      <path d="M-46 32 L0 -42 L46 32 Z" />
      <path d="M-30 12 L30 12" stroke-dasharray="2 4" />
      <path d="M-22 -2 L22 -2" stroke-dasharray="2 4" />
      <path d="M-12 -18 L12 -18" stroke-dasharray="2 4" />
      <circle cx="-30" cy="32" r="3" fill="${color}" stroke="none"/>
      <circle cx="0" cy="-42" r="3" fill="${color}" stroke="none"/>
      <circle cx="30" cy="32" r="3" fill="${color}" stroke="none"/>
    `);
  }
  if (kind === 'scene') {
    // Stylized France hex outline + 3 dots (severity colors)
    return `<g transform="translate(${cx},${cy})" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round">
      <path d="M-22 -44 L18 -42 L34 -28 L40 -8 L36 14 L24 32 L4 42 L-22 36 L-38 18 L-42 -6 L-32 -28 Z" />
      <circle cx="-6" cy="-12" r="4" fill="${C.fatal}" stroke="none"/>
      <circle cx="14" cy="6" r="4" fill="${C.severe}" stroke="none"/>
      <circle cx="-18" cy="14" r="4" fill="${C.minor}" stroke="none"/>
      <circle cx="-6" cy="-12" r="9" fill="${C.fatal}" fill-opacity="0.25" stroke="none"/>
    </g>`;
  }
  return '';
}

function tile(stage, x, y, w, h) {
  const headerH = 70;
  const accent = stage.accent;
  let svg = '';
  // tile background
  svg += `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" ry="16" fill="url(#tileGrad)" />
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" ry="16" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5" />
  </g>`;

  // accent stripe top
  svg += `<rect x="${x + 16}" y="${y}" width="${w - 32}" height="3" fill="${accent}" />`;

  // number badge
  const bx = x + 22, by = y + 24;
  svg += `<g>
    <rect x="${bx}" y="${by}" width="42" height="22" rx="4" fill="${accent}" />
    <text x="${bx + 21}" y="${by + 16}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="0.1em">${stage.num}</text>
  </g>`;

  // tag
  svg += `<text x="${bx + 52}" y="${by + 16}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="13" fill="${C.tileSub}" letter-spacing="0.18em">${escape(stage.tag)}</text>`;

  // title
  svg += `<text x="${x + 22}" y="${y + 96}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="28" fill="${C.tileText}" letter-spacing="-0.01em">${escape(stage.title)}</text>`;

  // subtitle
  svg += `<text x="${x + 22}" y="${y + 122}" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="13" fill="${C.tileSub}" letter-spacing="0.06em">${escape(stage.sub)}</text>`;

  // separator
  svg += `<line x1="${x + 22}" y1="${y + 144}" x2="${x + w - 22}" y2="${y + 144}" stroke="${C.tileSub}" stroke-opacity="0.25" stroke-width="1" />`;

  // icon
  svg += icon(stage.icon, x + w / 2, y + 230, accent);

  // bullets
  const bulletStartY = y + 326;
  stage.bullets.forEach((b, i) => {
    const yy = bulletStartY + i * 30;
    svg += `<circle cx="${x + 26}" cy="${yy - 5}" r="3" fill="${accent}" />`;
    svg += `<text x="${x + 40}" y="${yy}" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="14" fill="${C.tileText}" letter-spacing="0.02em">${escape(b)}</text>`;
  });

  return svg;
}

function arrow(x, y, len = 30) {
  // x = start of arrow (right edge of left tile + small gap), y = center
  const x2 = x + len;
  return `<g stroke="${C.glow}" stroke-width="2.2" fill="${C.glow}" stroke-linecap="round">
    <line x1="${x}" y1="${y}" x2="${x2 - 6}" y2="${y}" />
    <polygon points="${x2},${y} ${x2 - 10},${y - 6} ${x2 - 10},${y + 6}" stroke="none"/>
  </g>`;
}

// ── layout ──────────────────────────────────────────────────────
const tileW = 280, tileH = 520;
const sideMargin = 60;
const phase1Tiles = 3, phase2Tiles = 3;
const interGap = 30;          // gap between tiles within a phase
const phaseGap = 70;          // wider gap between the two phases
const tilesY = 280;

// compute x positions
const tileXs = [];
let xCur = sideMargin;
for (let i = 0; i < 6; i++) {
  tileXs.push(xCur);
  if (i === 5) break;
  xCur += tileW + (i === phase1Tiles - 1 ? phaseGap : interGap);
}
const totalW = tileXs[5] + tileW - sideMargin;
// re-center
const xShift = (W - totalW - sideMargin * 2) / 2;
for (let i = 0; i < tileXs.length; i++) tileXs[i] += xShift;

// ── build SVG ──────────────────────────────────────────────────
let body = '';

// background
body += `<rect width="${W}" height="${H}" fill="url(#bgGrad)" />`;

// subtle dot grid (very faint)
let dots = '';
for (let dx = 0; dx < W; dx += 50) {
  for (let dy = 0; dy < H; dy += 50) {
    dots += `<circle cx="${dx}" cy="${dy}" r="0.8" fill="#1e2230" />`;
  }
}
body += `<g opacity="0.5">${dots}</g>`;

// header band
body += `<rect x="0" y="0" width="${W}" height="130" fill="${C.headerBg}" />`;
body += `<rect x="0" y="129" width="${W}" height="1" fill="${C.border}" />`;

// header title block (left)
body += `<text x="60" y="56" font-family="DIN 1451 Mittelschrift" font-weight="600" font-size="14" fill="${C.textSecondary}" letter-spacing="0.18em">DATA.GOUV.FR</text>`;
body += `<text x="60" y="98" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="40" fill="${C.textPrimary}" letter-spacing="-0.01em">Accidents de France</text>`;

// header center label
body += `<text x="${W / 2}" y="56" font-family="DIN 1451 Mittelschrift" font-weight="600" font-size="13" fill="${C.textMuted}" letter-spacing="0.22em" text-anchor="middle">DATA &#x2192; PIXEL</text>`;
body += `<text x="${W / 2}" y="98" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="34" fill="${C.glow}" letter-spacing="0.1em" text-anchor="middle">PIPELINE</text>`;

// header meta (right)
body += `<text x="${W - 60}" y="50" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="13" fill="${C.textMuted}" letter-spacing="0.08em" text-anchor="end">SOURCE · ONISR / BAAC</text>`;
body += `<text x="${W - 60}" y="74" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="13" fill="${C.textMuted}" letter-spacing="0.08em" text-anchor="end">RENDER · Three.js + GLSL</text>`;
body += `<text x="${W - 60}" y="98" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="13" fill="${C.blue}" letter-spacing="0.08em" text-anchor="end">github.com / datagouv-3d-viz</text>`;

// phase headers
const phase1Cx = (tileXs[0] + tileXs[2] + tileW) / 2;
const phase2Cx = (tileXs[3] + tileXs[5] + tileW) / 2;
body += `<text x="${phase1Cx}" y="220" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="${C.textSecondary}" letter-spacing="0.32em" text-anchor="middle">PHASE 01 · DATA ACQUISITION</text>`;
body += `<text x="${phase2Cx}" y="220" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="${C.textSecondary}" letter-spacing="0.32em" text-anchor="middle">PHASE 02 · GPU RENDER PIPELINE</text>`;

// phase divider line
const dividerX = (tileXs[2] + tileW + tileXs[3]) / 2;
body += `<line x1="${dividerX}" y1="200" x2="${dividerX}" y2="${tilesY + tileH + 40}" stroke="${C.border}" stroke-dasharray="3 6" stroke-width="1" />`;

// tiles
for (let i = 0; i < stages.length; i++) {
  body += tile(stages[i], tileXs[i], tilesY, tileW, tileH);
}

// arrows between tiles
for (let i = 0; i < 5; i++) {
  if (i === 2) continue; // skip phase boundary, arrow handled below
  const startX = tileXs[i] + tileW + 4;
  const endX = tileXs[i + 1] - 4;
  const cx = (startX + endX) / 2 - 15;
  body += arrow(cx, tilesY + tileH / 2, 30);
}
// phase boundary arrow (bigger)
{
  const startX = tileXs[2] + tileW;
  const endX = tileXs[3];
  const cx = (startX + endX) / 2 - 22;
  body += arrow(cx, tilesY + tileH / 2, 44);
}

// ── footer panels ──────────────────────────────────────────────
const footY = tilesY + tileH + 70;  // 280 + 520 + 70 = 870
const footH = 195;

// panel 1: severity legend
const p1x = sideMargin, p1w = 600;
body += `<rect x="${p1x}" y="${footY}" width="${p1w}" height="${footH}" rx="14" fill="${C.bgElevated}" stroke="${C.border}" />`;
body += `<text x="${p1x + 24}" y="${footY + 36}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="${C.textSecondary}" letter-spacing="0.22em">SEVERITY · COLOR ENCODING</text>`;
const legendItems = [
  { c: C.fatal, label: 'Fatal', sub: 'tué — death within 30 days' },
  { c: C.severe, label: 'Hospitalized', sub: 'blessé hospitalisé' },
  { c: C.minor, label: 'Minor injury', sub: 'blessé léger' },
];
legendItems.forEach((it, i) => {
  const yy = footY + 80 + i * 38;
  body += `<circle cx="${p1x + 36}" cy="${yy - 6}" r="9" fill="${it.c}" />`;
  body += `<circle cx="${p1x + 36}" cy="${yy - 6}" r="18" fill="${it.c}" fill-opacity="0.18" />`;
  body += `<text x="${p1x + 64}" y="${yy}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="18" fill="${C.textPrimary}" letter-spacing="0.04em">${escape(it.label)}</text>`;
  body += `<text x="${p1x + 220}" y="${yy}" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="14" fill="${C.textMuted}" letter-spacing="0.04em">${escape(it.sub)}</text>`;
});

// panel 2: tech stack
const p2x = p1x + p1w + 30, p2w = 760;
body += `<rect x="${p2x}" y="${footY}" width="${p2w}" height="${footH}" rx="14" fill="${C.bgElevated}" stroke="${C.border}" />`;
body += `<text x="${p2x + 24}" y="${footY + 36}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="${C.textSecondary}" letter-spacing="0.22em">STACK · NO FRAMEWORK</text>`;
const stack = [
  ['Three.js', 'WebGL · BufferGeometry'],
  ['GLSL', 'custom vertex + fragment'],
  ['Vite', 'dev server + build'],
  ['Vanilla JS', 'ES modules · no React'],
];
stack.forEach((s, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const xx = p2x + 24 + col * 360;
  const yy = footY + 78 + row * 60;
  body += `<text x="${xx}" y="${yy}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="22" fill="${C.glow}" letter-spacing="-0.005em">${escape(s[0])}</text>`;
  body += `<text x="${xx}" y="${yy + 22}" font-family="DIN 1451 Mittelschrift" font-weight="400" font-size="13" fill="${C.textMuted}" letter-spacing="0.06em">${escape(s[1])}</text>`;
});

// panel 3: output preview (mini France)
const p3x = p2x + p2w + 30;
const p3w = W - sideMargin - p3x;
body += `<rect x="${p3x}" y="${footY}" width="${p3w}" height="${footH}" rx="14" fill="${C.bgElevated}" stroke="${C.border}" />`;
body += `<text x="${p3x + 24}" y="${footY + 36}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="14" fill="${C.textSecondary}" letter-spacing="0.22em">OUTPUT</text>`;

// mini France with dots
const fx = p3x + p3w / 2;
const fy = footY + 120;
body += `<g transform="translate(${fx},${fy})">
  <path d="M-46 -64 L24 -68 L52 -50 L62 -22 L58 8 L42 36 L20 54 L-22 50 L-46 32 L-58 4 L-58 -28 L-42 -50 Z"
    fill="none" stroke="${C.textSecondary}" stroke-width="1.5" stroke-linejoin="round" />
  <!-- particles -->
  <circle cx="-4" cy="-30" r="3" fill="${C.fatal}"/>
  <circle cx="-4" cy="-30" r="7" fill="${C.fatal}" fill-opacity="0.3"/>
  <circle cx="14" cy="-10" r="2.5" fill="${C.severe}"/>
  <circle cx="-22" cy="6" r="2.5" fill="${C.minor}"/>
  <circle cx="32" cy="14" r="3" fill="${C.fatal}"/>
  <circle cx="32" cy="14" r="7" fill="${C.fatal}" fill-opacity="0.3"/>
  <circle cx="6" cy="28" r="2.5" fill="${C.severe}"/>
  <circle cx="-30" cy="-12" r="2" fill="${C.minor}"/>
  <circle cx="40" cy="-30" r="2" fill="${C.severe}"/>
  <circle cx="-12" cy="42" r="2" fill="${C.minor}"/>
  <circle cx="22" cy="-40" r="2" fill="${C.minor}"/>
</g>`;

// stats below preview
body += `<text x="${p3x + p3w / 2}" y="${footY + footH - 22}" font-family="DIN 1451 Mittelschrift" font-weight="700" font-size="22" fill="${C.glow}" text-anchor="middle" letter-spacing="0.06em">~ 360 K particles</text>`;

// ── outermost SVG ─────────────────────────────────────────────
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#161a28" />
      <stop offset="100%" stop-color="${C.bgDeep}" />
    </radialGradient>
    <radialGradient id="tileGrad" cx="22%" cy="18%" r="95%">
      <stop offset="0%" stop-color="${C.tileTop}" />
      <stop offset="100%" stop-color="${C.tileBottom}" />
    </radialGradient>
  </defs>
  ${body}
</svg>`;

// ── render ─────────────────────────────────────────────────────
const fontFiles = [
  path.join(root, 'public/fonts/din1451alt.ttf'),
  path.join(root, 'public/fonts/din1451alt G.ttf'),
];

const resvg = new Resvg(svg, {
  font: {
    fontFiles,
    loadSystemFonts: true,
    defaultFontFamily: 'DIN 1451 Mittelschrift',
  },
  fitTo: { mode: 'width', value: W },
  background: C.bgDeep,
});

const png = resvg.render().asPng();
const outPng = path.join(root, 'public/infographic.png');
const outSvg = path.join(root, 'public/infographic.svg');
fs.writeFileSync(outPng, png);
fs.writeFileSync(outSvg, svg);
console.log(`Wrote ${outPng} (${(png.length / 1024).toFixed(1)} KB)`);
console.log(`Wrote ${outSvg}`);
