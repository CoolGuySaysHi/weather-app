document.addEventListener("DOMContentLoaded", () => {

  const cityInput = document.getElementById("cityInput");
  const searchBtn = document.getElementById("searchBtn");
  const locationBtn = document.getElementById("getWeather");
  const saveFavBtn = document.getElementById("saveFav");
  const output = document.getElementById("output");
  const forecastDiv = document.getElementById("forecast");
  const favList = document.getElementById("favorites");
  const darkBtn = document.getElementById("toggleDark");

  let lastCity = null;

  // Weather code → human words
  function getWeatherDescription(code) {
    if (code === 0) return "☀️ Sunny";
    if (code <= 3) return "🌤️ Cloudy";
    if (code <= 48) return "🌫️ Foggy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "❄️ Snowy";
    if (code <= 82) return "🌦️ Showers";
    return "⛈️ Stormy";
  }

  // Fetch weather + 5-day forecast
  function fetchWeather(lat, lon, placeName) {
    lastCity = placeName;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,weathercode&timezone=auto`)
      .then(res => res.json())
      .then(data => {
        const w = data.current_weather;

        output.textContent =
          `📍 ${placeName}
${getWeatherDescription(w.weathercode)}
🌡️ ${w.temperature}°C
💨 Wind: ${w.windspeed} km/h`;

        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              📅 ${data.daily.time[i]}<br>
              ${getWeatherDescription(data.daily.weathercode[i])}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
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

  // Save favorite
  saveFavBtn.addEventListener("click", () => {
    if (!lastCity) return;

    const favs = JSON.parse(localStorage.getItem("favorites")) || [];
    if (!favs.includes(lastCity)) {
      favs.push(lastCity);
      localStorage.setItem("favorites", JSON.stringify(favs));
      loadFavorites();
    }
  });

  // Load favorites
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

  // Dark mode
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }

  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark")
    );
  });

  loadFavorites();

});
