/* ==========================================================================
   Skydeck — weather app
   Data: Open-Meteo (forecast + geocoding), BigDataCloud (reverse geocoding),
   RainViewer (rain radar tiles). None of these require an API key.
   ========================================================================== */

const STORAGE_KEYS = { cities: "skydeck_cities", theme: "skydeck_theme", active: "skydeck_active" };

const state = {
  cities: [],       // [{ id, name, admin1, country, latitude, longitude }]
  activeId: null,
  weather: null,    // last fetched weather payload for the active city
  radar: { frames: [], index: 0, playing: false, timer: null, layer: null, map: null },
};

/* ---------------------------------------------------------------------- */
/* Weather code -> label + icon                                            */
/* ---------------------------------------------------------------------- */
const WEATHER_CODES = {
  0:  { label: "Clear sky",        icon: "clear" },
  1:  { label: "Mostly clear",     icon: "partly" },
  2:  { label: "Partly cloudy",    icon: "partly" },
  3:  { label: "Overcast",         icon: "cloudy" },
  45: { label: "Fog",              icon: "fog" },
  48: { label: "Rime fog",         icon: "fog" },
  51: { label: "Light drizzle",    icon: "drizzle" },
  53: { label: "Drizzle",          icon: "drizzle" },
  55: { label: "Dense drizzle",    icon: "drizzle" },
  56: { label: "Freezing drizzle", icon: "drizzle" },
  57: { label: "Freezing drizzle", icon: "drizzle" },
  61: { label: "Light rain",       icon: "rain" },
  63: { label: "Rain",             icon: "rain" },
  65: { label: "Heavy rain",       icon: "rain" },
  66: { label: "Freezing rain",    icon: "rain" },
  67: { label: "Freezing rain",    icon: "rain" },
  71: { label: "Light snow",       icon: "snow" },
  73: { label: "Snow",             icon: "snow" },
  75: { label: "Heavy snow",       icon: "snow" },
  77: { label: "Snow grains",      icon: "snow" },
  80: { label: "Rain showers",     icon: "rain" },
  81: { label: "Rain showers",     icon: "rain" },
  82: { label: "Violent showers",  icon: "rain" },
  85: { label: "Snow showers",     icon: "snow" },
  86: { label: "Snow showers",     icon: "snow" },
  95: { label: "Thunderstorm",     icon: "storm" },
  96: { label: "Thunderstorm, hail", icon: "storm" },
  99: { label: "Thunderstorm, hail", icon: "storm" },
};
function weatherInfo(code, isDay = true) {
  const base = WEATHER_CODES[code] || { label: "Unknown", icon: "cloudy" };
  if (base.icon === "clear" && !isDay) return { label: "Clear night", icon: "clear-night" };
  if (base.icon === "partly" && !isDay) return { label: base.label, icon: "partly-night" };
  return base;
}

/* ---------------------------------------------------------------------- */
/* Icon SVGs (flat, minimal, tuned to work on light + dark backgrounds)     */
/* ---------------------------------------------------------------------- */
const ICONS = {
  "clear": `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#F5A623"/><g stroke="#F5A623" stroke-width="3" stroke-linecap="round">
    <line x1="32" y1="4" x2="32" y2="12"/><line x1="32" y1="52" x2="32" y2="60"/>
    <line x1="4" y1="32" x2="12" y2="32"/><line x1="52" y1="32" x2="60" y2="32"/>
    <line x1="12.7" y1="12.7" x2="18.3" y2="18.3"/><line x1="45.7" y1="45.7" x2="51.3" y2="51.3"/>
    <line x1="12.7" y1="51.3" x2="18.3" y2="45.7"/><line x1="45.7" y1="18.3" x2="51.3" y2="12.7"/>
  </g></svg>`,
  "clear-night": `<svg viewBox="0 0 64 64"><path fill="#C9B037" d="M42 8a20 20 0 1 0 14 34A16 16 0 0 1 42 8z"/>
    <circle cx="17" cy="15" r="1.6" fill="#C9B037"/><circle cx="10" cy="26" r="1" fill="#C9B037"/></svg>`,
  "partly": `<svg viewBox="0 0 64 64"><circle cx="24" cy="22" r="11" fill="#F5A623"/>
    <path fill="#9FB3C8" d="M40 46H22a11 11 0 1 1 2-21.8A15 15 0 0 1 52 30a10 10 0 0 1-2 16z"/></svg>`,
  "partly-night": `<svg viewBox="0 0 64 64"><path fill="#C9B037" d="M27 10a13 13 0 1 0 9 22A10.4 10.4 0 0 1 27 10z"/>
    <path fill="#7C8FA6" d="M42 48H24a11 11 0 1 1 1.6-21.9A15 15 0 0 1 54 32a10 10 0 0 1-2 16z" opacity="0.9"/></svg>`,
  "cloudy": `<svg viewBox="0 0 64 64"><path fill="#9FB3C8" d="M44 46H20a13 13 0 1 1 2.4-25.8A17 17 0 0 1 55 26a11 11 0 0 1-1 20z"/></svg>`,
  "fog": `<svg viewBox="0 0 64 64"><path fill="#AEC0D2" d="M40 30H24a10 10 0 1 1 1.8-19.8A13.5 13.5 0 0 1 49 16a8.5 8.5 0 0 1-1 14z"/>
    <g stroke="#AEC0D2" stroke-width="3.2" stroke-linecap="round"><line x1="8" y1="42" x2="56" y2="42"/><line x1="14" y1="50" x2="50" y2="50"/><line x1="20" y1="58" x2="44" y2="58"/></g></svg>`,
  "drizzle": `<svg viewBox="0 0 64 64"><path fill="#9FB3C8" d="M42 34H22a11 11 0 1 1 2-21.8A15 15 0 0 1 53 18a10 10 0 0 1-1 16z"/>
    <g stroke="#2B6CB0" stroke-width="3" stroke-linecap="round"><line x1="22" y1="44" x2="19" y2="52"/><line x1="34" y1="44" x2="31" y2="52"/><line x1="46" y1="44" x2="43" y2="52"/></g></svg>`,
  "rain": `<svg viewBox="0 0 64 64"><path fill="#7C8FA6" d="M42 32H22a11 11 0 1 1 2-21.8A15 15 0 0 1 53 16a10 10 0 0 1-1 16z"/>
    <g stroke="#2B6CB0" stroke-width="3.4" stroke-linecap="round"><line x1="20" y1="42" x2="16" y2="54"/><line x1="32" y1="42" x2="28" y2="54"/><line x1="44" y1="42" x2="40" y2="54"/></g></svg>`,
  "snow": `<svg viewBox="0 0 64 64"><path fill="#9FB3C8" d="M42 30H22a11 11 0 1 1 2-21.8A15 15 0 0 1 53 14a10 10 0 0 1-1 16z"/>
    <g stroke="#8FB6E0" stroke-width="3" stroke-linecap="round"><line x1="21" y1="42" x2="21" y2="54"/><line x1="15.5" y1="45" x2="26.5" y2="51"/><line x1="15.5" y1="51" x2="26.5" y2="45"/>
    <line x1="43" y1="42" x2="43" y2="54"/><line x1="37.5" y1="45" x2="48.5" y2="51"/><line x1="37.5" y1="51" x2="48.5" y2="45"/></g></svg>`,
  "storm": `<svg viewBox="0 0 64 64"><path fill="#6B7A8F" d="M42 28H22a11 11 0 1 1 2-21.8A15 15 0 0 1 53 12a10 10 0 0 1-1 16z"/>
    <path fill="#F5A623" d="M34 34l-9 14h7l-4 12 13-16h-7z"/></svg>`,
};
function iconSvg(name) { return ICONS[name] || ICONS.cloudy; }

/* ---------------------------------------------------------------------- */
/* Persistence                                                             */
/* ---------------------------------------------------------------------- */
function loadCities() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.cities)) || []; }
  catch { return []; }
}
function saveCities() { localStorage.setItem(STORAGE_KEYS.cities, JSON.stringify(state.cities)); }
function saveActive() { localStorage.setItem(STORAGE_KEYS.active, state.activeId ?? ""); }

/* ---------------------------------------------------------------------- */
/* Geocoding (search) + reverse geocoding (GPS)                            */
/* ---------------------------------------------------------------------- */
async function searchCities(query) {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  return (data.results || []).map(r => ({
    id: `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`,
    name: r.name,
    admin1: r.admin1 || "",
    country: r.country || "",
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

async function reverseGeocode(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  const name = data.city || data.locality || data.principalSubdivision || "My location";
  return {
    id: `${lat.toFixed(3)},${lon.toFixed(3)}`,
    name,
    admin1: data.principalSubdivision || "",
    country: data.countryName || "",
    latitude: lat,
    longitude: lon,
  };
}

/* ---------------------------------------------------------------------- */
/* Weather fetch                                                           */
/* ---------------------------------------------------------------------- */
async function fetchWeather(city) {
  const params = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
    timezone: "auto",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("Weather request failed");
  return res.json();
}

/* ---------------------------------------------------------------------- */
/* Rendering                                                               */
/* ---------------------------------------------------------------------- */
function formatTime(isoString, tz) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatHour(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(" ", "");
}
function dayLabel(isoString, index) {
  if (index === 0) return "Today";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}
function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function renderCityList() {
  const list = document.getElementById("cityList");
  list.innerHTML = "";
  state.cities.forEach(city => {
    const li = document.createElement("li");
    li.className = "city-item" + (city.id === state.activeId ? " active" : "");
    li.innerHTML = `<span>${city.name}</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.className = "city-remove";
    removeBtn.innerHTML = "✕";
    removeBtn.title = "Remove city";
    removeBtn.onclick = (e) => { e.stopPropagation(); removeCity(city.id); };
    li.appendChild(removeBtn);
    li.onclick = () => selectCity(city.id);
    list.appendChild(li);
  });
}

function renderSkyStrip(current, sunrise, sunset, tzOffsetSeconds) {
  const svg = document.getElementById("skystripSvg");
  const now = new Date(current.time);
  const sunriseD = new Date(sunrise);
  const sunsetD = new Date(sunset);

  // build a 24h gradient: night -> dawn -> day -> dusk -> night, anchored on sunrise/sunset
  const minutesInDay = 24 * 60;
  const toMinutes = (d) => d.getHours() * 60 + d.getMinutes();
  const sunriseMin = toMinutes(sunriseD);
  const sunsetMin = toMinutes(sunsetD);
  const nowMin = toMinutes(now);

  const stops = [];
  const nightColor = "#0B1220", dawnColor = "#F5A623", dayColor = "#5B9BD5", duskColor = "#E3703C";
  const pct = (m) => (m / minutesInDay) * 100;
  stops.push([0, nightColor]);
  stops.push([Math.max(0, pct(sunriseMin - 40)), nightColor]);
  stops.push([pct(sunriseMin), dawnColor]);
  stops.push([pct(sunriseMin + 50), dayColor]);
  stops.push([pct(sunsetMin - 50), dayColor]);
  stops.push([pct(sunsetMin), duskColor]);
  stops.push([Math.min(100, pct(sunsetMin + 40)), nightColor]);
  stops.push([100, nightColor]);

  const gradStops = stops.map(([p, c]) => `<stop offset="${p}%" stop-color="${c}"/>`).join("");
  const markerX = (nowMin / minutesInDay) * 1000;
  const isDay = current.is_day === 1;
  const markerColor = isDay ? "#FFD57E" : "#F4F4F4";

  svg.innerHTML = `
    <defs><linearGradient id="skygrad" x1="0" y1="0" x2="1" y2="0">${gradStops}</linearGradient></defs>
    <rect x="0" y="0" width="1000" height="60" fill="url(#skygrad)"/>
    <circle cx="${markerX}" cy="30" r="7" fill="${markerColor}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
  `;
  document.getElementById("sunriseLabel").textContent = formatTime(sunrise);
  document.getElementById("sunsetLabel").textContent = formatTime(sunset);
  document.getElementById("nowLabel").textContent = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function renderWeather(data, city) {
  const cur = data.current;
  const daily = data.daily;
  const hourly = data.hourly;
  const info = weatherInfo(cur.weather_code, cur.is_day === 1);

  document.getElementById("heroIcon").innerHTML = iconSvg(info.icon);
  document.getElementById("heroTemp").textContent = Math.round(cur.temperature_2m);
  document.getElementById("heroPlace").textContent = [city.name, city.admin1 || city.country].filter(Boolean).join(", ");
  document.getElementById("heroCondition").textContent = info.label;

  document.getElementById("statFeelsLike").textContent = Math.round(cur.apparent_temperature);
  document.getElementById("statHumidity").textContent = Math.round(cur.relative_humidity_2m);
  document.getElementById("statWind").textContent = Math.round(cur.wind_speed_10m);
  document.getElementById("statUv").textContent = daily.uv_index_max[0].toFixed(1);
  document.getElementById("statUvLabel").textContent = uvLabel(daily.uv_index_max[0]);
  document.getElementById("statSunrise").textContent = formatTime(daily.sunrise[0]);
  document.getElementById("statSunset").textContent = formatTime(daily.sunset[0]);

  renderSkyStrip(cur, daily.sunrise[0], daily.sunset[0]);

  // hourly — next 24 hours starting from current hour
  const nowIso = data.current.time;
  let startIdx = hourly.time.findIndex(t => t >= nowIso);
  if (startIdx < 0) startIdx = 0;
  const hourlyStrip = document.getElementById("hourlyStrip");
  hourlyStrip.innerHTML = "";
  for (let i = startIdx; i < startIdx + 24 && i < hourly.time.length; i++) {
    const hInfo = weatherInfo(hourly.weather_code[i], true);
    const card = document.createElement("div");
    card.className = "hour-card" + (i === startIdx ? " now" : "");
    card.innerHTML = `
      <span class="hour-time">${i === startIdx ? "Now" : formatHour(hourly.time[i])}</span>
      <span class="hour-icon">${iconSvg(hInfo.icon)}</span>
      <span class="hour-temp">${Math.round(hourly.temperature_2m[i])}°</span>
    `;
    hourlyStrip.appendChild(card);
  }

  // 7-day
  const allMax = daily.temperature_2m_max, allMin = daily.temperature_2m_min;
  const globalMax = Math.max(...allMax), globalMin = Math.min(...allMin);
  const range = globalMax - globalMin || 1;
  const dailyList = document.getElementById("dailyList");
  dailyList.innerHTML = "";
  for (let i = 0; i < daily.time.length; i++) {
    const dInfo = weatherInfo(daily.weather_code[i], true);
    const leftPct = ((allMin[i] - globalMin) / range) * 100;
    const widthPct = ((allMax[i] - allMin[i]) / range) * 100;
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `
      <span class="day-name">${dayLabel(daily.time[i], i)}</span>
      <span class="day-icon">${iconSvg(dInfo.icon)}</span>
      <span class="day-bar-wrap"><span class="day-bar" style="left:${leftPct}%; width:${Math.max(widthPct,6)}%"></span></span>
      <span class="day-temps"><span class="hi">${Math.round(allMax[i])}°</span><span class="lo">${Math.round(allMin[i])}°</span></span>
    `;
    dailyList.appendChild(row);
  }
}

/* ---------------------------------------------------------------------- */
/* City selection flow                                                     */
/* ---------------------------------------------------------------------- */
async function loadAndRender(city) {
  const loading = document.getElementById("loadingState");
  const error = document.getElementById("errorState");
  const content = document.getElementById("weatherContent");
  loading.hidden = false; error.hidden = true; content.hidden = true;
  try {
    const data = await fetchWeather(city);
    state.weather = data;
    renderWeather(data, city);
    loading.hidden = true; content.hidden = false;
    if (!document.getElementById("radarWrap").hidden) setupRadar(city);
  } catch (err) {
    loading.hidden = true;
    error.hidden = false;
    error.textContent = "Couldn't load weather for this location. Check your connection and try again.";
  }
}

function selectCity(id) {
  state.activeId = id;
  saveActive();
  renderCityList();
  const city = state.cities.find(c => c.id === id);
  if (city) loadAndRender(city);
}

function addCity(city) {
  if (!state.cities.some(c => c.id === city.id)) {
    state.cities.push(city);
    saveCities();
  }
  selectCity(city.id);
}

function removeCity(id) {
  state.cities = state.cities.filter(c => c.id !== id);
  saveCities();
  if (state.activeId === id) {
    state.activeId = state.cities[0]?.id ?? null;
    saveActive();
    if (state.activeId) {
      const city = state.cities.find(c => c.id === state.activeId);
      loadAndRender(city);
    } else {
      document.getElementById("weatherContent").hidden = true;
      document.getElementById("loadingState").hidden = false;
      document.getElementById("loadingState").textContent = "Search for a city to get started.";
    }
  }
  renderCityList();
}

/* ---------------------------------------------------------------------- */
/* Search UI                                                               */
/* ---------------------------------------------------------------------- */
let searchDebounce = null;
document.getElementById("citySearchInput").addEventListener("input", (e) => {
  const q = e.target.value;
  clearTimeout(searchDebounce);
  const resultsEl = document.getElementById("searchResults");
  if (!q.trim()) { resultsEl.innerHTML = ""; return; }
  searchDebounce = setTimeout(async () => {
    try {
      const results = await searchCities(q);
      resultsEl.innerHTML = "";
      results.forEach(r => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.innerHTML = `<span>${r.name}</span><span class="sr-region">${[r.admin1, r.country].filter(Boolean).join(", ")}</span>`;
        div.onclick = () => {
          addCity(r);
          document.getElementById("citySearchInput").value = "";
          resultsEl.innerHTML = "";
        };
        resultsEl.appendChild(div);
      });
    } catch { /* silent — network hiccup on search */ }
  }, 350);
});

document.getElementById("locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation isn't supported by this browser.");
    return;
  }
  const btn = document.getElementById("locateBtn");
  btn.classList.add("locating");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        addCity(city);
      } catch {
        alert("Couldn't determine your city from your location.");
      } finally {
        btn.classList.remove("locating");
      }
    },
    () => {
      alert("Location access was denied. You can search for a city instead.");
      btn.classList.remove("locating");
    }
  );
});

/* ---------------------------------------------------------------------- */
/* Theme toggle                                                            */
/* ---------------------------------------------------------------------- */
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const btn = document.getElementById("themeToggle");
  btn.querySelector(".theme-toggle-icon").textContent = theme === "dark" ? "☀" : "☾";
  btn.querySelector(".theme-toggle-text").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

/* ---------------------------------------------------------------------- */
/* Rain radar (Leaflet + RainViewer public tiles)                           */
/* ---------------------------------------------------------------------- */
document.getElementById("radarToggle").addEventListener("click", () => {
  const wrap = document.getElementById("radarWrap");
  const btn = document.getElementById("radarToggle");
  wrap.hidden = !wrap.hidden;
  btn.textContent = wrap.hidden ? "Show map" : "Hide map";
  if (!wrap.hidden) {
    const city = state.cities.find(c => c.id === state.activeId);
    if (city) setupRadar(city);
  }
});

async function setupRadar(city) {
  if (!state.radar.map) {
    state.radar.map = L.map("radarMap", { zoomControl: true }).setView([city.latitude, city.longitude], 6);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(state.radar.map);
    L.marker([city.latitude, city.longitude]).addTo(state.radar.map);
  } else {
    state.radar.map.setView([city.latitude, city.longitude], 6);
  }

  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = await res.json();
    const past = data.radar?.past || [];
    const nowcast = data.radar?.nowcast || [];
    state.radar.frames = [...past, ...nowcast];
    state.radar.index = past.length ? past.length - 1 : 0;
    const slider = document.getElementById("radarSlider");
    slider.max = Math.max(0, state.radar.frames.length - 1);
    slider.value = state.radar.index;
    showRadarFrame(state.radar.index, data.host);
  } catch {
    document.getElementById("radarTime").textContent = "unavailable";
  }
}

function showRadarFrame(index, host) {
  const frame = state.radar.frames[index];
  if (!frame) return;
  if (state.radar.layer) state.radar.map.removeLayer(state.radar.layer);
  const h = host || "https://tilecache.rainviewer.com";
  state.radar.layer = L.tileLayer(`${h}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.65 });
  state.radar.layer.addTo(state.radar.map);
  document.getElementById("radarTime").textContent = new Date(frame.time * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  document.getElementById("radarSlider").value = index;
}

document.getElementById("radarSlider").addEventListener("input", (e) => {
  state.radar.index = Number(e.target.value);
  showRadarFrame(state.radar.index);
});

document.getElementById("radarPlay").addEventListener("click", () => {
  const btn = document.getElementById("radarPlay");
  state.radar.playing = !state.radar.playing;
  btn.textContent = state.radar.playing ? "⏸ Pause" : "▶ Play";
  if (state.radar.playing) {
    state.radar.timer = setInterval(() => {
      state.radar.index = (state.radar.index + 1) % state.radar.frames.length;
      showRadarFrame(state.radar.index);
    }, 600);
  } else {
    clearInterval(state.radar.timer);
  }
});

/* ---------------------------------------------------------------------- */
/* Init                                                                     */
/* ---------------------------------------------------------------------- */
(function init() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  applyTheme(savedTheme);

  state.cities = loadCities();
  state.activeId = localStorage.getItem(STORAGE_KEYS.active) || (state.cities[0]?.id ?? null);
  renderCityList();

  if (state.activeId) {
    const city = state.cities.find(c => c.id === state.activeId);
    if (city) { loadAndRender(city); return; }
  }
  document.getElementById("loadingState").textContent = "Search for a city, or use your location, to get started.";
})();
