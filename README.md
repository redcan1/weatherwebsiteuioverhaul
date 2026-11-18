# The Nerd Map

A static website that shows live environmental data on interactive maps: weather, severe weather alerts, hurricanes, wildfires, earthquakes, air quality and humidity.

## Running it

There is no build step. Serve the `frontend/` folder with any static file server, for example:

```
py -m http.server 8000 --directory frontend
```

Then open http://localhost:8000. Browser geolocation ("Use my current location") needs `http://localhost` or HTTPS.

## Layout

| File | Purpose |
| --- | --- |
| `style.css` | Design system shared by every page: tokens, layout, panels, stats, charts, map cards |
| `common.js` | Shared helpers: icons, formatting, Esri basemaps, the location panel (city search, geolocation, saved location) |
| `charts.js` | Small dependency-free SVG line and bar charts with hover tooltips |
| `index.html` + `weather.js` | Current conditions, 24-hour outlook, 7-day forecast, radar and satellite layers |
| `severe.html` + `severe.js` | NWS warnings, watches and advisories, local alert text, NHC storm tracks and cones |
| `wildfires.html` + `wildfires.js` | Active US fire perimeters, largest fires, nearest fire |
| `seismic.html` + `seismic.js` | M2.5+ earthquakes from the past day or week, strongest and nearest quakes |
| `air.html` + `air.js` | US AQI, pollutant levels and a 24-hour AQI forecast |
| `humidity.html` + `humidity.js` | Humidity, dew point, comfort, 24-hour trend and a regional humidity grid |
| `about.html` | What the site is and where every piece of data comes from |

The location a visitor picks is saved in `localStorage`, so every page opens on the same place.

## Data sources

All sources are free and need no API key. See `about.html` for details.

- **Open-Meteo**: forecast, air quality and geocoding APIs
- **RainViewer**: precipitation radar tiles (free tiles stop at zoom 7, so they're scaled up beyond that)
- **NASA GIBS**: GOES-East GeoColor satellite imagery (the newest frame is looked up via DescribeDomains)
- **National Weather Service**: alert shapes from NOAA's watch/warning map service; local alert text from api.weather.gov
- **National Hurricane Center**: storm forecast points, track and cone from NOAA's tropical map service (one `identify` request covers all 15 storm slots)
- **NIFC WFIGS**: current interagency fire perimeters
- **USGS**: FDSN earthquake event service
- **Esri ArcGIS Online**: Light Gray Canvas and World Street Map basemaps
- **Leaflet 1.9.4** (from unpkg) and the **Inter** font (from Google Fonts)

The Traffic and Crime tabs were removed. Traffic APIs (TomTom, HERE and others) and the FBI Crime Data API all require an API key.
