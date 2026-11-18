#!/usr/bin/env bash
# Generates every HTML page in frontend/ from one shared template, so the
# <head>, header/nav, location panel and footer stay identical across pages.
#
# Usage (from anywhere, in Git Bash / any bash):
#   bash tools/build_pages.sh
#
# Edit page layouts HERE, not in the .html files: running the script
# overwrites them. Page behaviour lives in the .js files and is untouched.
#
# Adding a page: add a <a class="tab"> line to the nav in page(), then a
# `page newpage.html ...` block below (copy an existing one).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../frontend"

EXT='target="_blank" rel="noopener"'

# page FILE TITLE DESCRIPTION SCRIPTS(space-separated, after common.js) USES_LEAFLET  < body
page() {
  local file=$1 title=$2 desc=$3 scripts=$4 leaflet=$5
  local leaflet_tags="" script_tags=""
  if [ "$leaflet" = yes ]; then
    leaflet_tags='  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
'
  fi
  for s in $scripts; do script_tags+="  <script src=\"$s\" defer></script>
"; done

  cat > "$file" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$title · The Nerd Map</title>
  <meta name="description" content="$desc">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
${leaflet_tags}  <link rel="stylesheet" href="style.css">

  <script src="common.js" defer></script>
${script_tags}</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="index.html" aria-label="The Nerd Map home">
        <img src="thenerdmap.png" alt="The Nerd Map" width="122" height="52">
      </a>
      <nav class="tabs" aria-label="Sections">
        <a class="tab" href="index.html"><svg data-icon="cloud-sun"></svg><span>Weather</span></a>
        <a class="tab" href="severe.html"><svg data-icon="alert"></svg><span>Severe Weather</span></a>
        <a class="tab" href="wildfires.html"><svg data-icon="flame"></svg><span>Wildfires</span></a>
        <a class="tab" href="seismic.html"><svg data-icon="activity"></svg><span>Seismic</span></a>
        <a class="tab" href="air.html"><svg data-icon="wind"></svg><span>Air</span></a>
        <a class="tab" href="events.html"><svg data-icon="map"></svg><span>Natural Events</span></a>
        <a class="tab" href="aurora.html"><svg data-icon="sun"></svg><span>Aurora</span></a>
        <a class="tab" href="ocean.html"><svg data-icon="waves"></svg><span>Ocean</span></a>
        <a class="tab" href="iss.html"><svg data-icon="satellite"></svg><span>ISS</span></a>
        <a class="tab" href="about.html"><svg data-icon="info"></svg><span>About</span></a>
      </nav>
    </div>
  </header>

  <main class="container page">
$(cat)
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <span>The Nerd Map · Live environmental data from public sources</span>
      <span>Data: Open-Meteo, NOAA, NASA, USGS, NIFC, RainViewer and CelesTrak · <a href="about.html">About the data</a></span>
    </div>
  </footer>
</body>
</html>
EOF
}

head_block() { # EYEBROW TITLE LEDE SOURCES_HTML
  cat <<EOF
    <div class="page-head">
      <div>
        <p class="eyebrow"><span class="live-dot"></span>$1</p>
        <h1>$2</h1>
        <p class="lede">$3</p>
      </div>
      <div class="sources">Data from $4</div>
    </div>
EOF
}

empty() { # ICON MESSAGE
  echo "<div class=\"empty\"><svg data-icon=\"$1\"></svg><p>$2</p></div>"
}

LOCATION_PANEL='        <section class="panel" aria-labelledby="locHeading">
          <div class="panel-head"><h2 id="locHeading">Location</h2></div>
          <div class="search-field">
            <svg data-icon="search"></svg>
            <input id="cityInput" type="search" placeholder="Search for a city" autocomplete="off" aria-label="Search for a city">
            <button id="btnCitySearch" class="btn btn-primary" type="button">Search</button>
          </div>
          <div id="cityResults" class="results" aria-live="polite"></div>
          <div class="divider">or</div>
          <button id="btnLocation" class="btn btn-secondary btn-block" type="button"><svg data-icon="navigation"></svg>Use my current location</button>
          <div id="locCard" class="loc-card is-empty">
            <svg data-icon="map-pin"></svg>
            <div>
              <div id="locName" class="loc-name">No location selected</div>
              <div id="locResult" class="loc-meta">Search for a city or use your current location.</div>
            </div>
          </div>
          <p id="locStatus" class="status" role="status" hidden></p>
        </section>'

src() { echo "<a href=\"$1\" $EXT>$2</a>"; }

# --------------------------------------------------------------------------
# Weather
# --------------------------------------------------------------------------
page index.html "Weather" "Current conditions, hourly outlook, 7-day forecast, humidity and live radar for anywhere on Earth." "charts.js weather.js" yes <<EOF
$(head_block "Live conditions" "Weather" "Current conditions, a 24-hour outlook, a 7-day forecast and humidity for anywhere on Earth, with live radar, satellite and humidity map layers." "$(src https://open-meteo.com/ Open-Meteo)$(src https://www.rainviewer.com/ RainViewer)$(src https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api "NASA GIBS")")

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="currentHeading">
          <div class="panel-head">
            <div>
              <h2 id="currentHeading">Current conditions</h2>
              <p id="currentPlace" class="panel-sub">No location selected</p>
            </div>
          </div>
          <div id="currentOut">$(empty cloud-sun "Choose a location to see current conditions.")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Weather map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Map layers</div>
            <label class="switch"><input type="checkbox" id="toggleRadar" disabled> Precipitation radar</label>
            <label class="switch"><input type="checkbox" id="toggleClouds" disabled> Satellite (clouds)</label>
            <label class="switch"><input type="checkbox" id="toggleHumidity"> Humidity (regional)</label>
            <p id="layerNote" class="map-card-note">Loading layers…</p>
          </div>
          <div id="humidityLegendCard" class="map-card" hidden>
            <div class="map-card-title">Relative humidity (%)</div>
            <div id="humidityLegend"></div>
            <p id="humidityNote" class="map-card-note">Pick a location to map humidity around it.</p>
          </div>
        </div>
        <div id="radarPlayer" class="map-card radar-player is-disabled" hidden>
          <div class="radar-player-head">
            <span class="map-card-title">Past 2 hours</span>
            <span id="radarTime" class="radar-time" aria-live="off"></span>
          </div>
          <div class="radar-player-controls">
            <button id="btnRadarPlay" class="btn btn-icon" type="button" aria-label="Play animation" disabled></button>
            <input id="radarSlider" type="range" min="0" max="0" step="1" value="0" aria-label="Radar time" disabled>
          </div>
          <p class="radar-hint map-card-note">Turn on radar or satellite to play.</p>
        </div>
      </section>
    </div>

    <div class="row row-2">
      <section class="panel" aria-labelledby="hourlyHeading">
        <div class="panel-head">
          <div>
            <h2 id="hourlyHeading">Next 24 hours</h2>
            <p class="panel-sub">Temperature and chance of precipitation</p>
          </div>
        </div>
        <div id="hourlyOut">$(empty clock "The hourly outlook appears once you pick a location.")</div>
      </section>

      <section class="panel" aria-labelledby="dailyHeading">
        <div class="panel-head">
          <div>
            <h2 id="dailyHeading">7-day forecast</h2>
            <p class="panel-sub">Chance of precipitation, low and high</p>
          </div>
        </div>
        <div id="dailyOut">$(empty sun "The weekly forecast appears once you pick a location.")</div>
      </section>
    </div>

    <div class="row">
      <section class="panel" aria-labelledby="humidityHeading">
        <div class="panel-head">
          <div>
            <h2 id="humidityHeading">Humidity</h2>
            <p id="humiditySub" class="panel-sub">Hourly relative humidity for the next 24 hours</p>
          </div>
        </div>
        <div id="humidityChart">$(empty droplet "The humidity trend appears once you pick a location.")</div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Air quality
# --------------------------------------------------------------------------
page air.html "Air Quality" "Current US Air Quality Index, pollutant levels and a 24-hour AQI forecast for any location." "charts.js air.js" yes <<EOF
$(head_block "Live conditions" "Air quality" "The US Air Quality Index, the pollutants behind it and what to expect over the next 24 hours." "$(src https://open-meteo.com/en/docs/air-quality-api "Open-Meteo Air Quality")")

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="aqiHeading">
          <div class="panel-head"><h2 id="aqiHeading">Air quality now</h2></div>
          <div id="aqiOut">$(empty gauge "Choose a location to see its air quality.")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Air quality map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">US AQI</div>
            <div id="aqiLegend"></div>
          </div>
        </div>
      </section>
    </div>

    <div class="row row-2">
      <section class="panel" aria-labelledby="pollutantsHeading">
        <div class="panel-head">
          <div>
            <h2 id="pollutantsHeading">Pollutants</h2>
            <p class="panel-sub">Current concentrations near ground level</p>
          </div>
        </div>
        <div id="pollutantsOut">$(empty wind "Pollutant levels appear once you pick a location.")</div>
      </section>

      <section class="panel" aria-labelledby="forecastHeading">
        <div class="panel-head">
          <div>
            <h2 id="forecastHeading">Next 24 hours</h2>
            <p class="panel-sub">Hourly US AQI forecast</p>
          </div>
        </div>
        <div id="aqiChart">$(empty clock "The AQI forecast appears once you pick a location.")</div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Humidity
# --------------------------------------------------------------------------
# Humidity is now part of the Weather page; this stub keeps old links working.
cat > humidity.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Humidity · The Nerd Map</title>
  <meta http-equiv="refresh" content="0; url=index.html">
  <link rel="canonical" href="index.html">
</head>
<body>
  <p>Humidity is now part of the <a href="index.html">Weather page</a>.</p>
</body>
</html>
EOF

# --------------------------------------------------------------------------
# Severe weather
# --------------------------------------------------------------------------
page severe.html "Severe Weather" "Active National Weather Service warnings, watches and advisories across the US, plus tropical storms and hurricanes." "severe.js" yes <<EOF
$(head_block "Updated continuously" "Severe weather" "Active National Weather Service warnings, watches and advisories across the US, plus tropical storms and hurricanes tracked by the National Hurricane Center." "$(src https://www.weather.gov/ NWS)$(src https://www.nhc.noaa.gov/ NHC)")

    <div id="alertStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Warnings</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Watches</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Advisories &amp; statements</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Tropical storms</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="localHeading">
          <div class="panel-head">
            <div>
              <h2 id="localHeading">Alerts for your location</h2>
              <p id="localSub" class="panel-sub">Pick a US location to check</p>
            </div>
          </div>
          <div id="localAlerts">$(empty shield "Search for a city or use your location to see its active alerts.")</div>
        </section>
        <section class="panel" aria-labelledby="typesHeading">
          <div class="panel-head">
            <div>
              <h2 id="typesHeading">Active alert types</h2>
              <p class="panel-sub">Most severe first. Click one to zoom to it.</p>
            </div>
          </div>
          <div id="alertTypes">$(empty alert "Loading alerts…")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Severe weather map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Layers</div>
            <label class="switch"><input type="checkbox" id="toggleTropical" checked> Tropical storms</label>
            <label class="switch"><input type="checkbox" id="toggleMarine"> Marine alerts</label>
            <p id="tropicalNote" class="map-card-note">Checking for tropical storms…</p>
            <p id="wxStatus" class="map-card-note">Loading alerts…</p>
          </div>
          <div class="map-card">
            <div class="map-card-title">Legend</div>
            <div id="alertLegend"></div>
          </div>
        </div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Natural events
# --------------------------------------------------------------------------
page events.html "Natural Events" "Storms, wildfires, volcanoes, icebergs and other natural events happening around the world, tracked by NASA." "events.js" yes <<EOF
$(head_block "Updated daily" "Natural events" "Storms, wildfires, volcanoes, icebergs and other natural events happening around the world right now, tracked by NASA's Earth Observatory." "$(src https://eonet.gsfc.nasa.gov/ "NASA EONET")")

    <div id="eventStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Active events</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Categories shown</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Latest update</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Nearest to you</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="eventListHeading">
          <div class="panel-head">
            <div>
              <h2 id="eventListHeading">Latest events</h2>
              <p id="eventStatus" class="panel-sub">Loading events…</p>
            </div>
          </div>
          <div id="eventList">$(empty map "Loading events…")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Natural events map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Categories</div>
            <div id="categoryFilters"><p class="map-card-note">Loading…</p></div>
            <p class="map-card-note">Lines show storm tracks. Open events from the last 30 days.</p>
          </div>
        </div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Aurora
# --------------------------------------------------------------------------
page aurora.html "Aurora Forecast" "Where the northern and southern lights may be visible, your chance of seeing them, and the Kp index forecast." "charts.js aurora.js" yes <<EOF
$(head_block "Updated every 30 minutes" "Aurora forecast" "Where the northern and southern lights may be visible right now, your chance of seeing them, and how geomagnetic activity is expected to change over the next three days." "$(src https://www.swpc.noaa.gov/ "NOAA Space Weather")")

    <div id="auroraStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Kp index now</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Peak next 3 days</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Chance at your location</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Forecast for</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="viewingHeading">
          <div class="panel-head"><h2 id="viewingHeading">Your viewing chance</h2></div>
          <div id="viewingOut">$(empty map-pin "Choose a location to see its chance of aurora.")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Aurora forecast map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Aurora chance</div>
            <div id="auroraLegend"></div>
            <p id="auroraNote" class="map-card-note">Loading the forecast…</p>
          </div>
        </div>
      </section>
    </div>

    <div class="row">
      <section class="panel" aria-labelledby="kpHeading">
        <div class="panel-head">
          <div>
            <h2 id="kpHeading">Kp index</h2>
            <p class="panel-sub">Geomagnetic activity on a 0–9 scale: past 24 hours observed, next 3 days forecast. Kp 5 and above is a geomagnetic storm.</p>
          </div>
        </div>
        <div id="kpChart">$(empty clock "Loading the Kp index…")</div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Ocean
# --------------------------------------------------------------------------
page ocean.html "Ocean" "Tide times and heights from the nearest NOAA station, plus waves, swell and sea temperature." "charts.js ocean.js" yes <<EOF
$(head_block "Live conditions" "Ocean" "Tide times and heights from your nearest NOAA tide station, plus waves, swell and sea temperature along the coast." "$(src https://tidesandcurrents.noaa.gov/ "NOAA Tides &amp; Currents")$(src https://open-meteo.com/en/docs/marine-weather-api "Open-Meteo Marine")")

    <div id="oceanStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Next high tide</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Next low tide</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Wave height</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Sea temperature</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="stationHeading">
          <div class="panel-head">
            <div>
              <h2 id="stationHeading">Tide station</h2>
              <p id="stationSub" class="panel-sub">The nearest station to your location</p>
            </div>
          </div>
          <div id="stationOut">$(empty waves "Choose a location to find its nearest tide station.")</div>
        </section>
        <section class="panel" aria-labelledby="tideTableHeading">
          <div class="panel-head"><h2 id="tideTableHeading">Upcoming tides</h2></div>
          <div id="tideTable">$(empty clock "High and low tides appear once a station is selected.")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Tide station map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Legend</div>
            <div id="oceanLegend"></div>
            <p id="stationCount" class="map-card-note">Loading tide stations…</p>
          </div>
        </div>
      </section>
    </div>

    <div class="row row-2">
      <section class="panel" aria-labelledby="tideChartHeading">
        <div class="panel-head">
          <div>
            <h2 id="tideChartHeading">Tide, next 24 hours</h2>
            <p id="tideChartSub" class="panel-sub">Predicted height in feet above mean lower low water (MLLW)</p>
          </div>
        </div>
        <div id="tideChart">$(empty clock "The tide curve appears once a station is selected.")</div>
      </section>

      <section class="panel" aria-labelledby="marineHeading">
        <div class="panel-head">
          <div>
            <h2 id="marineHeading">Sea conditions</h2>
            <p class="panel-sub">Waves, swell and water temperature right now</p>
          </div>
        </div>
        <div id="marineOut">$(empty waves "Sea conditions appear once you pick a location.")</div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# ISS
# --------------------------------------------------------------------------
page iss.html "ISS Tracker" "Where the International Space Station is right now, its orbit path, and when it passes over you." "https://cdnjs.cloudflare.com/ajax/libs/satellite.js/5.0.0/satellite.min.js iss.js" yes <<EOF
$(head_block "Live, updated every second" "ISS tracker" "Where the International Space Station is right now, where it's heading, and when you can see it pass over your location." "$(src https://celestrak.org/ CelesTrak)")

    <div id="issStats" class="kpis" aria-live="off">
      <div class="stat"><div class="stat-label">Altitude</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Speed</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Position</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Next visible pass</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="passHeading">
          <div class="panel-head">
            <div>
              <h2 id="passHeading">Passes over you</h2>
              <p id="passSub" class="panel-sub">Next 3 days</p>
            </div>
          </div>
          <div id="passList">$(empty map-pin "Choose a location to see when the ISS passes over.")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="ISS map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Tracking</div>
            <label class="switch"><input type="checkbox" id="toggleFollow" checked> Follow the ISS</label>
            <div class="legend-row" style="margin-top:10px"><span class="swatch" style="background:#c0612a"></span>Next 95 minutes</div>
            <div class="legend-row"><span class="swatch" style="background:#134b70;opacity:.5"></span>Last 45 minutes</div>
            <div class="legend-row"><span class="swatch" style="background:rgba(192,97,42,.15);box-shadow:inset 0 0 0 1px #c0612a"></span>Can see the ISS now</div>
            <p id="issNote" class="map-card-note">Loading orbit data…</p>
          </div>
        </div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Wildfires
# --------------------------------------------------------------------------
page wildfires.html "Wildfires" "Active wildfire perimeters across the United States, with size, containment and distance from you." "wildfires.js" yes <<EOF
$(head_block "Updated continuously" "Wildfires" "Every active wildfire perimeter currently mapped by US fire agencies, with size, containment and how far each fire is from you." "$(src https://data-nifc.opendata.arcgis.com/ "NIFC WFIGS")")

    <div id="fireStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Active perimeters</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Area burned</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Largest</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Nearest to you</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="fireListHeading">
          <div class="panel-head">
            <div>
              <h2 id="fireListHeading">Largest active fires</h2>
              <p id="wfStatus" class="panel-sub">Loading fire perimeters…</p>
            </div>
            <button id="btnReloadPerimeters" class="btn btn-ghost" type="button" aria-label="Reload fire perimeters"><svg data-icon="refresh"></svg>Reload</button>
          </div>
          <div id="fireList">$(empty flame "Loading fires…")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Wildfire map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Legend</div>
            <div class="legend-row"><span class="swatch" style="background:rgba(208,59,59,.3);box-shadow:inset 0 0 0 2px #d03b3b;border-radius:3px"></span>Fire perimeter</div>
            <div class="legend-row"><span class="swatch" style="background:#d03b3b"></span>Fire location</div>
            <p class="map-card-note">Dot size shows fire size. Dots hide when you zoom in close.</p>
          </div>
        </div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# Seismic
# --------------------------------------------------------------------------
page seismic.html "Seismic" "Magnitude 2.5+ earthquakes worldwide from the past day and week, sized by magnitude and colored by depth." "seismic.js" yes <<EOF
$(head_block "Near real time" "Seismic activity" "Magnitude 2.5 and stronger earthquakes around the world, sized by magnitude and colored by depth. Click any point for details." "$(src https://earthquake.usgs.gov/fdsnws/event/1/ USGS)")

    <div id="quakeStats" class="kpis" aria-live="polite">
      <div class="stat"><div class="stat-label">Past 24 hours</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Past 7 days</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Strongest</div><div class="stat-value">—</div></div>
      <div class="stat"><div class="stat-label">Nearest to you</div><div class="stat-value">—</div></div>
    </div>

    <div class="dashboard">
      <div class="stack">
$LOCATION_PANEL
        <section class="panel" aria-labelledby="quakeListHeading">
          <div class="panel-head">
            <div>
              <h2 id="quakeListHeading">Strongest earthquakes</h2>
              <p id="quakeListSub" class="panel-sub">Past 24 hours, by magnitude</p>
            </div>
          </div>
          <div id="quakeList">$(empty activity "Loading earthquakes…")</div>
        </section>
      </div>

      <section class="panel map-panel" aria-label="Earthquake map">
        <div id="map"></div>
        <div class="map-overlay">
          <div class="map-card">
            <div class="map-card-title">Time range</div>
            <label class="switch"><input type="checkbox" id="togglePastWeek"> Show past 7 days</label>
            <p id="eqStatus" class="map-card-note">Loading earthquakes…</p>
          </div>
          <div class="map-card">
            <div class="map-card-title">Depth</div>
            <div id="depthLegend"></div>
          </div>
        </div>
      </section>
    </div>
EOF

# --------------------------------------------------------------------------
# About
# --------------------------------------------------------------------------
source_card() { # ICON URL NAME DESCRIPTION USED_ON COVERAGE UPDATES
  cat <<EOF
          <article class="source">
            <div class="source-icon"><svg data-icon="$1"></svg></div>
            <div>
              <h3><a href="$2" $EXT>$3</a></h3>
              <p>$4</p>
              <ul class="source-facts">
                <li><strong>Used on:</strong> $5</li>
                <li><strong>Coverage:</strong> $6</li>
                <li><strong>Updates:</strong> $7</li>
              </ul>
            </div>
          </article>
EOF
}

feature() { # HREF ICON TITLE TEXT
  echo "          <a class=\"feature\" href=\"$1\"><svg data-icon=\"$2\"></svg><h3>$3</h3><p>$4</p></a>"
}

page about.html "About" "What The Nerd Map is, where its data comes from and how your location is used." "" no <<EOF
    <div class="narrow">
      <div class="page-head">
        <div>
          <p class="eyebrow">About</p>
          <h1>About The Nerd Map</h1>
          <p class="lede">The Nerd Map brings live environmental data from trusted public sources together on one set of interactive maps, so you can see what the sky, the air and the ground are doing anywhere you care about.</p>
        </div>
      </div>

      <div class="stack">
        <section class="panel" aria-labelledby="exploreHeading">
          <div class="panel-head"><h2 id="exploreHeading">What you can explore</h2></div>
          <div class="feature-grid">
$(feature index.html cloud-sun Weather "Conditions, 24-hour and 7-day forecasts, humidity, and radar, satellite and humidity map layers.")
$(feature wildfires.html flame Wildfires "Active US fire perimeters with size, containment and distance from you.")
$(feature seismic.html activity Seismic "M2.5+ earthquakes worldwide from the past day or week.")
$(feature air.html wind Air "The US Air Quality Index, pollutant levels and a 24-hour AQI forecast.")
$(feature severe.html alert "Severe Weather" "US warnings, watches and advisories, plus hurricane tracks and cones.")
$(feature events.html map "Natural Events" "Storms, wildfires, volcanoes, icebergs and more, worldwide.")
$(feature aurora.html sun "Aurora" "Where the northern lights may be visible, plus the Kp forecast.")
$(feature ocean.html waves "Ocean" "Tide times from the nearest NOAA station, plus waves and sea temperature.")
$(feature iss.html satellite "ISS" "Where the space station is now, and when it passes over you.")
          </div>
        </section>

        <section class="panel" aria-labelledby="sourcesHeading">
          <div class="panel-head">
            <div>
              <h2 id="sourcesHeading">Where the data comes from</h2>
              <p class="panel-sub">Every reading is fetched live from these public services, straight from your browser. Nothing is cached or edited by The Nerd Map.</p>
            </div>
          </div>
          <div class="source-list">
$(source_card cloud-sun https://open-meteo.com/ "Open-Meteo Forecast API" "An open-source weather API that blends forecast models from national weather services, including NOAA's GFS and HRRR in the US, ECMWF and Germany's DWD, into one consistent forecast. Data is licensed CC&nbsp;BY&nbsp;4.0." "Weather" "Worldwide" "Current conditions every 15 minutes; forecast models refresh hourly to every few hours")
$(source_card wind https://open-meteo.com/en/docs/air-quality-api "Open-Meteo Air Quality API" "Air-pollution forecasts from the Copernicus Atmosphere Monitoring Service (CAMS), the European Union's atmospheric monitoring program. The US AQI is calculated from the pollutant concentrations using EPA breakpoints." "Air" "Worldwide (about 45&nbsp;km grid; 11&nbsp;km in Europe)" "Hourly values; forecasts refresh several times a day")
$(source_card search https://open-meteo.com/en/docs/geocoding-api "Open-Meteo Geocoding API" "Powers the city search box. Place names and coordinates come from the GeoNames geographical database." "Every map page" "Worldwide" "Static reference data")
$(source_card rain https://www.rainviewer.com/api.html "RainViewer" "A global precipitation radar mosaic assembled from weather radars run by national meteorological services around the world." "Weather (radar layer)" "Regions with weather radar" "Every 10 minutes")
$(source_card satellite https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api "NASA GIBS · NOAA GOES-East" "NASA's Global Imagery Browse Services provides GeoColor imagery from NOAA's GOES-East satellite: true color by day, infrared cloud imagery by night." "Weather (satellite layer)" "North and South America" "Every 10 minutes; the newest frame is usually 30–60 minutes old")
$(source_card flame https://data-nifc.opendata.arcgis.com/ "NIFC · WFIGS Interagency Fire Perimeters" "Current wildfire perimeters from the National Interagency Fire Center's Wildland Fire Interagency Geospatial Services, compiled from federal, state and local fire agencies." "Wildfires" "United States" "As incident teams map new perimeters, often daily on active fires")
$(source_card alert https://www.weather.gov/ "National Weather Service" "Official US watches, warnings and advisories. Alert shapes come from NOAA's watch/warning map service; the alerts for your location, with full text and safety instructions, come from the api.weather.gov alerts API." "Severe Weather" "United States and coastal waters" "As forecast offices issue alerts, typically within minutes")
$(source_card storm https://www.nhc.noaa.gov/ "National Hurricane Center" "Forecast positions, track and cone of uncertainty for active tropical storms and hurricanes, served by NOAA's tropical weather map service." "Severe Weather" "Atlantic, East and Central Pacific" "With each advisory, usually every 6 hours (more often near land)")
$(source_card map https://eonet.gsfc.nasa.gov/ "NASA EONET" "The Earth Observatory Natural Event Tracker, a curated catalog of natural events (storms, wildfires, volcanoes, icebergs and more) linked to their original sources." "Natural Events" "Worldwide" "Daily, as events are added or updated")
$(source_card sun https://www.swpc.noaa.gov/ "NOAA Space Weather Prediction Center" "The OVATION aurora model's probability of aurora overhead, plus the observed and forecast planetary Kp index of geomagnetic activity." "Aurora" "Worldwide (both hemispheres)" "Aurora every ~30 minutes; Kp every 3 hours")
$(source_card waves https://tidesandcurrents.noaa.gov/ "NOAA Tides &amp; Currents" "Tide predictions (high and low times and heights, plus a 30-minute tide curve where the station publishes one) for about 3,500 tide stations, from NOAA's Center for Operational Oceanographic Products and Services." "Ocean" "US coasts and territories" "Predictions are computed years ahead; the station list is cached for a week")
$(source_card wind https://open-meteo.com/en/docs/marine-weather-api "Open-Meteo Marine" "Wave height, period and direction, swell and sea surface temperature from ocean wave models (including ECMWF and NOAA WaveWatch III). For inland locations the nearest tide station's coast is used." "Ocean" "Worldwide oceans and coasts" "Hourly")
$(source_card satellite https://celestrak.org/ "CelesTrak" "The ISS's current orbital elements (a two-line element set). Position, ground track and passes are then computed in your browser with the open-source satellite.js library (SGP4). wheretheiss.at is used as a backup source." "ISS" "Worldwide" "Orbit data a few times a day; position every second")
$(source_card activity https://earthquake.usgs.gov/fdsnws/event/1/ "USGS Earthquake Hazards Program" "The U.S. Geological Survey's earthquake catalog, combining the USGS network with contributing seismic networks worldwide." "Seismic" "Worldwide, magnitude 2.5 and above" "Near real time, typically within minutes")
          </div>
        </section>

        <section class="panel" aria-labelledby="mapsHeading">
          <div class="panel-head"><h2 id="mapsHeading">Maps and tools</h2></div>
          <div class="source-list">
$(source_card map https://www.openstreetmap.org/copyright "OpenStreetMap" "Map data &copy; OpenStreetMap contributors, available under the Open Database License." "Every map" "Worldwide" "Continuously, by volunteers")
$(source_card layers https://www.esri.com/ "Esri basemaps" "The Light Gray Canvas and World Street Map styles, served from ArcGIS Online, with map data from Esri, HERE, Garmin, FAO, NOAA, USGS and OpenStreetMap contributors." "Every map" "Worldwide" "Regularly")
$(source_card map-pin https://leafletjs.com/ "Leaflet" "The open-source JavaScript library that powers every interactive map on the site." "Every map" "Desktop and mobile browsers" "Version 1.9.4")
          </div>
        </section>

        <div class="row row-2" style="margin-top:0">
          <div class="callout"><svg data-icon="shield"></svg><p><strong>Your location stays on your device.</strong> When you search for a city or share your location, it's saved in your browser so every page opens on the same place. Its coordinates are only sent to the services listed above, to fetch readings and map tiles. The Nerd Map has no accounts and no analytics.</p></div>
          <div class="callout warning"><svg data-icon="alert"></svg><p><strong>Not for emergency use.</strong> Data can be delayed, incomplete or based on models. For warnings and safety decisions, rely on official sources such as <a href="https://www.weather.gov/" $EXT>weather.gov</a>, <a href="https://www.airnow.gov/" $EXT>AirNow</a>, <a href="https://inciweb.wildfire.gov/" $EXT>InciWeb</a> and the <a href="https://earthquake.usgs.gov/" $EXT>USGS</a>.</p></div>
        </div>
      </div>
    </div>
EOF

echo "Generated: $(ls *.html | tr '\n' ' ')"
