// events.js — Natural events page (NASA EONET). Requires common.js.

let map;
let eventsLayer = null;
let userMarker = null;
let userLocation = null;
let events = []; // normalized EONET events
const hiddenCategories = new Set(["seaLakeIce"]); // icebergs dominate the feed, so start with them off

const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";

// Fixed category → color assignment (color follows the category, never its rank).
// Hues from the validated categorical palette; rarer categories share "Other".
const CATEGORY_STYLES = {
  severeStorms: { label: "Severe storms", color: "#2a78d6", icon: "storm" },
  wildfires: { label: "Wildfires", color: "#eb6834", icon: "flame" },
  seaLakeIce: { label: "Sea and lake ice", color: "#1baf7a", icon: "droplet" },
  volcanoes: { label: "Volcanoes", color: "#e34948", icon: "alert" },
  floods: { label: "Floods", color: "#6250d6", icon: "rain" },
  earthquakes: { label: "Earthquakes", color: "#eda100", icon: "activity" },
  dustHaze: { label: "Dust and haze", color: "#e87ba4", icon: "wind" },
  other: { label: "Other", color: "#008300", icon: "info" },
};
const styleFor = (categoryId) => CATEGORY_STYLES[categoryId] || CATEGORY_STYLES.other;
const groupOf = (categoryId) => (CATEGORY_STYLES[categoryId] ? categoryId : "other");

// ==========================================================================
// Data
// ==========================================================================
function pointOf(geometry) {
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  // Polygons: use the average of the outer ring
  const ring = geometry.coordinates?.[0] || [];
  if (!ring.length) return null;
  const sum = ring.reduce(([a, b], [lon, lat]) => [a + lat, b + lon], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

async function fetchEvents() {
  const params = new URLSearchParams({ status: "open", days: "30" });
  const res = await fetch(`${EONET_URL}?${params}`);
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const data = await res.json();

  return (data.events || [])
    .map((e) => {
      const geometry = [...(e.geometry || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      const points = geometry.map(pointOf).filter(Boolean);
      const latest = geometry[geometry.length - 1];
      const category = e.categories?.[0] || { id: "other", title: "Other" };
      return {
        id: e.id,
        title: e.title,
        categoryId: groupOf(category.id),
        categoryTitle: category.title,
        points,
        latestPoint: points[points.length - 1],
        updated: latest ? new Date(latest.date).getTime() : null,
        magnitude: latest?.magnitudeValue != null ? `${formatNumber(latest.magnitudeValue)} ${latest.magnitudeUnit || ""}`.trim() : null,
        sources: e.sources || [],
      };
    })
    .filter((e) => e.latestPoint);
}

const visibleEvents = () => events.filter((e) => !hiddenCategories.has(e.categoryId));

// ==========================================================================
// Rendering
// ==========================================================================
function eventPopup(e) {
  const links = e.sources
    .filter((s) => s.url)
    .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.id)} ↗</a>`)
    .join(" · ");
  return (
    popupHtml(e.title, [
      ["Category", e.categoryTitle],
      ["Last update", e.updated ? formatRelative(e.updated) : null],
      ["Magnitude", e.magnitude],
    ]) + (links ? `<p style="margin-top:8px">${links}</p>` : "")
  );
}

function renderMap() {
  eventsLayer?.remove();
  const layers = [];

  for (const e of visibleEvents()) {
    const color = styleFor(e.categoryId).color;
    // Storms move: draw their track behind the latest position.
    if (e.points.length > 1) {
      layers.push(L.polyline(e.points, { color, weight: 2, opacity: 0.7 }));
    }
    const marker = L.circleMarker(e.latestPoint, {
      radius: e.categoryId === "seaLakeIce" ? 4 : 7,
      color: "#ffffff",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.95,
    })
      .bindPopup(eventPopup(e))
      .bindTooltip(escapeHtml(e.title), { direction: "top" });
    e.marker = marker;
    layers.push(marker);
  }

  eventsLayer = L.layerGroup(layers).addTo(map);
  userMarker?.bringToFront();
}

function nearestEvent(list) {
  if (!userLocation) return null;
  let best = null;
  for (const e of list) {
    const miles = distanceMiles(userLocation.latitude, userLocation.longitude, e.latestPoint[0], e.latestPoint[1]);
    if (!best || miles < best.miles) best = { event: e, miles };
  }
  return best;
}

function renderStats() {
  const list = visibleEvents();
  const newest = [...list].sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
  const nearest = nearestEvent(list);
  const categories = new Set(list.map((e) => e.categoryId));

  setHtml(
    "eventStats",
    `
    <div class="stat">
      <div class="stat-label">${icon("map")}Active events</div>
      <div class="stat-value">${formatNumber(list.length)}</div>
      <div class="stat-note">${formatNumber(events.length)} including hidden categories</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("layers")}Categories shown</div>
      <div class="stat-value">${formatNumber(categories.size)}</div>
      <div class="stat-note">Open events from the last 30 days</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("clock")}Latest update</div>
      <div class="stat-value">${newest?.updated ? formatRelative(newest.updated) : "—"}</div>
      <div class="stat-note">${newest ? escapeHtml(newest.title) : "—"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">${icon("ruler")}Nearest to you</div>
      <div class="stat-value">${nearest ? formatNumber(nearest.miles) : "—"}<span class="stat-unit">${nearest ? "mi" : ""}</span></div>
      <div class="stat-note">${nearest ? escapeHtml(nearest.event.title) : "Set a location to see"}</div>
    </div>
  `
  );
}

function renderList() {
  const box = $("eventList");
  if (!box) return;

  const list = [...visibleEvents()].sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8);
  if (list.length === 0) {
    box.innerHTML = emptyState("map", "No events in the selected categories.");
    return;
  }

  const ol = document.createElement("ol");
  ol.className = "list";
  ol.append(
    ...list.map((e) => {
      const style = styleFor(e.categoryId);
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="list-item">
          <span class="badge" style="background:${style.color};color:#fff">${icon(style.icon)}</span>
          <span>
            <span class="list-title">${escapeHtml(e.title)}</span>
            <span class="list-meta">${escapeHtml(e.categoryTitle)} · ${e.updated ? formatRelative(e.updated) : "date unknown"}</span>
          </span>
          <span class="list-value">${e.magnitude ? escapeHtml(e.magnitude) : ""}</span>
        </button>`;
      li.querySelector("button").addEventListener("click", () => {
        map.setView(e.latestPoint, Math.max(map.getZoom(), 5));
        e.marker?.openPopup();
      });
      return li;
    })
  );
  box.replaceChildren(ol);
}

// Category toggles double as the legend (color + label + count).
function renderFilters() {
  const box = $("categoryFilters");
  if (!box) return;

  const counts = new Map();
  for (const e of events) counts.set(e.categoryId, (counts.get(e.categoryId) || 0) + 1);

  const ids = Object.keys(CATEGORY_STYLES).filter((id) => counts.has(id));
  if (ids.length === 0) {
    box.innerHTML = '<p class="map-card-note">No open events.</p>';
    return;
  }

  box.innerHTML = ids
    .map((id) => {
      const s = CATEGORY_STYLES[id];
      return `<label class="switch"><input type="checkbox" data-category="${id}" ${hiddenCategories.has(id) ? "" : "checked"}>
        <span class="swatch" style="background:${s.color}"></span>${escapeHtml(s.label)} <span class="filter-count">${counts.get(id)}</span></label>`;
    })
    .join("");

  box.querySelectorAll("input[data-category]").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked) hiddenCategories.delete(input.dataset.category);
      else hiddenCategories.add(input.dataset.category);
      render();
    })
  );
}

function render() {
  renderMap();
  renderStats();
  renderList();
}

// ==========================================================================
// Location + page setup
// ==========================================================================
function useLocation(location, source) {
  userLocation = location;
  const latLng = [location.latitude, location.longitude];
  userMarker?.remove();
  userMarker = locationMarker(latLng, location.name || "Your location").addTo(map);
  if (events.length) renderStats();
  if (source !== "saved") map.setView(latLng, 4);
}

document.addEventListener("DOMContentLoaded", async () => {
  map = createBaseMap({ center: [20, -30], zoom: 2 });
  setupLocationPanel(useLocation);

  try {
    setText("eventStatus", "Loading events…");
    events = await fetchEvents();
    renderFilters();
    render();
    setText("eventStatus", `Updated ${nowClock()}`);
  } catch (e) {
    console.error(e);
    setText("eventStatus", `Couldn't load events (${e.message}).`);
    setHtml("eventList", emptyState("alert", "NASA EONET is unavailable right now."));
  }
});
