// weather.js — Weather page (index.html). Requires common.js.

let map;
let marker = null;

// ==========================================================================
// WMO weather codes -> label + icon
// ==========================================================================
const WEATHER_CODES = {
  0: ["Clear sky", "clear"],
  1: ["Mainly clear", "clear"],
  2: ["Partly cloudy", "partly"],
  3: ["Overcast", "cloud"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "drizzle"],
  53: ["Drizzle", "drizzle"],
  55: ["Heavy drizzle", "drizzle"],
  56: ["Freezing drizzle", "drizzle"],
  57: ["Freezing drizzle", "drizzle"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rain"],
  81: ["Showers", "rain"],
  82: ["Heavy showers", "rain"],
  85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm with hail", "storm"],
  99: ["Thunderstorm with hail", "storm"],
};

function describeWeather(code, isDay = 1) {
  const [label, kind] = WEATHER_CODES[code] || ["Unknown", "cloud"];
  const iconName =
    kind === "clear" ? (isDay ? "sun" : "moon") : kind === "partly" ? (isDay ? "cloud-sun" : "cloud-moon") : kind;
  return { label, icon: iconName };
}

function compassDirection(degrees) {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(degrees / 45) % 8];
}

const deg = (value) => `${Math.round(value)}°`;

// ==========================================================================
// Rendering
// ==========================================================================
function renderCurrent(data) {
  const c = data.current;
  const today = data.daily;
  const sky = describeWeather(c.weather_code, c.is_day);

  setHtml(
    "currentOut",
    `
    <div class="hero">
      ${icon(sky.icon)}
      <div>
        <div class="hero-value">${Math.round(c.temperature_2m)}<small>°F</small></div>
        <div class="hero-label">${escapeHtml(sky.label)}</div>
      </div>
    </div>
    <p class="hero-sub">Feels like ${deg(c.apparent_temperature)} · High ${deg(today.temperature_2m_max[0])} · Low ${deg(today.temperature_2m_min[0])}</p>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-label">${icon("droplet")}Humidity</div>
        <div class="stat-value">${Math.round(c.relative_humidity_2m)}<span class="stat-unit">%</span></div>
        <div class="stat-note">Dew point ${deg(c.dew_point_2m)}</div>
        <div class="stat-note">Feels ${comfortLevel(c.dew_point_2m).toLowerCase()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon("wind")}Wind</div>
        <div class="stat-value">${Math.round(c.wind_speed_10m)}<span class="stat-unit">mph ${compassDirection(c.wind_direction_10m)}</span></div>
        <div class="stat-note">Gusts ${Math.round(c.wind_gusts_10m)} mph</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon("rain")}Precipitation</div>
        <div class="stat-value">${formatNumber(c.precipitation, 2)}<span class="stat-unit">in</span></div>
        <div class="stat-note">Today ${formatNumber(today.precipitation_sum[0], 2)} in</div>
      </div>
      <div class="stat">
        <div class="stat-label">${icon("sun")}Daylight</div>
        <div class="stat-value">${formatClock(today.sunrise[0])}</div>
        <div class="stat-note">Sunset ${formatClock(today.sunset[0])}</div>
      </div>
    </div>
    <p class="updated">Updated ${formatClock(c.time)} local time · ${data.latitude.toFixed(2)}°, ${data.longitude.toFixed(2)}°</p>
  `
  );
}

function renderHourly(data) {
  const { current, hourly } = data;

  // Hourly data starts at local midnight; begin at the first hour at or after now.
  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time));
  const hours = hourly.time.slice(start, start + 24).map((time, k) => {
    const i = start + k;
    const sky = describeWeather(hourly.weather_code[i], hourly.is_day[i]);
    const pop = hourly.precipitation_probability[i] ?? 0;
    return `
      <li class="hour" title="${escapeHtml(sky.label)} · Humidity ${hourly.relative_humidity_2m[i]}% · Precip ${hourly.precipitation[i]} in">
        <span class="hour-time">${formatHour(time)}</span>
        ${icon(sky.icon)}
        <span class="hour-temp">${deg(hourly.temperature_2m[i])}</span>
        <span class="hour-pop ${pop === 0 ? "dry" : ""}">${icon("droplet")}${pop}%</span>
      </li>`;
  });

  setHtml("hourlyOut", `<ol class="hourly">${hours.join("")}</ol>`);
}

function renderDaily(data) {
  const d = data.daily;
  const weekMin = Math.min(...d.temperature_2m_min);
  const weekMax = Math.max(...d.temperature_2m_max);
  const span = Math.max(weekMax - weekMin, 1);

  const rows = d.time.map((date, i) => {
    const sky = describeWeather(d.weather_code[i], 1);
    const pop = d.precipitation_probability_max[i] ?? 0;
    const left = ((d.temperature_2m_min[i] - weekMin) / span) * 100;
    const width = ((d.temperature_2m_max[i] - d.temperature_2m_min[i]) / span) * 100;
    const name = i === 0 ? "Today" : formatLocalTime(date, { weekday: "short" });

    return `
      <li class="day" title="${escapeHtml(sky.label)} · ${formatNumber(d.precipitation_sum[i], 2)} in">
        <span class="day-name">${name}</span>
        ${icon(sky.icon)}
        <span class="day-pop ${pop === 0 ? "dry" : ""}">${pop}%</span>
        <span class="day-low">${deg(d.temperature_2m_min[i])}</span>
        <span class="range"><span style="left:${left}%;width:${Math.max(width, 2)}%"></span></span>
        <span class="day-high">${deg(d.temperature_2m_max[i])}</span>
      </li>`;
  });

  setHtml("dailyOut", `<ol class="daily">${rows.join("")}</ol>`);
}

// ==========================================================================
// Open-Meteo forecast
// ==========================================================================
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,is_day," +
      "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly:
      "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,weather_code,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset",
    forecast_days: 7,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
  });

  setHtml("currentOut", emptyState("clock", "Loading the latest conditions…"));

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderCurrent(data);
    renderHourly(data);
    renderDaily(data);
    renderHumidityChart(data);
  } catch (e) {
    setHtml("currentOut", emptyState("alert", `Couldn't load the weather (${e.message}).`));
    console.error(e);
  }
}

// ==========================================================================
// Humidity: comfort level, 24-hour chart and the regional grid map layer
// ==========================================================================
// How the air feels, based on dew point (°F).
function comfortLevel(dewPointF) {
  if (dewPointF < 40) return "Dry";
  if (dewPointF < 55) return "Comfortable";
  if (dewPointF < 60) return "Slightly humid";
  if (dewPointF < 65) return "Humid";
  if (dewPointF < 70) return "Muggy";
  return "Oppressive";
}

function renderHumidityChart(data) {
  const { current, hourly } = data;
  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time));
  const points = hourly.time.slice(start, start + 24).map((time, k) => ({
    time,
    label: formatHour(time),
    value: hourly.relative_humidity_2m[start + k],
    dewPoint: hourly.dew_point_2m[start + k],
  }));

  const values = points.map((d) => d.value);
  setText("humiditySub", `Relative humidity ranges from ${Math.min(...values)}% to ${Math.max(...values)}% over the next 24 hours`);

  mountChart($("humidityChart"), {
    type: "line",
    data: points,
    yMax: 100,
    yTicks: [0, 25, 50, 75, 100],
    formatValue: (v) => `${v}% humidity`,
    formatNote: (d) =>
      `${formatLocalTime(d.time, { weekday: "short", hour: "numeric" })} · dew point ${Math.round(d.dewPoint)}°F, feels ${comfortLevel(d.dewPoint).toLowerCase()}`,
    labelEvery: 3,
    ariaLabel: `Relative humidity for the next 24 hours, between ${Math.min(...values)} and ${Math.max(...values)} percent.`,
  });
}

// Regional grid: GRID_SIZE × GRID_SIZE points GRID_STEP degrees apart, one Open-Meteo request.
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

let humidityGrid = null;
let currentLocation = null;

async function loadHumidityGrid(location) {
  const half = (GRID_SIZE - 1) / 2;
  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      cells.push({ lat: location.latitude + (row - half) * GRID_STEP, lon: location.longitude + (col - half) * GRID_STEP });
    }
  }

  const params = new URLSearchParams({
    latitude: cells.map((c) => c.lat.toFixed(3)).join(","),
    longitude: cells.map((c) => c.lon.toFixed(3)).join(","),
    current: "relative_humidity_2m",
  });

  setText("humidityNote", "Loading regional humidity…");
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();
    if (!$("toggleHumidity")?.checked) return; // switched off while loading

    humidityGrid?.remove();
    humidityGrid = L.layerGroup(
      cells.map((cell, i) => {
        const rh = results[i]?.current?.relative_humidity_2m;
        const d = GRID_STEP / 2;
        return L.rectangle(
          [
            [cell.lat - d, cell.lon - d],
            [cell.lat + d, cell.lon + d],
          ],
          { color: "#ffffff", weight: 1, fillColor: rh == null ? "#a0a8b5" : humidityColor(rh), fillOpacity: 0.6 }
        ).bindTooltip(rh == null ? "No data" : `${rh}% humidity`, { sticky: true, className: "cell-tip" });
      })
    ).addTo(map);
    marker?.bringToFront();

    // Zoom so the whole grid is visible.
    const extent = (half + 0.5) * GRID_STEP;
    map.fitBounds(
      [
        [location.latitude - extent, location.longitude - extent],
        [location.latitude + extent, location.longitude + extent],
      ],
      { padding: [20, 20] }
    );
    setText("humidityNote", `${GRID_SIZE}×${GRID_SIZE} points, ~${Math.round(GRID_STEP * 69)} mi apart.`);
  } catch (e) {
    console.error(e);
    setText("humidityNote", `Regional humidity unavailable (${e.message}).`);
  }
}

function setupHumidityLayer() {
  const toggle = $("toggleHumidity");
  const card = $("humidityLegendCard");
  if (!toggle) return;

  // Stepped legend: one block per bin, labelled with its lower bound.
  const labels = ["<30", "30", "40", "50", "60", "70", "80+"];
  setHtml(
    "humidityLegend",
    `<div class="legend-steps">${HUMIDITY_BINS.map((b) => `<span style="background:${b.color}"></span>`).join("")}</div>
     <div class="legend-steps labels">${labels.map((l) => `<span>${escapeHtml(l)}</span>`).join("")}</div>`
  );

  toggle.addEventListener("change", () => {
    if (card) card.hidden = !toggle.checked;
    if (!toggle.checked) {
      humidityGrid?.remove();
      humidityGrid = null;
      return;
    }
    if (currentLocation) loadHumidityGrid(currentLocation);
    else setText("humidityNote", "Pick a location to map humidity around it.");
  });
}

function useLocation(location, source) {
  currentLocation = location;
  if ($("toggleHumidity")?.checked) loadHumidityGrid(location);
  const latLng = [location.latitude, location.longitude];
  const label = location.name || "Your location";

  map.setView(latLng, source === "saved" ? 8 : 9);
  if (marker) marker.remove();
  marker = locationMarker(latLng, label).addTo(map);

  setText("currentPlace", label);
  fetchWeather(location.latitude, location.longitude);
}

// ==========================================================================
// Map overlays: RainViewer radar + NASA GIBS GOES-East satellite imagery
// ==========================================================================
// --------------------------------------------------------------------------
// Animated radar: one tile layer per RainViewer frame (past ~2 hours, every 10 min).
// All frames are on the map while radar is on; only the current one is visible,
// so playback never waits for tiles.
// --------------------------------------------------------------------------
const RADAR_OPACITY = 0.7;
const FRAME_MS = 500;
const LAST_FRAME_HOLD_MS = 1500; // pause on "now" before looping

const radar = { frames: [], layers: [], index: 0, timer: null };

const clockTime = (date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

async function loadRadarFrames() {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error(`RainViewer HTTP ${res.status}`);
  const data = await res.json();

  radar.frames = data.radar?.past || [];
  if (radar.frames.length === 0) throw new Error("no radar frames");

  // Free RainViewer tiles stop at zoom 7; Leaflet scales them up beyond that.
  radar.layers = radar.frames.map((frame) =>
    L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0,
      zIndex: 3, // above the satellite layer
      maxNativeZoom: 7,
      maxZoom: 19,
      attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
    })
  );
  radar.index = radar.frames.length - 1;
}

function showRadarFrame(i) {
  radar.layers[radar.index]?.setOpacity(0);
  radar.index = i;
  radar.layers[i].setOpacity(RADAR_OPACITY);

  const last = radar.frames.length - 1;
  const slider = $("radarSlider");
  if (slider) slider.value = String(i);
  const time = clockTime(new Date(radar.frames[i].time * 1000));
  setText("radarTime", i === last ? `${time} · latest` : time);
}

function setRadarPlaying(playing) {
  clearTimeout(radar.timer);
  radar.timer = null;

  const button = $("btnRadarPlay");
  if (button) {
    button.innerHTML = icon(playing ? "pause" : "play");
    button.setAttribute("aria-label", playing ? "Pause radar animation" : "Play radar animation");
    button.title = button.getAttribute("aria-label");
  }
  if (!playing) return;

  const step = () => {
    const next = (radar.index + 1) % radar.frames.length;
    showRadarFrame(next);
    radar.timer = setTimeout(step, next === radar.frames.length - 1 ? LAST_FRAME_HOLD_MS : FRAME_MS);
  };
  radar.timer = setTimeout(step, FRAME_MS);
}

function setRadarVisible(visible) {
  if (visible) {
    radar.layers.forEach((layer) => layer.addTo(map));
    showRadarFrame(radar.index);
  } else {
    setRadarPlaying(false);
    radar.layers.forEach((layer) => map.removeLayer(layer));
  }
}

// The player is always shown once frames load; using it switches radar on.
function ensureRadarOn() {
  const toggle = $("toggleRadar");
  if (toggle && !toggle.checked) {
    toggle.checked = true;
    setRadarVisible(true);
  }
}

function setupRadarControls() {
  const toggle = $("toggleRadar");
  const slider = $("radarSlider");
  const button = $("btnRadarPlay");

  if (slider) {
    slider.max = String(radar.frames.length - 1);
    slider.addEventListener("input", () => {
      ensureRadarOn();
      setRadarPlaying(false);
      showRadarFrame(Number(slider.value));
    });
  }
  button?.addEventListener("click", () => {
    ensureRadarOn();
    setRadarPlaying(radar.timer === null);
  });
  setRadarPlaying(false); // draw the play icon
  showRadarFrame(radar.index); // label the slider with the latest frame time
  radar.layers[radar.index].setOpacity(0); // ...but stay invisible until radar is on

  if (toggle) {
    toggle.disabled = false;
    toggle.addEventListener("change", () => setRadarVisible(toggle.checked));
  }
  const player = $("radarPlayer");
  if (player) player.hidden = false;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const GOES_LAYER = "GOES-East_ABI_GeoColor";
const GOES_MATRIX = "GoogleMapsCompatible_Level7";

// GOES-East frames are every 10 minutes but arrive late and occasionally go missing,
// so ask GIBS which frames exist (DescribeDomains) and use the newest one.
async function latestSatelliteTime() {
  const iso = (date) => date.toISOString().slice(0, 19) + "Z";
  const now = new Date();
  const from = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const res = await fetch(`${GIBS}/1.0.0/${GOES_LAYER}/default/${GOES_MATRIX}/all/${iso(from)}--${iso(now)}.xml`);
  if (!res.ok) throw new Error(`GIBS HTTP ${res.status}`);

  // <Domain> holds comma-separated "start/end/PT10M" ranges or single times.
  const domain = (await res.text()).match(/<Domain>([^<]+)<\/Domain>/)?.[1];
  if (!domain) throw new Error("no satellite frames");
  const parts = domain.split(",").pop().split("/");
  return parts.length > 1 ? parts[1] : parts[0];
}

async function loadSatelliteLayer() {
  const time = await latestSatelliteTime();
  const layer = L.tileLayer(`${GIBS}/${GOES_LAYER}/default/${time}/${GOES_MATRIX}/{z}/{y}/{x}.png`, {
    opacity: 0.75,
    zIndex: 2, // above the basemap, below radar
    maxNativeZoom: 7,
    maxZoom: 19,
    attribution: '<a href="https://www.earthdata.nasa.gov/gibs">NASA GIBS</a> / NOAA GOES-East',
  });
  return { layer, time: new Date(time) };
}

function bindToggle(checkboxId, layer) {
  const checkbox = $(checkboxId);
  if (!checkbox) return;
  checkbox.disabled = false;
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) layer.addTo(map);
    else map.removeLayer(layer);
  });
}

async function setupOverlays() {
  const notes = [];

  try {
    await loadRadarFrames();
    setupRadarControls();
    notes.push("Radar covers the past 2 hours");
  } catch (e) {
    console.error("Radar unavailable:", e);
    notes.push("Radar unavailable");
  }

  try {
    const satellite = await loadSatelliteLayer();
    bindToggle("toggleClouds", satellite.layer);
    notes.push(`satellite ${clockTime(satellite.time)} (Americas)`);
  } catch (e) {
    console.error("Satellite imagery unavailable:", e);
    notes.push("satellite unavailable");
  }

  setText("layerNote", `${notes.join(" · ")}.`);
}

// ==========================================================================
// Page setup
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  map = createBaseMap({ center: DEFAULT_CENTER, zoom: 6, basemap: "streets" });
  setupOverlays();
  setupHumidityLayer();
  setupLocationPanel(useLocation);
});
