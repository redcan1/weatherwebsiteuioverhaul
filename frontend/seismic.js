// seismic.js — Seismic page. Requires common.js.

let map;
let quakeLayer = null;
let userMarker = null;
let userLocation = null;
let allQuakes = []; // past 7 days, M2.5+
let showWeek = false;

const DAY_MS = 24 * 60 * 60 * 1000;

// Depth classes (ordinal blue ramp: deeper = darker).
const DEPTH_CLASSES = [
  { max: 10, label: "0–10 km", color: "#86b6ef" },
  { max: 70, label: "10–70 km", color: "#3987e5" },
  { max: 300, label: "70–300 km", color: "#1c5cab" },
  { max: Infinity, label: "300+ km", color: "#0d366b" },
];

const depthColor = (km) => DEPTH_CLASSES.find((c) => km < c.max).color;
const magnitudeRadius = (mag) => Math.max(3, (mag - 1.5) * 3.2);

// ==========================================================================
// USGS earthquakes (FDSN event service)
// ==========================================================================
async function fetchEarthquakes(days) {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: new Date(Date.now() - days * DAY_MS).toISOString(),
    minmagnitude: "2.5",
    orderby: "magnitude",
  });

  const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`);
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const data = await res.json();

  return data.features.map((f) => ({
    mag: Number(f.properties.mag) || 0,
    place: f.properties.place || "Unknown location",
    time: f.properties.time,
    url: f.properties.url,
    depth: Number(f.geometry.coordinates[2]) || 0,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}

function visibleQuakes() {
  const cutoff = Date.now() - (showWeek ? 7 : 1) * DAY_MS;
  return allQuakes.filter((q) => q.time >= cutoff); // already sorted strongest first
}

function quakePopup(q) {
  return (
    popupHtml(`M ${q.mag.toFixed(1)} · ${q.place}`, [
      ["Magnitude", q.mag.toFixed(1)],
      ["Depth", `${formatNumber(q.depth, 1)} km`],
      ["Time", new Date(q.time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
      ["", formatRelative(q.time)],
    ]) + (q.url ? `<p style="margin-top:8px"><a href="${escapeHtml(q.url)}" target="_blank" rel="noopener">USGS event page ↗</a></p>` : "")
  );
}

// ==========================================================================
// Rendering
// ==========================================================================
function nearestQuake(quakes) {
  if (!userLocation) return null;
  let best = null;
  for (const q of quakes) {
    const miles = distanceMiles(userLocation.latitude, userLocation.longitude, q.lat, q.lon);
    if (!best || miles < best.miles) best = { quake: q, miles };
  }
  return best;
}

function renderMap(quakes) {
  quakeLayer?.remove();

  // Strongest drawn first so smaller quakes stay clickable on top.
  quakeLayer = L.layerGroup(
    quakes.map((q) => {
      const marker = L.circleMarker([q.lat, q.lon], {
        radius: magnitudeRadius(q.mag),
        fillColor: depthColor(q.depth),
        fillOpacity: 0.85,
        color: "#ffffff",
        weight: 1,
      }).bindPopup(quakePopup(q));
      q.marker = marker;
      return marker;
    })
  ).addTo(map);
}

function renderStats(quakes) {
  const dayCutoff = Date.now() - DAY_MS;
  const dayCount = allQuakes.filter((q) => q.time >= dayCutoff).length;
  const strongest = quakes[0];
  const nearest = nearestQuake(quakes);
  const period = showWeek ? "7 days" : "24 hours";

  setHtml(
    "quakeStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("clock")}Past 24 hours</div>
      <div class="stat-value">${formatNumber(dayCount)}</div>
      <div class="stat-note">M2.5+ worldwide</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("activity")}Past 7 days</div>
      <div class="stat-value">${formatNumber(allQuakes.length)}</div>
      <div class="stat-note">M2.5+ worldwide</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("alert")}Strongest · ${period}</div>
      <div class="stat-value">${strongest ? `M ${strongest.mag.toFixed(1)}` : "—"}</div>
      <div class="stat-note">${strongest ? escapeHtml(strongest.place) : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("ruler")}Nearest to you</div>
      <div class="stat-value">${nearest ? formatNumber(toDistance(nearest.miles)) : "—"}<span class="stat-unit">${nearest ? UNIT.distance : ""}</span></div>
      <div class="stat-note">${nearest ? `M ${nearest.quake.mag.toFixed(1)} · ${escapeHtml(nearest.quake.place)}` : "Set a location to see"}</div>
    </div>
  `
  );
}

function renderList(quakes) {
  const list = $("quakeList");
  if (!list) return;

  setText("quakeListSub", `Past ${showWeek ? "7 days" : "24 hours"}, by magnitude`);

  if (quakes.length === 0) {
    list.innerHTML = emptyState("activity", "No M2.5+ earthquakes in this period.");
    return;
  }

  const ol = document.createElement("ol");
  ol.className = "list";
  ol.append(
    ...quakes.slice(0, 8).map((q) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="list-item">
          <span class="badge">${q.mag.toFixed(1)}</span>
          <span>
            <span class="list-title">${escapeHtml(q.place)}</span>
            <span class="list-meta">${formatRelative(q.time)} · ${formatNumber(q.depth, 0)} km deep</span>
          </span>
          <span class="swatch" style="background:${depthColor(q.depth)}" title="Depth ${formatNumber(q.depth, 0)} km"></span>
        </button>`;
      li.querySelector("button").addEventListener("click", () => {
        map.setView([q.lat, q.lon], 7);
        q.marker.openPopup();
      });
      return li;
    })
  );
  list.replaceChildren(ol);
}

function render() {
  const quakes = visibleQuakes();
  renderMap(quakes);
  renderStats(quakes);
  renderList(quakes);
  setText("eqStatus", `Showing ${formatNumber(quakes.length)} earthquakes · updated ${nowClock()}`);
}

function renderLegend() {
  setHtml(
    "depthLegend",
    DEPTH_CLASSES.map(
      (c) => `<div class="legend-row"><span class="swatch" style="background:${c.color}"></span>${c.label}</div>`
    ).join("") + `<p class="map-card-note">Circle size shows magnitude.</p>`
  );
}

// ==========================================================================
// Location
// ==========================================================================
function useLocation(location, source) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];

  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);

  if (allQuakes.length) renderStats(visibleQuakes());
  if (source !== "saved") map.setView(latLng, 5);
}

// ==========================================================================
// Page setup
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [20, -40], zoom: 2 });
  renderLegend();
  setupLocationPanel(useLocation);

  const toggle = $("togglePastWeek");
  toggle?.addEventListener("change", () => {
    showWeek = toggle.checked;
    render();
  });

  try {
    setText("eqStatus", "Loading earthquakes…");
    allQuakes = await fetchEarthquakes(7);
    render();
  } catch (e) {
    console.error("Earthquake load error:", e);
    setText("eqStatus", `Couldn't load earthquake data (${e.message}).`);
    setHtml("quakeList", emptyState("alert", "Earthquake data is unavailable right now."));
  }

  // Auto-refresh earthquakes every 5 minutes.
  autoRefresh(async () => {
    allQuakes = await fetchEarthquakes(7);
    render();
  }, 5);
});
