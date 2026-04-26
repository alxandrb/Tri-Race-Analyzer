import { CHART_COLORS, THEME } from "./config.js";
import { fmtDuration } from "./utils.js";
import { predictRace } from "./physics.js";
import { lineChartOptions } from "./view-analyse.js";

let predChart = null;

/**
 * Render the prediction tab for the given GPX with parameters from the form.
 * Reads inputs from the DOM (already wired up via PRED_FIELDS in main.js).
 */
export function renderPrediction(data) {
  const params = readParamsFromDOM();
  const result = predictRace(data.points, params);

  document.getElementById("predResults").innerHTML = composeHTML(result, params, data.points);
  buildChart(result);
}

// ---------------------------------------------------------------------------
// Form values
// ---------------------------------------------------------------------------
function readParamsFromDOM() {
  return {
    power:       num("predPower"),
    riderWeight: num("predRiderW"),
    bikeWeight:  num("predBikeW"),
    cda:         num("predCda"),
    crr:         num("predCrr"),
    efficiency:  num("predEff"),
    rho:         num("predRho"),
    wind:        num("predWind"),
  };
}

const num = id => parseFloat(document.getElementById(id).value);

// ---------------------------------------------------------------------------
// HTML composition
// ---------------------------------------------------------------------------
function composeHTML(result, params, points) {
  return summary(result, params)
       + chartCard()
       + sensitivityCard(result, params, points);
}

function statTile(label, value, unit = "") {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}${unit ? `<span class="unit">${unit}</span>` : ""}</div></div>`;
}

function summary(result, params) {
  const actual = result.actualTotal;
  const diff = actual ? result.totalTime - actual : null;
  const diffClass = diff == null ? "" : (diff < 0 ? "faster" : "slower");
  const diffStr = diff == null
    ? ""
    : `${diff < 0 ? "−" : "+"}${fmtDuration(Math.abs(diff))} vs réel`;

  const energyKJ = Math.round(params.power * params.efficiency * result.totalTime / 1000);

  const tiles = [
    `<div class="stat"><div class="label">Temps prédit</div><div class="value">${fmtDuration(result.totalTime)}</div>${diff != null ? `<div class="delta ${diffClass}">${diffStr}</div>` : ""}</div>`,
    statTile("Vitesse moy. prédite", result.avgSpeed.toFixed(1), "km/h"),
    statTile("Distance",             (result.totalDist / 1000).toFixed(2), "km"),
    actual ? statTile("Temps réel (GPX)", fmtDuration(actual)) : "",
    statTile("Masse totale",  (params.riderWeight + params.bikeWeight).toFixed(1), "kg"),
    statTile("Énergie estimée", energyKJ, "kJ"),
  ];

  return `<div class="pred-summary">${tiles.join("")}</div>`;
}

function chartCard() {
  return `
    <div class="chart-card" style="margin-bottom:1rem">
      <h2>Vitesse prédite vs réelle (km vs km/h)</h2>
      <div class="chart-wrap" style="height:280px"><canvas id="predChart"></canvas></div>
    </div>
  `;
}

/** "What if" table — perturbs each parameter and reports its time impact. */
function sensitivityCard(baseResult, baseParams, points) {
  const variations = [
    { label: "Puissance +10 W",            params: { ...baseParams, power: baseParams.power + 10 } },
    { label: "Puissance −10 W",            params: { ...baseParams, power: baseParams.power - 10 } },
    { label: "Puissance +20 W",            params: { ...baseParams, power: baseParams.power + 20 } },
    { label: "CdA −0.01 (plus aéro)",      params: { ...baseParams, cda:   baseParams.cda - 0.01 } },
    { label: "CdA +0.01 (moins aéro)",     params: { ...baseParams, cda:   baseParams.cda + 0.01 } },
    { label: "Crr −0.001 (pneus rapides)", params: { ...baseParams, crr:   Math.max(0.001, baseParams.crr - 0.001) } },
    { label: "Vent +5 km/h face",          params: { ...baseParams, wind:  baseParams.wind + 5 } },
    { label: "Vent +5 km/h arrière",       params: { ...baseParams, wind:  baseParams.wind - 5 } },
    { label: "Poids −2 kg",                params: { ...baseParams, riderWeight: baseParams.riderWeight - 2 } },
  ];

  const rows = variations.map(v => {
    const r = predictRace(points, v.params);
    const delta = r.totalTime - baseResult.totalTime;
    const sign = delta < 0 ? "−" : "+";
    const cls  = delta < 0 ? "neg" : "pos";
    return `<tr><td>${v.label}</td><td>${fmtDuration(r.totalTime)}</td><td class="${cls}">${sign}${fmtDuration(Math.abs(delta))}</td></tr>`;
  }).join("");

  return `
    <div class="zones-card">
      <h2>Sensibilité (impact sur le temps total)</h2>
      <table class="sens-table">
        <thead><tr><th>Variation</th><th>Temps</th><th>Δ vs base</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
function buildChart(result) {
  if (predChart) predChart.destroy();

  const dataset = (label, key, palette, dashed = false) => ({
    label,
    data: result.series.map(p => p[key]),
    borderColor: palette.stroke,
    backgroundColor: palette.fill,
    fill: false,
    tension: 0.2,
    borderWidth: 2,
    pointRadius: 0,
    ...(dashed ? { borderDash: [4, 3] } : {}),
  });

  predChart = new Chart(document.getElementById("predChart"), {
    type: "line",
    data: {
      labels: result.series.map(p => p.dist.toFixed(2)),
      datasets: [
        dataset("Prédite", "predSpeed",   CHART_COLORS.pred),
        dataset("Réelle",  "actualSpeed", CHART_COLORS.actual, true),
      ],
    },
    options: {
      ...lineChartOptions("km/h"),
      plugins: {
        legend: { labels: { color: THEME.text, font: { family: "Share Tech Mono" } } },
        tooltip: { mode: "index", intersect: false },
      },
    },
  });
}
