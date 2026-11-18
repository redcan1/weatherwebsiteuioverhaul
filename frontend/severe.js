// severe.js — Severe weather page. Requires common.js.

let map;
let alertsLayer = null;
let tropicalLayer = null;
let userMarker = null;
let alertFeatures = []; // every active watch/warning/advisory zone (GeoJSON features)
let showMarine = false;

// NOAA map services (both allow browser access).
const WWA_URL = "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/1/query";
const TROPICAL_URL = "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";

// NWS significance levels, most severe first. Always shown with a label, never colour alone.
const LEVELS = {
  W: { label: "Warning", color: "#d03b3b", rank: 3 },
  A: { label: "Watch", color: "#ec835a", rank: 2 },
  Y: { label: "Advisory", color: "#fab219", rank: 1 },
  S: { label: "Statement", color: "#7a8699", rank: 0 },
};
const levelOf = (sig) => LEVELS[String(sig || "").trim()] || LEVELS.S;

// The api.weather.gov alerts don't carry a significance code, so infer it from the event name.
function levelFromEvent(event = "") {
  if (/warning$/i.test(event)) return LEVELS.W;
  if (/watch$/i.test(event)) return LEVELS.A;
  if (/advisory$/i.test(event)) return LEVELS.Y;
  return LEVELS.S;
}

// Marine hazards (VTEC phenomena codes) — hidden unless the marine toggle is on.
const MARINE_PHENOMENA = new Set(["SC", "GL", "SR", "SE", "UP", "BW", "HF", "MF", "MS", "MH", "LO", "RB", "SI", "SW", "MA"]);
const isMarine = (p) => MARINE_PHENOMENA.has(String(p.phenom || "").trim()) || /marine/i.test(p.prod_type || "");

// NWS text is hard-wrapped at ~70 characters. Join wrapped lines, keep blank-line paragraph breaks.
const unwrap = (text) => String(text).replace(/\r/g, "").replace(/([^\n])\n(?!\n)/g, "$1 ").trim();

function formatExpiry(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

// ==========================================================================
// Nationwide watches, warnings and advisories
// ==========================================================================
async function fetchAlertZones() {
  const features = [];
  for (let offset = 0; ; ) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "prod_type,sig,phenom,cap_id,expiration",
      returnGeometry: "true",
      geometryPrecision: "3",
      maxAllowableOffset: "0.02", // simplify shapes; plenty for a national map
      resultOffset: String(offset),
      f: "geojson",
    });
    const res = await fetch(`${WWA_URL}?${params}`);
    if (!res.ok) throw new Error(`NWS map service HTTP ${res.status}`);
    const data = await res.json();

    const page = data.features || [];
    features.push(...page);
    const more = data.exceededTransferLimit || data.properties?.exceededTransferLimit;
    if (!more || page.length === 0) break;
    offset += page.length;
  }
  return features;
}

const visibleAlerts = () => alertFeatures.filter((f) => showMarine || !isMarine(f.properties));

function alertPopup(p) {
  return popupHtml(p.prod_type || "Weather alert", [
    ["Level", levelOf(p.sig).label],
    ["Expires", formatExpiry(p.expiration)],
  ]);
}

function renderAlerts() {
  alertsLayer?.remove();

  // Least severe first so warnings are drawn on top.
  const features = visibleAlerts().sort((a, b) => levelOf(a.properties.sig).rank - levelOf(b.properties.sig).rank);

  alertsLayer = L.geoJSON(
    { type: "FeatureCollection", features },
    {
      style: (f) => {
        const level = levelOf(f.properties.sig);
        return { color: level.color, weight: 1, opacity: 0.9, fillColor: level.color, fillOpacity: 0.3 };
      },
      onEachFeature: (f, layer) => layer.bindPopup(alertPopup(f.properties)),
    }
  ).addTo(map);

  // Keep storm cones and tracks above the alert shapes.
  if (tropicalLayer && map.hasLayer(tropicalLayer)) {
    tropicalLayer.remove();
    tropicalLayer.addTo(map);
  }

  renderStats();
  renderAlertTypes(features);
}

// Several zone shapes can belong to one alert, so count distinct alert IDs.
function countAlerts(features, sigs) {
  const ids = new Set();
  for (const f of features) {
    if (sigs.includes(levelOf(f.properties.sig))) ids.add(f.properties.cap_id || f.id);
  }
  return ids.size;
}

let tropicalSummary = null; // { count, names } once loaded

function renderStats() {
  const features = visibleAlerts();
  const storms = tropicalSummary;

  setHtml(
    "alertStats",
    `
    <div class="stat">
      <div class="stat-label"><span class="swatch" style="background:${LEVELS.W.color}"></span>Warnings</div>
      <div class="stat-value">${formatNumber(countAlerts(features, [LEVELS.W]))}</div>
      <div class="stat-note">Hazard happening or imminent</div>
    </div>
    <div class="stat">
      <div class="stat-label"><span class="swatch" style="background:${LEVELS.A.color}"></span>Watches</div>
      <div class="stat-value">${formatNumber(countAlerts(features, [LEVELS.A]))}</div>
      <div class="stat-note">Conditions favor the hazard</div>
    </div>
    <div class="stat">
      <div class="stat-label"><span class="swatch" style="background:${LEVELS.Y.color}"></span>Advisories &amp; statements</div>
      <div class="stat-value">${formatNumber(countAlerts(features, [LEVELS.Y, LEVELS.S]))}</div>
      <div class="stat-note">Less serious, still worth knowing</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("storm")}Tropical storms</div>
      <div class="stat-value">${storms ? formatNumber(storms.count) : "—"}</div>
      <div class="stat-note">${storms ? (storms.count ? escapeHtml(storms.names.join(", ")) : "None active right now") : "Loading…"}</div>
    </div>
  `
  );
}

function renderAlertTypes(features) {
  const box = $("alertTypes");
  if (!box) return;

  const groups = new Map();
  for (const f of features) {
    const p = f.properties;
    const name = p.prod_type || "Other alert";
    if (!groups.has(name)) groups.set(name, { name, level: levelOf(p.sig), ids: new Set(), features: [] });
    const g = groups.get(name);
    g.ids.add(p.cap_id || f.id);
    g.features.push(f);
  }

  const top = [...groups.values()]
    .sort((a, b) => b.level.rank - a.level.rank || b.ids.size - a.ids.size)
    .slice(0, 8);

  if (top.length === 0) {
    box.innerHTML = emptyState("shield", "No active alerts right now.");
    return;
  }

  const ol = document.createElement("ol");
  ol.className = "list";
  ol.append(
    ...top.map((g) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="list-item">
          <span class="swatch" style="background:${g.level.color}"></span>
          <span>
            <span class="list-title">${escapeHtml(g.name)}</span>
            <span class="list-meta">${g.level.label}</span>
          </span>
          <span class="list-value">${formatNumber(g.ids.size)}</span>
        </button>`;
      li.querySelector("button").addEventListener("click", () => {
        map.fitBounds(L.geoJSON({ type: "FeatureCollection", features: g.features }).getBounds(), {
          padding: [30, 30],
          maxZoom: 8,
        });
      });
      return li;
    })
  );
  box.replaceChildren(ol);
}

async function loadAlerts() {
  setText("wxStatus", "Loading alerts…");
  try {
    alertFeatures = await fetchAlertZones();
    renderAlerts();
    setText("wxStatus", `Alerts updated ${nowClock()}`);
  } catch (e) {
    console.error(e);
    setText("wxStatus", `Couldn't load alerts (${e.message}).`);
    setHtml("alertTypes", emptyState("alert", "Alert data is unavailable right now."));
  }
}

// ==========================================================================
// Tropical storms (NHC forecast points, track and cone)
// One "identify" request searches every storm slot: 5 Atlantic, 5 East Pacific, 5 Central Pacific.
// ==========================================================================
const BASIN_FIRST_LAYER = { AT: 6, EP: 136, CP: 266 }; // "<basin>1 Forecast Points"; each slot is 26 layers apart
const TROPICAL_LAYERS = Object.values(BASIN_FIRST_LAYER).flatMap((first) =>
  [0, 1, 2, 3, 4].flatMap((slot) => [0, 1, 2].map((offset) => first + slot * 26 + offset))
);

const STORM_TYPES = { D: "Tropical depression", S: "Tropical storm", H: "Hurricane", M: "Major hurricane" };

// "identify" keys attributes by display name ("Storm Name"), queries by field name ("stormname").
function attr(attributes, ...names) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");
  for (const name of names) {
    for (const key in attributes) {
      if (norm(key) === norm(name)) {
        const value = attributes[key];
        if (value !== null && value !== "" && value !== "Null") return value;
      }
    }
  }
  return null;
}

const toLatLngs = (coords) => coords.map(([x, y]) => [y, x]);

function stormPopup(a) {
  const knots = Number(attr(a, "maxwind", "Maximum Wind"));
  const gust = Number(attr(a, "gust", "Wind Gust"));
  const pressure = attr(a, "mslp", "Mean Sea Level Pressure");
  return popupHtml(attr(a, "stormname", "Storm Name") || "Tropical system", [
    ["Type", STORM_TYPES[attr(a, "dvlbl", "Forecast Storm Type")] || attr(a, "stormtype", "Storm Type")],
    ["Time", attr(a, "fldatelbl", "Full Date Label") || attr(a, "datelbl", "Date Label")],
    ["Max wind", Number.isFinite(knots) && knots > 0 ? `${Math.round(knots * 1.15078)} mph` : null],
    ["Gusts", Number.isFinite(gust) && gust > 0 ? `${Math.round(gust * 1.15078)} mph` : null],
    ["Pressure", pressure && Number(pressure) < 9000 ? `${pressure} mb` : null],
  ]);
}

async function loadTropical() {
  const params = new URLSearchParams({
    geometry: "-180,0,0,65",
    geometryType: "esriGeometryEnvelope",
    sr: "4326",
    layers: `all:${TROPICAL_LAYERS.join(",")}`,
    tolerance: "0",
    mapExtent: "-180,0,0,65",
    imageDisplay: "1200,500,96",
    returnGeometry: "true",
    maxAllowableOffset: "0.02",
    f: "json",
  });

  try {
    const res = await fetch(`${TROPICAL_URL}/identify?${params}`);
    if (!res.ok) throw new Error(`NHC map service HTTP ${res.status}`);
    const results = (await res.json()).results || [];

    const cones = [];
    const tracks = [];
    const points = [];
    const names = new Set();

    for (const r of results) {
      const g = r.geometry || {};
      const name = attr(r.attributes, "stormname", "Storm Name");
      if (name) names.add(name);

      if (/Cone$/.test(r.layerName) && g.rings) {
        cones.push(
          L.polygon(g.rings.map(toLatLngs), {
            color: "#134b70",
            weight: 1.5,
            dashArray: "5 5",
            fillColor: "#2a78d6",
            fillOpacity: 0.12,
          }).bindTooltip(`${escapeHtml(name || "Storm")} forecast cone`, { sticky: true })
        );
      } else if (/Track$/.test(r.layerName) && g.paths) {
        tracks.push(L.polyline(g.paths.map(toLatLngs), { color: "#0e1a2b", weight: 2 }));
      } else if (/Points$/.test(r.layerName) && Number.isFinite(g.x)) {
        const label = attr(r.attributes, "datelbl", "Date Label");
        points.push(
          L.circleMarker([g.y, g.x], { radius: 6, color: "#ffffff", weight: 2, fillColor: "#134b70", fillOpacity: 1 })
            .bindPopup(stormPopup(r.attributes))
            .bindTooltip(escapeHtml(`${name || "Storm"}${label ? ` · ${label}` : ""}`), { direction: "top" })
        );
      }
    }

    tropicalLayer?.remove();
    tropicalLayer = L.layerGroup([...cones, ...tracks, ...points]);
    if ($("toggleTropical")?.checked) tropicalLayer.addTo(map);

    tropicalSummary = { count: names.size, names: [...names] };
    setText("tropicalNote", names.size ? `Active: ${[...names].join(", ")}.` : "No active tropical storms right now.");
  } catch (e) {
    console.error("Tropical data unavailable:", e);
    tropicalSummary = { count: 0, names: [] };
    setText("tropicalNote", "Tropical storm data is unavailable right now.");
  }
  renderStats();
}

// ==========================================================================
// Alerts for the chosen location (api.weather.gov, US only)
// ==========================================================================
async function loadLocalAlerts(location) {
  const box = $("localAlerts");
  if (!box) return;

  setText("localSub", `For ${location.name || "your location"}`);
  box.innerHTML = emptyState("clock", "Checking for alerts…");

  try {
    const point = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${point}`);
    if (res.status === 400 || res.status === 404) {
      box.innerHTML = emptyState("map-pin", "Local alerts are only available for US locations.");
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const alerts = (await res.json()).features
      .map((f) => f.properties)
      .sort((a, b) => levelFromEvent(b.event).rank - levelFromEvent(a.event).rank);

    if (alerts.length === 0) {
      box.innerHTML = emptyState("shield", "No active alerts for this location.");
      return;
    }

    box.innerHTML = `<div class="alert-list">${alerts
      .map((a) => {
        const level = levelFromEvent(a.event);
        const until = formatExpiry(a.ends || a.expires);
        return `
        <details class="alert-item">
          <summary>
            <span class="swatch" style="background:${level.color}"></span>
            <span>
              <span class="alert-title">${escapeHtml(a.event)}</span>
              <span class="alert-when">${until ? `Until ${escapeHtml(until)}` : escapeHtml(a.senderName || "")}</span>
            </span>
            <span class="level-tag">${level.label}</span>
          </summary>
          <div class="alert-body">
            ${a.headline ? `<p class="alert-headline">${escapeHtml(a.headline)}</p>` : ""}
            ${a.description ? `<h4>Details</h4><p>${escapeHtml(unwrap(a.description))}</p>` : ""}
            ${a.instruction ? `<h4>What to do</h4><p>${escapeHtml(unwrap(a.instruction))}</p>` : ""}
          </div>
        </details>`;
      })
      .join("")}</div>`;
  } catch (e) {
    console.error(e);
    box.innerHTML = emptyState("alert", `Couldn't check local alerts (${e.message}).`);
  }
}

function useLocation(location, source) {
  const latLng = [location.latitude, location.longitude];
  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);

  if (source !== "saved") map.setView(latLng, 7);
  loadLocalAlerts(location);
}

// ==========================================================================
// Page setup
// ==========================================================================
function renderLegend() {
  setHtml(
    "alertLegend",
    Object.values(LEVELS)
      .map((l) => `<div class="legend-row"><span class="swatch" style="background:${l.color}"></span>${l.label}</div>`)
      .join("") +
      `<div class="legend-row"><span class="swatch" style="background:rgba(42,120,214,.15);box-shadow:inset 0 0 0 1.5px #134b70;border-radius:3px"></span>Storm forecast cone</div>`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  map = createBaseMap({ center: [39, -97], zoom: 4 }); // contiguous US
  renderLegend();
  renderStats();
  setupLocationPanel(useLocation);

  $("toggleMarine")?.addEventListener("change", (e) => {
    showMarine = e.target.checked;
    renderAlerts();
  });
  $("toggleTropical")?.addEventListener("change", (e) => {
    if (!tropicalLayer) return;
    if (e.target.checked) tropicalLayer.addTo(map);
    else tropicalLayer.remove();
  });

  loadAlerts();
  loadTropical();
});
