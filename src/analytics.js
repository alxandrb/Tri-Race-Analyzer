import { POWER_ZONES, MMP_DURATIONS, DEFAULTS } from "./config.js";

/**
 * Normalized Power: 30s rolling mean → ^4 → mean → ^(1/4).
 * Returns null when the series is too short to produce a window.
 */
export function computeNP(points) {
  const series = points.filter(p => p.time && Number.isFinite(p.power));
  if (series.length < 30) return null;
  const window = DEFAULTS.npWindowMs;

  const rolling = [];
  let head = 0, sum = 0, count = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].power; count++;
    while (series[i].time - series[head].time > window) {
      sum -= series[head].power; count--; head++;
    }
    if (series[i].time - series[0].time >= window) {
      rolling.push(sum / count);
    }
  }
  if (!rolling.length) return null;
  const fourthMean = rolling.reduce((s, v) => s + v ** 4, 0) / rolling.length;
  return fourthMean ** 0.25;
}

/** Total mechanical work in kJ — ∑ P·dt, skipping gaps > 60s. */
export function computeKJ(points) {
  let joules = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1];
    if (!Number.isFinite(p.power) || !p.time || !prev.time) continue;
    const dt = (p.time - prev.time) / 1000;
    if (dt > 0 && dt < 60) joules += p.power * dt;
  }
  return joules / 1000;
}

/**
 * Time spent in each Coggan zone (seconds), given an FTP.
 * Returns the zone definitions enriched with `lowW`, `highW` and `seconds`.
 */
export function computePowerZones(points, ftp) {
  const buckets = POWER_ZONES.map(z => ({
    ...z,
    lowW: z.lo * ftp,
    highW: z.hi * ftp,
    seconds: 0,
  }));
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1];
    if (!Number.isFinite(p.power) || !p.time || !prev.time) continue;
    const dt = (p.time - prev.time) / 1000;
    if (!(dt > 0 && dt < 60)) continue;
    const zone = buckets.find(b => p.power >= b.lowW && p.power < b.highW)
              ?? buckets[buckets.length - 1];
    zone.seconds += dt;
  }
  return buckets;
}

/**
 * Mean Maximal Power: best rolling-average watts over each duration.
 * Resamples to 1Hz with carry-forward to handle uneven trackpoint spacing.
 */
export function computeMMP(points, durations = MMP_DURATIONS) {
  const series = points.filter(p => p.time && Number.isFinite(p.power));
  if (series.length < 2) return durations.map(d => ({ duration: d, watts: null }));

  const t0 = series[0].time.getTime();
  const tEnd = series[series.length - 1].time.getTime();
  const N = Math.floor((tEnd - t0) / 1000) + 1;
  const arr = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const t = t0 + i * 1000;
    while (j + 1 < series.length && series[j + 1].time.getTime() <= t) j++;
    arr[i] = series[j].power;
  }

  return durations.map(dur => {
    if (N < dur) return { duration: dur, watts: null };
    let sum = 0;
    for (let i = 0; i < dur; i++) sum += arr[i];
    let best = sum;
    for (let i = dur; i < N; i++) {
      sum += arr[i] - arr[i - dur];
      if (sum > best) best = sum;
    }
    return { duration: dur, watts: best / dur };
  });
}
