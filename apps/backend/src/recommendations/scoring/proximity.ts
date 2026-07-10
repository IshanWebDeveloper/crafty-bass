import { clamp } from './config.js';

export interface Coords {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Proximity sub-score: 1 when the tradesman sits on the job, falling linearly to
 * 0 at the edge of their travel radius. Missing coordinates or a non-positive
 * radius score 0 (we can't claim closeness we can't measure).
 */
export function proximityScore(
  job: Coords | null | undefined,
  tradesman: Coords | null | undefined,
  radiusKm: number,
): number {
  if (!job || !tradesman || radiusKm <= 0) return 0;
  const d = haversineKm(job, tradesman);
  return clamp(1 - d / radiusKm, 0, 1);
}
