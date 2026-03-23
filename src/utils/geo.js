const FRANCE_BOUNDS = { latMin: 41.3, latMax: 51.1, lngMin: -5.2, lngMax: 9.6 };
const SCENE_WIDTH = 30, SCENE_DEPTH = 30;
const LAT_RANGE = FRANCE_BOUNDS.latMax - FRANCE_BOUNDS.latMin;
const LNG_RANGE = FRANCE_BOUNDS.lngMax - FRANCE_BOUNDS.lngMin;

export function latLngToScene(lat, lng) {
  const normLat = (lat - FRANCE_BOUNDS.latMin) / LAT_RANGE;
  const normLng = (lng - FRANCE_BOUNDS.lngMin) / LNG_RANGE;
  const mercatorFactor = Math.cos((lat * Math.PI) / 180);
  return {
    x: (normLng - 0.5) * SCENE_WIDTH * mercatorFactor,
    y: 0,
    z: -(normLat - 0.5) * SCENE_DEPTH,
  };
}

export function sceneToLatLng(x, z) {
  return {
    lat: (-z / SCENE_DEPTH + 0.5) * LAT_RANGE + FRANCE_BOUNDS.latMin,
    lng: (x / SCENE_WIDTH + 0.5) * LNG_RANGE + FRANCE_BOUNDS.lngMin,
  };
}

export function isInFrance(lat, lng) {
  return lat >= FRANCE_BOUNDS.latMin && lat <= FRANCE_BOUNDS.latMax && lng >= FRANCE_BOUNDS.lngMin && lng <= FRANCE_BOUNDS.lngMax;
}

export { FRANCE_BOUNDS };
