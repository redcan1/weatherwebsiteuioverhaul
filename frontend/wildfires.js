// wildfires.js — Wildfires page. Requires common.js.

let map;
let perimetersLayer = null;
let fireDots = null;
let userMarker = null;
let userLocation = null;
let fires = [];
let firesLoaded = false; // key figures stay "—" until the first successful load

// WFIGS Current Interagency Fire Perimeters (ArcGIS FeatureServer query endpoint)
const WFIGS_CURRENT_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

// Field names have changed over time, so check current names first, then older ones.
const FIELDS = {
  name: ["poly_IncidentName", "attr_IncidentName", "IncidentName", "FireName", "Name"],
  acres: ["poly_GISAcres", "attr_IncidentSize", "GISAcres", "Acres"],
  contained: ["attr_PercentContained", "PercentContained"],
  state: ["attr_POOState", "POOState"],
  discovered: ["attr_FireDiscoveryDateTime", "FireDiscoveryDateTime"],
  updated: ["attr_ModifiedOnDateTime_dt", "poly_DateCurrent", "ModifyDate", "DateCurrent"],
};

const FIRE_RED = "#d03b3b";
const DOTS_HIDDEN_FROM_ZOOM = 10; // perimeters are readable on their own from here

function getProp(props, keys) {
  for (const key of keys) {
    const value = props?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toFire(props) {
  const acres = Number(getProp(props, FIELDS.acres));
  const contained = getProp(props, FIELDS.contained);
  const state = getProp(props, FIELDS.state);
  return {
    name: getProp(props, FIELDS.name) || "Unnamed fire",
    acres: Number.isFinite(acres) ? acres : 0,
    contained: contained == null ? null : Number(contained),
    state: state ? String(state).replace(/^US-/, "") : null,
    discovered: getProp(props, FIELDS.discovered),
    updated: getProp(props, FIELDS.updated),
  };
}

function firePopup(fire) {
  return popupHtml(fire.name, [
    ["State", fire.state],
    ["Size", `${formatNumber(fire.acres)} acres`],
    ["Contained", fire.contained == null ? null : `${fire.contained}%`],
    ["Discovered", fire.discovered ? formatDate(fire.discovered) : null],
    ["Perimeter updated", fire.updated ? formatRelative(fire.updated) : null],
  ]);
}

// Bigger fires get a thicker outline and a denser fill.
function stylePerimeter(feature) {
  const acres = toFire(feature.properties).acres;
  return {
    color: FIRE_RED,
    weight: acres > 50000 ? 2.5 : 2,
    opacity: 1,
    fillColor: FIRE_RED,
    fillOpacity: acres > 50000 ? 0.35 : acres > 10000 ? 0.3 : 0.25,
  };
}

// ArcGIS caps records per request, so page through the results.
async function fetchAllPerimeters(where = "1=1") {
  const pageSize = 1000;
  const features = [];

  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      f: "geojson",
      where,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });

    const res = await fetch(`${WFIGS_CURRENT_URL}?${params}`);
    if (!res.ok) throw new Error(`WFIGS request failed: HTTP ${res.status}`);

    const page = (await res.json()).features || [];
    features.push(...page);
    if (page.length < pageSize) break;
  }

  return { type: "FeatureCollection", features };
}

// ==========================================================================
// Rendering
// ==========================================================================
function nearestFire() {
  if (!userLocation || fires.length === 0) return null;
  let best = null;
  for (const fire of fires) {
    const miles = distanceMiles(userLocation.latitude, userLocation.longitude, fire.center.lat, fire.center.lng);
    if (!best || miles < best.miles) best = { fire, miles };
  }
  return best;
}

function renderStats() {
  const totalAcres = fires.reduce((sum, fire) => sum + fire.acres, 0);
  const largest = fires[0];
  const nearest = nearestFire();

  setHtml(
    "fireStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("flame")}Active perimeters</div>
      <div class="stat-value">${formatNumber(fires.length)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("map")}Area burned</div>
      <div class="stat-value">${formatNumber(totalAcres)}<span class="stat-unit">ac</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("alert")}Largest</div>
      <div class="stat-value">${largest ? `${formatNumber(largest.acres)}<span class="stat-unit">ac</span>` : "—"}</div>
      <div class="stat-note">${largest ? escapeHtml(largest.name) : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("ruler")}Nearest to you</div>
      <div class="stat-value">${nearest ? formatNumber(nearest.miles) : "—"}<span class="stat-unit">${nearest ? "mi" : ""}</span></div>
      <div class="stat-note">${nearest ? escapeHtml(nearest.fire.name) : "Set a location to see"}</div>
    </div>
  `
  );
}

function focusFire(fire) {
  map.fitBounds(fire.polygon.getBounds(), { padding: [40, 40], maxZoom: 11 });
  fire.polygon.openPopup(fire.center);
}

function renderList() {
  const list = $("fireList");
  if (!list) return;

  if (fires.length === 0) {
    list.innerHTML = emptyState("flame", "No active fire perimeters right now.");
    return;
  }

  const items = fires.slice(0, 8).map((fire) => {
    const li = document.createElement("li");
    const contained = fire.contained == null ? "Containment unknown" : `${fire.contained}% contained`;
    li.innerHTML = `
      <button type="button" class="list-item">
        <span class="badge fire">${icon("flame")}</span>
        <span>
          <span class="list-title">${escapeHtml(fire.name)}</span>
          <span class="list-meta">${escapeHtml([fire.state, contained].filter(Boolean).join(" · "))}</span>
          <span class="meter" aria-hidden="true"><span style="width:${fire.contained ?? 0}%"></span></span>
        </span>
        <span class="list-value">${formatNumber(fire.acres)} ac</span>
      </button>`;
    li.querySelector("button").addEventListener("click", () => focusFire(fire));
    return li;
  });

  const ol = document.createElement("ol");
  ol.className = "list";
  ol.append(...items);
  list.replaceChildren(ol);
}

function updateDotVisibility() {
  if (!fireDots) return;
  if (map.getZoom() >= DOTS_HIDDEN_FROM_ZOOM) map.removeLayer(fireDots);
  else if (!map.hasLayer(fireDots)) fireDots.addTo(map);
}

async function loadPerimeters() {
  const button = $("btnReloadPerimeters");
  if (button) button.disabled = true;
  setText("wfStatus", "Loading fire perimeters…");

  try {
    const collection = await fetchAllPerimeters();

    perimetersLayer?.remove();
    fireDots?.remove();
    fires = [];

    perimetersLayer = L.geoJSON(collection, {
      style: stylePerimeter,
      onEachFeature: (feature, layer) => {
        const fire = toFire(feature.properties);
        fire.polygon = layer;
        fire.center = layer.getBounds().getCenter();
        layer.bindPopup(firePopup(fire));
        fires.push(fire);
      },
    }).addTo(map);

    fires.sort((a, b) => b.acres - a.acres);
    firesLoaded = true;

    // One dot per fire so small fires stay visible when zoomed out. Largest drawn first.
    fireDots = L.layerGroup(
      fires.map((fire) =>
        L.circleMarker(fire.center, {
          radius: Math.min(4 + Math.sqrt(fire.acres) / 30, 16),
          color: "#ffffff",
          weight: 1.5,
          fillColor: FIRE_RED,
          fillOpacity: 0.9,
        })
          .bindPopup(firePopup(fire))
          .bindTooltip(escapeHtml(fire.name), { direction: "top" })
      )
    );
    updateDotVisibility();

    if (fires.length > 0) map.fitBounds(perimetersLayer.getBounds(), { padding: [30, 30] });

    renderStats();
    renderList();
    setText("wfStatus", `${formatNumber(fires.length)} active perimeters · updated ${nowClock()}`);
  } catch (e) {
    console.error(e);
    setText("wfStatus", `Couldn't load fire perimeters (${e.message}).`);
    setHtml("fireList", emptyState("alert", "Fire data is unavailable right now. Try reloading."));
  } finally {
    if (button) button.disabled = false;
  }
}

function useLocation(location, source) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];

  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);

  if (firesLoaded) renderStats();

  // A saved location shouldn't override the national overview on page load.
  if (source === "saved") return;

  const nearest = nearestFire();
  if (nearest) {
    map.fitBounds(L.latLngBounds([latLng, nearest.fire.center]), { padding: [60, 60], maxZoom: 9 });
  } else {
    map.setView(latLng, 8);
  }
}

// ==========================================================================
// Page setup
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [39.5, -98.35], zoom: 4 }); // continental US
  map.on("zoomend", updateDotVisibility);

  setupLocationPanel(useLocation, { restore: false });
  $("btnReloadPerimeters")?.addEventListener("click", loadPerimeters);

  await loadPerimeters();
  restoreSavedLocation(useLocation);
});
