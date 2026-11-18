// aurora.js — Aurora forecast page (NOAA SWPC). Requires common.js and charts.js.

let map;
let auroraLayer = null;
let userMarker = null;
let userLocation = null;
let ovation = null; // { forecastTime, grid: Map("lon,lat" -> %) }

const SWPC = "https://services.swpc.noaa.gov";

// Sequential green ramp (aurora green): light = low chance, dark = high chance.
const CHANCE_BINS = [
  { min: 5, color: "#c7ebd2", label: "5" },
  { min: 10, color: "#8fd6a6", label: "10" },
  { min: 25, color: "#3fae6a", label: "25" },
  { min: 50, color: "#1f7a45", label: "50" },
  { min: 75, color: "#0d4d2a", label: "75+" },
];
const MIN_SHOWN = CHANCE_BINS[0].min;
const chanceColor = (pct) => [...CHANCE_BINS].reverse().find((b) => pct >= b.min).color;

// Planetary K-index scale (NOAA G-scale for geomagnetic storms).
function kpLevel(kp) {
  if (kp >= 9) return { label: "G5 extreme storm", color: "#d03b3b" };
  if (kp >= 8) return { label: "G4 severe storm", color: "#d03b3b" };
  if (kp >= 7) return { label: "G3 strong storm", color: "#d03b3b" };
  if (kp >= 6) return { label: "G2 moderate storm", color: "#d03b3b" };
  if (kp >= 5) return { label: "G1 minor storm", color: "#d03b3b" };
  if (kp >= 4) return { label: "Active", color: "#fab219" };
  if (kp >= 3) return { label: "Unsettled", color: "#3987e5" };
  return { label: "Quiet", color: "#3987e5" };
}

// SWPC time tags are UTC without a zone suffix.
const swpcTime = (tag) => new Date(tag.endsWith("Z") ? tag : `${tag}Z`);

// ==========================================================================
// OVATION aurora probability grid (1° × 1°, whole globe)
// ==========================================================================
async function loadOvation() {
  const res = await fetch(`${SWPC}/json/ovation_aurora_latest.json`);
  if (!res.ok) throw new Error(`SWPC HTTP ${res.status}`);
  const data = await res.json();

  const grid = new Map();
  for (const [lon, lat, pct] of data.coordinates) grid.set(`${lon},${lat}`, pct);
  ovation = { forecastTime: new Date(data["Forecast Time"]), observed: new Date(data["Observation Time"]), grid, cells: data.coordinates };
}

function chanceAt(lat, lon) {
  if (!ovation) return null;
  const key = `${Math.round((lon + 360) % 360) % 360},${Math.round(lat)}`;
  return ovation.grid.get(key) ?? 0;
}

function renderAurora() {
  auroraLayer?.remove();
  const renderer = L.canvas({ padding: 0.5 }); // thousands of cells: canvas, not SVG

  const cells = ovation.cells
    .filter(([, , pct]) => pct >= MIN_SHOWN)
    .map(([lon, lat, pct]) => {
      const west = lon > 180 ? lon - 360 : lon;
      return L.rectangle(
        [
          [lat - 0.5, west - 0.5],
          [lat + 0.5, west + 0.5],
        ],
        { renderer, stroke: false, fillColor: chanceColor(pct), fillOpacity: 0.65, interactive: false }
      );
    });

  auroraLayer = L.layerGroup(cells).addTo(map);
  userMarker?.bringToFront();
  setText("auroraNote", `Forecast for ${clockTime(ovation.forecastTime)} · updated ${formatRelative(ovation.observed.getTime())}`);
}

const clockTime = (date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// ==========================================================================
// Kp index: observed (past day) + forecast (next ~3 days), one SWPC product
// ==========================================================================
let kpSeries = [];

async function loadKp() {
  const res = await fetch(`${SWPC}/products/noaa-planetary-k-index-forecast.json`);
  if (!res.ok) throw new Error(`SWPC HTTP ${res.status}`);
  const rows = await res.json();

  // Newer format is an array of objects; older versions were a header row + arrays.
  kpSeries = rows
    .map((r) =>
      Array.isArray(r) ? { time_tag: r[0], kp: Number(r[1]), observed: r[2] } : { ...r, kp: Number(r.kp) }
    )
    .filter((r) => Number.isFinite(r.kp) && r.time_tag && !/time/i.test(r.time_tag))
    .map((r) => ({ time: swpcTime(r.time_tag), kp: r.kp, kind: r.observed }));
}

function renderKpChart() {
  const container = $("kpChart");
  if (!container) return;

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const points = kpSeries
    .filter((r) => r.time.getTime() >= since)
    .map((r) => ({
      ...r,
      value: r.kp,
      label: r.time.toLocaleString(undefined, { weekday: "short", hour: "numeric" }),
    }));

  if (points.length === 0) {
    container.innerHTML = emptyState("activity", "No Kp data available right now.");
    return;
  }

  mountChart(container, {
    type: "bar",
    data: points,
    yMax: 9,
    yTicks: [0, 3, 5, 7, 9],
    colorFor: (v) => kpLevel(v).color,
    formatValue: (v) => `Kp ${v.toFixed(1)} · ${kpLevel(v).label}`,
    formatNote: (d) =>
      `${d.time.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · ${d.kind === "predicted" ? "forecast" : d.kind}`,
    labelEvery: 8,
    ariaLabel: `Planetary Kp index for the past day and next ${Math.round(points.length / 8) - 1} days, peaking at ${Math.max(...points.map((d) => d.value)).toFixed(1)}.`,
  });
}

// ==========================================================================
// Key figures + viewing chance
// ==========================================================================
function renderStats() {
  const now = Date.now();
  const current = [...kpSeries].reverse().find((r) => r.kind !== "predicted" && r.time.getTime() <= now);
  const upcoming = kpSeries.filter((r) => r.kind === "predicted" && r.time.getTime() > now);
  const peak = upcoming.reduce((best, r) => (!best || r.kp > best.kp ? r : best), null);
  const chance = userLocation ? chanceAt(userLocation.latitude, userLocation.longitude) : null;

  setHtml(
    "auroraStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("activity")}Kp index now</div>
      <div class="stat-value">${current ? current.kp.toFixed(1) : "—"}</div>
      <div class="stat-note">${current ? kpLevel(current.kp).label : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("clock")}Peak next 3 days</div>
      <div class="stat-value">${peak ? peak.kp.toFixed(1) : "—"}</div>
      <div class="stat-note">${peak ? `${kpLevel(peak.kp).label} · ${peak.time.toLocaleString(undefined, { weekday: "short", hour: "numeric" })}` : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("map-pin")}Chance at your location</div>
      <div class="stat-value">${chance == null ? "—" : chance}<span class="stat-unit">${chance == null ? "" : "%"}</span></div>
      <div class="stat-note">${userLocation ? escapeHtml(userLocation.name?.split(",")[0] || "Your location") : "Set a location to see"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("satellite")}Forecast for</div>
      <div class="stat-value">${ovation ? clockTime(ovation.forecastTime) : "—"}</div>
      <div class="stat-note">Refreshed about every 30 minutes</div>
    </div>
  `
  );
}

function renderViewing() {
  const box = $("viewingOut");
  if (!box) return;
  if (!userLocation) {
    box.innerHTML = emptyState("map-pin", "Choose a location to see its chance of aurora.");
    return;
  }
  if (!ovation) {
    box.innerHTML = emptyState("clock", "Loading the aurora forecast…");
    return;
  }

  const chance = chanceAt(userLocation.latitude, userLocation.longitude);
  const south = userLocation.latitude < 0;
  const direction = south ? "south" : "north";

  let verdict;
  let advice;
  if (chance >= 50) {
    verdict = "Good chance";
    advice = "The aurora may be overhead. Get somewhere dark and look up.";
  } else if (chance >= 10) {
    verdict = "Possible";
    advice = `Find a dark spot and look toward the ${direction}ern horizon.`;
  } else if (chance >= 1) {
    verdict = "Unlikely";
    advice = `Only a faint glow low on the ${direction}ern horizon is possible, if anything.`;
  } else {
    verdict = "Very unlikely";
    advice = "The aurora oval is too far away right now. Check back when the Kp index rises.";
  }

  box.innerHTML = `
    <div class="hero">
      ${icon("sun")}
      <div>
        <div class="hero-value">${chance}<small>%</small></div>
        <div class="hero-label">${verdict}</div>
      </div>
    </div>
    <p class="hero-sub">${escapeHtml(advice)}</p>
    <p class="health">Best viewing is between about 10 PM and 2 AM local time, with clear skies and away from city lights. ${south ? "In the southern hemisphere this is the aurora australis." : ""}</p>
    <p class="updated">Chance of aurora overhead, from NOAA's OVATION model</p>
  `;
}

// ==========================================================================
// Location + page setup
// ==========================================================================
function useLocation(location, source) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];
  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);
  if (source !== "saved") map.setView(latLng, 4);
  renderStats();
  renderViewing();
}

function renderLegend() {
  setHtml(
    "auroraLegend",
    `<div class="legend-steps">${CHANCE_BINS.map((b) => `<span style="background:${b.color}"></span>`).join("")}</div>
     <div class="legend-steps labels">${CHANCE_BINS.map((b) => `<span>${b.label}</span>`).join("")}</div>
     <p class="map-card-note">Chance of aurora overhead (%)</p>`
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [60, -100], zoom: 3 });
  renderLegend();
  renderStats();
  setupLocationPanel(useLocation);

  const [ovationResult, kpResult] = await Promise.allSettled([loadOvation(), loadKp()]);

  if (ovationResult.status === "fulfilled") {
    renderAurora();
  } else {
    console.error(ovationResult.reason);
    setText("auroraNote", `Couldn't load the aurora forecast (${ovationResult.reason.message}).`);
  }

  if (kpResult.status === "fulfilled") {
    renderKpChart();
  } else {
    console.error(kpResult.reason);
    setHtml("kpChart", emptyState("alert", "Kp data is unavailable right now."));
  }

  renderStats();
  renderViewing();

  // Auto-refresh every 15 minutes (OVATION updates about every 30).
  autoRefresh(async () => {
    const [o, k] = await Promise.allSettled([loadOvation(), loadKp()]);
    if (o.status === "fulfilled") renderAurora();
    if (k.status === "fulfilled") renderKpChart();
    renderStats();
    renderViewing();
  }, 15);
});
