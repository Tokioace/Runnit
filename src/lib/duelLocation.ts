export type GeoCoordinates = { lat: number; lng: number };

function validPoint(lat: number, lng: number): GeoCoordinates | null {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** PostGIS geography accepts EWKT, not an arbitrary JSON object in PostgREST. */
export function toGeographyPoint(location: GeoCoordinates): string {
  const point = validPoint(location.lat, location.lng);
  if (!point) throw new Error('Ungültige GPS-Koordinaten für das Rennen.');
  return `SRID=4326;POINT(${point.lng} ${point.lat})`;
}

/** Read a point returned by PostgREST (EWKB hex) or by GeoJSON endpoints. */
export function parseGeographyPoint(value: unknown): GeoCoordinates | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value as { type?: unknown; coordinates?: unknown };
    if (candidate.type !== 'Point' || !Array.isArray(candidate.coordinates) ||
        candidate.coordinates.length < 2) return null;
    const [lng, lat] = candidate.coordinates;
    return typeof lat === 'number' && typeof lng === 'number' ? validPoint(lat, lng) : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.startsWith('{')) {
    try { return parseGeographyPoint(JSON.parse(text) as unknown); }
    catch { return null; }
  }
  const wkt = /^(?:SRID=4326;)?POINT\s*\(\s*([+-]?[\d.]+)\s+([+-]?[\d.]+)\s*\)$/i.exec(text);
  if (wkt) return validPoint(Number(wkt[2]), Number(wkt[1]));
  const hex = text.startsWith('\\x') ? text.slice(2) : text;
  if (hex.length < 42 || hex.length > 1000 || hex.length % 2 || !/^[a-f0-9]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  if (bytes[0] !== 0 && bytes[0] !== 1) return null;
  const littleEndian = bytes[0] === 1;
  const geometryType = view.getUint32(1, littleEndian);
  if ((geometryType & 0xff) !== 1) return null; // Only POINT, not LINE/POLYGON
  const hasSrid = (geometryType & 0x20000000) !== 0;
  const offset = hasSrid ? 9 : 5;
  if (hasSrid && view.getUint32(5, littleEndian) !== 4326) return null;
  if (bytes.length < offset + 16) return null;
  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  return validPoint(lat, lng);
}
