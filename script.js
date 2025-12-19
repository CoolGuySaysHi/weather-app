document.addEventListener("DOMContentLoaded", () => {

  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const saveFavBtn = document.getElementById("saveFav");
  const output = document.getElementById("output");
  const forecastDiv = document.getElementById("forecast");
  const hourlyDiv = document.getElementById("hourlyForecast");
  const favList = document.getElementById("favorites");
  const darkBtn = document.getElementById("toggleDark");

  const DateTime = luxon.DateTime;

  let lastCity = null;

  function getWeatherDescription(code, isNight) {
    if (code === 0) return isNight ? "🌙 Clear Night" : "☀️ Sunny";
    if (code <= 3) return "🌤️ Cloudy";
    if (code <= 48) return "🌫️ Foggy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "❄️ Snowy";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Stormy";
  }

  function fetchWeather(lat, lon, placeName) {
    lastCity = placeName;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,weathercode,sunrise,sunset&hourly=temperature_2m,weathercode&timezone=auto`)
      .then(res => res.json())
      .then(data => {
        const w = data.current_weather;
        const timezone = data.timezone;

        const dt = DateTime.fromISO(w.time, { zone: timezone });

        const sunrise = DateTime.fromISO(data.daily.sunrise[0], { zone: timezone });
        const sunset = DateTime.fromISO(data.daily.sunset[0], { zone: timezone });

        const isNight = dt < sunrise || dt > sunset;

        // Clear all previous weather & day/night classes
        document.body.classList.remove("day", "night", "sunny", "clear-night", "cloudy", "rainy", "snowy", "foggy", "showers", "stormy");

        // Add day or night class
        if (isNight) {
          document.body.classList.add("night");
        } else {
          document.body.classList.add("day");
        }

        // Determine weather class for backgrounds
        let weatherClass = "";
        if (w.weathercode === 0) {
          weatherClass = isNight ? "clear-night" : "sunny";
        } else if (w.weathercode <= 3 || (w.weathercode >= 45 && w.weathercode <= 48)) {
          weatherClass = "cloudy";
        } else if (w.weathercode <= 67) {
          weatherClass = "rainy";
        } else if (w.weathercode <= 77) {
          weatherClass = "snowy";
        } else if (w.weathercode <= 82) {
          weatherClass = "showers";
        } else {
          weatherClass = "stormy";
        }
        document.body.classList.add(weatherClass);

        const weatherText = getWeatherDescription(w.weathercode, isNight);

        output.textContent =
          `📍 ${placeName}
${weatherText}
🌡️ ${w.temperature}°C
💨 Wind: ${w.windspeed} km/h`;

        // 5-day forecast
        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              📅 ${data.daily.time[i]}<br>
              ${getWeatherDescription(data.daily.weathercode[i], false)}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
            </div>
          `;
        }

        // Hourly forecast (next 24 hours)
        hourlyDiv.innerHTML = "";

        // Find current hour index
        const nowIndex = data.hourly.time.findIndex(t => DateTime.fromISO(t, { zone: timezone }) >= dt);

        for (let i = nowIndex; i < nowIndex + 24 && i < data.hourly.time.length; i++) {
          const time = DateTime.fromISO(data.hourly.time[i], { zone: timezone });
          const hourStr = time.toFormat("HH':'mm");

          // Check night for each hour
          const hrIsNight = time < sunrise || time > sunset;

          hourlyDiv.innerHTML += `
            <div class="day" title="${time.toLocaleString(DateTime.DATETIME_MED)}">
              ⏰ ${hourStr}<br>
              ${getWeatherDescription(data.hourly.weathercode[i], hrIsNight)}<br>
              🌡️ ${data.hourly.temperature_2m[i]}°C
            </div>
          `;
        }
      })
      .catch(() => {
        output.textContent = "Weather failed ☁️";
      });
  }

  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    output.textContent = "Searching city… 🗺️";

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      .then(res => res.json())
      .then(data => {
        if (!data.results || data.results.length === 0) throw new Error();
        const p = data.results[0];
        fetchWeather(p.latitude, p.longitude, `${p.name}, ${p.country}`);
      })
      .catch(() => {
        output.textContent = "City not found 🌍";
      });
  });

  locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      output.textContent = "Location not supported 😬";
      return;
    }

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

  saveFavBtn.addEventListener("click", () => {
    if (!lastCity) return;

    const favs = JSON.parse(localStorage.getItem("favorites")) || [];
    if (!favs.includes(lastCity)) {
      favs.push(lastCity);
      localStorage.setItem("favorites", JSON.stringify(favs));
      loadFavorites();
    }
  });

  function loadFavorites() {
    favList.innerHTML = "";
    const favs = JSON.parse(localStorage.getItem("favorites")) || [];

    favs.forEach(city => {
      const li = document.createElement("li");
      li.textContent = city;
      li.addEventListener("click", () => {
        cityInput.value = city;
        searchBtn.click();
      });
      favList.appendChild(li);
    });
  }

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    document.body.setAttribute("data-theme", "dark");
  }

  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    if (isDark) {
      document.body.setAttribute("data-theme", "dark");
    } else {
      if (lastCity) {
        searchBtn.click();
      } else {
        document.body.setAttribute("data-theme", "light-bg");
      }
    }
    localStorage.setItem("darkMode", isDark);
  });

  loadFavorites();

});
