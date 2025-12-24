document.addEventListener("DOMContentLoaded", () => {

  /* =====================
     ELEMENTS
  ===================== */
  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const randomBtn = document.getElementById("randomBtn");
  const darkToggleBtn = document.getElementById("toggleDark");
  const feelsToggleBtn = document.getElementById("feelsToggle");

  const output = document.getElementById("output");
  const hourlyDiv = document.getElementById("hourlyForecast");
  const forecastDiv = document.getElementById("forecast");
  const bestHoursDiv = document.getElementById("bestHours");
  const uvContainer = document.getElementById("uvContainer");
  const outsideScoreDiv = document.getElementById("outsideScore");
  const mapDiv = document.getElementById("map");

  let autoLocationTried = false;
  let showFeelsLike = localStorage.getItem("nimbus_feels") === "1";
  let lastRequest = null;

  /* =====================
     DARK MODE
  ===================== */
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

  /* =====================
     WEATHER BACKGROUNDS
  ===================== */
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
    } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
      document.body.classList.add("snowy");
    } else {
      document.body.classList.add("rainy");
    }
  }

  /* =====================
     HELPERS
  ===================== */
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  function isNight(data) {
    const now = new Date(data.current_weather.time).getTime();
    const sunrise = new Date(data.daily.sunrise[0]).getTime();
    const sunset = new Date(data.daily.sunset[0]).getTime();
    return now < sunrise || now > sunset;
  }

  function currentHourIndex(data) {
    const now = new Date(data.current_weather.time).getTime();
    return data.hourly.time.findIndex(t => new Date(t).getTime() >= now);
  }

  /* =====================
     FEELS LIKE
  ===================== */
  function calculateFeelsLike(temp, wind) {
    if (temp <= 10 && wind > 4.8) {
      return Math.round(
        13.12 +
        0.6215 * temp -
        11.37 * Math.pow(wind, 0.16) +
        0.3965 * temp * Math.pow(wind, 0.16)
      );
    }
    return Math.round(temp);
  }

  feelsToggleBtn?.addEventListener("click", () => {
    showFeelsLike = !showFeelsLike;
    localStorage.setItem("nimbus_feels", showFeelsLike ? "1" : "0");
    const cached = localStorage.getItem("nimbus_last_weather");
    if (cached) renderCurrent(JSON.parse(cached));
  });

  /* =====================
     API (KNOWN GOOD)
  ===================== */
  function buildUrl(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      timezone: "auto",
      current_weather: "true",
      hourly: "temperature_2m,precipitation,windspeed_10m",
      daily: "weathercode,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset"
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
  }

  /* =====================
     UV + OUTSIDE SCORE
  ===================== */
  function renderUV(data) {
    const uv = data.daily.uv_index_max[0];
    if (uv === null || uv === undefined) return "";

    const now = Date.now();
    const sunrise = new Date(data.daily.sunrise[0]).getTime();
    const sunset = new Date(data.daily.sunset[0]).getTime();
    if (now < sunrise || now > sunset) return "";

    let cls = "uv-low", text = "Low – no suncream needed";
    if (uv >= 6) { cls = "uv-high"; text = "High – SPF essential"; }
    else if (uv >= 3) { cls = "uv-med"; text = "Moderate – SPF advised"; }

    return `<div class="uv-badge ${cls}">☀️ UV ${uv} – ${text}</div>`;
  }

  function calculateOutsideScore(data) {
    let score = 100;
    const temp = data.current_weather.temperature;
    const wind = data.current_weather.windspeed;

    if (temp < 5 || temp > 30) score -= 25;
    if (wind > 25) score -= 20;

    let rain = 0;
    const today = data.daily.time[0];
    data.hourly.time.forEach((t, i) => {
      if (t.startsWith(today)) rain += data.hourly.precipitation[i];
    });

    if (rain > 2) score -= 30;
    return Math.max(0, Math.round(score));
  }

  /* =====================
     BEST HOURS
  ===================== */
  function renderBestHours(data) {
    bestHoursDiv.innerHTML = "";
    const today = data.daily.time[0];
    let best = null;

    for (let i = 0; i < data.hourly.time.length - 1; i++) {
      if (!data.hourly.time[i].startsWith(today)) continue;

      const h = Number(data.hourly.time[i].slice(11, 13));
      if (h < 9 || h > 19) continue;

      let score = 100;
      if (data.hourly.precipitation[i] > 0.5) score -= 40;
      if (data.hourly.windspeed_10m[i] > 20) score -= 20;

      if (!best || score > best.score) {
        best = { h, score };
      }
    }

    if (best && best.score > 50) {
      bestHoursDiv.innerHTML =
        `🕒 Best time outside: <strong>${best.h}:00–${best.h + 1}:00</strong>`;
    }
  }

  /* =====================
     RENDER CURRENT
  ===================== */
  function renderCurrent(saved, offline = false) {
    const data = saved.data;
    const w = data.current_weather;

    applyWeatherClass(w.weathercode, isNight(data));

    const actual = num(w.temperature);
    const feels = calculateFeelsLike(actual, num(w.windspeed));

    output.innerHTML = `
      <div class="line">📍 ${saved.label}</div>
      <div class="line">${showFeelsLike ? `🤔 Feels like ${feels}°C` : `🌡️ ${actual}°C`}</div>
      <div class="line">💨 Wind: ${num(w.windspeed)} km/h</div>
      ${offline ? `<div class="line">📴 Offline data</div>` : ""}
    `;

    const score = calculateOutsideScore(data);
    let scoreClass = "good";
    if (score < 40) scoreClass = "bad";
    else if (score < 70) scoreClass = "okay";

    outsideScoreDiv.innerHTML = `
    <div class="outside-score ${scoreClass}">
      🌿 Outside score: <strong>${score}/100</strong>
    </div>
    `;


    uvContainer.innerHTML = renderUV(data);
    renderBestHours(data);
  }

  /* =====================
        RANDOM CITY
  ==================== */
  function showMap(lat, lon, label) {
  mapDiv.classList.remove("hidden");
  // Leaflet logic…
  }

  function hideMap() {
    mapDiv.classList.add("hidden");
  }

  randomBtn?.addEventListener("click", () => {
  console.log("🎲 Random clicked");

  const LAND_REGIONS = [
    { latMin: 36, latMax: 71, lonMin: -10, lonMax: 40 },   // Europe
    { latMin: 15, latMax: 72, lonMin: -170, lonMax: -50 },// N America
    { latMin: -55, latMax: 12, lonMin: -82, lonMax: -35 },// S America
    { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 }, // Africa
    { latMin: 5, latMax: 77, lonMin: 26, lonMax: 180 },   // Asia
    { latMin: -44, latMax: -10, lonMin: 112, lonMax: 154 }// Australia
  ];

  const r = LAND_REGIONS[Math.floor(Math.random() * LAND_REGIONS.length)];

  const lat = (Math.random() * (r.latMax - r.latMin) + r.latMin).toFixed(4);
  const lon = (Math.random() * (r.lonMax - r.lonMin) + r.lonMin).toFixed(4);

  hideMap(); // reset first
  fetchWeather(lat, lon, "🎲 Random land location");
  showMap(lat, lon, "🎲 Random land location");
});


  /* =====================
     HOURLY + DAILY
  ===================== */
  function renderHourly(data) {
    hourlyDiv.innerHTML = "";
    let start = currentHourIndex(data);
    for (let i = start; i < start + 24; i++) {
      hourlyDiv.innerHTML += `
        <div class="day">
          <div>${data.hourly.time[i].slice(11,16)}</div>
          <div>${data.hourly.temperature_2m[i]}°C</div>
          <div>${data.hourly.precipitation[i]} mm</div>
        </div>`;
    }
  }

  function renderDaily(data) {
    forecastDiv.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      forecastDiv.innerHTML += `
        <div class="day">
          <strong>${new Date(data.daily.time[i]).toLocaleDateString("en-GB",{weekday:"short"})}</strong>
          <div>⬆️ ${data.daily.temperature_2m_max[i]}°C</div>
          <div>⬇️ ${data.daily.temperature_2m_min[i]}°C</div>
        </div>`;
    }
  }

  /* =====================
     FETCH WEATHER
  ===================== */
  function fetchWeather(lat, lon, label) {
    lastRequest = { lat, lon, label };
    output.textContent = "Nimbus is checking the sky… ☁️";

    fetch(buildUrl(lat, lon))
      .then(r => r.ok ? r.json() : Promise.reject())
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
        }
      });
  }

  /* =====================
     SEARCH / LOCATION
  ===================== */
  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    hideMap();

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      .then(r => r.json())
      .then(d => {
        const c = d.results?.[0];
        if (c) fetchWeather(c.latitude, c.longitude, `${c.name}, ${c.country}`);
      });
  });

  locationBtn.addEventListener("click", () => {
    hideMap();
    navigator.geolocation.getCurrentPosition(pos => {
      fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Location");
    });
  });

  /* =====================
     AUTO LOCATION
  ===================== */
  setTimeout(() => {
    if (autoLocationTried) return;
    autoLocationTried = true;

    navigator.geolocation.getCurrentPosition(pos => {
      fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Location");
    });
  }, 800);

});
