document.addEventListener("DOMContentLoaded", () => {
  const DateTime = luxon.DateTime;

  // =========================
  // ELEMENTS
  // =========================
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

  // =========================
  // WEATHER HELPERS
  // =========================

  function getWeatherDescription(code, isNight) {
    if (code === 0) return isNight ? "Clear night" : "Sunny";
    if (code <= 3) return "Cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 67) return "Rainy";
    if (code <= 77) return "Snowy";
    if (code <= 82) return "Showers";
    return "Stormy";
  }

  function clearWeatherClasses() {
    document.body.classList.remove(
      "sunny",
      "cloudy",
      "rainy",
      "snowy",
      "clear-night"
    );
  }

  function applyRainWind(windSpeed) {
    const tilt = Math.min(windSpeed * 0.6, 12);
    const speed = Math.max(0.5, 1.2 - windSpeed / 40);

    document.body.style.setProperty("--rain-tilt", `${tilt}px`);
    document.body.style.setProperty("--rain-speed", `${speed}s`);
  }

  function setTheme(isNight) {
    if (document.body.getAttribute("data-theme") === "dark") return;
    document.body.setAttribute("data-theme", isNight ? "dark-bg" : "light-bg");
  }

  // =========================
  // FETCH WEATHER
  // =========================

  function fetchWeather(lat, lon, label) {
    lastCity = label;

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current_weather=true` +
        `&daily=weathercode,temperature_2m_max,sunrise,sunset` +
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

        let weatherClass = "cloudy";
        if (w.weathercode === 0) {
          weatherClass = isNight ? "clear-night" : "sunny";
        } else if (w.weathercode <= 3 || w.weathercode <= 48) {
          weatherClass = "cloudy";
        } else if (w.weathercode <= 67) {
          weatherClass = "rainy";
        } else if (w.weathercode <= 77) {
          weatherClass = "snowy";
        }

        document.body.classList.add(weatherClass);
        setTheme(isNight);

        if (weatherClass === "rainy") {
          applyRainWind(w.windspeed);
        }

        output.textContent =
          `📍 ${label}\n` +
          `${getWeatherDescription(w.weathercode, isNight)}\n` +
          `🌡️ ${w.temperature}°C\n` +
          `💨 Wind: ${w.windspeed} km/h`;

        // =========================
        // 5 DAY FORECAST
        // =========================
        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              ${data.daily.time[i]}<br>
              ${getWeatherDescription(data.daily.weathercode[i], false)}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
            </div>
          `;
        }

        // =========================
        // HOURLY FORECAST (24H)
        // =========================
        hourlyDiv.innerHTML = "";
        const startIndex = data.hourly.time.findIndex(t =>
          DateTime.fromISO(t, { zone }) >= now
        );

        for (
          let i = startIndex;
          i < startIndex + 24 && i < data.hourly.time.length;
          i++
        ) {
          const t = DateTime.fromISO(data.hourly.time[i], { zone });
          const time = t.toFormat("HH:mm");
          const temp = data.hourly.temperature_2m[i];
          const rain = data.hourly.precipitation_probability?.[i];

          hourlyDiv.innerHTML += `
            <div class="day">
              ${time}<br>
              🌡️ ${temp}°C<br>
              ${rain !== undefined ? `🌧️ ${rain}%` : ""}
            </div>
          `;
        }
      })
      .catch(() => {
        output.textContent = "Failed to load weather ☁️";
      });
  }

  // =========================
  // SEARCH CITY
  // =========================

  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    output.textContent = "Searching… 🌍";

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

  // =========================
  // MANUAL LOCATION BUTTON
  // =========================

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

  // =========================
  // AUTO LOCATION ON LOAD
  // =========================

  window.addEventListener("load", () => {
    if (!navigator.geolocation) {
      output.textContent = "Geolocation not supported 😬";
      return;
    }

    output.textContent = "Getting your location… 📍";

    navigator.geolocation.getCurrentPosition(
      pos => {
        fetchWeather(
          pos.coords.latitude,
          pos.coords.longitude,
          "Your Location"
        );
      },
      () => {
        output.textContent = "Allow location to auto-load weather 🌍";
      }
    );
  });

  // =========================
  // FAVOURITES
  // =========================

  function loadFavorites() {
    favList.innerHTML = "";
    const favs = JSON.parse(localStorage.getItem("favorites")) || [];

    favs.forEach((city, index) => {
      const li = document.createElement("li");
      li.textContent = city;
      li.addEventListener("click", () => {
        cityInput.value = city;
        searchBtn.click();
      });

      const remove = document.createElement("button");
      remove.textContent = "❌";
      remove.addEventListener("click", e => {
        e.stopPropagation();
        favs.splice(index, 1);
        localStorage.setItem("favorites", JSON.stringify(favs));
        loadFavorites();
      });

      li.appendChild(remove);
      favList.appendChild(li);
    });
  }

  saveFavBtn.addEventListener("click", () => {
    if (!lastCity) return;
    const favs = JSON.parse(localStorage.getItem("favorites")) || [];
    if (!favs.includes(lastCity)) {
      favs.push(lastCity);
      localStorage.setItem("favorites", JSON.stringify(favs));
      loadFavorites();
    }
  });

  // =========================
  // DARK MODE
  // =========================

  darkBtn.addEventListener("click", () => {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    document.body.setAttribute("data-theme", isDark ? "" : "dark");
  });

  loadFavorites();
});
