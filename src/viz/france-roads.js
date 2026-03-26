import * as THREE from 'three';
import { latLngToScene } from '../utils/geo.js';

/*
 * Minimal French road network – major autoroutes only.
 * Coordinates are simplified waypoints along each route.
 * Swiss-minimal style: hairline weight, very low opacity.
 */

const AUTOROUTES = [
  // A1  Paris → Lille
  [[48.86,2.35],[49.21,2.59],[49.42,2.83],[49.85,2.95],[50.29,2.78],[50.63,3.06]],
  // A4  Paris → Strasbourg
  [[48.86,2.35],[49.04,3.40],[49.25,3.88],[49.12,5.38],[49.12,6.18],[48.57,7.75]],
  // A6  Paris → Lyon
  [[48.86,2.35],[48.36,2.70],[47.80,3.57],[47.32,5.04],[47.02,4.84],[46.20,4.84],[45.76,4.84]],
  // A7  Lyon → Marseille
  [[45.76,4.84],[45.19,4.83],[44.93,4.89],[44.56,4.80],[44.14,4.81],[43.84,4.80],[43.53,5.45],[43.30,5.37]],
  // A8  Aix-en-Provence → Nice → Italy
  [[43.53,5.45],[43.42,5.93],[43.43,6.74],[43.66,6.93],[43.71,7.26]],
  // A9  Orange → Spanish border
  [[44.14,4.81],[43.84,4.36],[43.61,3.88],[43.34,3.22],[43.18,3.00],[42.70,2.90],[42.46,2.87]],
  // A10 Paris → Bordeaux
  [[48.86,2.35],[48.30,1.90],[47.90,1.90],[47.39,0.69],[46.58,0.34],[46.15,-0.35],[45.60,-0.53],[44.84,-0.58]],
  // A13 Paris → Caen
  [[48.86,2.35],[49.07,1.48],[49.44,1.10],[49.18,-0.37]],
  // A26 Calais → Troyes
  [[50.95,1.86],[50.29,2.78],[49.85,3.29],[49.25,3.88],[48.30,4.07]],
  // A11 Paris → Nantes
  [[48.30,1.90],[48.45,1.49],[48.00,0.20],[47.47,-0.56],[47.22,-1.55]],
  // A62 Bordeaux → Toulouse
  [[44.84,-0.58],[44.20,0.62],[43.60,1.44]],
  // A61 Toulouse → Narbonne
  [[43.60,1.44],[43.21,2.35],[43.18,3.00]],
  // A63 Bordeaux → Spanish border
  [[44.84,-0.58],[44.35,-1.05],[43.49,-1.47],[43.35,-1.79]],
  // A71 Orléans → Clermont-Ferrand
  [[47.90,1.90],[47.08,2.40],[46.35,2.60],[45.78,3.08]],
  // A75 Clermont-Ferrand → Béziers
  [[45.78,3.08],[45.20,3.10],[44.10,3.08],[43.60,3.20],[43.34,3.22]],
  // A20 Vierzon → Toulouse
  [[47.22,2.07],[46.58,1.80],[45.83,1.26],[45.16,1.53],[44.45,1.44],[43.60,1.44]],
  // A31 Dijon → Luxembourg border
  [[47.32,5.04],[47.80,5.70],[48.69,6.18],[49.12,6.18],[49.36,6.17]],
  // A36 Beaune → Mulhouse
  [[47.02,4.84],[47.24,6.02],[47.50,6.80],[47.75,7.34]],
  // A5  Paris → Troyes
  [[48.86,2.35],[48.52,2.90],[48.30,4.07]],
  // A84 Caen → Rennes
  [[49.18,-0.37],[48.84,-0.88],[48.45,-1.17],[48.11,-1.68]],
  // A81 Le Mans → Rennes
  [[48.00,0.20],[48.07,-0.77],[48.11,-1.68]],
  // A83 Nantes → Niort
  [[47.22,-1.55],[46.67,-0.87],[46.32,-0.46]],
  // A64 Bayonne → Toulouse
  [[43.49,-1.47],[43.31,-0.37],[43.30,0.37],[43.60,1.44]],
  // A89 Bordeaux → Lyon
  [[44.84,-0.58],[45.19,0.72],[45.28,1.77],[45.60,3.00],[45.76,4.84]],
  // A28 Rouen → Tours
  [[49.44,1.10],[48.44,1.08],[47.39,0.69]],
  // A16 Paris (A1) → Calais (coast road)
  [[49.21,2.59],[49.87,2.10],[50.10,1.83],[50.95,1.86]],
];

/* Secondary national routes – even subtler */
const ROUTES_NATIONALES = [
  // RN7 Lyon → Nice (inland variant)
  [[45.76,4.84],[45.10,5.60],[44.56,5.93],[44.08,6.24],[43.71,7.26]],
  // RN10 Poitiers → Angoulême → Bordeaux
  [[46.58,0.34],[45.65,0.16],[44.84,-0.58]],
  // Rennes → Brest (N12/N164)
  [[48.11,-1.68],[48.18,-2.76],[48.39,-4.49]],
  // Nantes → Bordeaux (N137/A83/N11)
  [[47.22,-1.55],[46.32,-0.46],[45.95,-1.10],[44.84,-0.58]],
  // Lyon → Grenoble → Gap
  [[45.76,4.84],[45.19,5.72],[44.56,6.08]],
  // Strasbourg → Lyon (A35/A36/A6)
  [[48.57,7.75],[47.75,7.34],[47.24,6.02],[47.02,4.84]],
  // Lille → Reims (A26)
  [[50.63,3.06],[50.29,2.78],[49.85,3.29],[49.25,3.88]],
  // Clermont → Lyon
  [[45.78,3.08],[45.76,4.84]],
  // Limoges → Clermont
  [[45.83,1.26],[45.78,3.08]],
  // Tours → Bourges
  [[47.39,0.69],[47.08,2.40]],
];

function buildTubeRoutes(routes, color, opacity, radius) {
  var group = new THREE.Group();
  var baseColor = new THREE.Color(color);
  for (var i = 0; i < routes.length; i++) {
    var route = routes[i];
    var points = [];
    for (var j = 0; j < route.length; j++) {
      var p = latLngToScene(route[j][0], route[j][1]);
      points.push(new THREE.Vector3(p.x, 0.005, p.z));
    }
    if (points.length < 2) continue;
    var curve = new THREE.CatmullRomCurve3(points);
    var geom = new THREE.TubeGeometry(curve, points.length * 8, radius, 6, false);

    var mat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: opacity,
      depthWrite: false,
      fog: false,
    });
    group.add(new THREE.Mesh(geom, mat));
  }
  return group;
}

const CITIES = [
  [48.86, 2.35, 'Paris'],
  [45.76, 4.84, 'Lyon'],
  [43.30, 5.37, 'Marseille'],
  [43.60, 1.44, 'Toulouse'],
  [43.71, 7.26, 'Nice'],
  [47.22, -1.55, 'Nantes'],
  [48.57, 7.75, 'Strasbourg'],
  [44.84, -0.58, 'Bordeaux'],
  [50.63, 3.06, 'Lille'],
  [48.11, -1.68, 'Rennes'],
  [47.39, 0.69, 'Tours'],
  [45.78, 3.08, 'Clermont-Fd'],
  [47.32, 5.04, 'Dijon'],
  [49.25, 3.88, 'Reims'],
  [49.18, -0.37, 'Caen'],
  [48.39, -4.49, 'Brest'],
  [43.49, -1.47, 'Bayonne'],
  [42.70, 2.90, 'Perpignan'],
  [43.61, 3.88, 'Montpellier'],
  [47.75, 7.34, 'Mulhouse'],
];

function makeTextSprite(text) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  ctx.font = '700 48px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  var texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    opacity: 0.85,
  });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(5, 1.25, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function createCityLabels() {
  var group = new THREE.Group();
  for (var i = 0; i < CITIES.length; i++) {
    var city = CITIES[i];
    var p = latLngToScene(city[0], city[1]);
    var sprite = makeTextSprite(city[2]);
    sprite.position.set(p.x, 1.2, p.z);
    group.add(sprite);
  }
  group.name = 'city-labels';
  return group;
}

export function createFranceRoads() {
  var group = new THREE.Group();
  group.name = 'france-roads';

  // Autoroutes
  group.add(buildTubeRoutes(AUTOROUTES, 0xffffff, 0.85, 0.112));

  // National routes
  group.add(buildTubeRoutes(ROUTES_NATIONALES, 0xffffff, 0.85, 0.075));

  // City labels
  group.add(createCityLabels());

  return group;
}
