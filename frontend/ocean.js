// ocean.js — Ocean page: NOAA tides + Open-Meteo marine conditions. Requires common.js and charts.js.

let map;
let stationsLayer = null;
let selectedMarker = null;
let userMarker = null;
let userLocation = null;
let stations = []; // [{ id, name, state, lat, lon }]
let selected = null; // { station, miles }

const TIDES_API = "https://api.tidesandcurrents.noaa.gov";
const STATIONS_CACHE_KEY = "noaa_tide_stations_v1";
const STATIONS_CACHE_DAYS = 7;
const NEAR_MILES = 300; // farther than this, the "nearest" station isn't meaningful (inland users still get their nearest coast)

// ==========================================================================
// Tide stations (2 MB from NOAA, so a trimmed copy is cached for a week)
// ==========================================================================
async function loadStations() {
  try {
    const cached = JSON.parse(localStorage.getItem(STATIONS_CACHE_KEY));
    if (cached && Date.now() - cached.time < STATIONS_CACHE_DAYS * 86400000) return cached.stations;
  } catch {
    /* no cache: fetch */
  }

  const res = await fetch(`${TIDES_API}/mdapi/prod/webapi/stations.json?type=tidepredictions`);
  if (!res.ok) throw new Error(`NOAA stations HTTP ${res.status}`);
  const list = (await res.json()).stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s) => ({ id: s.id, name: s.name, state: s.state || "", lat: s.lat, lon: s.lng }));

  try {
    localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ time: Date.now(), stations: list }));
  } catch {
    /* storage full: skip caching */
  }
  return list;
}

function nearestStation(lat, lon) {
  let best = null;
  for (const station of stations) {
    const miles = distanceMiles(lat, lon, station.lat, station.lon);
    if (!best || miles < best.miles) best = { station, miles };
  }
  return best;
}

const stationLabel = (s) => [s.name, s.state].filter(Boolean).join(", ");

function renderStations() {
  const renderer = L.canvas({ padding: 0.5 }); // 3,500 points: canvas, not SVG
  stationsLayer = L.layerGroup(
    stations.map((s) =>
      L.circleMarker([s.lat, s.lon], {
        renderer,
        radius: 3,
        color: "#ffffff",
        weight: 1,
        fillColor: "#2a78d6",
        fillOpacity: 0.9,
      })
        .bindTooltip(escapeHtml(stationLabel(s)), { direction: "top" })
        .on("click", () => {
          const miles = userLocation ? distanceMiles(userLocation.latitude, userLocation.longitude, s.lat, s.lon) : null;
          selectStation(s, miles);
          loadMarineAtStation(s); // a hand-picked station gets its own sea conditions too
        })
    )
  ).addTo(map);
}

// ==========================================================================
// Tide predictions
// ==========================================================================
async function fetchTides(stationId, interval) {
  const params = new URLSearchParams({
    product: "predictions",
    application: "thenerdmap",
    begin_date: noaaDate(new Date(Date.now() - 3 * 3600000)),
    range: "51", // hours: a little before now through the next two days
    datum: "MLLW",
    station: stationId,
    time_zone: "gmt",
    units: METRIC ? "metric" : "english",
    interval,
    format: "json",
  });
  const res = await fetch(`${TIDES_API}/api/prod/datagetter?${params}`);
  if (!res.ok) throw new Error(`NOAA tides HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "no predictions");
  return data.predictions.map((p) => ({ time: new Date(`${p.t.replace(" ", "T")}Z`), height: Number(p.v), type: p.type }));
}

// NOAA wants "yyyyMMdd HH:mm" in the requested time zone (GMT here).
function noaaDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatUntil(ms) {
  const minutes = Math.round((ms - Date.now()) / 60000);
  if (minutes < 60) return `in ${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `in ${hours} hr${rest ? ` ${rest} min` : ""}`;
}

const tideClock = (date) => date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
const feet = (v) => `${v.toFixed(1)} ${UNIT.height}`;

let tideExtremes = [];

function renderTideTable() {
  const box = $("tideTable");
  if (!box) return;
  const upcoming = tideExtremes.filter((t) => t.time.getTime() > Date.now()).slice(0, 6);
  if (upcoming.length === 0) {
    box.innerHTML = emptyState("clock", "No upcoming tides in the forecast.");
    return;
  }

  box.innerHTML = `<ol class="list">${upcoming
    .map(
      (t) => `
      <li><div class="list-item" style="cursor:default">
        <span class="badge">${t.type === "H" ? "High" : "Low"}</span>
        <span>
          <span class="list-title">${tideClock(t.time)}</span>
          <span class="list-meta">${formatUntil(t.time.getTime())}</span>
        </span>
        <span class="list-value">${feet(t.height)}</span>
      </div></li>`
    )
    .join("")}</ol>`;
}

function renderTideChart(curve) {
  const container = $("tideChart");
  if (!container) return;

  const now = Date.now();
  const points = curve
    .filter((p) => p.time.getTime() >= now - 30 * 60000 && p.time.getTime() <= now + 24 * 3600000)
    .map((p) => ({ ...p, value: p.height, label: p.time.toLocaleTimeString(undefined, { hour: "numeric" }) }));
  if (points.length === 0) {
    container.innerHTML = emptyState("clock", "No tide curve available.");
    return;
  }

  const lo = Math.floor(Math.min(0, ...points.map((p) => p.value)));
  const hi = Math.ceil(Math.max(...points.map((p) => p.value)) + 0.5);
  const step = hi - lo > 8 ? 2 : 1;
  const ticks = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);

  mountChart(container, {
    type: "line",
    data: points,
    yMin: lo,
    yMax: ticks[ticks.length - 1],
    yTicks: ticks,
    formatValue: (v) => feet(v),
    formatNote: (d) => tideClock(d.time),
    labelEvery: 6, // every 3 hours at 30-minute steps
    ariaLabel: `Predicted tide height for the next 24 hours, between ${Math.min(...points.map((p) => p.value)).toFixed(1)} and ${Math.max(...points.map((p) => p.value)).toFixed(1)} feet.`,
  });
}

// Subordinate stations (most of them) only publish high/low times, not a curve.
// Between two extremes the tide follows roughly half a cosine wave.
function curveFromExtremes(extremes, stepMin = 30) {
  const points = [];
  for (let i = 0; i < extremes.length - 1; i++) {
    const a = extremes[i];
    const b = extremes[i + 1];
    for (let t = a.time.getTime(); t < b.time.getTime(); t += stepMin * 60000) {
      const frac = (t - a.time.getTime()) / (b.time.getTime() - a.time.getTime());
      points.push({ time: new Date(t), height: a.height + ((b.height - a.height) * (1 - Math.cos(Math.PI * frac))) / 2 });
    }
  }
  return points;
}

async function loadTides(station) {
  setHtml("tideTable", emptyState("clock", "Loading tides…"));
  setHtml("tideChart", emptyState("clock", "Loading the tide curve…"));
  try {
    const [extremes, curveResult] = await Promise.all([
      fetchTides(station.id, "hilo"),
      fetchTides(station.id, "30").catch(() => null), // not offered by subordinate stations
    ]);
    tideExtremes = extremes;
    renderTideTable();
    setText(
      "tideChartSub",
      curveResult
        ? "Predicted height in feet above mean lower low water (MLLW)"
        : "Estimated between predicted high and low tides, in feet above mean lower low water (MLLW)"
    );
    renderTideChart(curveResult || curveFromExtremes(extremes));
  } catch (e) {
    console.error(e);
    tideExtremes = [];
    setHtml("tideTable", emptyState("alert", `Couldn't load tides (${e.message}).`));
    setHtml("tideChart", emptyState("alert", "Tide predictions are unavailable for this station."));
  }
  renderStats();
}

// ==========================================================================
// Marine conditions (Open-Meteo Marine, worldwide)
// ==========================================================================
let marine = null; // { current, placeLabel }

// lat/lon may be single values or comma-separated lists (Open-Meteo then returns an array).
async function fetchMarineRaw(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature",
    length_unit: METRIC ? "metric" : "imperial",
    temperature_unit: UNIT.openMeteo.temperature_unit,
    timezone: "auto",
  });
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchMarine(lat, lon) {
  return (await fetchMarineRaw(lat, lon)).current || {};
}

const compass = (deg) => (deg == null ? "" : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8]);

function renderMarine() {
  const box = $("marineOut");
  if (!box) return;
  if (!marine) {
    box.innerHTML = emptyState("map-pin", "Pick a coastal location (or one near the coast) to see sea conditions.");
    return;
  }
  const c = marine.current;
  const tile = (label, iconName, value, unit, note = "") => `
    <div class="stat">
      <div class="stat-label">${icon(iconName)}${label}</div>
      <div class="stat-value">${value ?? "—"}${value != null ? `<span class="stat-unit">${unit}</span>` : ""}</div>
      ${note ? `<div class="stat-note">${note}</div>` : ""}
    </div>`;
  const fixed = (v, d = 1) => (v == null ? null : Number(v).toFixed(d));

  box.innerHTML = `
    <div class="stat-grid">
      ${tile("Waves", "waves", fixed(c.wave_height), UNIT.height, c.wave_period != null ? `${fixed(c.wave_period, 0)} s period · from ${compass(c.wave_direction)}` : "")}
      ${tile("Swell", "wind", fixed(c.swell_wave_height), UNIT.height, c.swell_wave_period != null ? `${fixed(c.swell_wave_period, 0)} s period · from ${compass(c.swell_wave_direction)}` : "")}
      ${tile("Sea temperature", "thermometer", c.sea_surface_temperature != null ? Math.round(c.sea_surface_temperature) : null, UNIT.temp)}
      ${tile("Updated", "clock", c.time ? formatClock(c.time) : null, "", "Local time")}
    </div>
    <p class="updated">Conditions ${escapeHtml(marine.placeLabel)}</p>`;
}

const hasSeaData = (c) => c && (c.wave_height != null || c.sea_surface_temperature != null);

// Stations up rivers or in marshes count as land in the wave model, so check the
// nearest 25 stations in one request and use the closest one on open water.
async function marineNearStations(lat, lon, count = 25) {
  const candidates = [...stations]
    .map((s) => ({ s, miles: distanceMiles(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, count)
    .map((c) => c.s);
  if (candidates.length === 0) return null;

  const data = await fetchMarineRaw(candidates.map((s) => s.lat).join(","), candidates.map((s) => s.lon).join(","));
  const results = Array.isArray(data) ? data : [data];
  // Waves and sea temperature can come from different nearby grid cells (sheltered
  // inlets may have one but not the other), so take each from the closest point that has it.
  const waveIdx = results.findIndex((r) => r.current?.wave_height != null);
  const sstIdx = results.findIndex((r) => r.current?.sea_surface_temperature != null);
  const i = waveIdx !== -1 ? waveIdx : sstIdx;
  if (i === -1) return null;

  const current = { ...results[i].current };
  if (current.sea_surface_temperature == null && sstIdx !== -1) {
    current.sea_surface_temperature = results[sstIdx].current.sea_surface_temperature;
  }
  return { current, placeLabel: `near ${stationLabel(candidates[i])}` };
}

async function loadMarine(location, near) {
  setHtml("marineOut", emptyState("clock", "Loading sea conditions…"));
  marine = null;
  try {
    const current = await fetchMarine(location.latitude, location.longitude);
    if (hasSeaData(current)) {
      marine = { current, placeLabel: `at ${location.name ? location.name.split(",")[0] : "your location"}` };
    } else if (near) {
      // Inland: use the coast near your tide station instead.
      marine = await marineNearStations(near.station.lat, near.station.lon);
    }
  } catch (e) {
    console.error(e);
  }
  renderMarine();
  renderStats();
}

async function loadMarineAtStation(station) {
  setHtml("marineOut", emptyState("clock", "Loading sea conditions…"));
  marine = null;
  try {
    marine = await marineNearStations(station.lat, station.lon);
  } catch (e) {
    console.error(e);
  }
  renderMarine();
  renderStats();
}

// ==========================================================================
// Key figures + station panel
// ==========================================================================
function renderStats() {
  const now = Date.now();
  const nextHigh = tideExtremes.find((t) => t.type === "H" && t.time.getTime() > now);
  const nextLow = tideExtremes.find((t) => t.type === "L" && t.time.getTime() > now);
  const c = marine?.current;

  setHtml(
    "oceanStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("waves")}Next high tide</div>
      <div class="stat-value">${nextHigh ? nextHigh.time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—"}</div>
      <div class="stat-note">${nextHigh ? `${feet(nextHigh.height)} · ${nextHigh.time.toLocaleDateString(undefined, { weekday: "short" })}` : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("waves")}Next low tide</div>
      <div class="stat-value">${nextLow ? nextLow.time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—"}</div>
      <div class="stat-note">${nextLow ? `${feet(nextLow.height)} · ${nextLow.time.toLocaleDateString(undefined, { weekday: "short" })}` : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("wind")}Wave height</div>
      <div class="stat-value">${c?.wave_height != null ? `${Number(c.wave_height).toFixed(1)}<span class="stat-unit">${UNIT.height}</span>` : "—"}</div>
      <div class="stat-note">${c?.wave_period != null ? `${Number(c.wave_period).toFixed(0)} s period` : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("thermometer")}Sea temperature</div>
      <div class="stat-value">${c?.sea_surface_temperature != null ? `${Math.round(c.sea_surface_temperature)}<span class="stat-unit">${UNIT.temp}</span>` : "—"}</div>
      <div class="stat-note">${marine ? escapeHtml(marine.placeLabel) : "—"}</div>
    </div>
  `
  );
}

function renderStationPanel() {
  const box = $("stationOut");
  if (!box || !selected) return;
  const s = selected.station;
  box.innerHTML = `
    <div class="loc-card" style="margin-top:0">
      ${icon("waves")}
      <div>
        <div class="loc-name">${escapeHtml(stationLabel(s))}</div>
        <div class="loc-meta">NOAA station ${escapeHtml(s.id)}${selected.miles != null ? ` · ${formatNumber(toDistance(selected.miles))} ${UNIT.distance} away` : ""}</div>
      </div>
    </div>
    <p class="updated"><a href="https://tidesandcurrents.noaa.gov/stationhome.html?id=${encodeURIComponent(s.id)}" target="_blank" rel="noopener">Station page on NOAA Tides &amp; Currents ↗</a> · Tap any blue dot on the map to switch stations.</p>`;
}

function selectStation(station, miles) {
  selected = { station, miles };
  selectedMarker?.remove();
  selectedMarker = L.circleMarker([station.lat, station.lon], {
    radius: 8,
    color: "#ffffff",
    weight: 3,
    fillColor: "#c0612a",
    fillOpacity: 1,
  })
    .bindTooltip(escapeHtml(stationLabel(station)), { direction: "top" })
    .addTo(map);

  setText("stationSub", "Tide predictions come from this station");
  renderStationPanel();
  loadTides(station);
}

// ==========================================================================
// Location + page setup
// ==========================================================================
function useLocation(location, source) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];
  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);

  const near = stations.length ? nearestStation(location.latitude, location.longitude) : null;
  const withinRange = near && near.miles <= NEAR_MILES;

  if (withinRange) {
    selectStation(near.station, near.miles);
    // Tides are local, so always frame you and your station (even for a saved location).
    map.fitBounds(L.latLngBounds([latLng, [near.station.lat, near.station.lon]]), { padding: [80, 80], maxZoom: 10 });
  } else {
    selected = null;
    tideExtremes = [];
    selectedMarker?.remove();
    setText("stationSub", "NOAA tide stations cover US coasts and territories");
    setHtml(
      "stationOut",
      emptyState("waves", near ? `The nearest NOAA tide station is ${formatNumber(toDistance(near.miles))} ${METRIC ? "km" : "miles"} away, too far to be useful. Tap any blue dot on the map to pick one.` : "Loading tide stations…")
    );
    setHtml("tideTable", emptyState("waves", "No nearby tide station."));
    setHtml("tideChart", emptyState("waves", "Tides are available near US coasts."));
    if (source !== "saved") map.setView(latLng, 7);
  }

  loadMarine(location, withinRange ? near : null);
  renderStats();
}

function renderLegend() {
  setHtml(
    "oceanLegend",
    `<div class="legend-row"><span class="swatch" style="background:#2a78d6"></span>NOAA tide station</div>
     <div class="legend-row"><span class="swatch" style="background:#c0612a"></span>Selected station</div>
     <div class="legend-row"><span class="swatch" style="background:#2a78d6"></span>Your location</div>`
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [37, -96], zoom: 4 });
  renderLegend();
  renderStats();

  try {
    stations = await loadStations();
    renderStations();
    setText("stationCount", `${formatNumber(stations.length)} NOAA tide stations`);
  } catch (e) {
    console.error(e);
    setText("stationCount", `Tide stations unavailable (${e.message}).`);
  }

  // Wait for the station list so a saved location can be matched to its nearest station.
  setupLocationPanel(useLocation);

  // Tide times don't change, but "in 2 hr" does: re-render every 5 minutes.
  autoRefresh(() => {
    renderTideTable();
    renderStats();
  }, 5);
  // Sea conditions refresh every 30 minutes.
  autoRefresh(async () => {
    if (!currentLocation) return;
    const near = stations.length ? nearestStation(currentLocation.latitude, currentLocation.longitude) : null;
    await loadMarine(currentLocation, near && near.miles <= NEAR_MILES ? near : null);
  }, 30);
});
