document.addEventListener("DOMContentLoaded", () => {
  const DateTime = luxon.DateTime;

  /* =========================
     ELEMENTS
  ========================= */
  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const saveFavBtn = document.getElementById("saveFav");
  const darkBtn = document.getElementById("toggleDark");

  const output = document.getElementById("output");
  const forecastDiv = document.getElementById("forecast");
  const hourlyDiv = document.getElementById("hourlyForecast");
  const favList = document.getElementById("favorites");

  let lastCity = null;

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

  function applyRainWind(windSpeed) {
    const speed = Math.max(0.6, 1.3 - windSpeed / 40);
    document.body.style.setProperty("--rain-speed", `${speed}s`);
  }

function uvBadge(uv, temp) {
  let level = "Low";
  let cls = "uv-low";
  let advice = "No suncream needed (unless you're a vampire 🧛‍♂️)";

  // Base UV level
  if (uv >= 3) { level = "Moderate"; cls = "uv-moderate"; }
  if (uv >= 6) { level = "High"; cls = "uv-high"; }
  if (uv >= 8) { level = "Very High"; cls = "uv-very-high"; }
  if (uv >= 11) { level = "Extreme"; cls = "uv-extreme"; }

  // Combined UV + temperature advice
  if (uv >= 3 || temp >= 18) {
    advice = "SPF 15+ recommended 🧴";
  }
  if (uv >= 6 || temp >= 22) {
    advice = "SPF 30+ strongly recommended 🧴";
  }
  if (uv >= 8 || temp >= 26) {
    advice = "SPF 50+, hat & shade advised 😎";
  }
  if (uv >= 11 || temp >= 30) {
    advice = "SPF 50+, avoid midday sun ☀️🚫";
  }

  return `
    <div class="uv-badge ${cls}">
      <div class="uv-main">☀️ UV ${uv} – ${level}</div>
      <div class="uv-advice">${advice}</div>
    </div>
  `;
}



  


  function setAutoTheme(isNight) {
    if (document.body.getAttribute("data-theme") === "dark") return;
    document.body.setAttribute("data-theme", isNight ? "dark-bg" : "light-bg");
  }

  /* =========================
     FETCH WEATHER
  ========================= */

  function fetchWeather(lat, lon, label) {
    lastCity = label;
    output.textContent = "Loading weather… 🌍";

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&daily=weathercode,temperature_2m_max,sunrise,sunset,uv_index_max` +
      `&hourly=temperature_2m,precipitation_probability` +
      `&timezone=auto`
    )
      .then(res => res.json())
      .then(data => {
        const w = data.current_weather;
        const zone = data.timezone;

        const now = DateTime.fromISO(w.time, { zone });
        const sunrise = DateTime.fromISO(data.daily.sunrise[0], { zone });
        const sunset = DateTime.fromISO(data.daily.sunset[0], { zone });
        const isNight = now < sunrise || now > sunset;

        clearWeatherClasses();

        const weatherClass = getWeatherClass(w.weathercode, isNight);
        document.body.classList.add(weatherClass);
        setAutoTheme(isNight);

        if (weatherClass === "rainy") {
          applyRainWind(w.windspeed);
        }

        const uv = data.daily.uv_index_max[0];

        output.innerHTML = `
          <div class="line">📍 ${label}</div>
          <div class="line">🌡️ ${w.temperature}°C</div>
          <div class="line">💨 Wind: ${w.windspeed} km/h</div>
          ${!isNight ? `<div class="line">${uvBadge(uv,w.temperature)}</div>` : ""}
`       ;



        /* =========================
           5-DAY FORECAST
        ========================= */
        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              ${data.daily.time[i]}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
            </div>
          `;
        }

        /* =========================
           HOURLY (NEXT 24H)
        ========================= */
        hourlyDiv.innerHTML = "";
        const startIndex = data.hourly.time.findIndex(t =>
          DateTime.fromISO(t, { zone }) >= now
        );

        for (
          let i = startIndex;
          i < startIndex + 24 && i < data.hourly.time.length;
          i++
        ) {
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
        output.textContent = "Weather failed to load ☁️";
      });
  }

  /* =========================
     SEARCH CITY
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
     LOCATION
  ========================= */

  locationBtn.addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(
          pos.coords.latitude,
          pos.coords.longitude,
          "Your Location"
        );
      },
      () => {
        output.textContent = "Location denied 🕵️";
      }
    );
  });

  /* =========================
     AUTO LOCATION ON LOAD
  ========================= */

  window.addEventListener("load", () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(
          pos.coords.latitude,
          pos.coords.longitude,
          "Your Location"
        );
      }
    );
  });

  /* =========================
     FAVOURITES
  ========================= */

  function loadFavourites() {
    favList.innerHTML = "";
    const favs = JSON.parse(localStorage.getItem("favourites")) || [];

    favs.forEach((city, index) => {
      const li = document.createElement("li");
      li.textContent = city;
      li.onclick = () => {
        cityInput.value = city;
        searchBtn.click();
      };

      const remove = document.createElement("button");
      remove.textContent = "❌";
      remove.onclick = e => {
        e.stopPropagation();
        favs.splice(index, 1);
        localStorage.setItem("favourites", JSON.stringify(favs));
        loadFavourites();
      };

      li.appendChild(remove);
      favList.appendChild(li);
    });
  }

  saveFavBtn.addEventListener("click", () => {
    if (!lastCity) return;
    const favs = JSON.parse(localStorage.getItem("favourites")) || [];
    if (!favs.includes(lastCity)) {
      favs.push(lastCity);
      localStorage.setItem("favourites", JSON.stringify(favs));
      loadFavourites();
    }
  });

  /* =========================
     DARK MODE (MANUAL OVERRIDE)
  ========================= */

  darkBtn.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    document.body.setAttribute(
      "data-theme",
      current === "dark" ? "light-bg" : "dark"
    );
  });

  loadFavourites();
});
