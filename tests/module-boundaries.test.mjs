import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const mapCoreUrl = new URL("../public/static-site/map-core.js", import.meta.url);
const appUrl = new URL("../public/static-site/app.js", import.meta.url);

test("Leaflet ownership lives in the public map-core module", async () => {
  await access(mapCoreUrl);
  const mapCore = await import(mapCoreUrl);
  const appSource = await readFile(appUrl, "utf8");
  const mapCoreSource = await readFile(mapCoreUrl, "utf8");

  assert.equal(typeof mapCore.createMapController, "function");
  assert.doesNotMatch(appSource, /\bL\.(?:map|geoJSON)\s*\(/);
  assert.doesNotMatch(appSource, /\bL\./, "app.js must not directly own Leaflet rendering");
  assert.doesNotMatch(
    appSource,
    /mapController\.(?:addGeoJson|addMarker|addPolyline|addCircleMarker|divIcon|fitBounds|createBounds|getZoom|flyTo)\s*\(/,
    "app.js must use cohesive map operations, not Leaflet forwarding methods"
  );
  assert.doesNotMatch(appSource, /state\.cityDetailLayer\b|\.addTo\s*\(/, "app.js must not attach or clear map layers");
  assert.match(appSource, /mapController\.renderCityDetail\s*\(/);
  assert.match(appSource, /createMapController\s*\(\s*\{[\s\S]*?L:\s*window\.L[\s\S]*?state,[\s\S]*?callbacks:[\s\S]*?helpers:/);
  assert.doesNotMatch(
    appSource,
    /function\s+(?:initMap|renderChinaLayer|matchFeatureToCity|provinceNameFromFeature|featureStyle|renderCities|cityStyle|updateVisibleLabels|fitChina|renderRoutes|curvedRoutePoints|recalculateRoutesForTransport|calculateRouteMetrics)\s*\(/
  );
  assert.doesNotMatch(mapCoreSource, /(?:from|import\s*)["']\.\/app\.js["']/);
  assert.doesNotMatch(mapCoreSource, /\b(?:window|document)\b/, "map-core must use injected dependencies");
  assert.doesNotMatch(
    mapCoreSource,
    /function\s+(?:addGeoJson|addMarker|addPolyline|addCircleMarker|divIcon|fitBounds|createBounds|getZoom|flyTo)\s*\(/,
    "map-core must not expose generic Leaflet forwarding functions"
  );
  for (const method of ["init", "fitChina", "renderRoutes", "updateCityStyles", "enterChinaView", "setMobileView", "destroy"]) {
    assert.match(mapCoreSource, new RegExp(`\\b${method}\\b`), `expected controller API to include ${method}`);
  }
});

test("map controller owns cohesive city-detail rendering and lifecycle", async () => {
  const { createMapController } = await import(mapCoreUrl);
  const calls = [];
  const attached = new Set();
  const events = [];
  const bounds = {
    extend(value) { calls.push(["bounds.extend", value]); return this; },
    isValid() { return true; },
    pad() { return this; }
  };
  const makeLayer = (kind) => ({
    feature: null,
    addTo() { calls.push([`${kind}.addTo`]); return this; },
    bindTooltip(text) { calls.push([`${kind}.tooltip`, text]); return this; },
    bindPopup(text) { calls.push([`${kind}.popup`, text]); return this; },
    on(nameOrEvents, handler) { events.push([nameOrEvents, handler]); return this; },
    setStyle(style) { calls.push([`${kind}.style`, style]); return this; },
    getBounds() { return bounds; },
    clearLayers() { calls.push([`${kind}.clear`]); }
  });
  const detailLayer = makeLayer("detail");
  const routeLayer = makeLayer("routes");
  const cityLayer = makeLayer("cities");
  const labelLayer = makeLayer("labels");
  const chinaLayer = makeLayer("china");
  const map = {
    hasLayer(layer) { return attached.has(layer); },
    removeLayer(layer) { attached.delete(layer); calls.push(["map.removeLayer", layer]); },
    fitBounds() { calls.push(["map.fitBounds"]); },
    getBounds() { return { pad() { return this; }, contains() { return true; } }; },
    getZoom() { return 8; },
    off() {},
    remove() { calls.push(["map.remove"]); }
  };
  for (const layer of [chinaLayer, cityLayer, labelLayer]) attached.add(layer);
  for (const layer of [routeLayer, detailLayer]) {
    layer.addTo = () => { attached.add(layer); calls.push(["layer.addTo", layer]); return layer; };
  }
  const L = {
    latLngBounds() { calls.push(["latLngBounds"]); return bounds; },
    geoJSON(data, options) {
      calls.push(["geoJSON"]);
      if (options?.onEachFeature && data.features?.[0]) options.onEachFeature(data.features[0], makeLayer("district"));
      return makeLayer("geoJSON");
    },
    marker() { calls.push(["marker"]); return makeLayer("marker"); },
    circleMarker() { calls.push(["circleMarker"]); return makeLayer("circleMarker"); },
    polyline() { calls.push(["polyline"]); return makeLayer("polyline"); },
    divIcon(options) { calls.push(["divIcon", options]); return options; }
  };
  const cityMarker = makeLayer("cityMarker");
  const state = {
    map,
    canvasRenderer: {},
    cities: [{ id: "city", marker: cityMarker }],
    routes: [],
    selectedCityId: "city",
    cityDetailLayer: detailLayer,
    routeLayer,
    cityLayer,
    labelLayer,
    chinaLayer,
    viewMode: "city",
    activeCityViewId: "city",
    cityById: new Map([["city", { id: "city" }]]),
    placeById: new Map()
  };
  const controller = createMapController({
    L,
    state,
    callbacks: { queuePlaceClick(id) { calls.push(["place.click", id]); } },
    helpers: { articleCountForCity: () => 0 }
  });

  controller.enterCityView();
  controller.renderCityDetail({
    city: { id: "city", name: "测试城" },
    sourceFeature: { type: "Feature", properties: {} },
    districts: [{ feature: { type: "Feature", properties: {} }, name: "一区", placeId: "district", labelPoint: { lat: 1, lon: 2 } }],
    subareas: [{ id: "subarea", name: "二区", lat: 3, lon: 4 }],
    landmarks: [{ name: "景点", lat: 5, lon: 6, type: "scenic", symbol: "景", typeLabel: "景点", popupHtml: "landmark popup" }],
    stations: [{ name: "火车站", lat: 7, lon: 8 }],
    metroLines: [{ name: "1号线", color: "#123456", coordinates: [[9, 10], [11, 12]] }],
    subwayStations: [{ name: "地铁站", lat: 13, lon: 14, color: "#654321", source: "metro-network", lineName: "1号线" }],
    foodMarkers: [{ title: "美食", lat: 15, lon: 16, popupHtml: "food popup" }]
  });
  events.find(([eventMap]) => eventMap && typeof eventMap === "object")?.[0].click();
  controller.updateCityStyles();
  controller.clearCityDetail();
  controller.enterChinaView();
  controller.destroy();

  assert.ok(calls.filter(([name]) => name === "geoJSON").length >= 1);
  assert.ok(calls.filter(([name]) => name === "marker").length >= 4, "expected landmark, station, food, and labels");
  assert.ok(calls.filter(([name]) => name === "circleMarker").length >= 1);
  assert.equal(calls.filter(([name]) => name === "polyline").length, 2);
  assert.ok(calls.some(([name]) => name === "map.fitBounds"));
  assert.ok(calls.some(([name]) => name === "detail.clear"));
  assert.ok(calls.some(([name]) => name === "cityMarker.style"));
  assert.ok(calls.some(([name]) => name === "china.style"));
  assert.ok(calls.some(([name]) => name === "map.removeLayer"));
  assert.ok(calls.some(([name]) => name === "map.remove"));
  assert.ok(calls.some(([name, id]) => name === "place.click" && id === "district"));
});

test("map controller initializes Leaflet layers and renders routes through injected state", async () => {
  const { createMapController } = await import(mapCoreUrl);
  const calls = [];
  let featureEvents = null;
  const layerGroup = () => ({
    addTo(map) { calls.push(["layer.addTo", map]); return this; },
    clearLayers() { calls.push(["layer.clearLayers"]); },
    addLayer() {},
    remove() {}
  });
  const map = {
    attributionControl: { setPrefix(value) { calls.push(["prefix", value]); } },
    createPane(name) { calls.push(["pane", name]); },
    getPane() { return { style: {} }; },
    on(events) { calls.push(["map.on", events]); },
    off(events) { calls.push(["map.off", events]); },
    fitBounds() {},
    getBounds() { return { pad() { return this; }, contains() { return true; } }; },
    getZoom() { return 5; },
    hasLayer() { return true; },
    removeLayer() {},
    remove() { calls.push(["map.remove"]); }
  };
  const featureLayer = {
    bindTooltip() { return this; },
    on(events) { featureEvents = events; return this; },
    setStyle() {},
    feature: null
  };
  const chinaLayer = {
    addTo() { return this; },
    getBounds() { return { isValid() { return false; } }; },
    setStyle() {},
    remove() {}
  };
  const marker = {
    bindTooltip() { return this; },
    on() { return this; },
    addTo() { return this; },
    setStyle() {}
  };
  const L = {
    canvas(options) { calls.push(["canvas", options]); return {}; },
    map(target, options) { calls.push(["map", target, options]); return map; },
    layerGroup() { return layerGroup(); },
    geoJSON(data, options) { calls.push(["geoJSON", data]); options.onEachFeature(data.features[0], featureLayer); return chinaLayer; },
    circleMarker() { return { ...marker }; },
    marker() { return { ...marker }; },
    divIcon(options) { return options; },
    polyline(points, options) { calls.push(["polyline", points, options]); return { addTo() { return this; } }; },
    latLngBounds() { return { isValid() { return false; } }; },
    DomEvent: { stop() {} }
  };
  const city = { id: "beijing", name: "北京", province: "北京", lat: 39.9, lon: 116.4 };
  const state = {
    selectedCityId: null,
    routes: [{ from: "beijing", to: "shanghai", status: "success" }],
    cities: [city],
    cityById: new Map([[city.id, city]]),
    placeById: new Map([[city.id, city], ["shanghai", { id: "shanghai", lat: 31.2, lon: 121.5 }]]),
    cityByKey: new Map([["北京", city]]),
    cityByProvinceKey: new Map([["北京|北京", city]]),
    cityKeyEntries: [["北京", city]],
    cityFeatureLayers: new Map(),
    cityAdcodes: new Map(),
    featureCityIds: new WeakMap(),
    mapData: { features: [{ properties: { id: "110100", name: "北京" } }] },
    viewMode: "china"
  };
  const controller = createMapController({
    L,
    state,
    elements: { mapTarget: "travelMap", appShell: null, mobileViewButtons: [] },
    callbacks: {
      queueCityClick(id) { calls.push(["city.click", id]); },
      enterCityView(id) { calls.push(["city.dblclick", id]); }
    },
    helpers: {
      normalizeKey: (value) => value,
      escapeHtml: (value) => value,
      articleCountForCity: () => 0
    }
  });

  controller.init();
  featureEvents.click();
  featureEvents.dblclick({ originalEvent: {} });
  controller.renderRoutes();
  controller.destroy();

  assert.equal(state.map, null);
  assert.equal(calls.filter(([name]) => name === "map").length, 1);
  assert.equal(calls.filter(([name]) => name === "geoJSON").length, 1);
  assert.equal(calls.filter(([name]) => name === "polyline").length, 2);
  assert.ok(calls.some(([name, id]) => name === "city.click" && id === city.id));
  assert.ok(calls.some(([name, id]) => name === "city.dblclick" && id === city.id));
  assert.ok(calls.some(([name]) => name === "map.remove"));
});

test("map controller applies injected route profiles and mobile view state", async () => {
  const { createMapController } = await import(mapCoreUrl);
  const toggles = [];
  const button = {
    dataset: { mobileView: "map" },
    classList: { toggle(name, active) { toggles.push([name, active]); } },
    setAttribute(name, value) { toggles.push([name, value]); }
  };
  const shell = { classList: { toggle(name, active) { toggles.push([name, active]); } } };
  const from = { id: "a", lat: 39.9, lon: 116.4 };
  const to = { id: "b", lat: 31.2, lon: 121.5 };
  const route = { from: "a", to: "b", status: "loading", transportMode: "rail" };
  const state = {
    transportMode: "rail",
    routes: [route],
    cities: [],
    cityById: new Map(),
    placeById: new Map([["a", from], ["b", to]])
  };
  let metricUpdates = 0;
  const controller = createMapController({
    L: {},
    state,
    elements: { appShell: shell, mobileViewButtons: [button] },
    callbacks: { routeMetricsUpdated() { metricUpdates += 1; } },
    helpers: {
      transportProfile: () => ({ mode: "rail", label: "火车", speedKmh: 200, detourFactor: 1.1, bufferMinutes: 20 })
    }
  });

  controller.calculateRouteMetrics(route);
  controller.setMobileView("map");

  assert.equal(route.status, "success");
  assert.equal(route.fallback, true);
  assert.equal(route.transportLabel, "火车");
  assert.ok(route.distance > 0);
  assert.ok(route.duration > 0);
  assert.equal(metricUpdates, 1);
  assert.deepEqual(toggles, [
    ["mobile-plan", false],
    ["mobile-map", true],
    ["active", true],
    ["aria-selected", "true"]
  ]);
});
