// sw.js — service worker: installable app + last-loaded pages, data and map tiles offline.
//
// Strategy:
//   - Site files (HTML/CSS/JS): network first, so a new deploy shows immediately;
//     the cached copy is used offline.
//   - Libraries and fonts (unpkg, cdnjs, Google Fonts): cache first (versioned URLs).
//   - Map tiles (Esri, RainViewer, NASA GIBS): cache first, capped in size.
//   - Data APIs: network first; the last response is kept under a key without
//     time-stamped parameters so it can still be found offline.
//
// Bump VERSION when the list of site files changes.

const VERSION = "v1";
const SHELL_CACHE = `nerdmap-shell-${VERSION}`;
const DATA_CACHE = `nerdmap-data-${VERSION}`;
const TILE_CACHE = `nerdmap-tiles-${VERSION}`;
const MAX_TILES = 800;

const PAGES = ["index.html", "severe.html", "wildfires.html", "seismic.html", "air.html", "events.html", "aurora.html", "ocean.html", "iss.html", "about.html"];
const SHELL_FILES = [
  "./",
  ...PAGES,
  "style.css",
  "common.js",
  "charts.js",
  "weather.js",
  "severe.js",
  "wildfires.js",
  "seismic.js",
  "air.js",
  "events.js",
  "aurora.js",
  "ocean.js",
  "iss.js",
  "favicon.svg",
  "thenerdmap.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/satellite.js/5.0.0/satellite.min.js",
];

const TILE_HOSTS = ["server.arcgisonline.com", "tilecache.rainviewer.com", "gibs.earthdata.nasa.gov"];
const STATIC_HOSTS = ["unpkg.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];
// Query parameters that change on every request (times) and shouldn't split the offline cache.
const VOLATILE_PARAMS = ["starttime", "begin_date", "date", "range", "_"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, SHELL_CACHE, { ignoreSearch: true }));
  } else if (TILE_HOSTS.includes(url.hostname) && !url.pathname.endsWith(".xml")) {
    event.respondWith(cacheFirst(request, TILE_CACHE, MAX_TILES));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  } else {
    event.respondWith(networkFirst(request, DATA_CACHE, { key: offlineKey(url) }));
  }
});

// One cache entry per logical request: drop time-stamped parameters (and GIBS's
// time-range path segment) so yesterday's earthquake query still matches today offline.
function offlineKey(url) {
  const key = new URL(url);
  VOLATILE_PARAMS.forEach((p) => key.searchParams.delete(p));
  if (key.hostname === "gibs.earthdata.nasa.gov" && key.pathname.includes("/all/")) {
    key.pathname = key.pathname.slice(0, key.pathname.indexOf("/all/") + 5);
  }
  return key.toString();
}

async function networkFirst(request, cacheName, { key = request, ignoreSearch = false } = {}) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(key, response.clone());
    return response;
  } catch {
    const cached = await cache.match(key, { ignoreSearch });
    return cached || Response.error();
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  let response;
  try {
    response = await fetch(request);
  } catch {
    return Response.error();
  }
  // Tiles load as <img>, so cross-origin responses can be opaque (status 0): still cacheable.
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (maxEntries) trimCache(cache, maxEntries);
  }
  return response;
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}
