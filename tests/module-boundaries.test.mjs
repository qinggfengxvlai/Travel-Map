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
  assert.match(appSource, /createMapController\s*\(\s*\{[\s\S]*?L:\s*window\.L[\s\S]*?state,[\s\S]*?callbacks:[\s\S]*?helpers:/);
  assert.doesNotMatch(
    appSource,
    /function\s+(?:initMap|renderChinaLayer|matchFeatureToCity|provinceNameFromFeature|featureStyle|renderCities|cityStyle|updateVisibleLabels|fitChina|renderRoutes|curvedRoutePoints|recalculateRoutesForTransport|calculateRouteMetrics)\s*\(/
  );
  assert.doesNotMatch(mapCoreSource, /(?:from|import\s*)["']\.\/app\.js["']/);
  assert.doesNotMatch(mapCoreSource, /\b(?:window|document)\b/, "map-core must use injected dependencies");
  for (const method of ["init", "fitChina", "renderRoutes", "updateCityStyles", "enterChinaView", "setMobileView", "destroy"]) {
    assert.match(mapCoreSource, new RegExp(`\\b${method}\\b`), `expected controller API to include ${method}`);
  }
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
