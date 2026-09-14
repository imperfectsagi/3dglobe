import * as THREE from "three";

/** Globe radius used throughout the scene (arbitrary Three.js units). */
export const GLOBE_RADIUS = 50;

/**
 * Convert latitude/longitude (degrees) to a position on the sphere surface,
 * offset outward by `altitude` (in the same units as GLOBE_RADIUS).
 *
 * Uses the standard equirectangular-texture convention: longitude 0 sits at
 * +Z, increasing eastward, matching how the Earth JPG is UV-mapped by
 * THREE.SphereGeometry.
 */
export function latLngToVector3(
  latDeg: number,
  lngDeg: number,
  altitude = 0,
  radius = GLOBE_RADIUS,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lng = THREE.MathUtils.degToRad(lngDeg);
  const r = radius + altitude;

  const x = r * Math.cos(lat) * Math.sin(lng);
  const y = r * Math.sin(lat);
  const z = r * Math.cos(lat) * Math.cos(lng);

  return new THREE.Vector3(x, y, z);
}

/** Haversine distance in kilometers between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = THREE.MathUtils.degToRad(lat2 - lat1);
  const dLng = THREE.MathUtils.degToRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(THREE.MathUtils.degToRad(lat1)) *
      Math.cos(THREE.MathUtils.degToRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
