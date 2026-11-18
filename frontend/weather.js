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
// Map overlays: RainViewer radar + NASA GIBS GOES-East satellite, animated together
// --------------------------------------------------------------------------
// One timeline (the radar frame times, past ~2 hours every 10 min) drives both
// layers. Every frame of a layer that's switched on sits on the map with only the
// current one visible, so playback never waits for tiles.
// ==========================================================================
const RADAR_OPACITY = 0.7;
const SATELLITE_OPACITY = 0.75;
const FRAME_MS = 500;
const LAST_FRAME_HOLD_MS = 1500; // pause on "now" before looping
const SATELLITE_STEP_MIN = 20; // satellite tiles are large, so use every other 10-min frame

const anim = { times: [], index: 0, timer: null }; // timeline in ms
const radar = { layers: [], on: false };
const satellite = { times: [], layers: [], forStep: [], on: false }; // forStep[i] -> satellite layer for step i

const clockTime = (date) => date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const GOES_LAYER = "GOES-East_ABI_GeoColor";
const GOES_MATRIX = "GoogleMapsCompatible_Level7";

async function loadRadarFrames() {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error(`RainViewer HTTP ${res.status}`);
  const data = await res.json();

  const frames = data.radar?.past || [];
  if (frames.length === 0) throw new Error("no radar frames");

  anim.times = frames.map((f) => f.time * 1000);
  // Free RainViewer tiles stop at zoom 7; Leaflet scales them up beyond that.
  radar.layers = frames.map((frame) =>
    L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0,
      zIndex: 3, // above the satellite layer
      maxNativeZoom: 7,
      maxZoom: 19,
      attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
    })
  );
}

// GOES-East frames are every 10 minutes but arrive 30–60 min late and occasionally
// go missing, so ask GIBS which frames exist (DescribeDomains) instead of guessing.
async function availableSatelliteTimes(hours) {
  const iso = (date) => date.toISOString().slice(0, 19) + "Z";
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const res = await fetch(`${GIBS}/1.0.0/${GOES_LAYER}/default/${GOES_MATRIX}/all/${iso(from)}--${iso(now)}.xml`);
  if (!res.ok) throw new Error(`GIBS HTTP ${res.status}`);

  // <Domain> holds comma-separated "start/end/PT10M" ranges or single times.
  const domain = (await res.text()).match(/<Domain>([^<]+)<\/Domain>/)?.[1];
  if (!domain) throw new Error("no satellite frames");

  const times = [];
  for (const part of domain.split(",")) {
    const [start, end, period] = part.split("/");
    if (!end) {
      times.push(Date.parse(start));
      continue;
    }
    const stepMs = (Number(period?.match(/PT(\d+)M/)?.[1]) || 10) * 60 * 1000;
    for (let t = Date.parse(start); t <= Date.parse(end); t += stepMs) times.push(t);
  }
  return times.sort((a, b) => a - b);
}

async function loadSatelliteFrames() {
  const available = await availableSatelliteTimes(4);
  if (available.length === 0) throw new Error("no satellite frames");
  const onStep = (t) => new Date(t).getUTCMinutes() % SATELLITE_STEP_MIN === 0;

  // Without radar, the satellite frames from the last 2 hours become the timeline.
  if (anim.times.length === 0) {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    anim.times = available.filter((t) => t >= cutoff && onStep(t));
    if (anim.times.length === 0) anim.times = [available[available.length - 1]];
  }

  // Pair each step with the latest 20-minute frame at or before it; fall back to
  // any available frame when a 20-minute one is missing.
  const thinned = available.filter(onStep);
  const latestAtOrBefore = (list, t) => {
    let best = null;
    for (const s of list) if (s <= t) best = s;
    return best;
  };
  const picks = anim.times.map(
    (t) => latestAtOrBefore(thinned, t) ?? latestAtOrBefore(available, t) ?? thinned[0] ?? available[0]
  );

  satellite.times = [...new Set(picks)];
  satellite.forStep = picks.map((t) => satellite.times.indexOf(t));
  satellite.layers = satellite.times.map((t) =>
    L.tileLayer(
      `${GIBS}/${GOES_LAYER}/default/${new Date(t).toISOString().slice(0, 19)}Z/${GOES_MATRIX}/{z}/{y}/{x}.png`,
      {
        opacity: 0,
        zIndex: 2, // above the basemap, below radar
        maxNativeZoom: 7,
        maxZoom: 19,
        attribution: '<a href="https://www.earthdata.nasa.gov/gibs">NASA GIBS</a> / NOAA GOES-East',
      }
    )
  );
}

// Show timeline step i on every layer that's switched on.
function showStep(i) {
  anim.index = i;
  radar.layers.forEach((layer, j) => layer.setOpacity(radar.on && j === i ? RADAR_OPACITY : 0));
  satellite.layers.forEach((layer, j) =>
    layer.setOpacity(satellite.on && j === satellite.forStep[i] ? SATELLITE_OPACITY : 0)
  );

  const slider = $("radarSlider");
  if (slider) slider.value = String(i);

  const stepTime = clockTime(new Date(anim.times[i]));
  const latest = i === anim.times.length - 1 ? " · latest" : "";
  const satTime = satellite.layers.length ? clockTime(new Date(satellite.times[satellite.forStep[i]])) : null;

  let label = `${stepTime}${latest}`;
  if (satellite.on && satTime) label = radar.on ? `Radar ${stepTime} · Satellite ${satTime}` : `Satellite ${satTime}`;
  setText("radarTime", label);
}

function setPlaying(playing) {
  clearTimeout(anim.timer);
  anim.timer = null;

  const button = $("btnRadarPlay");
  if (button) {
    button.innerHTML = icon(playing ? "pause" : "play");
    button.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
    button.title = button.getAttribute("aria-label");
  }
  if (!playing) return;

  const step = () => {
    const next = (anim.index + 1) % anim.times.length;
    showStep(next);
    anim.timer = setTimeout(step, next === anim.times.length - 1 ? LAST_FRAME_HOLD_MS : FRAME_MS);
  };
  anim.timer = setTimeout(step, FRAME_MS);
}

// The player (bottom-left card) is greyed out unless radar or satellite is on.
function refreshPlayer() {
  const enabled = radar.on || satellite.on;
  if (!enabled) setPlaying(false);
  $("radarPlayer")?.classList.toggle("is-disabled", !enabled);
  for (const id of ["btnRadarPlay", "radarSlider"]) {
    const el = $(id);
    if (el) el.disabled = !enabled;
  }
  showStep(anim.index);
}

function setLayerOn(group, on) {
  group.on = on;
  group.layers.forEach((layer) => (on ? layer.addTo(map) : map.removeLayer(layer)));
  refreshPlayer();
}

function setupAnimationControls() {
  const slider = $("radarSlider");
  if (slider) {
    slider.max = String(anim.times.length - 1);
    slider.addEventListener("input", () => {
      setPlaying(false);
      showStep(Number(slider.value));
    });
  }
  $("btnRadarPlay")?.addEventListener("click", () => setPlaying(anim.timer === null));
  setPlaying(false); // draw the play icon

  anim.index = anim.times.length - 1;
  refreshPlayer();
  const player = $("radarPlayer");
  if (player) player.hidden = false;
}

function enableToggle(id, group) {
  const toggle = $(id);
  if (!toggle || group.layers.length === 0) return;
  toggle.disabled = false;
  toggle.addEventListener("change", () => setLayerOn(group, toggle.checked));
}

async function setupOverlays() {
  const notes = [];

  try {
    await loadRadarFrames();
    notes.push("Radar and satellite cover the past 2 hours");
  } catch (e) {
    console.error("Radar unavailable:", e);
    notes.push("Radar unavailable");
  }

  try {
    await loadSatelliteFrames();
    notes.push("satellite runs 30–60 min behind (Americas only)");
  } catch (e) {
    console.error("Satellite imagery unavailable:", e);
    notes.push("satellite unavailable");
  }

  if (anim.times.length) {
    setupAnimationControls();
    enableToggle("toggleRadar", radar);
    enableToggle("toggleClouds", satellite);
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
