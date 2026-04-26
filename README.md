```
╔═══════════════════════════════════════════════════════════════════════╗
║ [ A ]  OBJECT IDENTIFICATION .. 01                                    ║
║        OBJ : GPX_TELEMETRY_ANALYZER                                   ║
║        STAT: ACTIVE                                                   ║
╚═══════════════════════════════════════════════════════════════════════╝
```

# GPX · TELEMETRY · ANALYZER

![Status](https://img.shields.io/badge/STATUS-ACTIVE-d4a854?style=flat-square&labelColor=050403)
![Modules](https://img.shields.io/badge/ES-MODULES-d4a854?style=flat-square&labelColor=050403)
![Deps](https://img.shields.io/badge/RUNTIME%20DEPS-0-d4a854?style=flat-square&labelColor=050403)
![Pages](https://img.shields.io/badge/DEPLOY-GITHUB%20PAGES-d4a854?style=flat-square&labelColor=050403)
![License](https://img.shields.io/badge/LICENSE-PROPRIETARY-d44a2c?style=flat-square&labelColor=050403)

> Analyseur GPX physique au look HUD/Weyland-Yutani. Lit un fichier de course
> (idéalement vélo, avec capteurs de puissance/cadence) et produit des stats
> normalisées, des zones de puissance Coggan, du Mean Maximal Power, et une
> **prédiction physique du temps de course** basée sur CdA / Crr / ρ / vent.

> [!NOTE]
> Construit pour analyser une étape vélo d'Ironman 70.3, mais fonctionne avec
> n'importe quel `.gpx` (drag-and-drop dans la page).

---

## ▎ FEATURES

### `[ ANALYSE ]` — lecture du fichier

- **Stats principales** — distance, durée, vitesse moy/max, dénivelé +/−, altitude min/max, cadence, température
- **Puissance** (si présente dans le GPX) :
  - Moyennes (sur tous les points / en mouvement uniquement)
  - **Normalized Power** (NP) — fenêtre glissante 30 s, élevé à la 4ᵉ, racine 4ᵉ
  - **Variability Index** — NP / avg en mvt
  - **Intensity Factor** — NP / FTP
  - **TSS** — Training Stress Score
  - **W/kg** — moyenne, NP, max (si poids renseigné)
  - **Travail total** (kJ) + calories estimées
- **Zones de puissance Coggan** — barre empilée + tableau (% temps par zone, plage en watts dérivée du FTP)
- **Mean Maximal Power** — pics sur 5 s / 15 s / 30 s / 1 min / 2 min / 5 min / 10 min / 20 min / 30 min / 60 min, avec %FTP et W/kg

### `[ MAP ]` — carte interactive

- **4 fonds** — OpenStreetMap · OpenTopoMap · Satellite (Esri) · Sombre (CARTO)
- **6 modes de coloration** — uniforme · vitesse · élévation · pente · puissance · cadence
- **Hover** — panneau qui suit le curseur, snap au point de trace le plus proche : distance, élévation, **pente**, vitesse, **puissance**, cadence, **FC**, température, temps écoulé, heure absolue

### `[ PREDICTION ]` — modèle physique

```
P·η  =  v · ( ½·ρ·CdA·v_rel·|v_rel|  +  m·g·(Crr·cos θ + sin θ) )
```

- Formulaire : puissance cible, poids cycliste/vélo, CdA, Crr, rendement, densité air, vent
- Résolution par **bissection** segment-par-segment (~100 m), robuste sur descentes raides où Newton-Raphson diverge
- Sortie : temps prédit + Δ vs temps réel du GPX (vert si plus rapide, rouge sinon), vitesse moy. prédite, énergie estimée, **courbe vitesse prédite vs réelle**
- **Tableau de sensibilité** : impact de ±10/20 W, ±0.01 CdA, ±0.001 Crr, ±5 km/h vent, −2 kg poids sur le temps total

---

## ▎ QUICK START

```bash
git clone <ton-repo>
cd Tri
python3 -m http.server 8000
```

Ouvre <http://localhost:8000> — le GPX fourni se charge automatiquement.

> [!IMPORTANT]
> Un serveur local est requis. Les modules ES ne se chargent pas via `file://`.

Pour analyser ton propre fichier : drag-and-drop sur la page ou bouton **`Charger un .gpx`**.

---

## ▎ ARCHITECTURE

```
Tri/
├── index.html                    shell minimal (header + slot principal)
├── styles.css                    thème HUD ambré, variables CSS centralisées
├── src/
│   ├── main.js                   bootstrap · layout · state · event wiring
│   ├── config.js                 constantes (theme, zones, MMP, tiles, form schema)
│   ├── utils.js                  helpers purs (haversine, fmt*, downsample, gradients)
│   ├── gpx.js                    parsing GPX + dérivation des stats
│   ├── analytics.js              NP, kJ, zones Coggan, Mean Maximal Power
│   ├── physics.js                solveSpeed (bissection), predictRace, airDensity
│   ├── view-analyse.js           onglet Analyse (stats, carte, hover, charts)
│   └── view-prediction.js        onglet Prédiction (formulaire, chart, sensibilité)
└── *.gpx
```

| Module | Responsabilité | Dépend de |
|--------|----------------|-----------|
| `config.js` | Constantes (theme, zones, defaults, schema formulaire) | — |
| `utils.js` | Pure functions (math, formatting, smoothing) | — |
| `analytics.js` | Stats puissance (NP, kJ, zones, MMP) | `config` |
| `gpx.js` | Parse XML → points enrichis + stats | `utils`, `analytics` |
| `physics.js` | Modèle de prédiction de course | `config` |
| `view-analyse.js` | Rendu DOM + Leaflet + Chart.js | tous les ci-dessus |
| `view-prediction.js` | Rendu formulaire + chart prédit | `config`, `physics`, `view-analyse` |
| `main.js` | Orchestration et wiring | tout le reste |

---

## ▎ TECH STACK

| Lib | Rôle |
|-----|------|
| **Leaflet** 1.9 | Carte + polylines + markers |
| **Chart.js** 4.4 | Profils élévation, vitesse, puissance, cadence, prédiction |
| **Google Fonts** | `Orbitron` (titres / valeurs) · `Share Tech Mono` (corps) |
| Vanilla **ES Modules** | Aucun bundler, aucun framework, aucune build step |

---

## ▎ DEPLOYMENT — GitHub Pages

```bash
git init
git add .
git commit -m "[ INIT ] GPX Telemetry Analyzer"
git branch -M main
git remote add origin <ton-repo>
git push -u origin main
```

Sur GitHub : **Settings → Pages → Source : `main` / root → Save**.

Disponible à `https://<user>.github.io/<repo>/`.

> [!WARNING]
> Le nom du GPX par défaut contient un accent (`Vélo.gpx`). Il est encodé en
> `%C3%A9` côté JS, mais en cas de 404 sur Pages, renomme en ASCII et mets à
> jour `DEFAULTS.defaultGpx` dans [src/config.js](src/config.js).

> [!TIP]
> Toutes les libs sont chargées en CDN HTTPS — aucun mixed-content, aucune clé
> d'API, aucune `node_modules`.

---

## ▎ CUSTOMIZATION

Tout est exposé via des constantes nommées :

| Cible | Fichier | Variable |
|-------|---------|----------|
| FTP par défaut | [src/config.js](src/config.js) | `DEFAULTS.ftp` |
| Palette graphiques | [src/config.js](src/config.js) | `CHART_COLORS` |
| Plages des zones de puissance | [src/config.js](src/config.js) | `POWER_ZONES` |
| Durées de pics MMP | [src/config.js](src/config.js) | `MMP_DURATIONS` |
| Fonds de carte disponibles | [src/config.js](src/config.js) | `TILE_LAYERS` |
| Modes de coloration de la trace | [src/config.js](src/config.js) | `COLOR_MODES` |
| Schéma du formulaire de prédiction | [src/config.js](src/config.js) | `PRED_FIELDS` |
| Couleurs UI globales | [styles.css](styles.css) | `:root { --accent... }` |
| Filtre teinte de la carte | [styles.css](styles.css) | `#map { filter:... }` |

---

## ▎ FORMULES DE RÉFÉRENCE

```
NP   =  ( mean( rolling30s(P)^4 ) )^(1/4)
IF   =  NP / FTP
TSS  =  (durée_s · NP · IF) / (FTP · 3600) · 100
VI   =  NP / avg_power_moving
ρ    =  101325 · (1 - 0.0065·alt / 288.15)^5.255 / (287.05 · T_kelvin)
P·η  =  v · ( ½·ρ·CdA·v_rel·|v_rel|  +  m·g·(Crr·cosθ + sinθ) )
```

---

## ▎ ROADMAP / IDÉES

- [ ] Calibration auto du CdA en résolvant pour faire correspondre temps prédit ≈ temps réel
- [ ] Comparaison de deux GPX côte-à-côte
- [ ] Export CSV / JSON des stats
- [ ] Mode segments (Strava-style) — split par km, par effort
- [ ] Dérive cardiaque (Pa:Hr decoupling) — nécessite un GPX avec FC
- [ ] Profil de vent variable par segment

---

## ▎ LICENSE

> [!CAUTION]
> **Tous droits réservés** — Copyright © 2026 Alexandre Bordereau.
>
> Ce code est rendu publiquement visible **à titre de consultation et de
> référence personnelle uniquement**. Aucune partie de ce projet (code source,
> assets, design, mise en page, documentation) ne peut être copiée, modifiée,
> redistribuée ou utilisée — à des fins commerciales ou non — **sans
> autorisation écrite préalable** de l'auteur.
>
> Demandes de licence : alex.bordereau@gmail.com
>
> Voir le fichier [LICENSE](LICENSE) pour les conditions complètes.

```
╔═══════════════════════════════════════════════════════════════════════╗
║ [ END OF FILE ]                                          .. 939 SO    ║
╚═══════════════════════════════════════════════════════════════════════╝
```
