import { haversine } from "./utils.js";
import { computeNP, computeKJ } from "./analytics.js";

/**
 * Parse a GPX XML string into an enriched track + summary stats.
 * @returns {{ name: string, points: Point[], stats: TrackStats }}
 */
export function parseGPX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("GPX invalide");

  const name = doc.querySelector("trk > name")?.textContent ?? "Trace";
  const trkpts = [...doc.querySelectorAll("trkpt")];
  if (!trkpts.length) throw new Error("Aucun point dans la trace");

  const points = enrichPoints(trkpts.map(parseTrackpoint));
  const stats = deriveStats(points);
  return { name, points, stats };
}

function parseTrackpoint(node) {
  const lat = parseFloat(node.getAttribute("lat"));
  const lon = parseFloat(node.getAttribute("lon"));
  const ele = parseFloat(node.querySelector("ele")?.textContent ?? "NaN");
  const timeStr = node.querySelector("time")?.textContent;
  const time = timeStr ? new Date(timeStr) : null;

  // Garmin TrackPointExtension fields
  const cad  = parseFloat(node.getElementsByTagNameNS("*", "cad")[0]?.textContent   ?? "NaN");
  const temp = parseFloat(node.getElementsByTagNameNS("*", "atemp")[0]?.textContent ?? "NaN");
  const hr   = parseFloat(node.getElementsByTagNameNS("*", "hr")[0]?.textContent    ?? "NaN");

  // Strava power: <extensions><power>250</power></extensions>
  const powerEl = node.querySelector("extensions > power")
              ?? node.getElementsByTagNameNS("*", "power")[0];
  const power = parseFloat(powerEl?.textContent ?? "NaN");

  return { lat, lon, ele, time, cad, temp, hr, power };
}

/** Add cumulative distance (m) and instantaneous speed (km/h) to each point. */
function enrichPoints(points) {
  const out = new Array(points.length);
  let cumDist = 0;
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      out[i] = { ...points[i], dist: 0, speed: 0 };
      continue;
    }
    const p = points[i], prev = points[i - 1];
    const d = haversine(prev.lat, prev.lon, p.lat, p.lon);
    cumDist += d;
    let speed = 0;
    if (p.time && prev.time) {
      const dt = (p.time - prev.time) / 1000;
      if (dt > 0) speed = (d / dt) * 3.6;
    }
    out[i] = { ...p, dist: cumDist, speed };
  }
  return out;
}

function deriveStats(points) {
  const last = points[points.length - 1];
  const startTime = points[0].time;
  const endTime = last.time;
  const duration = (startTime && endTime) ? (endTime - startTime) / 1000 : 0;

  let elevGain = 0, elevLoss = 0, maxSpeed = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1];
    if (Number.isFinite(p.ele) && Number.isFinite(prev.ele)) {
      const de = p.ele - prev.ele;
      if (de > 0) elevGain += de; else elevLoss -= de;
    }
    if (p.speed > maxSpeed && p.speed < 120) maxSpeed = p.speed;
  }

  const moving = points.filter(p => p.speed > 1);
  const avgSpeed = moving.length
    ? moving.reduce((s, p) => s + p.speed, 0) / moving.length
    : 0;

  const cads = collectFinite(points, "cad", v => v > 0);
  const temps = collectFinite(points, "temp");
  const eles = collectFinite(points, "ele");
  const powers = collectFinite(points, "power");

  const movingPowers = points
    .filter(p => Number.isFinite(p.power) && p.speed > 1)
    .map(p => p.power);

  const avgPower       = powers.length ? avg(powers) : null;
  const avgPowerMoving = movingPowers.length ? avg(movingPowers) : null;
  const maxPower       = powers.length ? Math.max(...powers) : null;
  const normalizedPower = powers.length ? computeNP(points) : null;

  return {
    distance: last.dist / 1000,
    duration,
    avgSpeed, maxSpeed,
    elevGain, elevLoss,
    minEle: eles.length ? Math.min(...eles) : null,
    maxEle: eles.length ? Math.max(...eles) : null,
    avgCad: cads.length  ? avg(cads)  : null,
    maxCad: cads.length  ? Math.max(...cads) : null,
    avgTemp: temps.length ? avg(temps) : null,
    hasPower: powers.length > 0,
    avgPower, avgPowerMoving, maxPower, normalizedPower,
    variabilityIndex: (normalizedPower && avgPowerMoving) ? normalizedPower / avgPowerMoving : null,
    totalKJ: computeKJ(points),
    startTime, endTime,
    pointCount: points.length,
  };
}

function collectFinite(points, key, predicate = () => true) {
  return points.map(p => p[key]).filter(v => Number.isFinite(v) && predicate(v));
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
