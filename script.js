document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     ELEMENTS
  ========================= */
  const urlParams = new URLSearchParams(location.search);
  const sharedLat = urlParams.get("lat");
  const sharedLon = urlParams.get("lon");
  const sharedLabel = urlParams.get("label");
  const isSharedLink = sharedLat !== null && sharedLon !== null;


  if (isSharedLink) {
    fetchWeather(sharedLat, sharedLon, sharedLabel || "Shared location");
  }


  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const randomBtn = document.getElementById("randomBtn");
  const shareBtn = document.getElementById("shareBtn");
  const darkToggleBtn = document.getElementById("toggleDark");

  const output = document.getElementById("output");
  const forecastDiv = document.getElementById("forecast");
  const hourlyDiv = document.getElementById("hourlyForecast");
  const mapDiv = document.getElementById("map");

  let lastRequest = null;
  let lastCoords = null;
  let autoLocationTried = false;
  let sharedLinkUsed = false;

  /* =========================
     DARK MODE
  ========================= */
  if (localStorage.getItem("nimbus_dark") === "1") {
    document.body.classList.add("dark");
  }

  darkToggleBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "nimbus_dark",
      document.body.classList.contains("dark") ? "1" : "0"
    );
  });

  /* =========================
     WEATHER BACKGROUNDS
  ========================= */
  function clearWeatherClasses() {
    document.body.classList.remove(
      "sunny",
      "cloudy",
      "rainy",
      "snowy",
      "clear-night"
    );
  }

  function applyWeatherClass(code, night) {
    clearWeatherClasses();

    if (code === 0) {
      document.body.classList.add(night ? "clear-night" : "sunny");
    } else if (code <= 48) {
      document.body.classList.add("cloudy");
    } else if (
      (code >= 71 && code <= 77) ||
      (code >= 85 && code <= 86)
    ) {
      document.body.classList.add("snowy");
    } else if (
      (code >= 51 && code <= 67) ||
      (code >= 80 && code <= 82) ||
      code >= 95
    ) {
      document.body.classList.add("rainy");
    } else {
      document.body.classList.add("cloudy");
    }
  }

  /* =========================
     HELPERS
  ========================= */
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;

  function isNight(data) {
    const now = new Date(data.current_weather.time).getTime();
    const sunrise = new Date(data.daily.sunrise[0]).getTime();
    const sunset = new Date(data.daily.sunset[0]).getTime();
    return now < sunrise || now > sunset;
  }

  function currentHourIndex(data) {
    const now = new Date(data.current_weather.time).getTime();
    for (let i = 0; i < data.hourly.time.length; i++) {
      if (new Date(data.hourly.time[i]).getTime() >= now) return i;
    }
    return 0;
  }

  /* =========================
     API
  ========================= */
  function buildForecastUrl(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      timezone: "auto",
      current_weather: "true",
      daily:
        "weathercode,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset",
      hourly: "temperature_2m,precipitation"
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
  }

  /* =========================
     UV INDEX
  ========================= */
  function renderUV(data) {
    const uv = data.daily.uv_index_max[0];
    if (uv == null) return "";

    const now = new Date(data.current_weather.time).getTime();
    const sunrise = new Date(data.daily.sunrise[0]).getTime();
    const sunset = new Date(data.daily.sunset[0]).getTime();
    if (now < sunrise || now > sunset) return "";

    let advice = "", cls = "";
    if (uv < 3) { advice = "Low – no suncream needed"; cls = "uv-low"; }
    else if (uv < 6) { advice = "Moderate – SPF recommended"; cls = "uv-med"; }
    else if (uv < 8) { advice = "High – SPF essential"; cls = "uv-high"; }
    else { advice = "Very high – avoid midday sun"; cls = "uv-extreme"; }

    return `<div class="uv-badge ${cls}">☀️ UV ${uv} – ${advice}</div>`;
  }

  /* =========================
     OUTSIDE SCORE
  ========================= */
  function calculateOutsideScore(data) {
    let score = 100;
    const temp = data.current_weather.temperature;
    const wind = data.current_weather.windspeed;

    if (temp < 5 || temp > 30) score -= 25;
    else if (temp < 10 || temp > 25) score -= 10;

    if (wind > 30) score -= 20;
    else if (wind > 20) score -= 10;

    const today = data.daily.time[0];
    let dayRain = 0;

    for (let i = 0; i < data.hourly.time.length; i++) {
      if (!data.hourly.time[i].startsWith(today)) continue;
      const hour = Number(data.hourly.time[i].slice(11, 13));
      if (hour >= 7 && hour < 22) {
        dayRain += data.hourly.precipitation[i] || 0;
      }
    }

    if (dayRain > 2) score -= 30;
    else if (dayRain > 0.5) score -= 15;

    const uv = data.daily.uv_index_max[0];
    if (uv >= 8) score -= 20;
    else if (uv >= 6) score -= 10;

    return Math.max(0, Math.round(score));
  }

  /* =========================
     CURRENT WEATHER
  ========================= */
  function renderCurrent(saved, offline = false) {
    const data = saved.data;
    const w = data.current_weather;

    applyWeatherClass(w.weathercode, isNight(data));

    const score = calculateOutsideScore(data);
    let scoreClass = "good";
    if (score < 40) scoreClass = "bad";
    else if (score < 70) scoreClass = "okay";

    output.innerHTML = `
      <div class="line">📍 ${saved.label}</div>
      <div class="line">🌡️ ${num(w.temperature)}°C</div>
      <div class="line">💨 Wind: ${num(w.windspeed)} km/h</div>

      <div class="outside-score ${scoreClass}">
        🌿 Outside score: <strong>${score}/100</strong>
      </div>

      ${renderUV(data)}
      ${offline ? `<div class="line">📴 Offline data</div>` : ""}
      <div class="line">Updated: ${new Date(saved.time).toLocaleTimeString("en-GB")}</div>
    `;
  }

  /* =========================
     HOURLY FORECAST
  ========================= */
  function renderHourly(data) {
    hourlyDiv.innerHTML = "";
    const start = currentHourIndex(data);

    for (let i = start; i < start + 24 && i < data.hourly.time.length; i++) {
      hourlyDiv.innerHTML += `
        <div class="day">
          <div>${data.hourly.time[i].slice(11, 16)}</div>
          <div>🌡️ ${data.hourly.temperature_2m[i]}°C</div>
          <div>🌧️ ${data.hourly.precipitation[i]} mm</div>
        </div>
      `;
    }
  }

  /* =========================
     5-DAY FORECAST
  ========================= */
  function renderDaily(data) {
    forecastDiv.innerHTML = "";

    for (let i = 0; i < 5; i++) {
      const date = data.daily.time[i];
      let dayRain = 0, nightRain = 0;

      for (let h = 0; h < data.hourly.time.length; h++) {
        if (!data.hourly.time[h].startsWith(date)) continue;
        const hour = Number(data.hourly.time[h].slice(11, 13));
        const rain = data.hourly.precipitation[h] || 0;
        if (hour >= 7 && hour < 22) dayRain += rain;
        else nightRain += rain;
      }

      let label = "Cloudy", emoji = "☁️";
      const code = data.daily.weathercode[i];

      if (dayRain > 0.5) {
        label = "Rainy"; emoji = "🌧️";
      } else if (nightRain > 0.5) {
        label = "Overnight rain only"; emoji = "🌙🌧️";
      } else if (code === 0) {
        label = "Sunny"; emoji = "☀️";
      } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        label = "Snowy"; emoji = "❄️";
      }

      forecastDiv.innerHTML += `
        <div class="day">
          <strong>${new Date(date).toLocaleDateString("en-GB",{weekday:"short"})}</strong>
          <div>${emoji} ${label}</div>
          <div>⬆️ ${data.daily.temperature_2m_max[i]}°C</div>
          <div>⬇️ ${data.daily.temperature_2m_min[i]}°C</div>
        </div>
      `;
    }
  }

  /* =========================
     FETCH WEATHER
  ========================= */
  function fetchWeather(lat, lon, label) {
    lastRequest = { lat, lon, label };
    lastCoords = { lat, lon, label };
    output.textContent = "Nimbus is checking the sky… ☁️";

    fetch(buildForecastUrl(lat, lon))
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const saved = { label, data, time: Date.now() };
        localStorage.setItem("nimbus_last_weather", JSON.stringify(saved));
        renderCurrent(saved);
        renderHourly(data);
        renderDaily(data);
      })
      .catch(() => {
        const cached = localStorage.getItem("nimbus_last_weather");
        if (cached) {
          const saved = JSON.parse(cached);
          renderCurrent(saved, true);
          renderHourly(saved.data);
          renderDaily(saved.data);
        } else {
          output.innerHTML = `
            <div class="line">⚠️ Couldn’t load weather</div>
            <button id="retryBtn">🔄 Retry</button>
          `;
          document.getElementById("retryBtn").onclick = () => {
            if (lastRequest)
              fetchWeather(lastRequest.lat, lastRequest.lon, lastRequest.label);
          };
        }
      });
  }

  /* =========================
     SHARE
  ========================= */
  shareBtn?.addEventListener("click", () => {
  if (!lastCoords) {
    alert("Load a location first 🌍");
    return;
  }

  const params = new URLSearchParams({
    lat: lastCoords.lat,
    lon: lastCoords.lon,
    label: lastCoords.label
  });

  const shareUrl = `${location.origin}${location.pathname}?${params}`;

  // 📱 Mobile share (must be direct)
  if (navigator.share) {
    navigator.share({
      title: "Nimbus weather",
      text: `Weather for ${lastCoords.label}`,
      url: shareUrl
    }).catch(() => {
      // fallback if user cancels
    });
    return;
  }

  // 💻 Desktop / fallback
  try {
    navigator.clipboard.writeText(shareUrl);
    alert("🔗 Link copied to clipboard!");
  } catch {
    prompt("Copy this link:", shareUrl);
  }
});


  /* =========================
     SEARCH
  ========================= */
  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    hideMap();

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      .then(r => r.json())
      .then(d => {
        const r0 = d.results?.[0];
        if (!r0) throw new Error();
        fetchWeather(r0.latitude, r0.longitude, `${r0.name}, ${r0.country}`);
      })
      .catch(() => output.textContent = "City not found ❌");
  });

  /* =========================
     LOCATION
  ========================= */
  locationBtn.addEventListener("click", () => {
    hideMap();

    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Location"),
      () => output.textContent = "Location denied ❌"
    );
  });

  /* =========================
     RANDOM (LAND ONLY)
  ========================= */
  const LAND_REGIONS = [
    { latMin: 36, latMax: 71, lonMin: -10, lonMax: 40 },
    { latMin: 15, latMax: 72, lonMin: -170, lonMax: -50 },
    { latMin: -55, latMax: 12, lonMin: -82, lonMax: -35 },
    { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
    { latMin: 5, latMax: 77, lonMin: 26, lonMax: 180 },
    { latMin: -44, latMax: -10, lonMin: 112, lonMax: 154 }
  ];

  function getRandomLandCoordinates() {
    const r = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];
    return {
      lat: (Math.random() * (r.latMax - r.latMin) + r.latMin).toFixed(4),
      lon: (Math.random() * (r.lonMax - r.lonMin) + r.lonMin).toFixed(4)
    };
  }

  randomBtn?.addEventListener("click", () => {
    const { lat, lon } = getRandomLandCoordinates();
    fetchWeather(lat, lon, "🎲 Random land location");
    showMap(lat, lon, "🎲 Random land location");
  });

  /* =========================
     MAP
  ========================= */
  let map = null;
  let mapMarker = null;

  function showMap(lat, lon, label) {
    mapDiv.classList.remove("hidden");

    if (!map) {
      map = L.map("map").setView([lat, lon], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(map);
    } else {
      map.setView([lat, lon], 4);
    }

    if (!mapMarker) {
      mapMarker = L.marker([lat, lon]).addTo(map);
    } else {
      mapMarker.setLatLng([lat, lon]);
    }

    mapMarker.bindPopup(label).openPopup();
  }

  function hideMap() {
    mapDiv.classList.add("hidden");
  }

  /* =========================
     SHARED LINK LOAD
  ========================= */
  const params = new URLSearchParams(location.search);
  const lat = params.get("lat");
  const lon = params.get("lon");
  const label = params.get("label");

  if (lat && lon) {
    sharedLinkUsed = true;
    fetchWeather(lat, lon, label || "Shared location");
  }

});
