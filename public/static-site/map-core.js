const provinceCodeNames = {
  11: "北京", 12: "天津", 13: "河北", 14: "山西", 15: "内蒙古",
  21: "辽宁", 22: "吉林", 23: "黑龙江", 31: "上海", 32: "江苏",
  33: "浙江", 34: "安徽", 35: "福建", 36: "江西", 37: "山东",
  41: "河南", 42: "湖北", 43: "湖南", 44: "广东", 45: "广西",
  46: "海南", 50: "重庆", 51: "四川", 52: "贵州", 53: "云南",
  54: "西藏", 61: "陕西", 62: "甘肃", 63: "青海", 64: "宁夏",
  65: "新疆", 71: "台湾", 81: "香港", 82: "澳门"
};

export function createMapController({ L, state, elements = {}, callbacks = {}, helpers = {} }) {
  if (!L) throw new Error("Leaflet renderer did not load");
  if (!state) throw new TypeError("Map controller requires shared state");

  const normalizeKey = helpers.normalizeKey || ((value) => String(value || "").trim());
  const escapeHtml = helpers.escapeHtml || ((value) => String(value));
  const articleCountForCity = helpers.articleCountForCity || (() => 0);
  const cityById = helpers.cityById || ((id) => state.cityById.get(id));
  const placeById = helpers.placeById || ((id) => state.placeById.get(id) || cityById(id));
  const transportProfile = helpers.transportProfile || (() => ({
    speedKmh: 250,
    detourFactor: 1.12,
    bufferMinutes: 35,
    label: "高铁"
  }));
  const hasCoordinates = helpers.hasCoordinates || ((place) =>
    Number.isFinite(Number(place && place.lon)) && Number.isFinite(Number(place && place.lat)));
  const labelEvents = "moveend zoomend";

  function provinceNameFromFeature(feature) {
    const id = feature && feature.properties ? String(feature.properties.id || "") : "";
    return provinceCodeNames[id.slice(0, 2)] || "";
  }

  function matchFeatureToCity(feature) {
    if (feature?.properties && String(feature.properties.id || "") === "710000") return cityById("taiwan-region");

    const featureName = feature?.properties ? feature.properties.name : "";
    const featureKey = normalizeKey(featureName);
    const provinceName = provinceNameFromFeature(feature);
    if (provinceName) {
      const exactProvinceMatch = state.cityByProvinceKey.get(`${provinceName}|${featureKey}`);
      if (exactProvinceMatch) return exactProvinceMatch;
      const provinceMatches = Array.from(state.cityByProvinceKey.entries())
        .filter(([key]) => key.startsWith(`${provinceName}|`))
        .sort((a, b) => b[0].length - a[0].length);
      const foundInProvince = provinceMatches.find(([key]) => {
        const cityKey = key.split("|")[1];
        return cityKey.length >= 3 && (featureKey.startsWith(cityKey) || cityKey.startsWith(featureKey));
      });
      return foundInProvince ? foundInProvince[1] : null;
    }
    if (state.cityByKey.has(featureKey)) return state.cityByKey.get(featureKey);
    const found = state.cityKeyEntries.find(([cityKey]) =>
      cityKey.length >= 3 && (featureKey.startsWith(cityKey) || cityKey.startsWith(featureKey)));
    return found ? found[1] : null;
  }

  function featureStyle(feature) {
    const city = matchFeatureToCity(feature);
    const isSelected = city && city.id === state.selectedCityId;
    const isVisited = city && state.routes.some((route) => route.from === city.id || route.to === city.id);
    return {
      color: isSelected ? "#e84d3d" : isVisited ? "#168f7d" : "#b7c7ad",
      weight: isSelected ? 1.7 : isVisited ? 1.2 : 0.85,
      fillColor: isSelected ? "#ffe7bd" : isVisited ? "#d9f0e8" : "#dfe9d7",
      fillOpacity: isSelected ? 0.98 : 0.9,
      opacity: 0.95
    };
  }

  function cityStyle(cityId) {
    const visited = new Set(state.routes.flatMap((route) => [route.from, route.to]));
    const isSelected = cityId === state.selectedCityId;
    const isVisited = visited.has(cityId);
    const hasFoodArticles = articleCountForCity(cityId) > 0;
    return {
      radius: isSelected ? 7 : isVisited ? 5 : hasFoodArticles ? 4.3 : 3.4,
      color: isSelected ? "#e84d3d" : isVisited ? "#168f7d" : "#fffaf0",
      weight: isSelected ? 2.5 : 1.25,
      fillColor: isSelected ? "#ffe7bd" : isVisited ? "#168f7d" : hasFoodArticles ? "#c46b2a" : "#e84d3d",
      fillOpacity: isSelected ? 1 : 0.92,
      opacity: 1
    };
  }

  function renderChinaLayer() {
    state.chinaLayer = L.geoJSON(state.mapData, {
      renderer: state.canvasRenderer,
      interactive: true,
      style: featureStyle,
      onEachFeature: (feature, layer) => {
        const city = matchFeatureToCity(feature);
        if (!city) return;
        state.featureCityIds.set(layer, city.id);
        state.cityFeatureLayers.set(city.id, layer);
        state.cityAdcodes.set(city.id, String(feature.properties.id || feature.properties.adcode || ""));
        layer.bindTooltip(`${city.name} / ${city.province}`, {
          className: "city-tooltip",
          direction: "center",
          opacity: 0.95,
          sticky: true
        });
        layer.on({
          click: () => callbacks.queueCityClick?.(city.id),
          dblclick: (event) => {
            if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
            callbacks.enterCityView?.(city.id);
          },
          mouseover: () => layer.setStyle({ fillOpacity: 0.98, weight: 1.45, color: "#78916c" }),
          mouseout: () => layer.setStyle(featureStyle(feature))
        });
      }
    }).addTo(state.map);
  }

  function renderCities() {
    state.cityLayer.clearLayers();
    state.cities.forEach((city) => {
      const marker = L.circleMarker([city.lat, city.lon], {
        ...cityStyle(city.id),
        renderer: state.canvasRenderer,
        bubblingMouseEvents: false
      });
      marker.bindTooltip(`${city.name} / ${city.province}`, {
        className: "city-tooltip",
        direction: "top",
        offset: [0, -8],
        opacity: 1,
        sticky: true
      });
      marker.on("click", () => callbacks.queueCityClick?.(city.id));
      marker.on("dblclick", (event) => {
        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
        callbacks.enterCityView?.(city.id);
      });
      marker.addTo(state.cityLayer);
      city.marker = marker;
    });
  }

  function updateVisibleLabels() {
    if (!state.map || !state.labelLayer || !state.cities.length) return;
    if (state.viewMode === "city") {
      state.labelLayer.clearLayers();
      return;
    }
    const bounds = state.map.getBounds().pad(0.08);
    const zoom = state.map.getZoom();
    const fontSize = Math.max(10, Math.min(20, Math.round(zoom * 2.2 + 1)));
    const selectedCity = cityById(state.selectedCityId);
    state.labelLayer.clearLayers();
    state.cities.forEach((city) => {
      const isSelected = selectedCity && selectedCity.id === city.id;
      if (!isSelected && !bounds.contains([city.lat, city.lon])) return;
      L.marker([city.lat, city.lon], {
        pane: "cityLabels",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "city-name-marker",
          html: `<span style="font-size:${fontSize}px">${escapeHtml(city.name)}</span>`,
          iconSize: null,
          iconAnchor: [0, 0]
        })
      }).addTo(state.labelLayer);
    });
  }

  function init() {
    if (state.map) return state.map;
    state.canvasRenderer = L.canvas({ padding: 0.65, tolerance: 8 });
    state.map = L.map(elements.mapTarget || "travelMap", {
      preferCanvas: true,
      renderer: state.canvasRenderer,
      zoomControl: true,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 14,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 90,
      doubleClickZoom: false
    });
    state.map.attributionControl.setPrefix("Leaflet Canvas");
    state.map.createPane("cityLabels");
    state.map.getPane("cityLabels").style.zIndex = 650;
    state.map.getPane("cityLabels").style.pointerEvents = "none";
    state.map.createPane("foodMarkers");
    state.map.getPane("foodMarkers").style.zIndex = 720;
    state.routeLayer = L.layerGroup().addTo(state.map);
    state.cityLayer = L.layerGroup().addTo(state.map);
    state.labelLayer = L.layerGroup([], { pane: "cityLabels" }).addTo(state.map);
    state.cityDetailLayer = L.layerGroup().addTo(state.map);
    renderChinaLayer();
    renderCities();
    fitChina();
    updateVisibleLabels();
    state.map.on(labelEvents, updateVisibleLabels);
    return state.map;
  }

  function fitChina() {
    if (!state.chinaLayer || !state.map) return;
    const bounds = state.chinaLayer.getBounds();
    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        paddingTopLeft: [28, 28],
        paddingBottomRight: [28, 28],
        animate: false
      });
      return;
    }
    const fallbackBounds = L.latLngBounds(state.cities.map((city) => [city.lat, city.lon]));
    if (!fallbackBounds.isValid()) return;
    state.map.fitBounds(fallbackBounds, {
      paddingTopLeft: [28, 28],
      paddingBottomRight: [28, 28],
      animate: false
    });
  }

  function curvedRoutePoints(from, to) {
    const start = { lat: from.lat, lon: from.lon };
    const end = { lat: to.lat, lon: to.lon };
    const deltaLat = end.lat - start.lat;
    const deltaLon = end.lon - start.lon;
    const distance = Math.hypot(deltaLat, deltaLon);
    if (!distance) return [[start.lat, start.lon], [end.lat, end.lon]];
    const curve = Math.min(distance * 0.16, 0.16);
    const normalLat = -deltaLon / distance;
    const normalLon = deltaLat / distance;
    const control = {
      lat: (start.lat + end.lat) / 2 + normalLat * curve,
      lon: (start.lon + end.lon) / 2 + normalLon * curve
    };
    return Array.from({ length: 18 }, (_, index) => {
      const t = index / 17;
      const inv = 1 - t;
      return [
        inv * inv * start.lat + 2 * inv * t * control.lat + t * t * end.lat,
        inv * inv * start.lon + 2 * inv * t * control.lon + t * t * end.lon
      ];
    });
  }

  function renderRoutes() {
    if (!state.routeLayer) return;
    state.routeLayer.clearLayers();
    state.routes.forEach((route) => {
      const from = placeById(route.from);
      const to = placeById(route.to);
      if (!from || !to) return;
      const routePoints = curvedRoutePoints(from, to);
      L.polyline(routePoints, {
        renderer: state.canvasRenderer,
        color: route.status === "error" ? "#d75b4f" : "#1f9d8a",
        weight: 9,
        opacity: 0.11,
        interactive: false
      }).addTo(state.routeLayer);
      L.polyline(routePoints, {
        renderer: state.canvasRenderer,
        color: route.status === "error" ? "#d75b4f" : route.status === "loading" ? "#e7aa38" : "#168f7d",
        weight: 3.2,
        opacity: 0.78,
        dashArray: route.status === "success" ? "10 9" : route.status === "error" ? "4 10" : "6 10",
        lineCap: "round",
        interactive: false
      }).addTo(state.routeLayer);
    });
  }

  function updateCityStyles() {
    state.cities.forEach((city) => city.marker?.setStyle(cityStyle(city.id)));
    state.chinaLayer?.setStyle(featureStyle);
    updateVisibleLabels();
  }

  function enterCityView() {
    if (!state.map) return;
    [state.chinaLayer, state.cityLayer, state.labelLayer].forEach((layer) => {
      if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    if (state.routeLayer && !state.map.hasLayer(state.routeLayer)) state.routeLayer.addTo(state.map);
    if (state.cityDetailLayer && !state.map.hasLayer(state.cityDetailLayer)) state.cityDetailLayer.addTo(state.map);
  }

  function enterChinaView(options = {}) {
    if (!state.map) return;
    callbacks.cancelQueuedCityClick?.();
    state.viewMode = "china";
    state.activeCityViewId = null;
    state.activeDistrictBoundaryCount = 0;
    state.activeLandmarkCount = 0;
    state.activeStationCount = 0;
    state.activeSubwayLineCount = 0;
    state.activeSubwayStationCount = 0;
    state.cityDetailLayer?.clearLayers();
    [state.chinaLayer, state.routeLayer, state.cityLayer, state.labelLayer].forEach((layer) => {
      if (layer && !state.map.hasLayer(layer)) layer.addTo(state.map);
    });
    if (elements.exitCityViewBtn) elements.exitCityViewBtn.hidden = true;
    renderRoutes();
    updateCityStyles();
    if (options.fit !== false) fitChina();
    callbacks.renderPanel?.();
  }

  function setMobileView(view) {
    if (!elements.appShell || !["plan", "map"].includes(view)) return;
    elements.appShell.classList.toggle("mobile-plan", view === "plan");
    elements.appShell.classList.toggle("mobile-map", view === "map");
    (elements.mobileViewButtons || []).forEach((button) => {
      const active = button.dataset.mobileView === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function estimateRailRoute(from, to, mode = state.transportMode) {
    const profile = transportProfile(mode);
    const distance = haversineDistance(from, to) * profile.detourFactor;
    const duration = distance / (profile.speedKmh * 1000 / 3600) + profile.bufferMinutes * 60;
    return {
      distance,
      duration,
      mode: profile.mode || mode,
      label: profile.label
    };
  }

  function routeMetricUpdates(route) {
    const from = placeById(route.from);
    const to = placeById(route.to);
    if (!from || !to) return null;
    if (!hasCoordinates(from) || !hasCoordinates(to)) {
      return {
        status: "error", distance: null, duration: null, fallback: true,
        error: "缺少坐标，无法估算行程"
      };
    }
    const estimate = estimateRailRoute(from, to, route.transportMode || state.transportMode);
    return {
      status: "success", distance: estimate.distance, duration: estimate.duration,
      fallback: true, error: null, transportMode: estimate.mode, transportLabel: estimate.label
    };
  }

  function calculateRouteMetrics(route) {
    const updates = routeMetricUpdates(route);
    if (!updates || !state.routes.includes(route)) return;
    Object.assign(route, updates);
    renderRoutes();
    callbacks.routeMetricsUpdated?.(route);
  }

  function recalculateRoutesForTransport() {
    state.routes.forEach((route) => {
      const updates = routeMetricUpdates({ ...route, transportMode: state.transportMode });
      if (updates) Object.assign(route, updates);
    });
  }

  function createBounds(points = []) { return L.latLngBounds(points); }
  function distanceBetween(from, to) { return haversineDistance(from, to); }
  function addGeoJson(data, options = {}) { return L.geoJSON(data, options); }
  function addCircleMarker(point, options = {}) { return L.circleMarker(point, options); }
  function addMarker(point, options = {}) { return L.marker(point, options); }
  function divIcon(options = {}) { return L.divIcon(options); }
  function addPolyline(points, options = {}) { return L.polyline(points, options); }
  function getZoom() { return state.map?.getZoom(); }
  function flyTo(point, zoom, options = {}) { return state.map?.flyTo(point, zoom, options); }
  function fitBounds(bounds, options = {}) { return state.map?.fitBounds(bounds, options); }

  function destroy() {
    if (!state.map) return;
    state.map.off(labelEvents, updateVisibleLabels);
    state.cities.forEach((city) => { city.marker = null; });
    state.map.remove();
    state.map = null;
    state.canvasRenderer = null;
    state.chinaLayer = null;
    state.cityLayer = null;
    state.labelLayer = null;
    state.routeLayer = null;
    state.cityDetailLayer = null;
  }

  return {
    init,
    fitChina,
    renderRoutes,
    updateCityStyles,
    enterCityView,
    enterChinaView,
    setMobileView,
    calculateRouteMetrics,
    recalculateRoutesForTransport,
    distanceBetween,
    createBounds,
    addGeoJson,
    addCircleMarker,
    addMarker,
    divIcon,
    addPolyline,
    getZoom,
    flyTo,
    fitBounds,
    destroy
  };
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

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}
