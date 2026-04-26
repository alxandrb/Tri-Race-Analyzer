const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in meters between two lat/lon points. */
export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Format seconds as "1h23m45". */
export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}`;
}

/** Format an MMP window as a human label ("5 s" / "1 min" / "1 h"). */
export function fmtMMPDuration(sec) {
  if (sec < 60)   return `${sec} s`;
  if (sec < 3600) return `${sec / 60} min`;
  return `${sec / 3600} h`;
}

/** Pick percentile p (0..1) from a pre-sorted ascending array. */
export function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * p)));
  return sortedAsc[idx];
}

/** Pick approximately `target` evenly-spaced points from `points`. */
export function downsample(points, target = 800) {
  if (points.length <= target) return points;
  const step = points.length / target;
  const out = [];
  for (let i = 0; i < target; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Append `smoothed` to each point: rolling time-window mean of `key`.
 * Uses point.time (Date) for windowing — falls back to running mean when missing.
 */
export function smoothByTime(points, key, windowSec) {
  const out = [];
  let head = 0, sum = 0, count = 0;
  for (let i = 0; i < points.length; i++) {
    const v = points[i][key];
    if (Number.isFinite(v) && points[i].time) { sum += v; count++; }
    while (head < i && points[head].time && points[i].time
           && (points[i].time - points[head].time) > windowSec * 1000) {
      const hv = points[head][key];
      if (Number.isFinite(hv) && points[head].time) { sum -= hv; count--; }
      head++;
    }
    out.push({ ...points[i], smoothed: count ? sum / count : null });
  }
  return out;
}

/**
 * Per-point gradient (%) using a centered horizontal window.
 * `windowM` is the total width: ele change is taken across [i - w/2, i + w/2].
 */
export function computeGradients(points, windowM) {
  const out = new Array(points.length);
  let lo = 0, hi = 0;
  for (let i = 0; i < points.length; i++) {
    while (lo < i && points[i].dist - points[lo].dist > windowM / 2) lo++;
    hi = Math.max(i, hi);
    while (hi < points.length - 1 && points[hi].dist - points[i].dist < windowM / 2) hi++;
    const dDist = points[hi].dist - points[lo].dist;
    out[i] = dDist > 0 ? ((points[hi].ele ?? 0) - (points[lo].ele ?? 0)) / dDist * 100 : 0;
  }
  return out;
}
