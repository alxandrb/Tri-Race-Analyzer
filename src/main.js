import { DEFAULTS, PRED_FIELDS } from "./config.js";
import { parseGPX } from "./gpx.js";
import { renderAnalyse, invalidateMapSize } from "./view-analyse.js";
import { renderPrediction } from "./view-prediction.js";

// ---------------------------------------------------------------------------
// State — single source of truth for the parsed track. UI params live in DOM.
// ---------------------------------------------------------------------------
let currentData = null;

const getFTP = () =>
  parseFloat(document.getElementById("ftpInput").value) || DEFAULTS.ftp;

const getWeight = () => {
  const v = parseFloat(document.getElementById("weightInput").value);
  return Number.isFinite(v) && v > 0 ? v : null;
};

// ---------------------------------------------------------------------------
// Layout — built once. Subsequent renders only update inner content.
// Keeping the prediction form stable here avoids losing input focus on every
// re-render (e.g. when the user edits FTP).
// ---------------------------------------------------------------------------
function ensureLayout() {
  if (document.getElementById("tab-analyse")) return;

  document.getElementById("main").innerHTML = `
    <div class="tabs" role="tablist">
      <button class="tab-btn active" data-tab="analyse">Analyse</button>
      <button class="tab-btn" data-tab="prediction">Prédiction</button>
    </div>
    <div id="tab-analyse" class="tab-content active"></div>
    <div id="tab-prediction" class="tab-content">
      <p style="color:var(--text-dim);margin-bottom:1rem;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em">
        Modèle physique — équilibre traînée aéro · résistance roulement · gravité
      </p>
      <div class="form-grid">${PRED_FIELDS.map(predFieldHTML).join("")}</div>
      <div id="predResults"></div>
    </div>
  `;

  document.querySelectorAll(".tab-btn").forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  bindPredictionInputs();
}

function predFieldHTML(field) {
  return `
    <div class="form-field">
      <label>${field.label}</label>
      <input type="number" id="${field.id}" step="${field.step}" min="${field.min}" max="${field.max}">
      ${field.hint ? `<div class="hint">${field.hint}</div>` : ""}
    </div>`;
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(c =>
    c.classList.toggle("active", c.id === "tab-" + name));
  if (name === "analyse") invalidateMapSize();
}

// ---------------------------------------------------------------------------
// Render orchestration
// ---------------------------------------------------------------------------
function renderApp(data) {
  ensureLayout();
  currentData = data;
  renderAnalyse(data, { ftp: getFTP(), weight: getWeight() });
  renderPrediction(data);
}

// ---------------------------------------------------------------------------
// Input wiring (header + prediction form), persisted in localStorage
// ---------------------------------------------------------------------------
function bindHeaderInputs() {
  const ftp = document.getElementById("ftpInput");
  const weight = document.getElementById("weightInput");
  ftp.value = localStorage.getItem("gpxFTP") ?? DEFAULTS.ftp;
  weight.value = localStorage.getItem("gpxWeight") ?? "";

  const debounced = debounce(() => currentData && renderApp(currentData), 200);
  const onChange = () => {
    localStorage.setItem("gpxFTP", ftp.value);
    localStorage.setItem("gpxWeight", weight.value);
    debounced();
  };
  ftp.addEventListener("input", onChange);
  weight.addEventListener("input", onChange);
}

function bindPredictionInputs() {
  const debounced = debounce(() => currentData && renderPrediction(currentData), 150);
  for (const field of PRED_FIELDS) {
    const el = document.getElementById(field.id);
    el.value = localStorage.getItem("gpx_" + field.id) ?? field.default;
    el.addEventListener("input", () => {
      localStorage.setItem("gpx_" + field.id, el.value);
      debounced();
    });
  }
}

function bindFileInput() {
  document.getElementById("fileInput").addEventListener("change", e => {
    if (e.target.files[0]) loadFromFile(e.target.files[0]);
  });
  document.body.addEventListener("dragover", e => e.preventDefault());
  document.body.addEventListener("drop", e => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) loadFromFile(e.dataTransfer.files[0]);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------
async function loadFromUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    renderApp(parseGPX(await res.text()));
  } catch (e) {
    showError(`Impossible de charger automatiquement le GPX (${e.message}). Servez le dossier via un serveur local (ex. <code>python3 -m http.server</code>) ou chargez manuellement.`);
  }
}

async function loadFromFile(file) {
  try { renderApp(parseGPX(await file.text())); }
  catch (e) { showError(e.message); }
}

function showError(msg) {
  document.getElementById("main").innerHTML = `
    <div class="err">${msg}</div>
    <div class="empty">Glissez-déposez un fichier .gpx ou utilisez le bouton ci-dessus.</div>
  `;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
bindHeaderInputs();
bindFileInput();
loadFromUrl(encodeURIComponent(DEFAULTS.defaultGpx));
