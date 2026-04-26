// Theme tokens used by JS-generated styles (Chart.js, Leaflet polylines/markers).
// CSS variables in styles.css mirror these for the rest of the UI.
export const THEME = {
  accent:       "#d4a854",
  accentBright: "#f5d278",
  text:         "#d4c79e",
  textDim:      "#8a7e5d",
  border:       "#2a2114",
  warn:         "#e87a3c",
  bad:          "#d44a2c",
  good:         "#c8b074",
};

export const CHART_COLORS = {
  ele:    { stroke: "#d4a854", fill: "rgba(212,168,84,0.18)" },
  speed:  { stroke: "#c8b074", fill: "rgba(200,176,116,0.15)" },
  power:  { stroke: "#f5d278", fill: "rgba(245,210,120,0.18)" },
  cad:    { stroke: "#9c7c3a", fill: "rgba(156,124,58,0.15)" },
  temp:   { stroke: "#e87a3c", fill: "rgba(232,122,60,0.15)" },
  pred:   { stroke: "#f5d278", fill: "rgba(245,210,120,0.15)" },
  actual: { stroke: "#c8b074", fill: "rgba(200,176,116,0.12)" },
};

export const MAP_COLORS = {
  trackDefault: "#d4a854",
  start:        "#f5d278",
  end:          "#e87a3c",
  hoverStroke:  "#f5d278",
  hoverFill:    "#d4a854",
};

// Coggan's 7 power zones, expressed as a fraction of FTP.
export const POWER_ZONES = [
  { key: "Z1", name: "Z1 Récupération",    lo: 0,    hi: 0.55,    color: "#6b5d3f" },
  { key: "Z2", name: "Z2 Endurance",       lo: 0.55, hi: 0.75,    color: "#7a8fa8" },
  { key: "Z3", name: "Z3 Tempo",           lo: 0.75, hi: 0.90,    color: "#9bba6b" },
  { key: "Z4", name: "Z4 Seuil",           lo: 0.90, hi: 1.05,    color: "#d4a854" },
  { key: "Z5", name: "Z5 VO2max",          lo: 1.05, hi: 1.20,    color: "#e87a3c" },
  { key: "Z6", name: "Z6 Anaérobie",       lo: 1.20, hi: 1.50,    color: "#d44a2c" },
  { key: "Z7", name: "Z7 Neuromusculaire", lo: 1.50, hi: Infinity, color: "#a855f7" },
];

// Durations (seconds) for the Mean Maximal Power table.
export const MMP_DURATIONS = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];

export const TILE_LAYERS = {
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 19, subdomains: "abc",
  },
  topo: {
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap, SRTM, © OpenTopoMap (CC-BY-SA)",
    maxZoom: 17, subdomains: "abc",
  },
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri World Imagery",
    maxZoom: 19,
  },
  cartoDark: {
    name: "Sombre",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "© OSM, © CARTO",
    maxZoom: 19, subdomains: "abcd",
  },
};

export const COLOR_MODES = [
  { id: "none",      label: "Uniforme",  unit: "" },
  { id: "speed",     label: "Vitesse",   unit: "km/h" },
  { id: "elevation", label: "Élévation", unit: "m" },
  { id: "gradient",  label: "Pente",     unit: "%" },
  { id: "power",     label: "Puissance", unit: "W",   needs: "power" },
  { id: "cadence",   label: "Cadence",   unit: "rpm", needs: "cadence" },
];

// Form schema for the prediction tab.
export const PRED_FIELDS = [
  { id: "predPower",  label: "Puissance cible (W)",     step: 1,      min: 50,    max: 600,   default: 240,   hint: "en moyenne soutenue" },
  { id: "predRiderW", label: "Poids cycliste (kg)",     step: 0.1,    min: 30,    max: 150,   default: 75 },
  { id: "predBikeW",  label: "Poids vélo (kg)",         step: 0.1,    min: 3,     max: 20,    default: 8 },
  { id: "predCda",    label: "CdA (m²)",                step: 0.005,  min: 0.15,  max: 0.6,   default: 0.28,  hint: "TT/aero ~0.25 · route ~0.32" },
  { id: "predCrr",    label: "Crr",                     step: 0.0005, min: 0.002, max: 0.012, default: 0.005, hint: "race ~0.004 · entr. ~0.006" },
  { id: "predEff",    label: "Rendement transmission",  step: 0.005,  min: 0.9,   max: 1,     default: 0.975 },
  { id: "predRho",    label: "Densité air ρ (kg/m³)",   step: 0.005,  min: 0.9,   max: 1.4,   default: 1.20,  hint: "15°C, 200 m ≈ 1.20" },
  { id: "predWind",   label: "Vent (km/h)",             step: 1,      min: -40,   max: 40,    default: 0,     hint: "+ = face · − = arrière" },
];

export const DEFAULTS = {
  ftp: 285,
  defaultGpx: "Mont_tremblant_Ironman_70_3_2025_Vélo.gpx",
  segmentMeters: 100,        // chunk size for prediction physics
  gradientWindowM: 100,      // window for hover-time gradient smoothing
  npWindowMs: 30_000,        // Coggan's 30s rolling window for NP
  caloriesEfficiency: 0.24,  // gross mechanical efficiency (~24%)
};
