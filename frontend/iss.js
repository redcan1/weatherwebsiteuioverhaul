// iss.js — ISS tracker. Requires common.js and satellite.js (SGP4 orbit propagation).
//
// The orbit (a TLE from CelesTrak) is fetched once; position, ground track and
// passes are then computed in the browser, so there's no polling of an API.

let map;
let satrec = null;
let tleEpoch = null;
let issMarker = null;
let footprint = null;
let trackLayer = null;
let userMarker = null;
let userLocation = null;
let follow = true;
let lastTrackAt = 0;

const EARTH_RADIUS_KM = 6371;
const KM_TO_MI = 0.621371;
const MIN_PASS_ELEVATION = 10; // degrees above the horizon

// ==========================================================================
// Orbit data
// ==========================================================================
async function loadTle() {
  const sources = [
    async () => {
      const res = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle");
      if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
      const lines = (await res.text()).trim().split(/\r?\n/).map((l) => l.trim());
      return [lines[lines.length - 2], lines[lines.length - 1]];
    },
    async () => {
      const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544/tles");
      if (!res.ok) throw new Error(`wheretheiss HTTP ${res.status}`);
      const data = await res.json();
      return [data.line1, data.line2];
    },
  ];

  for (const source of sources) {
    try {
      const [line1, line2] = await source();
      if (line1?.startsWith("1 ") && line2?.startsWith("2 ")) {
        satrec = satellite.twoline2satrec(line1, line2);
        tleEpoch = epochFromTle(line1);
        return;
      }
    } catch (e) {
      console.warn("TLE source failed:", e);
    }
  }
  throw new Error("no orbit data");
}

// TLE epoch: two-digit year + fractional day of year (columns 19–32 of line 1).
function epochFromTle(line1) {
  const year = 2000 + Number(line1.slice(18, 20));
  const day = Number(line1.slice(20, 32));
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000);
}

// ==========================================================================
// Geometry helpers
// ==========================================================================
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a) => Math.sqrt(dot(a, a));

function stateAt(date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv.position) return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  return {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    altKm: geo.height,
    speedKms: norm(pv.velocity),
    eci: pv.position,
    gmst,
  };
}

// Low-precision sun direction (unit vector in ECI), good to ~0.01°.
function sunDirection(date) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = toRad((280.46 + 0.9856474 * n) % 360);
  const g = toRad((357.528 + 0.9856003 * n) % 360);
  const lambda = L + toRad(1.915) * Math.sin(g) + toRad(0.02) * Math.sin(2 * g);
  const epsilon = toRad(23.439 - 0.0000004 * n);
  return { x: Math.cos(lambda), y: Math.cos(epsilon) * Math.sin(lambda), z: Math.sin(epsilon) * Math.sin(lambda) };
}

// Is the ISS in sunlight? (cylindrical Earth-shadow model)
function isSunlit(eci, sun) {
  const along = dot(eci, sun);
  if (along > 0) return true;
  return Math.sqrt(dot(eci, eci) - along * along) > EARTH_RADIUS_KM;
}

function observerOf(location) {
  return { latitude: toRad(location.latitude), longitude: toRad(location.longitude), height: 0.1 };
}

// Sun elevation at the observer, in degrees (dark sky below about -6°).
function sunElevation(observer, gmst, sun) {
  const ecf = satellite.geodeticToEcf(observer);
  const up = {
    x: ecf.x * Math.cos(gmst) - ecf.y * Math.sin(gmst),
    y: ecf.x * Math.sin(gmst) + ecf.y * Math.cos(gmst),
    z: ecf.z,
  };
  return toDeg(Math.asin(dot(up, sun) / norm(up)));
}

const compass = (deg) =>
  ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][
    Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  ];

function formatLatLon(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}

// ==========================================================================
// Passes over the chosen location (next 3 days)
// ==========================================================================
function findPasses(location, days = 3, stepSec = 20) {
  const observer = observerOf(location);
  const passes = [];
  let current = null;
  const start = Date.now();

  for (let t = start; t < start + days * 86400000; t += stepSec * 1000) {
    const date = new Date(t);
    const state = stateAt(date);
    if (!state) continue;
    const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(state.eci, state.gmst));
    const elevation = toDeg(look.elevation);
    const azimuth = toDeg(look.azimuth);

    if (elevation >= MIN_PASS_ELEVATION) {
      const sun = sunDirection(date);
      const visibleNow = isSunlit(state.eci, sun) && sunElevation(observer, state.gmst, sun) < -6;
      if (!current) current = { start: date, startAz: azimuth, maxElevation: elevation, visible: false, sunlit: false, dark: false };
      current.end = date;
      current.endAz = azimuth;
      current.maxElevation = Math.max(current.maxElevation, elevation);
      current.visible ||= visibleNow;
      current.sunlit ||= isSunlit(state.eci, sun);
      current.dark ||= sunElevation(observer, state.gmst, sun) < -6;
    } else if (current) {
      passes.push(current);
      current = null;
      if (passes.length >= 12) break;
    }
  }
  return passes;
}

function passReason(p) {
  if (p.visible) return "Visible";
  if (!p.dark) return "Daylight";
  return "In Earth's shadow";
}

function renderPasses() {
  const box = $("passList");
  if (!box) return;
  if (!userLocation) {
    box.innerHTML = emptyState("map-pin", "Choose a location to see when the ISS passes over.");
    return;
  }

  const passes = findPasses(userLocation);
  renderStats(passes);
  setText("passSub", `Next 3 days over ${userLocation.name ? userLocation.name.split(",")[0] : "your location"}, at least ${MIN_PASS_ELEVATION}° above the horizon`);

  if (passes.length === 0) {
    box.innerHTML = emptyState("satellite", "No passes above 10° in the next 3 days.");
    return;
  }

  box.innerHTML = `<ol class="list">${passes
    .slice(0, 8)
    .map((p) => {
      const minutes = Math.max(1, Math.round((p.end - p.start) / 60000));
      return `
      <li><div class="list-item" style="cursor:default">
        <span class="badge${p.visible ? " visible" : ""}">${Math.round(p.maxElevation)}°</span>
        <span>
          <span class="list-title">${p.start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          <span class="list-meta">${minutes} min · ${compass(p.startAz)} → ${compass(p.endAz)}</span>
        </span>
        <span class="level-tag${p.visible ? " good" : ""}">${passReason(p)}</span>
      </div></li>`;
    })
    .join("")}</ol>
    <p class="updated">Badge shows the highest point in the sky. “Visible” means the ISS is sunlit while your sky is dark: look for a bright, steady, fast-moving star.</p>`;
}

// ==========================================================================
// Live position, ground track and key figures
// ==========================================================================
function splitAtAntimeridian(points) {
  const segments = [[]];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][1] - points[i - 1][1]) > 180) segments.push([]);
    segments[segments.length - 1].push(points[i]);
  }
  return segments;
}

function renderTrack() {
  const now = Date.now();
  const past = [];
  const future = [];
  for (let m = -45; m <= 95; m++) {
    const s = stateAt(new Date(now + m * 60000));
    if (!s) continue;
    (m <= 0 ? past : future).push([s.lat, s.lon]);
  }
  if (past.length && future.length) future.unshift(past[past.length - 1]);

  trackLayer?.remove();
  trackLayer = L.layerGroup([
    ...splitAtAntimeridian(past).map((seg) => L.polyline(seg, { color: "#134b70", weight: 2, opacity: 0.5, dashArray: "4 6" })),
    ...splitAtAntimeridian(future).map((seg) => L.polyline(seg, { color: "#c0612a", weight: 2.5, opacity: 0.9 })),
  ]).addTo(map);
  lastTrackAt = now;
}

let lastStats = { passes: null };

function renderStats(passes = lastStats.passes) {
  lastStats.passes = passes;
  const s = satrec ? stateAt(new Date()) : null;
  const sunlit = s ? isSunlit(s.eci, sunDirection(new Date())) : null;
  const nextVisible = passes?.find((p) => p.visible);
  const next = passes?.[0];

  setHtml(
    "issStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("satellite")}Altitude</div>
      <div class="stat-value">${s ? formatNumber(s.altKm * KM_TO_MI) : "—"}${s ? '<span class="stat-unit">mi</span>' : ""}</div>
      <div class="stat-note">${s ? `${formatNumber(s.altKm)} km above Earth` : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("wind")}Speed</div>
      <div class="stat-value">${s ? formatNumber(s.speedKms * 3600 * KM_TO_MI) : "—"}${s ? '<span class="stat-unit">mph</span>' : ""}</div>
      <div class="stat-note">${s ? "One orbit every ~93 minutes" : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("map-pin")}Position</div>
      <div class="stat-value" style="font-size:20px">${s ? formatLatLon(s.lat, s.lon) : "—"}</div>
      <div class="stat-note">${s ? (sunlit ? "In sunlight" : "In Earth's shadow") : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("clock")}Next visible pass</div>
      <div class="stat-value" style="font-size:20px">${
        nextVisible ? nextVisible.start.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "—"
      }</div>
      <div class="stat-note">${
        !userLocation
          ? "Set a location to see"
          : nextVisible
            ? `${Math.round(nextVisible.maxElevation)}° high · ${compass(nextVisible.startAz)} → ${compass(nextVisible.endAz)}`
            : next
              ? "None visible in 3 days (passes are in daylight)"
              : "No passes in 3 days"
      }</div>
    </div>
  `
  );
}

function updatePosition() {
  const s = stateAt(new Date());
  if (!s) return;
  const latLng = [s.lat, s.lon];

  if (!issMarker) {
    issMarker = L.marker(latLng, {
      icon: L.divIcon({ className: "iss-icon", html: icon("satellite"), iconSize: [34, 34], iconAnchor: [17, 17] }),
      zIndexOffset: 1000,
      title: "International Space Station",
    }).addTo(map);
    footprint = L.circle(latLng, { radius: 0, color: "#c0612a", weight: 1, fillColor: "#c0612a", fillOpacity: 0.08 }).addTo(map);
  }
  issMarker.setLatLng(latLng);
  // Ground area that can see the ISS above the horizon.
  footprint.setLatLng(latLng).setRadius(EARTH_RADIUS_KM * Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + s.altKm)) * 1000);

  if (follow) map.panTo(latLng, { animate: false });
  if (Date.now() - lastTrackAt > 60000) renderTrack();
  renderStats();
}

// ==========================================================================
// Location + page setup
// ==========================================================================
function useLocation(location) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];
  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);
  if (satrec) renderPasses();
}

document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [0, 0], zoom: 3 });
  renderStats();

  const followToggle = $("toggleFollow");
  followToggle?.addEventListener("change", () => {
    follow = followToggle.checked;
    if (follow) updatePosition();
  });
  // Dragging the map or jumping to your location means you want to look around: stop following.
  const stopFollowing = () => {
    follow = false;
    if (followToggle) followToggle.checked = false;
  };
  map.on("dragstart", stopFollowing);
  map.on("recenter", stopFollowing);

  setupLocationPanel(useLocation);

  try {
    await loadTle();
    setText("issNote", `Orbit data from ${tleEpoch.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · position computed live in your browser`);
    renderTrack();
    updatePosition();
    setInterval(updatePosition, 1000);
    renderPasses();
  } catch (e) {
    console.error(e);
    setText("issNote", `Couldn't load the ISS orbit (${e.message}).`);
    setHtml("passList", emptyState("alert", "ISS orbit data is unavailable right now."));
  }
});
