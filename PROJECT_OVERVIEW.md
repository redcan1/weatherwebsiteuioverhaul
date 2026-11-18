# The Nerd Map: Skills and Data Demonstrated

The Nerd Map is a dependency-light, installable web app that turns more than a dozen public environmental data feeds into interactive maps and charts. It has about 4,400 lines of vanilla JavaScript, no framework, no build step for the app itself and no API keys. This document summarises what the project shows about how it was built.

## Skills demonstrated

### Front-end engineering (vanilla JS, no framework)
- **Multi-page architecture with shared modules.** `common.js` (about 940 lines) holds the location panel, formatting, unit handling, basemaps and share links. Each page adds one script on top of it.
- **Interactive mapping with Leaflet.** Features include tile layers, GeoJSON polygons, markers, animated radar and satellite frames, storm tracks and cones, an ISS ground track and footprint, and light and dark basemaps.
- **Custom data visualisation.** `charts.js` is a small SVG line and bar chart library with hover tooltips and no dependencies. It draws the forecast, humidity, AQI, Kp index and tide charts.
- **State and persistence.** `localStorage` holds the unit preference, saved places (up to 8) and a week-long cache of the tide-station list. The URL carries state (`lat`, `lon`, `name`, `map`), so any view can be shared as a link.
- **Resilient async code.** Pages fetch several APIs in parallel, handle partial failures, refresh on a timer only while the tab is visible, and use a backup source for ISS data.

### Browser APIs and progressive web app
- **Service worker (`sw.js`).** Site files are network-first with an offline fallback, map tiles are cache-first, and API responses are kept for offline use. Cache versioning is built in.
- **Web app manifest.** The site is installable with icons.
- **Geolocation, Web Share and Clipboard.** These back the "Use my location" and Share buttons, with fallbacks where they are unavailable.

### Design, UX and accessibility
- **A shared design system** in `style.css`: tokens, panels, stat tiles and map cards.
- **Automatic dark mode** that follows the system setting, including the map basemap.
- **Responsive layout**, including a tab bar that scrolls rather than overflows.
- **Accessibility.** The site has a skip link, labelled controls and WCAG AA contrast in both themes, checked with axe-core.

### Tooling and deployment
- **Template-driven page generation.** `tools/build_pages.sh` generates every HTML page from one template, so the header, navigation and footer stay consistent.
- **CI/CD.** A GitHub Actions workflow (`.github/workflows/pages.yml`) publishes the static site to GitHub Pages.
- **Disciplined scope decisions.** The Traffic and Crime tabs were dropped because their sources require API keys. The project is deliberately keyless and free to host.

### Domain and numerical work
- **Orbital mechanics in the browser.** The ISS position, ground track and passes over the user are computed from orbital elements (TLE) with satellite.js (SGP4), not fetched ready-made.
- **Spatial lookups.** The app finds the nearest tide station, fire, earthquake or alert to the user, and handles unit conversion between °F/°C and imperial/metric.
- **Source-specific quirks.** The app scales RainViewer tiles up beyond zoom 7, looks up the newest GOES frame through GIBS DescribeDomains, and reads all 15 NHC storm slots with a single `identify` request.

## Data demonstrated

| Domain | Source | Data used |
| --- | --- | --- |
| Weather | Open-Meteo | Current conditions, 24-hour outlook, 7-day forecast, humidity, UV |
| Geocoding | Open-Meteo | City search |
| Radar | RainViewer | Animated precipitation tiles |
| Satellite | NASA GIBS | GOES-East GeoColor imagery |
| Severe weather | NWS (api.weather.gov and NOAA map services) | Warning, watch and advisory polygons plus alert text |
| Hurricanes | NOAA National Hurricane Center | Forecast points, tracks and cones |
| Wildfires | NIFC WFIGS (ArcGIS) | Current interagency fire perimeters |
| Earthquakes | USGS FDSN | M2.5+ events for the past day or week |
| Air quality | Open-Meteo Air Quality | US AQI, pollutants, 24-hour forecast |
| Natural events | NASA EONET | Worldwide storms, volcanoes, fires, sea ice |
| Space weather | NOAA SWPC | OVATION aurora probability grid, Kp index (observed and forecast) |
| Tides | NOAA Tides & Currents | Stations and tide predictions |
| Sea conditions | Open-Meteo Marine | Waves, swell, sea surface temperature |
| Space | CelesTrak, wheretheiss.at | ISS orbital elements |
| Basemaps | Esri ArcGIS Online | Light gray and street tiles |

This covers a mix of formats and protocols: plain JSON REST APIs, ArcGIS feature and map services (including `identify` queries), GeoJSON, XYZ and WMTS-style raster tiles, gridded model output (aurora) and orbital element sets. It combines time series, point data, polygon data, raster tiles and gridded data.

## Where to look in the code

| Interest | File |
| --- | --- |
| Shared architecture and location handling | `frontend/common.js` |
| Custom charting | `frontend/charts.js` |
| Offline and caching strategy | `frontend/sw.js` |
| Raster layers and animation | `frontend/weather.js` |
| GIS polygon and track data | `frontend/severe.js`, `frontend/wildfires.js` |
| Orbital computation | `frontend/iss.js` |
| Page generation | `tools/build_pages.sh` |
| Deployment | `.github/workflows/pages.yml` |

See [README.md](README.md) for how to run and edit the project.
