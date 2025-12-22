document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     ELEMENTS
  ========================= */
  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const toggleDarkBtn = document.getElementById("toggleDark");

  const output = document.getElementById("output");
  const forecastDiv = document.getElementById("forecast");
  const hourlyDiv = document.getElementById("hourlyForecast");

  /* =========================
     SERVICE WORKER
  ========================= */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/weather-app/sw.js").catch(() => {});
  }

  /* =========================
     DARK MODE
  ========================= */
  if (localStorage.getItem("nimbus_dark") === "1") {
    document.body.classList.add("dark");
  }

  toggleDarkBtn?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "nimbus_dark",
      document.body.classList.contains("dark") ? "1" : "0"
    );
  });

  /* =========================
     WEATHER HELPERS
  ========================= */
  function clearWeatherClasses() {
    document.body.classList.remove(
      "sunny", "cloudy", "rainy", "snowy", "clear-night"
    );
  }

  function getWeatherClass(code, isNight) {
    if (code === 0) return isNight ? "clear-night" : "sunny";
    if (code <= 3 || code <= 48) return "cloudy";
    if (code <= 67 || code <= 82) return "rainy";
    if (code <= 77) return "snowy";
    return "cloudy";
  }

  /* =========================
     TIME ALIGNMENT
  ========================= */
  function findCurrentHourIndex(data) {
    const times = data.hourly?.time;
    if (!times) return 0;

    const now = new Date(data.current_weather.time).getTime();
    for (let i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() >= now) return i;
    }
    return 0;
  }

  /* =========================
     UV BADGE
  ========================= */
  function uvBadge(uv, temp) {
    let cls = "uv-low";
    let advice = "No suncream needed";

    if (uv >= 3 || temp >= 18) { cls = "uv-moderate"; advice = "SPF 15+ recommended 🧴"; }
    if (uv >= 6 || temp >= 22) { cls = "uv-high"; advice = "SPF 30+ recommended 🧴"; }
    if (uv >= 8 || temp >= 26) { cls = "uv-very-high"; advice = "SPF 50+, hat & shade 😎"; }
    if (uv >= 11 || temp >= 30) { cls = "uv-extreme"; advice = "Avoid midday sun ☀️🚫"; }

    return `
      <div class="uv-badge ${cls}">
        <strong>☀️ UV ${uv}</strong><br>
        <small>${advice}</small>
      </div>
    `;
  }

  /* =========================
     OUTSIDE SCORE
  ========================= */
  function outsideScore(temp, rainSoon, wind, uv) {
    let score = 100;
    const reasons = [];

    if (temp < 5) { score -= 30; reasons.push("very cold"); }
    else if (temp < 10) { score -= 15; reasons.push("chilly"); }
    else if (temp > 30) { score -= 30; reasons.push("very hot"); }

    if (rainSoon > 70) { score -= 40; reasons.push("rain likely soon"); }
    else if (rainSoon > 40) { score -= 20; reasons.push("chance of rain"); }

    if (wind > 35) { score -= 25; reasons.push("very windy"); }
    else if (wind > 20) { score -= 10; reasons.push("windy"); }

    if (uv >= 9) { score -= 15; reasons.push("very high UV"); }

    score = Math.max(0, score);

    if (score >= 70) return { text: "🟢 Great time to go outside", class: "outside-good", reason: "Conditions look good" };
    if (score >= 40) return { text: "🟠 Okay, but be prepared", class: "outside-meh", reason: reasons.join(", ") };
    return { text: "🔴 Probably stay inside", class: "outside-bad", reason: reasons.join(", ") };
  }

  /* =========================
     DAY RAIN SUMMARY (SMART)
  ========================= */
  function dayRainSummary(data, dayIndex) {
    const day = data.daily.time[dayIndex];
    let daytimeRain = 0;
    let nightRain = 0;

    for (let i = 0; i < data.hourly.time.length; i++) {
      if (!data.hourly.time[i].startsWith(day)) continue;

      const hour = parseInt(data.hourly.time[i].slice(11, 13), 10);
      const rain = data.hourly.precipitation[i] ?? 0;

      if (hour >= 7 && hour <= 21) daytimeRain += rain;
      else nightRain += rain;
    }
    return { daytimeRain, nightRain };
  }

  function dayLabel(data, i) {
    const rain = dayRainSummary(data, i);
    if (rain.daytimeRain < 0.5 && rain.nightRain > 0.5) return "🌙 Overnight rain only";
    if (rain.daytimeRain < 0.5) return "☀️ Mostly dry";
    if (rain.daytimeRain < 2) return "🌦️ Light showers";
    return "🌧️ Rain likely";
  }

  /* =========================
     RENDER WEATHER
  ========================= */
  function renderWeather(saved, isOffline) {
    const data = saved.data;
    const w = data.current_weather;

    const startIndex = findCurrentHourIndex(data);
    const rainSoon = Math.max(
      ...data.hourly.precipitation_probability
        .slice(startIndex, startIndex + 3)
        .map(v => v ?? 0)
    );

    const outside = outsideScore(
      w.temperature,
      rainSoon,
      w.windspeed,
      data.daily.uv_index_max[0]
    );

    clearWeatherClasses();
    document.body.classList.add(getWeatherClass(w.weathercode, false));

    output.innerHTML = `
      <div class="line">📍 ${saved.label}</div>
      <div class="line">🌡️ ${w.temperature}°C</div>
      <div class="line">💨 Wind: ${w.windspeed} km/h</div>
      ${isOffline ? `<div class="line">📴 Offline mode</div>` : ""}
      <div class="line">Last updated: ${new Date(saved.time).toLocaleTimeString("en-GB")}</div>

      <div class="outside-score ${outside.class}">
        <strong>${outside.text}</strong><br>
        <small>${outside.reason}</small>
      </div>

      ${uvBadge(data.daily.uv_index_max[0], w.temperature)}
    `;

    forecastDiv.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      forecastDiv.innerHTML += `
        <div class="day">
          <strong>${new Date(data.daily.time[i]).toLocaleDateString("en-GB", { weekday: "short" })}</strong><br>
          ${dayLabel(data, i)}<br>
          🌡️ ${data.daily.temperature_2m_max[i]}°C
        </div>
      `;
    }

    hourlyDiv.innerHTML = "";
    for (let i = 0; i < 24; i++) {
      const idx = startIndex + i;
      if (!data.hourly.time[idx]) break;

      hourlyDiv.innerHTML += `
        <div class="day">
          ${data.hourly.time[idx].slice(11,16)}<br>
          🌡️ ${data.hourly.temperature_2m[idx]}°C<br>
          🌧️ ${data.hourly.precipitation_probability[idx] ?? 0}%
        </div>
      `;
    }
  }

  /* =========================
     FETCH WEATHER
  ========================= */
  function fetchWeather(lat, lon, label) {
    output.textContent = "Nimbus is checking the sky… ☁️";

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&daily=temperature_2m_max,uv_index_max,time` +
      `&hourly=temperature_2m,precipitation,precipitation_probability,time` +
      `&timezone=auto`
    )
      .then(r => r.json())
      .then(data => {
        const saved = { label, data, time: Date.now() };
        localStorage.setItem("nimbus_last_weather", JSON.stringify(saved));
        renderWeather(saved, false);
      })
      .catch(() => {
        const cached = localStorage.getItem("nimbus_last_weather");
        if (cached) renderWeather(JSON.parse(cached), true);
        else output.textContent = "Offline and no saved data ☁️";
      });
  }

  /* =========================
     SEARCH + LOCATION
  ========================= */
  searchBtn?.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      .then(r => r.json())
      .then(d => {
        const r0 = d.results[0];
        fetchWeather(r0.latitude, r0.longitude, `${r0.name}, ${r0.country}`);
      })
      .catch(() => output.textContent = "City not found 😕");
  });

  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Location")
  );
});
