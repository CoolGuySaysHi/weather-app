document.addEventListener("DOMContentLoaded", () => {

  const DateTime = luxon.DateTime;

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

  /* -------------------------
     HELPERS
  ------------------------- */

  function describeWeather(code, isNight) {
    if (code === 0) return isNight ? "🌙 Clear Night" : "☀️ Sunny";
    if (code <= 3) return "🌤️ Cloudy";
    if (code <= 67) return "🌧️ Rainy";
    if (code <= 77) return "❄️ Snowy";
    return "⛈️ Stormy";
  }

  function setTheme(isNight) {
    if (document.body.classList.contains("dark")) {
      document.body.setAttribute("data-theme", "dark");
    } else {
      document.body.setAttribute(
        "data-theme",
        isNight ? "dark-bg" : "light-bg"
      );
    }
  }

  function clearBodyClasses() {
    document.body.className = "";
  }

  /* -------------------------
     WEATHER FETCH
  ------------------------- */

  function fetchWeather(lat, lon, name) {
    lastCity = name;

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&daily=weathercode,temperature_2m_max,sunrise,sunset` +
      `&hourly=temperature_2m,weathercode,precipitation_probability` +
      `&timezone=auto`
    )
      .then(res => res.json())
      .then(data => {

        const now = DateTime.fromISO(
          data.current_weather.time,
          { zone: data.timezone }
        );

        const sunrise = DateTime.fromISO(
          data.daily.sunrise[0],
          { zone: data.timezone }
        );

        const sunset = DateTime.fromISO(
          data.daily.sunset[0],
          { zone: data.timezone }
        );

        const isNight = now < sunrise || now > sunset;

        /* -------------------------
           BODY CLASSES
        ------------------------- */

        clearBodyClasses();

        let weatherClass = "sunny";
        const code = data.current_weather.weathercode;

        if (code <= 3) weatherClass = "cloudy";
        else if (code <= 67) weatherClass = "rainy";
        else if (code <= 77) weatherClass = "snowy";

        if (isNight) document.body.classList.add("clear-night");
        document.body.classList.add(weatherClass);

        setTheme(isNight);

        /* -------------------------
           CURRENT WEATHER
        ------------------------- */

        output.textContent =
`📍 ${name}
${describeWeather(code, isNight)}
🌡️ ${data.current_weather.temperature}°C
💨 Wind: ${data.current_weather.windspeed} km/h`;

        /* -------------------------
           5 DAY FORECAST
        ------------------------- */

        forecastDiv.innerHTML = "";
        for (let i = 0; i < 5; i++) {
          forecastDiv.innerHTML += `
            <div class="day">
              ${data.daily.time[i]}<br>
              ${describeWeather(data.daily.weathercode[i], false)}<br>
              🌡️ ${data.daily.temperature_2m_max[i]}°C
            </div>
          `;
        }

        /* -------------------------
           HOURLY FORECAST (24H)
           WITH RAIN CHANCE 🌧️
        ------------------------- */

        hourlyDiv.innerHTML = "";

        for (let i = 0; i < 24; i++) {
          const time = data.hourly.time[i].slice(11, 16);
          const temp = data.hourly.temperature_2m[i];
          const rainChance = data.hourly.precipitation_probability[i];
          const rainEmoji = rainChance >= 50 ? "🌧️" : "☁️";

          hourlyDiv.innerHTML += `
            <div class="day">
              ⏰ ${time}<br>
              🌡️ ${temp}°C<br>
              ${rainEmoji} ${rainChance}% chance
            </div>
          `;
        }
      })
      .catch(() => {
        output.textContent = "Weather failed ☁️";
      });
  }

  /* -------------------------
     SEARCH CITY
  ------------------------- */

  searchBtn.addEventListener("click", () => {
    if (!cityInput.value) return;

    fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput.value)}&count=1`
    )
      .then(res => res.json())
      .then(data => {
        if (!data.results) return;
        const city = data.results[0];
        fetchWeather(
          city.latitude,
          city.longitude,
          `${city.name}, ${city.country}`
        );
      });
  });

  /* -------------------------
     AUTO LOCATION
  ------------------------- */

  locationBtn.addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(pos => {
      fetchWeather(
        pos.coords.latitude,
        pos.coords.longitude,
        "Your Location"
      );
    });
  });

  /* -------------------------
     DARK MODE
  ------------------------- */

  darkBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.body.classList.contains("dark")
    );
  });

});
