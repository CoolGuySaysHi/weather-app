document.addEventListener("DOMContentLoaded", () => {
  const DateTime = luxon.DateTime;
  
/* =========================
   PWA UPDATE PROMPT
========================= */

let newWorker = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;

    if (reg.waiting) {
      showUpdatePrompt(reg.waiting);
    }

    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(installing);
        }
      });
    });
  });
}
function showUpdatePrompt(worker) {
  if (document.getElementById("updatePrompt")) return;

  const banner = document.createElement("div");
  banner.id = "updatePrompt";
  banner.innerHTML = `
    🔄 <strong>Nimbus update available</strong>
    <button id="updateBtn">Refresh</button>
  `;

  Object.assign(banner.style, {
    position: "fixed",
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#333",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: "8px",
    zIndex: "9999",
    display: "flex",
    gap: "10px",
    alignItems: "center"
  });

  document.body.appendChild(banner);

  document.getElementById("updateBtn").onclick = () => {
    worker.postMessage("SKIP_WAITING");
  };
}

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
     PWA: SERVICE WORKER
  ========================= */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/weather-app/sw.js")
        .then(() => console.log("Nimbus PWA ready ☁️"))
        .catch(err => console.log("Service Worker failed", err));
    });
  }

  /* =========================
     DARK MODE (MANUAL OVERRIDE)
  ========================= */
  if (localStorage.getItem("nimbus_dark") === "1") {
    document.body.classList.add("dark");
  }

  toggleDarkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "nimbus_dark",
      document.body.classList.contains("dark") ? "1" : "0"
    );
  });

  /* =========================
     HELPERS
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

  function getWeatherClass(code, isNight) {
    if (code === 0) return isNight ? "clear-night" : "sunny";
    if (code <= 3 || code <= 48) return "cloudy";
    if (code <= 67 || code <= 82) return "rainy";
    if (code <= 77) return "snowy";
    return "cloudy";
  }

  function dailyWeatherLabel(code) {
    if (code === 0) return "☀️ Sunny";
    if (code <= 3) return "☁️ Cloudy";
    if (code <= 48) return "🌫️ Foggy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "❄️ Snowy";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Stormy";
  }

  function uvBadge(uv, temp) {
    let cls = "uv-low";
    let advice = "No suncream needed (unless you're a vampire 🧛‍♂️)";

    if (uv >= 3 || temp >= 18) {
      cls = "uv-moderate";
      advice = "SPF 15+ recommended 🧴";
    }
    if (uv >= 6 || temp >= 22) {
      cls = "uv-high";
      advice = "SPF 30+ strongly recommended 🧴";
    }
    if (uv >= 8 || temp >= 26) {
      cls = "uv-very-high";
      advice = "SPF 50+, hat & shade 😎";
    }
    if (uv >= 11 || temp >= 30) {
      cls = "uv-extreme";
      advice = "Avoid midday sun ☀️🚫";
    }

    return `
      <div class="uv-badge ${cls}">
        <div class="uv-main">☀️ UV ${uv}</div>
        <div class="uv-advice">${advice}</div>
      </div>
    `;
  }

  /* =========================
     WEATHER ALERTS
  ========================= */

  function renderAlert(alerts) {
    const old = document.getElementById("weatherAlert");
    if (old) old.remove();

    if (!alerts || !alerts.length) return;

    const alert = alerts[0];
    let level = "yellow";

    if (alert.severity === "moderate") level = "amber";
    if (alert.severity === "severe" || alert.severity === "extreme")
      level = "red";

    const banner = document.createElement("div");
    banner.id = "weatherAlert";
    banner.className = `alert alert-${level}`;
    banner.innerHTML = `
      ⚠️ <strong>Weather Warning: ${alert.event}</strong><br>
      ${alert.description}
    `;

    output.insertAdjacentElement("afterend", banner);
  }

  function outsideScore(temp, rainChance, wind, uv) {
  let score = 100;
  const reasons = [];

  // Temperature
  if (temp < 5) {
    score -= 30;
    reasons.push("very cold");
  } else if (temp < 10) {
    score -= 15;
    reasons.push("chilly");
  } else if (temp > 30) {
    score -= 30;
    reasons.push("very hot");
  }

  // Rain
  if (rainChance > 70) {
    score -= 40;
    reasons.push("heavy rain likely");
  } else if (rainChance > 40) {
    score -= 20;
    reasons.push("chance of rain");
  }

  // Wind
  if (wind > 35) {
    score -= 25;
    reasons.push("very windy");
  } else if (wind > 20) {
    score -= 10;
    reasons.push("windy");
  }

  // UV
  if (uv >= 9) {
    score -= 15;
    reasons.push("very high UV");
  }

  score = Math.max(score, 0);

  if (score >= 70) {
    return {
      text: "🟢 Great time to go outside",
      reason: "Conditions are looking good",
      class: "outside-good"
    };
  }

  if (score >= 40) {
    return {
      text: "🟠 Okay, but be prepared",
      reason: reasons.join(", "),
      class: "outside-meh"
    };
  }

  return {
    text: "🔴 Probably stay inside",
    reason: reasons.join(", "),
    class: "outside-bad"
  };
}

  /* =========================
     FETCH WEATHER
  ========================= */

  function fetchWeather(lat, lon, label) {
    output.textContent = "Nimbus is checking the sky… ☁️";

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true` +
        `&daily=weathercode,temperature_2m_max,sunrise,sunset,uv_index_max` +
        `&hourly=temperature_2m,precipitation_probability` +
        `&alerts=true` +
        `&timezone=auto`
    )
      .then(res => res.json())
      .then(data => {
        // Save for offline use
        localStorage.setItem(
          "nimbus_last_weather",
          JSON.stringify({ label, data, time: Date.now() })
        );

        const w = data.current_weather;
        const zone = data.timezone;

        const now = DateTime.fromISO(w.time, { zone });
        const sunrise = DateTime.fromISO(data.daily.sunrise[0], { zone });
        const sunset = DateTime.fromISO(data.daily.sunset[0], { zone });
        const isNight = now < sunrise || now > sunset;

        clearWeatherClasses();
        document.body.classList.add(getWeatherClass(w.weathercode, isNight));

        const uv = data.daily.uv_index_max[0];
        const rainSoon = data.hourly.precipitation_probability[0] ?? 0;

        const outside = outsideScore(
          w.temperature,
          rainSoon,
          w.windspeed,
          uv
        );


        output.innerHTML = `
          <div class="line">📍 ${label}</div>
          <div class="line">🌡️ ${w.temperature}°C</div>
          <div class="line">💨 Wind: ${w.windspeed} km/h</div>
          <div class="outside-score ${outside.class}">
          <strong>${outside.text}</strong><br>
          <small>${outside.reason}</small>
          </div>
          ${!isNight ? `<div class="line">${uvBadge(uv, w.temperature)}</div>` : ""}
        `;

        renderAlert(data.alerts);

        /* ===== 5 DAY FORECAST ===== */
        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              <strong>${DateTime.fromISO(data.daily.time[i]).toFormat("ccc")}</strong><br>
              ${dailyWeatherLabel(data.daily.weathercode[i])}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
            </div>
          `;
        }

        /* ===== HOURLY FORECAST ===== */
        hourlyDiv.innerHTML = "";
        const start = data.hourly.time.findIndex(t =>
          DateTime.fromISO(t, { zone }) >= now
        );

        for (let i = start; i < start + 24; i++) {
          hourlyDiv.innerHTML += `
            <div class="day">
              ${DateTime.fromISO(data.hourly.time[i], { zone }).toFormat("HH:mm")}<br>
              🌡️ ${data.hourly.temperature_2m[i]}°C<br>
              🌧️ ${data.hourly.precipitation_probability[i] ?? 0}%
            </div>
          `;
        }
      })
      .catch(() => {
        const cached = localStorage.getItem("nimbus_last_weather");
        if (cached) {
          const saved = JSON.parse(cached);
          output.innerHTML = `
            <div class="line">📍 ${saved.label}</div>
            <div class="line">Offline mode</div>
            <div class="line">
              Last updated: ${new Date(saved.time).toLocaleTimeString()}
            </div>
          `;
        } else {
          output.textContent = "Offline and no saved data ☁️";
        }
      });
  }

  /* =========================
     SEARCH
  ========================= */

  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    )
      .then(res => res.json())
      .then(data => {
        if (!data.results?.length) throw new Error();
        const c = data.results[0];
        fetchWeather(c.latitude, c.longitude, `${c.name}, ${c.country}`);
      })
      .catch(() => {
        output.textContent = "City not found 😕";
      });
  });

  cityInput.addEventListener("keydown", e => {
    if (e.key === "Enter") searchBtn.click();
  });

  /* =========================
     AUTO LOCATION
  ========================= */

  navigator.geolocation.getCurrentPosition(pos => {
    fetchWeather(pos.coords.latitude, pos.coords.longitude, "Your Location");
  });
});
