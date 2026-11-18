// common.js — shared helpers loaded by every page (before the page's own script).

const DEFAULT_CENTER = [33.749, -84.388]; // Atlanta, GA
const LOCATION_STORAGE_KEY = "user_location";

// ==========================================================================
// Icons (24×24 line icons, drawn with currentColor)
// ==========================================================================
const CLOUD_BASE = '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/>';

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  "cloud-sun": '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
  "cloud-moon": '<path d="M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6Z"/><path d="M10.1 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6 6 6 0 0 1-3 5.2"/>',
  fog: CLOUD_BASE + '<path d="M16 17H7M17 21H9"/>',
  drizzle: CLOUD_BASE + '<path d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>',
  rain: CLOUD_BASE + '<path d="M16 14v6M8 14v6M12 16v6"/>',
  snow: CLOUD_BASE + '<path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  storm: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  navigation: '<path d="M3 11 22 2l-9 19-2-8-8-2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
  "map-pin": '<path d="M20 10c0 5-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  gauge: '<path d="m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  satellite: '<path d="M13 7 9 3 5 7l4 4M17 11l4 4-4 4-4-4M8 12l4 4 6-6-4-4ZM16 8l3-3M9 21a6 6 0 0 0-6-6"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
  map: '<path d="M14.1 6.03a2 2 0 0 0 1.79 0l3.66-1.83A1 1 0 0 1 21 5.1v12.28a1 1 0 0 1-.55.9l-4.56 2.28a2 2 0 0 1-1.79 0l-4.21-2.1a2 2 0 0 0-1.79 0l-3.66 1.83A1 1 0 0 1 3 19.38V7.1a1 1 0 0 1 .55-.9l4.56-2.28a2 2 0 0 1 1.79 0zM15 5.76v15M9 3.24v15"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  locate: '<path d="M2 12h3M19 12h3M12 2v3M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M6 3.5v17a.5.5 0 0 0 .77.42l13.5-8.5a.5.5 0 0 0 0-.84L6.77 3.08A.5.5 0 0 0 6 3.5Z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
};

function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// Fill every <svg data-icon="name"> placeholder in the static HTML.
function hydrateIcons(root = document) {
  root.querySelectorAll("svg[data-icon]").forEach((svg) => {
    svg.innerHTML = ICONS[svg.dataset.icon] || "";
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("icon");
  });
}

// ==========================================================================
// DOM helpers
// ==========================================================================
const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

// Escape API/user text before putting it into HTML strings (popups, lists).
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emptyState(iconName, message) {
  return `<div class="empty">${icon(iconName)}<p>${escapeHtml(message)}</p></div>`;
}

// ==========================================================================
// Formatting
// ==========================================================================
function formatNumber(value, digits = 0) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Open-Meteo returns wall-clock times in the location's own time zone
// ("2026-11-18T08:30"). Treat them as UTC so the browser's zone isn't applied twice.
function parseLocalTime(str) {
  const [date, time = "00:00"] = str.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}

function formatLocalTime(str, options) {
  return parseLocalTime(str).toLocaleString(undefined, { timeZone: "UTC", ...options });
}

const formatHour = (str) => formatLocalTime(str, { hour: "numeric" });
const formatClock = (str) => formatLocalTime(str, { hour: "numeric", minute: "2-digit" });

function formatRelative(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function nowClock() {
  return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Great-circle distance in miles.
function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

// ==========================================================================
// Navigation
// ==========================================================================
function highlightActiveTab() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".tab").forEach((tab) => {
    const isActive = tab.getAttribute("href") === currentPage;
    tab.classList.toggle("active", isActive);
    if (isActive) tab.setAttribute("aria-current", "page");
  });
}

hydrateIcons();
highlightActiveTab();

// ==========================================================================
// Leaflet maps
// ==========================================================================
// Esri ArcGIS Online basemaps (no API key needed).
const ESRI_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services";

const BASEMAPS = {
  // Muted gray canvas so data colors stand out; labels drawn in a separate layer above the data.
  light: {
    base: `${ESRI_TILES}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI_TILES}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 16,
  },
  streets: {
    base: `${ESRI_TILES}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    maxNativeZoom: 18,
  },
};

const MAP_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, FAO, NOAA, USGS, ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function createBaseMap({ center = DEFAULT_CENTER, zoom = 8, basemap = "light" } = {}) {
  const map = L.map("map", { worldCopyJump: true }).setView(center, zoom);
  const style = BASEMAPS[basemap];

  L.tileLayer(style.base, {
    maxNativeZoom: style.maxNativeZoom,
    maxZoom: 19,
    attribution: MAP_ATTRIBUTION,
  }).addTo(map);

  if (style.labels) {
    // Place names above data shapes (overlayPane is 400) but below markers and popups.
    const pane = map.createPane("labels");
    pane.style.zIndex = 450;
    pane.style.pointerEvents = "none";
    L.tileLayer(style.labels, { pane: "labels", maxNativeZoom: style.maxNativeZoom, maxZoom: 19 }).addTo(map);
  }

  addFullscreenControl(map);
  addRecenterControl(map);

  // The map sits inside a grid layout, so recalculate its size once layout settles.
  setTimeout(() => map.invalidateSize(), 100);

  return map;
}

// "Center on my location" button (under the full-screen button). Hidden until a
// location is chosen; selectLocation() keeps it pointed at the latest one.
let recenter = null; // { map, bar, button, location }

function addRecenterControl(map) {
  const control = L.control({ position: "topleft" });
  control.onAdd = () => {
    const bar = L.DomUtil.create("div", "leaflet-bar");
    const button = L.DomUtil.create("a", "map-icon-btn", bar);
    button.href = "#";
    button.setAttribute("role", "button");
    button.innerHTML = icon("locate");
    bar.hidden = true;

    L.DomEvent.disableClickPropagation(bar);
    L.DomEvent.on(button, "click", (e) => {
      L.DomEvent.preventDefault(e);
      const loc = recenter?.location;
      if (!loc) return;
      // Keep the user's zoom if they're already zoomed in closer.
      map.flyTo([loc.latitude, loc.longitude], Math.max(map.getZoom(), 7), { duration: 0.8 });
    });

    recenter = { map, bar, button, location: null };
    return bar;
  };
  control.addTo(map);
}

function updateRecenterControl(location) {
  if (!recenter) return;
  recenter.location = location;
  const label = `Center on ${location.name ? location.name.split(",")[0] : "your location"}`;
  recenter.button.title = label;
  recenter.button.setAttribute("aria-label", label);
  recenter.bar.hidden = false;
}

// Full-screen button (under the zoom buttons). Expands the whole map panel so the
// layer toggles and legends come along. Browsers without the Fullscreen API for
// elements (iPhone Safari) get a "fill the window" fallback instead.
function addFullscreenControl(map) {
  const panel = map.getContainer().closest(".map-panel");
  if (!panel) return;

  const isFullscreen = () => document.fullscreenElement === panel || panel.classList.contains("is-fullscreen");

  const setWindowFill = (on) => {
    panel.classList.toggle("is-fullscreen", on);
    document.body.classList.toggle("map-fullscreen-open", on);
    update();
  };

  let button;
  function update() {
    if (!button) return;
    const on = isFullscreen();
    button.innerHTML = icon(on ? "minimize" : "maximize");
    button.title = on ? "Exit full screen" : "Full screen";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(on));
    requestAnimationFrame(() => map.invalidateSize());
  }

  function toggle() {
    if (isFullscreen()) {
      if (document.fullscreenElement) document.exitFullscreen();
      else setWindowFill(false);
    } else if (panel.requestFullscreen) {
      panel.requestFullscreen().catch(() => setWindowFill(true));
    } else {
      setWindowFill(true);
    }
  }

  const control = L.control({ position: "topleft" });
  control.onAdd = () => {
    const bar = L.DomUtil.create("div", "leaflet-bar");
    button = L.DomUtil.create("a", "map-icon-btn map-fullscreen-btn", bar);
    button.href = "#";
    button.setAttribute("role", "button");
    L.DomEvent.disableClickPropagation(bar);
    L.DomEvent.on(button, "click", (e) => {
      L.DomEvent.preventDefault(e);
      toggle();
    });
    update();
    return bar;
  };
  control.addTo(map);

  document.addEventListener("fullscreenchange", update);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-fullscreen")) setWindowFill(false);
  });
}

// A small "you are here" dot used on every map.
function locationMarker(latLng, label) {
  return L.circleMarker(latLng, {
    radius: 7,
    color: "#ffffff",
    weight: 3,
    fillColor: "#134b70",
    fillOpacity: 1,
  }).bindTooltip(escapeHtml(label), { direction: "top", offset: [0, -8] });
}

function popupHtml(title, rows) {
  const items = rows
    .filter(([, value]) => value != null && value !== "")
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
  return `<div class="popup-title">${escapeHtml(title)}</div><dl class="popup-grid">${items}</dl>`;
}

// ==========================================================================
// Saved location (shared across pages via localStorage)
// ==========================================================================
function saveLocation(location) {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch (e) {
    console.warn("Could not save location:", e);
  }
}

function loadSavedLocation() {
  try {
    const location = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY));
    if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      return location;
    }
  } catch (e) {
    console.warn("Saved location unavailable:", e);
  }
  return null;
}

// ==========================================================================
// Location panel: search, "use my location", current selection
// Every page calls onLocation(location, source) with source "gps" | "search" | "saved".
// ==========================================================================
function setLocationStatus(message, isError = false) {
  const el = $("locStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = !message;
}

function showLocation(location) {
  const coords = `${location.latitude.toFixed(3)}°, ${location.longitude.toFixed(3)}°`;
  const accuracy = location.accuracy_meters ? ` · ±${formatNumber(location.accuracy_meters)} m` : "";

  setText("locName", location.name || "Your current location");
  setText("locResult", coords + accuracy);
  $("locCard")?.classList.remove("is-empty");
}

function selectLocation(location, source, onLocation) {
  if (source !== "saved") {
    saveLocation(location);
    updateAlertBadge(location);
  }
  updateRecenterControl(location);
  showLocation(location);
  setLocationStatus("");
  onLocation(location, source);
}

function restoreSavedLocation(onLocation) {
  const location = loadSavedLocation();
  if (location) selectLocation(location, "saved", onLocation);
}

const GEOLOCATION_ERRORS = {
  1: "Location permission was denied. Search for a city instead.",
  2: "Your position couldn't be determined. Try searching for a city.",
  3: "Finding your location timed out. Try again or search for a city.",
};

function setupLocationButton(onLocation) {
  const button = $("btnLocation");
  if (!button) return;

  button.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("Geolocation isn't supported in this browser.", true);
      return;
    }

    button.disabled = true;
    setLocationStatus("Requesting location permission…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        button.disabled = false;
        const { latitude, longitude, accuracy } = position.coords;
        selectLocation(
          {
            latitude,
            longitude,
            accuracy_meters: Math.round(accuracy),
            timestamp: new Date(position.timestamp).toISOString(),
          },
          "gps",
          onLocation
        );
      },
      (err) => {
        button.disabled = false;
        setLocationStatus(GEOLOCATION_ERRORS[err.code] || `Location error: ${err.message}`, true);
        console.error("Geolocation error:", err);
      },
      { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
    );
  });
}

async function searchCities(query) {
  const params = new URLSearchParams({ name: query, count: 8, language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

function setupCitySearch(onLocation) {
  const input = $("cityInput");
  const button = $("btnCitySearch");
  const results = $("cityResults");
  if (!input || !button || !results) return;

  const showMessage = (msg) => {
    results.innerHTML = `<p class="results-message">${escapeHtml(msg)}</p>`;
  };

  async function search() {
    const query = input.value.trim();
    if (!query) return;

    showMessage("Searching…");
    try {
      const places = await searchCities(query);
      if (places.length === 0) {
        showMessage(`No places found for “${query}”.`);
        return;
      }

      results.replaceChildren(
        ...places.map((place) => {
          const name = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
          const item = document.createElement("button");
          item.type = "button";
          item.className = "result";
          item.innerHTML =
            `<span class="result-name">${escapeHtml(place.name)}</span>` +
            `<span class="result-meta">${escapeHtml([place.admin1, place.country].filter(Boolean).join(", "))}` +
            ` · ${place.latitude.toFixed(2)}°, ${place.longitude.toFixed(2)}°</span>`;

          item.addEventListener("click", () => {
            results.replaceChildren();
            input.value = "";
            selectLocation(
              { latitude: place.latitude, longitude: place.longitude, timestamp: new Date().toISOString(), name },
              "search",
              onLocation
            );
          });
          return item;
        })
      );
    } catch (e) {
      showMessage(`Search failed: ${e.message}`);
      console.error(e);
    }
  }

  button.addEventListener("click", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") search();
    if (e.key === "Escape") results.replaceChildren();
  });
}

// ==========================================================================
// NWS alerts for a single point (api.weather.gov, US only)
// Shared by the nav badge and the Severe Weather page; cached for 5 minutes
// per point so moving between pages doesn't re-query the weather service.
// ==========================================================================
const ALERT_LEVELS = {
  W: { label: "Warning", color: "#d03b3b", rank: 3 },
  A: { label: "Watch", color: "#ec835a", rank: 2 },
  Y: { label: "Advisory", color: "#fab219", rank: 1 },
  S: { label: "Statement", color: "#7a8699", rank: 0 },
};

// api.weather.gov alerts don't carry a significance code, so infer it from the event name.
function alertLevelFromEvent(event = "") {
  if (/warning$/i.test(event)) return ALERT_LEVELS.W;
  if (/watch$/i.test(event)) return ALERT_LEVELS.A;
  if (/advisory$/i.test(event)) return ALERT_LEVELS.Y;
  return ALERT_LEVELS.S;
}

const POINT_ALERTS_TTL_MS = 5 * 60 * 1000;

// Resolves to { outsideUS, alerts: [{ event, headline, description, instruction, ends, expires, senderName }] }.
async function fetchPointAlerts(location) {
  const point = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
  const cacheKey = `alerts:${point}`;

  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    if (cached && Date.now() - cached.time < POINT_ALERTS_TTL_MS) return cached.result;
  } catch {
    /* storage unavailable: just fetch */
  }

  const res = await fetch(`https://api.weather.gov/alerts/active?point=${point}`);
  let result;
  if (res.status === 400 || res.status === 404) {
    result = { outsideUS: true, alerts: [] }; // the API rejects points outside the US
  } else {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    result = {
      outsideUS: false,
      alerts: data.features.map(({ properties: p }) => ({
        event: p.event,
        headline: p.headline,
        description: p.description,
        instruction: p.instruction,
        ends: p.ends,
        expires: p.expires,
        senderName: p.senderName,
      })),
    };
  }

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), result }));
  } catch {
    /* storage full or blocked: skip caching */
  }
  return result;
}

// Dot on the Severe Weather tab when the saved location has an active warning (red) or watch (orange).
let alertBadgeRequest = 0;

async function updateAlertBadge(location = loadSavedLocation()) {
  const tab = document.querySelector('.tab[href="severe.html"]');
  if (!tab) return;

  const request = ++alertBadgeRequest;
  const clear = () => tab.querySelectorAll(".tab-badge, .tab-badge-label").forEach((el) => el.remove());
  if (!location) return clear();

  try {
    const { alerts } = await fetchPointAlerts(location);
    if (request !== alertBadgeRequest) return; // a newer location was picked meanwhile
    clear();

    const serious = alerts.map((a) => alertLevelFromEvent(a.event)).filter((level) => level.rank >= 2);
    if (serious.length === 0) return;

    const top = serious.reduce((a, b) => (b.rank > a.rank ? b : a));
    const place = location.name ? location.name.split(",")[0] : "your location";
    const summary = `${serious.length} active ${serious.length === 1 ? "alert" : "alerts"} for ${place}`;

    const badge = document.createElement("span");
    badge.className = "tab-badge";
    badge.style.background = top.color;
    badge.title = summary;

    const label = document.createElement("span");
    label.className = "tab-badge-label visually-hidden";
    label.textContent = ` (${summary})`;

    tab.append(badge, label);
  } catch (e) {
    console.warn("Alert badge unavailable:", e);
  }
}

updateAlertBadge();

// Wire the whole location panel. Pass { restore: false } to restore the saved
// location yourself later (e.g. after other data has loaded).
function setupLocationPanel(onLocation, { restore = true } = {}) {
  setupLocationButton(onLocation);
  setupCitySearch(onLocation);
  if (restore) restoreSavedLocation(onLocation);
}
