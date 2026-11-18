// air.js — Air quality page. Requires common.js and charts.js.

let map;
let marker = null;

// ==========================================================================
// US AQI categories (EPA breakpoints; colours tuned slightly for legibility)
// ==========================================================================
const AQI_LEVELS = [
  {
    max: 50,
    label: "Good",
    color: "#34b44a",
    advice: "Air quality is satisfactory, and air pollution poses little or no risk.",
  },
  {
    max: 100,
    label: "Moderate",
    color: "#f2cc0c",
    advice: "Air quality is acceptable. Unusually sensitive people should consider limiting prolonged outdoor exertion.",
  },
  {
    max: 150,
    label: "Unhealthy for sensitive groups",
    color: "#ff8a1f",
    advice: "People with heart or lung disease, older adults, children and teens may experience health effects.",
  },
  {
    max: 200,
    label: "Unhealthy",
    color: "#e8352e",
    advice: "Some members of the general public may experience health effects; sensitive groups may be more seriously affected.",
  },
  {
    max: 300,
    label: "Very unhealthy",
    color: "#8f3f97",
    advice: "Health alert: the risk of health effects is increased for everyone.",
  },
  {
    max: 500,
    label: "Hazardous",
    color: "#7e0023",
    advice: "Health warning of emergency conditions: everyone is more likely to be affected.",
  },
];

const UNKNOWN_LEVEL = { label: "Unknown", color: "#a0a8b5", advice: "No air quality reading is available here." };

function aqiLevel(aqi) {
  if (aqi == null) return UNKNOWN_LEVEL;
  return AQI_LEVELS.find((level) => aqi <= level.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

// Position (0–100%) on a scale where each category gets an equal-width segment.
function aqiScalePosition(aqi) {
  const index = AQI_LEVELS.findIndex((level) => aqi <= level.max);
  const i = index === -1 ? AQI_LEVELS.length - 1 : index;
  const lo = i === 0 ? 0 : AQI_LEVELS[i - 1].max;
  const hi = AQI_LEVELS[i].max;
  const within = Math.min(Math.max((aqi - lo) / (hi - lo), 0), 1);
  return ((i + within) / AQI_LEVELS.length) * 100;
}

const POLLUTANTS = [
  ["pm2_5", "PM2.5", "Fine particles"],
  ["pm10", "PM10", "Coarse particles"],
  ["ozone", "O₃", "Ozone"],
  ["nitrogen_dioxide", "NO₂", "Nitrogen dioxide"],
  ["sulphur_dioxide", "SO₂", "Sulfur dioxide"],
  ["carbon_monoxide", "CO", "Carbon monoxide"],
];

// ==========================================================================
// Rendering
// ==========================================================================
function renderAqi(aqi, current) {
  const level = aqiLevel(aqi);
  const scale = AQI_LEVELS.map((l) => `<span style="background:${l.color}" title="${escapeHtml(l.label)}"></span>`).join("");

  setHtml(
    "aqiOut",
    `
    <div class="hero">
      ${icon("gauge")}
      <div>
        <div class="hero-value">${aqi ?? "—"}<small> AQI</small></div>
        <div class="hero-label"><span class="pill"><span class="swatch" style="background:${level.color}"></span>${escapeHtml(level.label)}</span></div>
      </div>
    </div>
    <div class="aqi-scale" aria-hidden="true">${scale}</div>
    <div class="aqi-track" aria-hidden="true">
      ${aqi != null ? `<span class="aqi-marker" style="left:${aqiScalePosition(aqi)}%"></span>` : ""}
    </div>
    <div class="aqi-ticks" aria-hidden="true"><span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span><span>500</span></div>
    <p class="health">${escapeHtml(level.advice)}</p>
    <p class="updated">US AQI · Updated ${current.time ? formatClock(current.time) : "—"} local time</p>
  `
  );
}

function renderPollutants(current) {
  const tiles = POLLUTANTS.map(
    ([key, symbol, name]) => `
      <div class="stat">
        <div class="stat-label">${symbol}</div>
        <div class="stat-value">${formatNumber(current[key], 1)}<span class="stat-unit">µg/m³</span></div>
        <div class="stat-note">${name}</div>
      </div>`
  );
  setHtml("pollutantsOut", `<div class="stat-grid pollutants">${tiles.join("")}</div>`);
}

function renderForecast(data) {
  const { current, hourly } = data;
  const container = $("aqiChart");
  if (!container) return;

  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time));
  const points = hourly.time
    .slice(start, start + 24)
    .map((time, k) => ({ time, label: formatHour(time), value: hourly.us_aqi[start + k] }))
    .filter((d) => d.value != null);

  if (points.length === 0) {
    container.innerHTML = emptyState("gauge", "No hourly forecast available for this location.");
    return;
  }

  const peak = Math.max(...points.map((d) => d.value));
  const yMax = Math.max(100, Math.ceil(peak / 50) * 50);
  const yTicks = [];
  for (let t = 0; t <= yMax; t += 50) yTicks.push(t);

  mountChart(container, {
    type: "bar",
    data: points,
    yMax,
    yTicks,
    colorFor: (v) => aqiLevel(v).color,
    formatValue: (v) => `AQI ${v} · ${aqiLevel(v).label}`,
    formatNote: (d) => formatLocalTime(d.time, { weekday: "short", hour: "numeric" }),
    labelEvery: 4,
    ariaLabel: `Hourly US AQI forecast for the next ${points.length} hours, peaking at ${peak}.`,
  });
}

function showOnMap(lat, lon, label, aqi) {
  const level = aqiLevel(aqi);
  if (marker) marker.remove();

  marker = L.circleMarker([lat, lon], {
    radius: 14,
    fillColor: level.color,
    fillOpacity: 0.95,
    color: "#ffffff",
    weight: 3,
  })
    .addTo(map)
    .bindPopup(popupHtml(label, [["US AQI", aqi ?? "n/a"], ["Category", level.label]]))
    .openPopup();

  map.setView([lat, lon], 9);
}

// ==========================================================================
// Open-Meteo air quality
// ==========================================================================
async function fetchAirQuality(lat, lon, label) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide",
    hourly: "us_aqi",
    forecast_days: 2,
    timezone: "auto",
  });

  setHtml("aqiOut", emptyState("clock", "Loading air quality…"));

  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const current = data.current || {};
    const aqi = Number.isFinite(current.us_aqi) ? Math.round(current.us_aqi) : null;

    renderAqi(aqi, current);
    renderPollutants(current);
    renderForecast(data);
    showOnMap(lat, lon, label, aqi);
  } catch (e) {
    console.error(e);
    setHtml("aqiOut", emptyState("alert", `Couldn't load air quality (${e.message}).`));
  }
}

function useLocation(location) {
  fetchAirQuality(location.latitude, location.longitude, location.name || "Your location");
}

// ==========================================================================
// Page setup
// ==========================================================================
function renderLegend() {
  setHtml(
    "aqiLegend",
    AQI_LEVELS.map(
      (l) => `<div class="legend-row"><span class="swatch" style="background:${l.color}"></span>${escapeHtml(l.label)}</div>`
    ).join("")
  );
}

document.addEventListener("DOMContentLoaded", () => {
  map = createBaseMap({ center: DEFAULT_CENTER, zoom: 6 });
  renderLegend();
  setupLocationPanel(useLocation);
});
