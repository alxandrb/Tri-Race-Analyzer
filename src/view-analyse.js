import { COLOR_MODES, TILE_LAYERS, MAP_COLORS, CHART_COLORS, THEME, DEFAULTS } from "./config.js";
import { fmtDuration, fmtMMPDuration, percentile, downsample, smoothByTime, computeGradients } from "./utils.js";
import { computePowerZones, computeMMP } from "./analytics.js";

// Module-local state for the analyse view's map and charts.
// Persists across re-renders so we can update without flicker.
let map = null;
let charts = {};
let hoverMarker = null;
let cachedGradients = null;

/** Called when the analyse tab becomes visible — Leaflet needs to recalculate size. */
export function invalidateMapSize() {
  if (map) setTimeout(() => map.invalidateSize(), 50);
}

/** Public entry point: render the entire analyse tab for a parsed GPX. */
export function renderAnalyse(data, { ftp, weight }) {
  document.getElementById("trackName").textContent = "— " + data.name;
  const tab = document.getElementById("tab-analyse");
  tab.innerHTML = renderHTML(data, ftp, weight);

  bindMapControls(data);
  drawMap(data);
  buildCharts(data);
}

// ---------------------------------------------------------------------------
// HTML composition — broken into small functions, each owns one section
// ---------------------------------------------------------------------------
function renderHTML(data, ftp, weight) {
  const s = data.stats;
  return [
    primaryStats(s),
    s.hasPower ? powerSection(data, ftp, weight) : "",
    mapSection(),
    chartsSection(s),
  ].join("");
}

function statTile(label, value, unit = "") {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}${unit ? `<span class="unit">${unit}</span>` : ""}</div></div>`;
}

function primaryStats(s) {
  const startStr = s.startTime ? s.startTime.toLocaleString("fr-CA") : "—";
  const tiles = [
    statTile("Distance",          s.distance.toFixed(2), "km"),
    statTile("Durée",             fmtDuration(s.duration)),
    statTile("Vitesse moy.",      s.avgSpeed.toFixed(1), "km/h"),
    statTile("Vitesse max.",      s.maxSpeed.toFixed(1), "km/h"),
    statTile("Dénivelé +",        Math.round(s.elevGain), "m"),
    statTile("Dénivelé −",        Math.round(s.elevLoss), "m"),
    statTile("Altitude min/max", `${Math.round(s.minEle ?? 0)} / ${Math.round(s.maxEle ?? 0)}`, "m"),
    s.avgCad  != null ? statTile("Cadence moy.", s.avgCad.toFixed(0),  "rpm") : "",
    s.avgTemp != null ? statTile("Température",  s.avgTemp.toFixed(1), "°C")  : "",
    `<div class="stat"><div class="label">Début</div><div class="value" style="font-size:0.95rem">${startStr}</div></div>`,
    statTile("Points", s.pointCount),
  ];
  return `<div class="stats">${tiles.join("")}</div>`;
}

function powerSection(data, ftp, weight) {
  const s = data.stats;
  const intensityFactor = s.normalizedPower ? s.normalizedPower / ftp : null;
  const tss = (intensityFactor && s.duration)
    ? (s.duration * s.normalizedPower * intensityFactor) / (ftp * 3600) * 100
    : null;
  const zones = computePowerZones(data.points, ftp);
  const mmp   = computeMMP(data.points);
  const totalZoneSec = zones.reduce((a, z) => a + z.seconds, 0);
  const wkgAvg = (weight && s.avgPowerMoving)  ? s.avgPowerMoving  / weight : null;
  const wkgNP  = (weight && s.normalizedPower) ? s.normalizedPower / weight : null;
  const wkgMax = (weight && s.maxPower)        ? s.maxPower        / weight : null;
  const kJperKm = (s.totalKJ && s.distance) ? s.totalKJ / s.distance : null;
  const calories = s.totalKJ ? s.totalKJ / DEFAULTS.caloriesEfficiency : null;

  const tiles = [
    statTile("Puissance moy.",       s.avgPower.toFixed(0),       "W"),
    statTile("Puiss. moy. (en mvt)", s.avgPowerMoving.toFixed(0), "W"),
    statTile("Puissance max.",       s.maxPower.toFixed(0),       "W"),
    s.normalizedPower    != null ? statTile("Normalized Power", s.normalizedPower.toFixed(0), "W") : "",
    s.variabilityIndex   != null ? statTile("Variability Index", s.variabilityIndex.toFixed(2)) : "",
    intensityFactor      != null ? statTile("Intensity Factor", intensityFactor.toFixed(2)) : "",
    tss                  != null ? statTile("TSS", tss.toFixed(0)) : "",
    s.totalKJ                    ? statTile("Travail total", Math.round(s.totalKJ), "kJ") : "",
    calories                     ? statTile("Calories ~", Math.round(calories), "kcal") : "",
    kJperKm                      ? statTile("kJ / km", kJperKm.toFixed(1)) : "",
    wkgAvg ? statTile("W/kg moy.", wkgAvg.toFixed(2)) : "",
    wkgNP  ? statTile("W/kg NP",   wkgNP.toFixed(2))  : "",
    wkgMax ? statTile("W/kg max",  wkgMax.toFixed(2)) : "",
  ];

  return `
    <div class="section-title">Puissance — FTP ${ftp} W${weight ? ` · ${weight} kg` : ""}</div>
    <div class="stats">${tiles.join("")}</div>
    <div class="power-detail">${zonesCard(zones, totalZoneSec)}${mmpCard(mmp, ftp, weight)}</div>
  `;
}

function zonesCard(zones, total) {
  const bar = zones.map(z => total
    ? `<span style="width:${(z.seconds / total * 100).toFixed(2)}%;background:${z.color}" title="${z.name}: ${fmtDuration(z.seconds)}"></span>`
    : "").join("");

  const rows = zones.map(z => `
    <tr>
      <td><span class="zone-swatch" style="background:${z.color}"></span>${z.name}</td>
      <td>${Math.round(z.lowW)}${z.highW === Infinity ? "+" : "–" + Math.round(z.highW)}</td>
      <td>${fmtDuration(z.seconds)}</td>
      <td>${total ? (z.seconds / total * 100).toFixed(1) : "0"}%</td>
    </tr>`).join("");

  return `
    <div class="zones-card">
      <h2>Temps en zones (Coggan)</h2>
      <div class="zone-bar">${bar}</div>
      <table class="zone-table">
        <thead><tr><th>Zone</th><th>Plage (W)</th><th>Temps</th><th>%</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function mmpCard(mmp, ftp, weight) {
  const rows = mmp.filter(m => m.watts != null).map(m => `
    <tr>
      <td>${fmtMMPDuration(m.duration)}</td>
      <td>${m.watts.toFixed(0)}</td>
      <td>${(m.watts / ftp * 100).toFixed(0)}%</td>
      ${weight ? `<td>${(m.watts / weight).toFixed(2)}</td>` : ""}
    </tr>`).join("");

  return `
    <div class="zones-card">
      <h2>Mean Maximal Power (pics)</h2>
      <table class="mmp-table">
        <thead><tr><th>Durée</th><th>Watts</th><th>% FTP</th>${weight ? "<th>W/kg</th>" : ""}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function mapSection() {
  return `
    <div class="map-controls">
      <label>Coloration : <select id="colorMode"></select></label>
      <label>Fond : <select id="tileMode"></select></label>
    </div>
    <div id="map"></div>
    <div id="mapLegend"></div>
    <div id="hoverInfo" class="hover-info">
      <span class="hover-empty">Survole la carte pour voir les détails au point survolé.</span>
    </div>
  `;
}

function chartsSection(s) {
  const card = (title, canvasId) =>
    `<div class="chart-card"><h2>${title}</h2><div class="chart-wrap"><canvas id="${canvasId}"></canvas></div></div>`;
  return `
    <div class="charts">
      ${card("Profil d'élévation (m vs km)", "eleChart")}
      ${card("Vitesse (km/h vs km)", "spdChart")}
      ${s.hasPower      ? card("Puissance (W vs km) — moy. mobile 30 s", "pwrChart") : ""}
      ${s.avgCad != null ? card("Cadence (rpm vs km)", "cadChart") : ""}
      ${s.avgTemp != null ? card("Température (°C vs km)", "tempChart") : ""}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Map controls + drawing
// ---------------------------------------------------------------------------
function bindMapControls(data) {
  const colorSel = document.getElementById("colorMode");
  const tileSel  = document.getElementById("tileMode");
  const hasPower = data.stats.hasPower;
  const hasCad   = data.stats.avgCad != null;

  colorSel.innerHTML = COLOR_MODES
    .filter(m => !m.needs
      || (m.needs === "power"   && hasPower)
      || (m.needs === "cadence" && hasCad))
    .map(m => `<option value="${m.id}">${m.label}</option>`).join("");

  tileSel.innerHTML = Object.entries(TILE_LAYERS)
    .map(([id, t]) => `<option value="${id}">${t.name}</option>`).join("");

  colorSel.value = localStorage.getItem("mapColorMode") || "speed";
  tileSel.value  = localStorage.getItem("mapTileMode")  || "osm";
  if (![...colorSel.options].some(o => o.value === colorSel.value)) colorSel.value = "none";

  colorSel.addEventListener("change", () => {
    localStorage.setItem("mapColorMode", colorSel.value);
    drawMap(data);
  });
  tileSel.addEventListener("change", () => {
    localStorage.setItem("mapTileMode", tileSel.value);
    drawMap(data);
  });
}

function drawMap(data) {
  const colorMode = document.getElementById("colorMode")?.value || "none";
  const tileId    = document.getElementById("tileMode")?.value  || "osm";

  if (map) map.remove();
  hoverMarker = null;
  cachedGradients = computeGradients(data.points, DEFAULTS.gradientWindowM);

  map = L.map("map", { preferCanvas: true });
  const tile = TILE_LAYERS[tileId] || TILE_LAYERS.osm;
  L.tileLayer(tile.url, {
    attribution: tile.attribution,
    maxZoom: tile.maxZoom,
    subdomains: tile.subdomains,
  }).addTo(map);

  const latlngs = data.points.map(p => [p.lat, p.lon]);
  const range = drawTrack(map, data.points, latlngs, colorMode);

  L.circleMarker(latlngs[0], {
    color: MAP_COLORS.start, fillColor: MAP_COLORS.start, radius: 7, fillOpacity: 1, weight: 2,
  }).addTo(map).bindPopup("DÉPART");
  L.circleMarker(latlngs[latlngs.length - 1], {
    color: MAP_COLORS.end, fillColor: MAP_COLORS.end, radius: 7, fillOpacity: 1, weight: 2,
  }).addTo(map).bindPopup("ARRIVÉE");
  map.fitBounds(L.latLngBounds(latlngs), { padding: [20, 20] });

  renderLegend(colorMode, range.lo, range.hi);
  bindMapHover(data);
}

function drawTrack(map, points, latlngs, colorMode) {
  const values = metricValues(points, colorMode);
  let lo = null, hi = null;
  if (values) {
    const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (valid.length) {
      lo = percentile(valid, 0.05);
      hi = percentile(valid, 0.95);
    }
  }
  if (!values || lo == null || hi == null || hi === lo) {
    L.polyline(latlngs, { color: MAP_COLORS.trackDefault, weight: 4, opacity: 0.95 }).addTo(map);
  } else {
    drawColoredTrack(map, points, latlngs, values, lo, hi);
  }
  return { lo, hi };
}

/**
 * Colour each track segment by its metric value.
 * Quantizes into N_BUCKETS to merge runs of points with the same colour bucket
 * into one polyline — keeps the SVG/canvas layer count bounded for big tracks.
 */
function drawColoredTrack(map, points, latlngs, values, lo, hi) {
  const N_BUCKETS = 24;
  const bucketOf = v => {
    if (!Number.isFinite(v)) return -1;
    const t = (v - lo) / (hi - lo);
    return Math.max(0, Math.min(N_BUCKETS - 1, Math.floor(t * N_BUCKETS)));
  };

  let runStart = 0;
  let runBucket = bucketOf(values[0]);
  for (let i = 1; i <= points.length; i++) {
    const b = i < points.length ? bucketOf(values[i]) : -2;
    if (b !== runBucket || i === points.length) {
      if (runBucket >= 0 && i - runStart >= 1) {
        const color = colorRamp((runBucket + 0.5) / N_BUCKETS);
        L.polyline(latlngs.slice(runStart, i + 1), { color, weight: 4, opacity: 0.95 }).addTo(map);
      }
      runStart = i;
      runBucket = b;
    }
  }
}

/** Blue → cyan → green → yellow → red. */
function colorRamp(t) {
  const x = Math.max(0, Math.min(1, t));
  return `hsl(${(240 - x * 240).toFixed(0)}, 90%, 50%)`;
}

function metricValues(points, mode) {
  switch (mode) {
    case "speed":     return points.map(p => p.speed);
    case "power":     return points.map(p => p.power);
    case "elevation": return points.map(p => p.ele);
    case "cadence":   return points.map(p => p.cad);
    case "gradient":  return cachedGradients;
    default:          return null;
  }
}

function renderLegend(mode, lo, hi) {
  const el = document.getElementById("mapLegend");
  if (!el) return;
  if (mode === "none" || lo == null || hi == null) { el.innerHTML = ""; return; }

  const meta = COLOR_MODES.find(m => m.id === mode);
  const stops = Array.from({ length: 12 }, (_, i) => i / 11);
  const fmt = v => mode === "gradient"
    ? v.toFixed(1)
    : (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1));

  el.innerHTML = `
    <div class="legend">
      <div class="legend-title">${meta?.label ?? ""} ${meta?.unit ? `(${meta.unit})` : ""} — échelle ${fmt(lo)} → ${fmt(hi)} (5–95 %ile)</div>
      <div class="legend-bar">${stops.map(s => `<span style="background:${colorRamp(s)}"></span>`).join("")}</div>
      <div class="legend-labels">
        <span>${fmt(lo)}</span>
        <span>${fmt((lo + hi) / 2)}</span>
        <span>${fmt(hi)}</span>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Hover interaction — snap to nearest trackpoint, update info panel
// ---------------------------------------------------------------------------
function bindMapHover(data) {
  let pendingFrame = null;
  let lastIdx = -1;
  map.on("mousemove", e => {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;
      const idx = findNearestPointIdx(data.points, e.latlng);
      if (idx === lastIdx) return;
      lastIdx = idx;
      showHoverPoint(data, idx);
    });
  });
  map.on("mouseout", () => { lastIdx = -1; hideHoverPoint(); });
}

function findNearestPointIdx(points, latlng) {
  // Brute force on (lat, lon)² is fast enough for ~10k points/frame.
  let bestIdx = 0, bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dLat = points[i].lat - latlng.lat;
    const dLon = points[i].lon - latlng.lng;
    const d = dLat * dLat + dLon * dLon;
    if (d < bestD) { bestD = d; bestIdx = i; }
  }
  return bestIdx;
}

function showHoverPoint(data, idx) {
  const p = data.points[idx];
  if (!p) return;

  if (!hoverMarker) {
    hoverMarker = L.circleMarker([p.lat, p.lon], {
      color: MAP_COLORS.hoverStroke, fillColor: MAP_COLORS.hoverFill,
      fillOpacity: 1, radius: 7, weight: 2,
    });
  }
  if (!hoverMarker._map) hoverMarker.addTo(map);
  hoverMarker.setLatLng([p.lat, p.lon]);

  const slope = cachedGradients?.[idx] ?? null;
  const elapsed = (p.time && data.points[0].time) ? (p.time - data.points[0].time) / 1000 : null;

  const fields = [
    { l: "Distance",  v: (p.dist / 1000).toFixed(2), u: "km" },
    { l: "Élévation", v: Number.isFinite(p.ele) ? Math.round(p.ele) : "—", u: "m" },
    { l: "Pente",     v: slope != null ? `${slope >= 0 ? "+" : ""}${slope.toFixed(1)}` : "—", u: "%" },
    { l: "Vitesse",   v: p.speed.toFixed(1), u: "km/h" },
    Number.isFinite(p.power)            ? { l: "Puissance",     v: p.power.toFixed(0), u: "W" } : null,
    Number.isFinite(p.cad)  && p.cad>0  ? { l: "Cadence",       v: p.cad.toFixed(0),   u: "rpm" } : null,
    Number.isFinite(p.hr)   && p.hr>0   ? { l: "FC",            v: p.hr.toFixed(0),    u: "bpm" } : null,
    Number.isFinite(p.temp)             ? { l: "Temp.",         v: p.temp.toFixed(0),  u: "°C" }  : null,
    elapsed != null                     ? { l: "Temps écoulé",  v: fmtDuration(elapsed), u: "" } : null,
    p.time                              ? { l: "Heure",         v: p.time.toLocaleTimeString("fr-CA"), u: "" } : null,
  ].filter(Boolean);

  document.getElementById("hoverInfo").innerHTML = `
    <div class="hover-grid">
      ${fields.map(f => `<div><div class="hl">${f.l}</div><div class="hv">${f.v}${f.u ? `<span class="unit">${f.u}</span>` : ""}</div></div>`).join("")}
    </div>
  `;
}

function hideHoverPoint() {
  if (hoverMarker?._map) map.removeLayer(hoverMarker);
  document.getElementById("hoverInfo").innerHTML =
    `<span class="hover-empty">Survole la carte pour voir les détails au point survolé.</span>`;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------
function buildCharts(data) {
  for (const c of Object.values(charts)) c?.destroy();
  charts = {};

  const sampled = downsample(data.points);
  const labels = sampled.map(p => (p.dist / 1000).toFixed(2));
  const s = data.stats;

  charts.ele = lineChart("eleChart", labels, sampled.map(p => p.ele),   CHART_COLORS.ele,   "m");
  charts.spd = lineChart("spdChart", labels, sampled.map(p => p.speed), CHART_COLORS.speed, "km/h");

  if (s.hasPower) {
    const smoothed = smoothByTime(data.points, "power", 30);
    const sampledP = downsample(smoothed);
    charts.pwr = lineChart(
      "pwrChart",
      sampledP.map(p => (p.dist / 1000).toFixed(2)),
      sampledP.map(p => p.smoothed),
      CHART_COLORS.power,
      "W",
    );
  }
  if (s.avgCad  != null) charts.cad  = lineChart("cadChart",  labels, sampled.map(p => p.cad),  CHART_COLORS.cad,  "rpm");
  if (s.avgTemp != null) charts.temp = lineChart("tempChart", labels, sampled.map(p => p.temp), CHART_COLORS.temp, "°C");
}

function lineChart(canvasId, labels, data, palette, yLabel) {
  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels,
      datasets: [{ data, borderColor: palette.stroke, backgroundColor: palette.fill, fill: true }],
    },
    options: lineChartOptions(yLabel),
  });
}

export function lineChartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    scales: {
      x: axisStyle("km", 8),
      y: axisStyle(yLabel),
    },
    elements: { point: { radius: 0 }, line: { tension: 0.2, borderWidth: 2 } },
  };
}

function axisStyle(title, maxTicks) {
  return {
    ticks: { color: THEME.textDim, ...(maxTicks ? { maxTicksLimit: maxTicks } : {}) },
    grid: { color: THEME.border },
    title: { display: true, text: title, color: THEME.textDim },
  };
}
