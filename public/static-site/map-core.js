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

  function districtBoundaryStyle(feature) {
    const index = feature?.properties ? Number(feature.properties.subFeatureIndex || 0) : 0;
    const fills = ["#dfe9d7", "#e9f1dd", "#d7e8dc", "#edf0d8", "#dbeade"];
    return {
      color: "#6f8c73",
      weight: 1.05,
      fillColor: fills[index % fills.length],
      fillOpacity: 0.86,
      opacity: 0.96
    };
  }

  function metroColor(color) {
    const text = String(color || "").replace(/^#/, "").trim();
    return /^[0-9a-f]{6}$/i.test(text) ? `#${text}` : "#0f8f83";
  }

  function addDetailLabel(detailBounds, { name, lat, lon, className, fontSize }) {
    detailBounds.extend([lat, lon]);
    L.marker([lat, lon], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className,
        html: `<span style="font-size:${fontSize}px">${escapeHtml(name)}</span>`,
        iconSize: null,
        iconAnchor: [0, 0]
      })
    }).addTo(state.cityDetailLayer);
  }

  function clearCityDetail() {
    state.cityDetailLayer?.clearLayers();
  }

  function renderCityDetail({
    city,
    sourceFeature = null,
    districts = [],
    subareas = [],
    landmarks = [],
    stations = [],
    metroLines = [],
    subwayStations = [],
    foodMarkers = [],
    foodArticleCount = foodMarkers.length
  } = {}) {
    if (!city || !state.map || !state.cityDetailLayer) return;
    clearCityDetail();
    const detailBounds = L.latLngBounds([]);

    state.activeDistrictBoundaryCount = districts.length;
    state.activeLandmarkCount = landmarks.length;
    state.activeStationCount = stations.length;
    state.activeSubwayLineCount = metroLines.length;
    state.activeSubwayStationCount = subwayStations.length;
    state.activeFoodArticleCount = foodArticleCount;

    if (!districts.length && sourceFeature) {
      const outline = L.geoJSON(sourceFeature, {
        renderer: state.canvasRenderer,
        interactive: false,
        style: () => ({
          color: "#234f44",
          weight: 1.8,
          fillColor: "#e7efdf",
          fillOpacity: 0.78,
          opacity: 1
        })
      }).addTo(state.cityDetailLayer);
      detailBounds.extend(outline.getBounds());
    }

    if (districts.length) {
      const districtByFeature = new Map(districts.map((district) => [district.feature, district]));
      const districtLayer = L.geoJSON({
        type: "FeatureCollection",
        features: districts.map((district) => district.feature)
      }, {
        renderer: state.canvasRenderer,
        interactive: true,
        style: districtBoundaryStyle,
        onEachFeature: (feature, layer) => {
          const district = districtByFeature.get(feature) || {};
          const name = district.name || feature.properties?.name || "下辖区域";
          layer.bindTooltip(`${name} / ${city.name}`, {
            className: "city-tooltip",
            direction: "center",
            opacity: 0.96,
            sticky: true
          });
          layer.on({
            click: () => district.placeId && callbacks.queuePlaceClick?.(district.placeId),
            mouseover: () => layer.setStyle({ fillOpacity: 0.96, weight: 1.6, color: "#234f44" }),
            mouseout: () => layer.setStyle(districtBoundaryStyle(feature))
          });
          if (district.labelPoint) {
            addDetailLabel(detailBounds, {
              name,
              lat: district.labelPoint.lat,
              lon: district.labelPoint.lon,
              className: "city-detail-label",
              fontSize: 12
            });
          }
        }
      }).addTo(state.cityDetailLayer);
      detailBounds.extend(districtLayer.getBounds());
    } else {
      subareas.forEach((area) => {
        detailBounds.extend([area.lat, area.lon]);
        L.circleMarker([area.lat, area.lon], {
          renderer: state.canvasRenderer,
          radius: 4.5,
          color: "#fffaf0",
          weight: 1.4,
          fillColor: "#168f7d",
          fillOpacity: 0.95,
          interactive: true
        })
          .bindTooltip(`${area.name} / ${city.name}`, {
            className: "city-tooltip",
            direction: "top",
            offset: [0, -8],
            opacity: 1,
            sticky: true
          })
          .on("click", () => callbacks.queuePlaceClick?.(area.id))
          .addTo(state.cityDetailLayer);
        addDetailLabel(detailBounds, { name: area.name, lat: area.lat, lon: area.lon, className: "city-detail-label", fontSize: 12 });
      });
    }

    landmarks.forEach((landmark) => {
      detailBounds.extend([landmark.lat, landmark.lon]);
      L.marker([landmark.lat, landmark.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span class="landmark-marker ${escapeHtml(landmark.type || "scenic")}"><span>${landmark.symbol}</span></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        })
      })
        .bindTooltip(`${landmark.name} / ${landmark.typeLabel}`, {
          className: "city-tooltip",
          direction: "top",
          offset: [0, -8],
          opacity: 1,
          sticky: true
        })
        .bindPopup(landmark.popupHtml, {
          className: "landmark-popup-shell",
          maxWidth: 280,
          minWidth: 220
        })
        .addTo(state.cityDetailLayer);
      addDetailLabel(detailBounds, { name: landmark.name, lat: landmark.lat, lon: landmark.lon, className: "landmark-label", fontSize: 13 });
    });

    stations.forEach((station) => {
      detailBounds.extend([station.lat, station.lon]);
      L.marker([station.lat, station.lon], {
        icon: L.divIcon({
          className: "",
          html: `<span class="station-marker"><span>火</span></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      })
        .bindTooltip(`${station.name} / 火车站`, {
          className: "city-tooltip",
          direction: "top",
          offset: [0, -8],
          opacity: 1,
          sticky: true
        })
        .addTo(state.cityDetailLayer);
      addDetailLabel(detailBounds, { name: station.name, lat: station.lat, lon: station.lon, className: "station-label", fontSize: 13 });
    });

    metroLines.forEach((line) => {
      const points = (line.coordinates || [])
        .map((coord) => [Number(coord[1]), Number(coord[0])])
        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
      if (points.length < 2) return;
      points.forEach((point) => detailBounds.extend(point));
      L.polyline(points, {
        renderer: state.canvasRenderer,
        color: "#fffaf0",
        weight: 7,
        opacity: 0.74,
        interactive: false,
        lineCap: "round",
        lineJoin: "round"
      }).addTo(state.cityDetailLayer);
      L.polyline(points, {
        renderer: state.canvasRenderer,
        color: metroColor(line.color),
        weight: 4,
        opacity: 0.92,
        interactive: true,
        lineCap: "round",
        lineJoin: "round"
      })
        .bindTooltip(`${line.name} / 地铁线路`, {
          className: "city-tooltip",
          direction: "top",
          opacity: 1,
          sticky: true
        })
        .addTo(state.cityDetailLayer);
    });

    subwayStations.forEach((station) => {
      detailBounds.extend([station.lat, station.lon]);
      L.circleMarker([station.lat, station.lon], {
        renderer: state.canvasRenderer,
        radius: station.source === "metro-network" ? 3.4 : 4.4,
        color: "#fffaf0",
        weight: 1,
        fillColor: metroColor(station.color),
        fillOpacity: 0.96,
        opacity: 1
      })
        .bindTooltip(`${station.name} / ${station.lineName ? `${station.lineName} ` : ""}地铁站`, {
          className: "city-tooltip",
          direction: "top",
          offset: [0, -8],
          opacity: 1,
          sticky: true
        })
        .addTo(state.cityDetailLayer);
    });

    foodMarkers.forEach((food) => {
      detailBounds.extend([food.lat, food.lon]);
      L.marker([food.lat, food.lon], {
        pane: "foodMarkers",
        icon: L.divIcon({
          className: "",
          html: `<span class="food-marker"><span>食</span></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      })
        .bindTooltip(`${food.title} / 食行记`, {
          className: "city-tooltip",
          direction: "top",
          offset: [0, -8],
          opacity: 1,
          sticky: true
        })
        .bindPopup(food.popupHtml, {
          className: "food-popup-shell",
          maxWidth: 320,
          minWidth: 250
        })
        .addTo(state.cityDetailLayer);
    });

    if (!detailBounds.isValid()) return;
    state.map.fitBounds(detailBounds.pad(0.18), {
      paddingTopLeft: [28, 28],
      paddingBottomRight: [28, 28],
      animate: true,
      duration: 0.35
    });
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
    clearCityDetail();
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

  function distanceBetween(from, to) { return haversineDistance(from, to); }
  function focusPlace(place, { minimumZoom = 10, duration = 0.45 } = {}) {
    if (!state.map || !hasCoordinates(place)) return;
    state.map.flyTo(
      [Number(place.lat), Number(place.lon)],
      Math.max(state.map.getZoom(), minimumZoom),
      { duration }
    );
  }

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
    renderCityDetail,
    clearCityDetail,
    setMobileView,
    calculateRouteMetrics,
    recalculateRoutesForTransport,
    distanceBetween,
    focusPlace,
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
