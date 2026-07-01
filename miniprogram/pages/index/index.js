const cityData = require("../../data/cities");
const countyData = require("../../data/counties");
const metroData = require("../../data/metro-networks");

const transportProfiles = {
  highspeed: { label: "高铁", speedKmh: 300, detourFactor: 1.08, bufferMinutes: 35 },
  train: { label: "火车", speedKmh: 180, detourFactor: 1.12, bufferMinutes: 25 }
};

const municipalityNames = new Set(["北京", "上海", "天津", "重庆"]);
const metroCityAliases = {
  hongkong: "xianggang",
  haerbin: "haerbin",
  wulumuqi: "wulumuqi",
  huhehaote: "huhehaote",
  xian: "xian"
};

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function haversineDistance(from, to) {
  const earthRadius = 6371000;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (!meters) return "待计算";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${Math.round(meters / 1000)} km`;
}

function formatDuration(seconds) {
  if (!seconds) return "待计算";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`;
}

function estimateRoute(from, to, mode) {
  const profile = transportProfiles[mode] || transportProfiles.highspeed;
  const distance = haversineDistance(from, to) * profile.detourFactor;
  return {
    distance,
    duration: distance / (profile.speedKmh * 1000 / 3600) + profile.bufferMinutes * 60,
    transportLabel: profile.label
  };
}

function routeCurve(from, to) {
  const start = { lat: from.lat, lon: from.lon };
  const end = { lat: to.lat, lon: to.lon };
  const deltaLat = end.lat - start.lat;
  const deltaLon = end.lon - start.lon;
  const distance = Math.hypot(deltaLat, deltaLon);
  if (!distance) return [{ latitude: start.lat, longitude: start.lon }, { latitude: end.lat, longitude: end.lon }];

  const curve = Math.min(distance * 0.16, 0.16);
  const control = {
    lat: (start.lat + end.lat) / 2 + (-deltaLon / distance) * curve,
    lon: (start.lon + end.lon) / 2 + (deltaLat / distance) * curve
  };

  return Array.from({ length: 18 }, (_, index) => {
    const t = index / 17;
    const inv = 1 - t;
    return {
      latitude: inv * inv * start.lat + 2 * inv * t * control.lat + t * t * end.lat,
      longitude: inv * inv * start.lon + 2 * inv * t * control.lon + t * t * end.lon
    };
  });
}

function metroColor(color) {
  const text = String(color || "").replace(/^#/, "").trim();
  return /^[0-9a-f]{6}$/i.test(text) ? `#${text}` : "#0f8f83";
}

Page({
  data: {
    viewMode: "china",
    mapCenter: { longitude: 104.1954, latitude: 35.8617 },
    mapScale: 4,
    markers: [],
    polylines: [],
    includePoints: [],
    badgeCount: 0,
    cityCount: 0,
    query: "",
    searchResults: [],
    transportMode: "highspeed",
    selectedPlaceId: null,
    selectedCityId: null,
    canEnterCity: false,
    routes: [],
    chainLabel: "尚未开始",
    totalDistanceText: "待计算",
    totalDurationText: "待计算",
    selectionTitle: "选择出发城市",
    selectionHint: "点击地图上的城市点作为起点，也可以搜索城市或区县。"
  },

  onLoad() {
    this.markerSeq = 1;
    this.markerLookup = {};
    this.cityById = new Map();
    this.countyById = new Map();
    this.placeById = new Map();
    this.cityByPinyin = new Map();
    this.routesRaw = [];
    this.bootstrapData();
    this.renderChina();
    this.renderPanel();
  },

  bootstrapData() {
    const cities = (cityData.cities || []).map((city) => ({
      ...city,
      placeType: "city",
      searchText: normalizeSearchText(`${city.name} ${city.province} ${city.pinyin}`)
    }));
    const counties = (countyData.counties || []).map((county) => ({
      ...county,
      placeType: "county",
      searchText: normalizeSearchText(`${county.name} ${county.province} ${county.pinyin} ${county.parentCityName} ${county.parentCityPinyin}`)
    }));

    cities.forEach((city) => {
      this.cityById.set(city.id, city);
      this.cityByPinyin.set(normalizeKey(city.pinyin), city);
      this.placeById.set(city.id, city);
    });
    counties.forEach((county) => {
      this.countyById.set(county.id, county);
      this.placeById.set(county.id, county);
    });

    this.cities = cities;
    this.counties = counties;
    this.setData({ cityCount: cities.length });
  },

  renderChina() {
    this.markerSeq = 1;
    this.markerLookup = {};
    const markers = this.cities.map((city) => this.markerForPlace(city, "city"));
    this.setData({
      viewMode: "china",
      mapCenter: { longitude: 104.1954, latitude: 35.8617 },
      mapScale: 4,
      markers,
      polylines: this.routePolylines(),
      includePoints: [],
      badgeCount: this.cities.length
    });
  },

  markerForPlace(place, kind) {
    const id = this.markerSeq++;
    this.markerLookup[id] = { kind, placeId: place.id };
    return {
      id,
      latitude: place.lat,
      longitude: place.lon,
      width: kind === "city" ? 18 : 14,
      height: kind === "city" ? 18 : 14,
      title: place.name,
      callout: {
        content: place.name,
        color: "#20352f",
        fontSize: 12,
        borderRadius: 4,
        bgColor: "#fffaf0",
        padding: 4,
        display: kind === "city" ? "BYCLICK" : "BYCLICK"
      }
    };
  },

  routePolylines() {
    return this.routesRaw.map((route) => {
      const from = this.placeById.get(route.from);
      const to = this.placeById.get(route.to);
      if (!from || !to) return null;
      return {
        points: routeCurve(from, to),
        color: route.status === "error" ? "#d75b4f" : "#168f7dcc",
        width: 4,
        dottedLine: route.status === "success",
        arrowLine: true
      };
    }).filter((line) => line && line.points && line.points.length);
  },

  onMarkerTap(event) {
    const item = this.markerLookup[event.detail.markerId];
    if (!item) return;
    if (item.kind === "metro") return;
    const place = this.placeById.get(item.placeId);
    if (place) this.selectPlace(place);
  },

  selectPlace(place) {
    if (!this.data.selectedPlaceId) {
      this.setData({
        selectedPlaceId: place.id,
        selectedCityId: place.placeType === "city" ? place.id : place.parentCityId || null,
        canEnterCity: place.placeType === "city"
      });
      this.renderPanel();
      return;
    }

    if (this.data.selectedPlaceId === place.id) {
      this.setData({ selectedPlaceId: null, selectedCityId: null, canEnterCity: false });
      this.renderPanel();
      return;
    }

    const from = this.placeById.get(this.data.selectedPlaceId);
    const estimate = estimateRoute(from, place, this.data.transportMode);
    this.routesRaw.push({
      id: Date.now(),
      from: from.id,
      to: place.id,
      status: "success",
      distance: estimate.distance,
      duration: estimate.duration,
      transportMode: this.data.transportMode,
      transportLabel: estimate.transportLabel,
      fallback: true
    });

    this.setData({
      selectedPlaceId: place.id,
      selectedCityId: place.placeType === "city" ? place.id : place.parentCityId || null,
      canEnterCity: place.placeType === "city",
      polylines: this.currentPolylines()
    });
    this.renderPanel();
  },

  currentPolylines() {
    if (this.data.viewMode === "city") {
      return [...this.metroPolylines(this.activeCity), ...this.routePolylines()];
    }
    return this.routePolylines();
  },

  renderPanel() {
    const selected = this.placeById.get(this.data.selectedPlaceId);
    const routePlaces = this.routesRaw.length
      ? [this.placeById.get(this.routesRaw[0].from), ...this.routesRaw.map((route) => this.placeById.get(route.to))]
      : selected ? [selected] : [];
    const totals = this.routesRaw.reduce((sum, route) => ({
      distance: sum.distance + route.distance,
      duration: sum.duration + route.duration
    }), { distance: 0, duration: 0 });
    const routes = this.routesRaw.map((route, index) => {
      const from = this.placeById.get(route.from);
      const to = this.placeById.get(route.to);
      return {
        ...route,
        fromName: from.name,
        toName: to.name,
        contextText: `${this.placeContext(from)} · ${this.placeContext(to)} · ${route.transportLabel} 估算行程`,
        meta: `第 ${index + 1} 段 · ${route.transportLabel} ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`
      };
    });

    this.setData({
      routes,
      chainLabel: routePlaces.length ? routePlaces.map((place) => place.name).join(" → ") : "尚未开始",
      totalDistanceText: this.routesRaw.length ? `${formatDistance(totals.distance)} 估` : "待计算",
      totalDurationText: this.routesRaw.length ? `${formatDuration(totals.duration)} 估` : "待计算",
      selectionTitle: selected ? `从${selected.name}出发` : "选择出发城市",
      selectionHint: selected ? "继续点击下一个城市或区县，会生成一段新的估算路线。" : "点击地图上的城市点作为起点，也可以搜索城市或区县。"
    });
  },

  placeContext(place) {
    if (!place) return "";
    if (place.placeType === "county") return `${place.parentCityName || place.province} / ${place.name}`;
    return place.province || "";
  },

  onSearchInput(event) {
    const query = event.detail.value;
    const normalized = normalizeSearchText(query);
    const pool = [
      ...this.cities.map((city) => ({ ...city, subtitle: `${city.province} / ${city.pinyin}` })),
      ...this.counties.map((county) => ({ ...county, subtitle: `${county.parentCityName} / ${county.province} / ${county.pinyin}` }))
    ];
    const searchResults = normalized
      ? pool.filter((item) => item.searchText.includes(normalized)).slice(0, 8)
      : [];
    this.setData({ query, searchResults });
  },

  clearSearch() {
    this.setData({ query: "", searchResults: [] });
  },

  selectSearchResult(event) {
    const place = this.placeById.get(event.currentTarget.dataset.id);
    if (!place) return;
    if (place.placeType === "county") this.enterCityView(place.parentCityId, false);
    this.selectPlace(place);
    this.setData({
      query: "",
      searchResults: [],
      mapCenter: { longitude: place.lon, latitude: place.lat },
      mapScale: 9
    });
  },

  setTransportMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!transportProfiles[mode]) return;
    this.routesRaw = this.routesRaw.map((route) => {
      const from = this.placeById.get(route.from);
      const to = this.placeById.get(route.to);
      const estimate = estimateRoute(from, to, mode);
      return { ...route, ...estimate, transportMode: mode, fallback: true };
    });
    this.setData({ transportMode: mode, polylines: this.currentPolylines() });
    this.renderPanel();
  },

  undoRoute() {
    const removed = this.routesRaw.pop();
    this.setData({
      selectedPlaceId: removed ? removed.from : null,
      selectedCityId: removed ? (this.placeById.get(removed.from).placeType === "city" ? removed.from : this.placeById.get(removed.from).parentCityId) : null,
      polylines: this.currentPolylines()
    });
    this.renderPanel();
  },

  clearRoutes() {
    this.routesRaw = [];
    this.setData({
      selectedPlaceId: null,
      selectedCityId: null,
      canEnterCity: false,
      polylines: this.currentPolylines()
    });
    this.renderPanel();
  },

  resetView() {
    if (this.data.viewMode === "city" && this.activeCity) {
      this.enterCityView(this.activeCity.id, true);
      return;
    }
    this.renderChina();
  },

  enterSelectedCity() {
    if (this.data.selectedCityId) this.enterCityView(this.data.selectedCityId, true);
  },

  enterCityView(cityId, fit = true) {
    const city = this.cityById.get(cityId);
    if (!city) return;
    this.activeCity = city;
    this.markerSeq = 1;
    this.markerLookup = {};
    const counties = this.counties.filter((county) => county.parentCityId === city.id);
    const metro = this.metroNetworkForCity(city);
    const countyMarkers = counties.map((county) => this.markerForPlace(county, "county"));
    const metroMarkers = (metro.stations || []).slice(0, 260).map((station) => this.markerForMetroStation(station));
    const markers = [...countyMarkers, ...metroMarkers];
    const includePoints = markers.map((marker) => ({ longitude: marker.longitude, latitude: marker.latitude }));
    const polylines = [...this.metroPolylines(city), ...this.routePolylines()];
    this.setData({
      viewMode: "city",
      mapCenter: { longitude: city.lon, latitude: city.lat },
      mapScale: fit ? 9 : this.data.mapScale,
      markers,
      polylines,
      includePoints,
      badgeCount: counties.length + (metro.stations || []).length,
      selectionTitle: `城市视图：${city.name}`,
      selectionHint: `正在显示 ${counties.length} 个区县点、${(metro.lines || []).length} 条地铁线路/${(metro.stations || []).length} 个地铁站。`
    });
  },

  markerForMetroStation(station) {
    const id = this.markerSeq++;
    this.markerLookup[id] = { kind: "metro", station };
    return {
      id,
      latitude: station.lat,
      longitude: station.lon,
      width: 10,
      height: 10,
      title: station.name,
      callout: {
        content: station.lineName ? `${station.name} / ${station.lineName}` : station.name,
        color: "#20352f",
        fontSize: 11,
        borderRadius: 4,
        bgColor: "#fffaf0",
        padding: 4,
        display: "BYCLICK"
      }
    };
  },

  metroNetworkForCity(city) {
    const keys = Array.from(new Set([
      metroCityAliases[normalizeKey(city.pinyin)],
      normalizeKey(city.pinyin),
      normalizeKey(city.name)
    ].filter(Boolean)));
    const key = keys.find((item) => metroData.networks && metroData.networks[item]);
    return key ? metroData.networks[key] : { lines: [], stations: [] };
  },

  metroPolylines(city) {
    const metro = this.metroNetworkForCity(city);
    return (metro.lines || []).map((line) => ({
      points: (line.coordinates || []).map((coord) => ({ longitude: Number(coord[0]), latitude: Number(coord[1]) })).filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude)),
      color: `${metroColor(line.color)}dd`,
      width: 4
    })).filter((line) => line.points.length > 1);
  },

  exitCityView() {
    this.activeCity = null;
    this.renderChina();
    this.renderPanel();
  }
});
