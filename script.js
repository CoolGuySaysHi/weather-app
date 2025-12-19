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

  let lastCity = null;

  // Weather code → human words
  function getWeatherDescription(code, isNight) {
    if (code === 0) return isNight ? "🌙 Clear Night" : "☀️ Sunny";
    if (code <= 3) return "🌤️ Cloudy";
    if (code <= 48) return "🌫️ Foggy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "❄️ Snowy";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Stormy";
  }

  // Fetch weather + 5-day forecast + hourly forecast
  function fetchWeather(lat, lon, placeName) {
    lastCity = placeName;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,weathercode&hourly=temperature_2m,weathercode&timezone=auto`)
      .then(res => res.json())
      .then(data => {
        const w = data.current_weather;

        // Get local hour from API time string
        const localTime = new Date(w.time);
        const hour = localTime.getHours();

        // Night between 7pm and 6am
        const isNight = (hour >= 19 || hour <= 6);

        // Determine weather text & background class
        let weatherText = "";
        let bgClass = "";

        if (w.weathercode === 0) {
          if (isNight) {
            weatherText = "🌙 Clear Night";
            bgClass = "clear-night";
          } else {
            weatherText = "☀️ Sunny";
            bgClass = "sunny";
          }
        } else if (w.weathercode <= 3 || (w.weathercode >= 45 && w.weathercode <= 48)) {
          weatherText = "🌤️ Cloudy";
          bgClass = "cloudy";
        } else if (w.weathercode <= 67) {
          weatherText = "🌧️ Rainy";
          bgClass = "rainy";
        } else if (w.weathercode <= 77) {
          weatherText = "❄️ Snowy";
          bgClass = "snowy";
        } else {
          weatherText = "⛈️ Stormy";
          bgClass = "";
        }

        output.textContent =
          `📍 ${placeName}
${weatherText}
🌡️ ${w.temperature}°C
💨 Wind: ${w.windspeed} km/h`;

        // Update body classes and data-theme attribute
        document.body.className = "";
        if (bgClass) document.body.classList.add(bgClass);

        const isDarkMode = document.body.classList.contains("dark");

        if (isDarkMode) {
          document.body.setAttribute("data-theme", "dark");
        } else if (bgClass === "sunny" || bgClass === "clear-night") {
          document.body.setAttribute("data-theme", "light-bg");
        } else if (["rainy", "cloudy", "snowy"].includes(bgClass)) {
          document.body.setAttribute("data-theme", "dark-bg");
        } else {
          document.body.setAttribute("data-theme", "light-bg");
        }

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

        const nowIndex = data.hourly.time.findIndex(t => new Date(t) >= new Date());

        for (let i = nowIndex; i < nowIndex + 24 && i < data.hourly.time.length; i++) {
          const time = new Date(data.hourly.time[i]);
          const hourStr = time.getHours().toString().padStart(2, '0') + ":00";

          // For hourly, night/day detection per hour
          const hr = time.getHours();
          const hrIsNight = (hr >= 19 || hr <= 6);

          hourlyDiv.innerHTML += `
            <div class="day" style="min-width: 80px;">
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

  // City search
  searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();
    if (!city) return;

    output.textContent = "Searching city… 🗺️";

    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`)
      .then(res => res.json())
      .then(data => {
        if (!data.results) throw new Error();
        const p = data.results[0];
        fetchWeather(p.latitude, p.longitude, `${p.name}, ${p.country}`);
      })
      .catch(() => {
        output.textContent = "City not found 🌍";
      });
  });

  // Auto-location
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

  // Save favourite
  saveFavBtn.addEventListener("click", () => {
    if (!lastCity) return;

    const favs = JSON.parse(localStorage.getItem("favorites")) || [];
    if (!favs.includes(lastCity)) {
      favs.push(lastCity);
      localStorage.setItem("favorites", JSON.stringify(favs));
      loadFavorites();
    }
  });

  // Load favourites
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

  // Dark mode toggle
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
