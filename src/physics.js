import { DEFAULTS } from "./config.js";

const G = 9.81;

/**
 * Aggregate trackpoints into chunks of approximately `segmentMeters`.
 * Each segment carries its slope and the actual time it took (when timestamps exist),
 * so callers can compare predicted vs actual.
 */
export function buildSegments(points, segmentMeters = DEFAULTS.segmentMeters) {
  const segs = [];
  let segStart = 0;
  for (let i = 1; i < points.length; i++) {
    const isLast = i === points.length - 1;
    const reachedLength = points[i].dist - points[segStart].dist >= segmentMeters;
    if (!reachedLength && !isLast) continue;

    const dDist = points[i].dist - points[segStart].dist;
    if (dDist <= 0) { segStart = i; continue; }

    const dEle = (points[i].ele ?? 0) - (points[segStart].ele ?? 0);
    const actualTime = (points[i].time && points[segStart].time)
      ? (points[i].time - points[segStart].time) / 1000
      : null;

    segs.push({
      startDist: points[segStart].dist,
      endDist: points[i].dist,
      length: dDist,
      slope: dEle / dDist,
      actualTime,
    });
    segStart = i;
  }
  return segs;
}

/**
 * Solve for steady-state speed (m/s) given target power and slope.
 *
 *     P·η = v · ( ½·ρ·CdA·v_rel·|v_rel| + m·g·(Crr·cos θ + sin θ) )
 *
 * Bisection over [0.1, 30] m/s — robust on steep descents where Newton's
 * method diverges (the function is non-monotone around v=8 there).
 */
export function solveSpeed({ power, mass, cda, crr, rho, slope, wind, eff }) {
  const peff = power * eff;
  const denom = Math.sqrt(1 + slope * slope);
  const sinT = slope / denom;
  const cosT = 1 / denom;
  const grav = mass * G * (crr * cosT + sinT);

  const f = v => {
    const vRel = v + wind;
    const drag = 0.5 * rho * cda * vRel * Math.abs(vRel);
    return v * (drag + grav) - peff;
  };

  let lo = 0.1, hi = 30; // ~0.4 to 108 km/h
  if (f(lo) > 0) return lo;
  if (f(hi) < 0) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
    if (hi - lo < 0.005) break;
  }
  return (lo + hi) / 2;
}

/**
 * Predict total race time on a GPX given physical parameters.
 * Returns segment-by-segment speeds for charting against the actual.
 *
 * `params.wind` is in km/h, positive = headwind.
 */
export function predictRace(points, params) {
  const segs = buildSegments(points);
  const mass = params.riderWeight + params.bikeWeight;
  const windMs = (params.wind || 0) / 3.6;

  let totalTime = 0;
  let actualTotal = 0;
  const series = [];

  for (const seg of segs) {
    const v = solveSpeed({
      power: params.power,
      mass,
      cda: params.cda,
      crr: params.crr,
      rho: params.rho,
      slope: seg.slope,
      wind: windMs,
      eff: params.efficiency,
    });
    totalTime += seg.length / v;
    if (seg.actualTime != null) actualTotal += seg.actualTime;
    series.push({
      dist: (seg.startDist + seg.endDist) / 2 / 1000,
      predSpeed: v * 3.6,
      actualSpeed: seg.actualTime ? (seg.length / seg.actualTime) * 3.6 : null,
      slopePct: seg.slope * 100,
    });
  }

  const totalDist = segs.length ? segs[segs.length - 1].endDist : 0;
  return {
    totalTime,
    actualTotal: actualTotal || null,
    totalDist,
    series,
    avgSpeed: totalTime > 0 ? (totalDist / totalTime) * 3.6 : 0,
  };
}

/** Air density (kg/m³) from temperature (°C) and altitude (m), ISA. */
export function airDensity(tempC, altitudeM) {
  const T = tempC + 273.15;
  const P = 101325 * Math.pow(1 - 0.0065 * altitudeM / 288.15, 5.255);
  return P / (287.05 * T);
}
