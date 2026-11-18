// humidity.js — Humidity page. Requires common.js and charts.js.

let map;
let gridLayer = null;
let userMarker = null;

// Regional grid: GRID_SIZE × GRID_SIZE cells, GRID_STEP degrees apart, centred on the location.
const GRID_SIZE = 7;
const GRID_STEP = 0.3;

// Sequential blue ramp (light = dry, dark = humid).
const HUMIDITY_BINS = [
  { max: 30, color: "#cde2fb" },
  { max: 40, color: "#9ec5f4" },
  { max: 50, color: "#6da7ec" },
  { max: 60, color: "#3987e5" },
  { max: 70, color: "#256abf" },
  { max: 80, color: "#184f95" },
  { max: Infinity, color: "#0d366b" },
];

const humidityColor = (rh) => HUMIDITY_BINS.find((b) => rh < b.max).color;

// How the air feels, based on dew point (°F).
function comfortLevel(dewPointF) {
  if (dewPointF < 40) return "Dry";
  if (dewPointF < 55) return "Comfortable";
  if (dewPointF < 60) return "Slightly humid";
  if (dewPointF < 65) return "Humid";
  if (dewPointF < 70) return "Muggy";
  return "Oppressive";
}

// ==========================================================================
// Current conditions + 24h chart
// ==========================================================================
async function fetchHumidity(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "relative_humidity_2m,dew_point_2m,temperature_2m,apparent_temperature",
    hourly: "relative_humidity_2m,dew_point_2m",
    forecast_days: 2,
    temperature_unit: "fahrenheit",
    timezone: "auto",
  });

  setHtml("humidityOut", emptyState("clock", "Loading humidity…"));

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderCurrent(data.current);
    renderChart(data);
  } catch (e) {
    console.error(e);
    setHtml("humidityOut", emptyState("alert", `Couldn't load humidity (${e.message}).`));
  }
}

function renderCurrent(c) {
  setHtml(
    "humidityOut",
    `
    <div class="hero">
      ${icon("droplet")}
      <div>
        <div class="hero-value">${Math.round(c.relative_humidity_2m)}<small>%</small></div>
        <div class="hero-label">Feels ${comfortLevel(c.dew_point_2m).toLowerCase()}</div>
      </div>
    </div>
    <p class="hero-sub">Relative humidity right now</p>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-label">${icon("droplet")}Dew point</div>
        <div class="stat-value">${Math.round(c.dew_point_2m)}<span class="stat-unit">°F</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon("thermometer")}Temperature</div>
        <div class="stat-value">${Math.round(c.temperature_2m)}<span class="stat-unit">°F</span></div>
        <div class="stat-note">Feels like ${Math.round(c.apparent_temperature)}°F</div>
      </div>
    </div>
    <p class="updated">Updated ${formatClock(c.time)} local time</p>
  `
  );
}

function renderChart(data) {
  const { current, hourly } = data;
  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time));
  const points = hourly.time.slice(start, start + 24).map((time, k) => ({
    time,
    label: formatHour(time),
    value: hourly.relative_humidity_2m[start + k],
    dewPoint: hourly.dew_point_2m[start + k],
  }));

  const values = points.map((d) => d.value);
  setText("chartSub", `Ranges from ${Math.min(...values)}% to ${Math.max(...values)}% over the next 24 hours`);

  mountChart($("humidityChart"), {
    type: "line",
    data: points,
    yMax: 100,
    yTicks: [0, 25, 50, 75, 100],
    formatValue: (v) => `${v}% humidity`,
    formatNote: (d) => `${formatLocalTime(d.time, { weekday: "short", hour: "numeric" })} · dew point ${Math.round(d.dewPoint)}°F`,
    labelEvery: 3,
    ariaLabel: `Relative humidity for the next 24 hours, between ${Math.min(...values)} and ${Math.max(...values)} percent.`,
  });
}

// ==========================================================================
// Regional humidity grid (one Open-Meteo request for every cell)
// ==========================================================================
async function loadGrid(lat, lon) {
  const half = (GRID_SIZE - 1) / 2;
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      cells.push({ lat: lat + (row - half) * GRID_STEP, lon: lon + (col - half) * GRID_STEP });
    }
  }

  const params = new URLSearchParams({
    latitude: cells.map((c) => c.lat.toFixed(3)).join(","),
    longitude: cells.map((c) => c.lon.toFixed(3)).join(","),
    current: "relative_humidity_2m",
  });

  setText("gridStatus", "Loading regional humidity…");

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();

    gridLayer?.remove();
    gridLayer = L.layerGroup(
      cells.map((cell, i) => {
        const rh = results[i]?.current?.relative_humidity_2m;
        const d = GRID_STEP / 2;
        return L.rectangle(
          [
            [cell.lat - d, cell.lon - d],
            [cell.lat + d, cell.lon + d],
          ],
          {
            color: "#ffffff",
            weight: 1,
            fillColor: rh == null ? "#a0a8b5" : humidityColor(rh),
            fillOpacity: 0.6,
          }
        ).bindTooltip(rh == null ? "No data" : `${rh}% humidity`, { sticky: true, className: "cell-tip" });
      })
    ).addTo(map);

    userMarker?.bringToFront();
    setText("gridStatus", `Regional grid · ${GRID_SIZE}×${GRID_SIZE} points, ~${Math.round(GRID_STEP * 69)} mi apart`);
  } catch (e) {
    console.error(e);
    setText("gridStatus", `Regional grid unavailable (${e.message}).`);
  }
}

function useLocation(location) {
  const latLng = [location.latitude, location.longitude];
  const half = ((GRID_SIZE - 1) / 2 + 0.5) * GRID_STEP;

  map.fitBounds(
    [
      [location.latitude - half, location.longitude - half],
      [location.latitude + half, location.longitude + half],
    ],
    { padding: [20, 20] }
  );

  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);

  fetchHumidity(location.latitude, location.longitude);
  loadGrid(location.latitude, location.longitude);
}

// ==========================================================================
// Page setup
// ==========================================================================
function renderLegend() {
  // Stepped ramp: one block per bin, each labelled with its lower bound.
  const labels = ["<30", "30", "40", "50", "60", "70", "80+"];
  setHtml(
    "humidityLegend",
    `<div class="legend-steps">${HUMIDITY_BINS.map((b) => `<span style="background:${b.color}"></span>`).join("")}</div>
     <div class="legend-steps labels">${labels.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}</div>
     <p class="map-card-note">Relative humidity (%)</p>`
  );
}

document.addEventListener("DOMContentLoaded", () => {
  map = createBaseMap({ center: DEFAULT_CENTER, zoom: 7 });
  renderLegend();
  setupLocationPanel(useLocation);
});
