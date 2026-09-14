/**
 * Simple equirectangular-style projection for the 2D schematic map.
 *
 * The network spans a small enough area (greater Delhi/NCR) that a flat
 * lat/lng projection, scaled to fill a viewBox and corrected for the
 * latitude's longitude compression, reads as an accurate, recognizable
 * "metro map" shape rather than a distorted blob.
 */

export interface ProjectionBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function computeBounds(
  points: { latitude: number; longitude: number }[],
): ProjectionBounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }
  return { minLat, maxLat, minLng, maxLng };
}

export interface Projector {
  (lat: number, lng: number): { x: number; y: number };
}

/**
 * Builds a projector function mapping lat/lng into a viewBox of
 * `width` x `height`, with `padding` on each side, preserving aspect
 * ratio (so the network isn't stretched) and correcting longitude
 * degrees for the cosine of the mean latitude.
 */
export function makeProjector(
  bounds: ProjectionBounds,
  width: number,
  height: number,
  padding: number,
): Projector {
  const meanLatRad = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const lngScaleCorrection = Math.cos(meanLatRad);

  const lngSpan = (bounds.maxLng - bounds.minLng) * lngScaleCorrection || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;

  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const scale = Math.min(usableW / lngSpan, usableH / latSpan);

  const drawnW = lngSpan * scale;
  const drawnH = latSpan * scale;
  const offsetX = padding + (usableW - drawnW) / 2;
  const offsetY = padding + (usableH - drawnH) / 2;

  return (lat: number, lng: number) => {
    const x = offsetX + (lng - bounds.minLng) * lngScaleCorrection * scale;
    // latitude increases northward; SVG y increases downward, so flip.
    const y = offsetY + (bounds.maxLat - lat) * scale;
    return { x, y };
  };
}
