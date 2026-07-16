# Progressive Loading and Frontend Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete China map usable before county and food data finish loading, then split the 4,000-line entry script into focused, progressively loaded modules without removing any feature.

**Architecture:** A small `app.js` composition entry owns one application context. Static core modules load cities, all eight prefecture chunks, render the China map, and recover local trip state; memoized background loaders hydrate county and food indexes after first render. City detail, food presentation, trip DOM coordination, and guide export are isolated behind shared dynamic-import promises so every existing command remains available without belonging to the startup-critical bundle.

**Tech Stack:** Browser ES modules, Leaflet 1.9.4, Node.js 22 test runner, Nginx static hosting, gzip static compression, Playwright browser smoke tests.

---

## File Structure

Create or change these files only for this feature:

- `public/static-site/app.js`: composition root, shared context creation, critical startup, module prefetch, and fatal startup status.
- `public/static-site/app-data.js`: versioned JSON requests, retry/timeout, critical map data, memoized deferred datasets, and idle scheduling.
- `public/static-site/place-index.js`: city/county normalization, place maps, search keys, and idempotent incremental county hydration.
- `public/static-site/map-core.js`: Leaflet initialization, China boundaries, city points/labels, viewport fitting, route layers, and map-level selection callbacks.
- `public/static-site/food-content.js`: food normalization/indexes, deferred summary and per-city hydration, panel rendering, article markers, and article URL helpers.
- `public/static-site/city-detail.js`: city drill-down, DataV districts, OSM/local landmarks, metro, railway/subway stations, and detail-layer lifecycle.
- `public/static-site/trip-controller.js`: TripPlan DOM coordination, persistence/share/import/export commands, panel rendering, and route-to-calendar synchronization.
- `public/static-site/guide-export.js`: existing pure guide model/renderers; loaded dynamically by `trip-controller.js` rather than statically by `app.js`.
- `public/static-site/index.html`: release version, preloads, and application-ready state hooks.
- `deploy/nginx.conf`: HTML revalidation plus immutable caching for versioned static assets.
- `scripts/precompress_static_assets.py`: reproducible gzip generation for deployable text assets.
- `tests/app-data.test.mjs`: request policy, critical/deferred separation, retry, memoization, and idle scheduling.
- `tests/place-index.test.mjs`: incremental county hydration and search integrity.
- `tests/food-content.test.mjs`: idempotent food hydration and city chunk merging.
- `tests/module-boundaries.test.mjs`: static module ownership and dynamic import contracts.
- `tests/browser-performance.test.mjs`: browser-visible readiness order and complete feature smoke path.
- `playwright.config.mjs`: local static server and Chromium smoke-test configuration.
- `tests/rendered-html.test.mjs`: entry URL/version and required control regression checks.
- `package.json` and lockfile: include new test files and Playwright test tooling.

Existing generated `dist/server/*` files are outside this static deployment and must not be regenerated or committed as part of this plan.

### Task 1: Lock the loading-order performance contract

**Files:**
- Create: `tests/app-data.test.mjs`
- Create: `tests/module-boundaries.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing critical/deferred loading tests**

Create `tests/app-data.test.mjs` with real deferred promises and no browser mocks:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeferredDataLoaders,
  loadCriticalMapData
} from "../public/static-site/app-data.js";

test("critical map data never requests county or food summaries", async () => {
  const requested = [];
  const loadJson = async (path) => {
    requested.push(path);
    if (path.includes("china-cities")) return { cities: [{ id: "beijing", name: "北京" }] };
    return { type: "FeatureCollection", features: [{ properties: { id: path } }] };
  };

  const result = await loadCriticalMapData({ loadJson, boundaryChunkCount: 8 });

  assert.equal(result.cities.length, 1);
  assert.equal(result.mapData.features.length, 8);
  assert.equal(requested.length, 9);
  assert.ok(requested.every((path) => !path.includes("counties-summary")));
  assert.ok(requested.every((path) => !path.includes("wechat-food-summary")));
});

test("one exhausted boundary chunk is reported without blocking city startup", async () => {
  const loadJson = async (path) => {
    if (path.includes("china-cities")) return { cities: [{ id: "beijing", name: "北京" }] };
    if (path.includes("lite-4")) throw new TypeError("offline");
    return { type: "FeatureCollection", features: [{ properties: { id: path } }] };
  };
  const result = await loadCriticalMapData({ loadJson, boundaryChunkCount: 8 });
  assert.equal(result.cities.length, 1);
  assert.equal(result.mapData.features.length, 7);
  assert.deepEqual(result.failedBoundaryPaths, ["./data/china-prefectures-lite-4.json"]);
});

test("deferred county and food requests are memoized independently", async () => {
  const calls = [];
  const loaders = createDeferredDataLoaders({
    loadOptionalJson: async (path) => {
      calls.push(path);
      return { path };
    }
  });

  const [countyA, countyB, foodA, foodB] = await Promise.all([
    loaders.loadCountySummary(),
    loaders.loadCountySummary(),
    loaders.loadFoodSummary(),
    loaders.loadFoodSummary()
  ]);

  assert.equal(countyA, countyB);
  assert.equal(foodA, foodB);
  assert.equal(calls.filter((path) => path.includes("counties-summary")).length, 1);
  assert.equal(calls.filter((path) => path.includes("wechat-food-summary")).length, 1);
});
```

- [ ] **Step 2: Write the failing module-boundary test**

Create `tests/module-boundaries.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appUrl = new URL("../public/static-site/app.js", import.meta.url);

test("the app entry delegates noncritical features to modules", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /from ["']\.\/app-data\.js["']/);
  assert.match(app, /from ["']\.\/map-core\.js["']/);
  assert.match(app, /import\(["']\.\/city-detail\.js["']\)/);
  assert.match(app, /import\(["']\.\/food-content\.js["']\)/);
  assert.match(app, /import\(["']\.\/trip-controller\.js["']\)/);
  assert.doesNotMatch(app, /counties-summary\.json/);
  assert.doesNotMatch(app, /wechat-food-summary\.json/);
  assert.doesNotMatch(app, /geo\.datav\.aliyun\.com/);
  assert.doesNotMatch(app, /overpass-api\.de/);
  assert.doesNotMatch(app, /buildPrintableHtml/);
});
```

- [ ] **Step 3: Add the new suites to the default test command**

Change `package.json` so `test` includes the new suites before the existing suites:

```json
"test": "node --test tests/app-data.test.mjs tests/place-index.test.mjs tests/food-content.test.mjs tests/module-boundaries.test.mjs tests/trip-plan.test.mjs tests/trip-editor.test.mjs tests/guide-export.test.mjs tests/rendered-html.test.mjs tests/trip-archive.test.mjs"
```

Create temporary empty `tests/place-index.test.mjs` and `tests/food-content.test.mjs` containing only `import test from "node:test";` so the command can run while their tasks are pending.

- [ ] **Step 4: Run the tests and verify the expected RED state**

Run:

```powershell
node --test tests/app-data.test.mjs tests/module-boundaries.test.mjs
```

Expected: FAIL because `app-data.js` does not exist and `app.js` still owns the noncritical implementations.

- [ ] **Step 5: Commit the contract tests**

```powershell
git add package.json tests/app-data.test.mjs tests/place-index.test.mjs tests/food-content.test.mjs tests/module-boundaries.test.mjs
git commit -m "test: define progressive loading contracts"
```

### Task 2: Implement the data-loading module

**Files:**
- Create: `public/static-site/app-data.js`
- Test: `tests/app-data.test.mjs`

- [ ] **Step 1: Extend tests for cache policy, retry, optional failure, and idle fallback**

Replace the original import from `app-data.js` with this complete import, then add the tests:

```js
import {
  ASSET_VERSION,
  createDeferredDataLoaders,
  createJsonLoader,
  loadCriticalMapData,
  scheduleIdle
} from "../public/static-site/app-data.js";

test("versioned JSON uses browser caching and retries one failed boundary request", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) throw new TypeError("temporary network error");
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const { loadJson } = createJsonLoader({ fetchImpl, version: "test-release" });
  assert.deepEqual(await loadJson("./data/chunk.json", { retries: 1 }), { ok: true });
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /v=test-release/);
  assert.equal(requests[1].options.cache, "force-cache");
});

test("idle scheduling falls back to a zero-blocking timer", async () => {
  const calls = [];
  scheduleIdle(() => calls.push("ran"), {
    requestIdleCallbackImpl: null,
    setTimeoutImpl: (callback, delay) => {
      calls.push(delay);
      callback();
    }
  });
  assert.deepEqual(calls, [50, "ran"]);
});

assert.equal(typeof ASSET_VERSION, "string");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/app-data.test.mjs
```

Expected: FAIL because the exported API is absent.

- [ ] **Step 3: Create the complete data-loader API**

Create `public/static-site/app-data.js` with this public surface and behavior:

```js
export const ASSET_VERSION = "progressive-1";
export const PREFECTURE_CHUNK_COUNT = 8;

const withVersion = (path, version) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(version)}`;
};

export function createJsonLoader({ fetchImpl = fetch, version = ASSET_VERSION } = {}) {
  async function loadJson(path, options = {}) {
    const attempts = Number(options.retries || 0) + 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const timeoutSignal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : null;
        const signal = options.signal && timeoutSignal
          ? AbortSignal.any([options.signal, timeoutSignal])
          : options.signal || timeoutSignal || undefined;
        const response = await fetchImpl(withVersion(path, version), {
          cache: options.cache || "force-cache",
          signal
        });
        if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (options.signal?.aborted || attempt + 1 >= attempts) throw error;
      }
    }
    throw lastError;
  }

  async function loadOptionalJson(path, options = {}) {
    const controller = options.timeoutMs ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
    try {
      return await loadJson(path, {
        cache: options.cache,
        retries: options.retries,
        signal: controller?.signal
      });
    } catch (error) {
      if (!options.quiet) console.warn("optional data unavailable", path, error);
      return null;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  return { loadJson, loadOptionalJson };
}

export async function loadCriticalMapData({
  loadJson,
  boundaryChunkCount = PREFECTURE_CHUNK_COUNT
}) {
  const boundaryPaths = Array.from(
    { length: boundaryChunkCount },
    (_, index) => `./data/china-prefectures-lite-${index + 1}.json`
  );
  const [boundaryResults, cityData] = await Promise.all([
    Promise.allSettled(boundaryPaths.map((path) => loadJson(path, { retries: 1, timeoutMs: 20000 }))),
    loadJson("./data/china-cities.json", { retries: 1, timeoutMs: 20000 })
  ]);
  const cities = Array.isArray(cityData?.cities) ? cityData.cities : [];
  if (!cities.length) throw new Error("china-cities data is empty");
  const chunks = boundaryResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  return {
    cities,
    failedBoundaryPaths: boundaryPaths.filter((path, index) => boundaryResults[index].status === "rejected"),
    mapData: {
      type: "FeatureCollection",
      features: chunks.flatMap((chunk) => Array.isArray(chunk?.features) ? chunk.features : [])
    }
  };
}

export function createDeferredDataLoaders({ loadOptionalJson }) {
  let countySummaryPromise;
  let foodSummaryPromise;
  return {
    loadCountySummary() {
      countySummaryPromise ||= loadOptionalJson("./data/counties-summary.json", {
        timeoutMs: 30000,
        retries: 1
      });
      return countySummaryPromise;
    },
    loadFoodSummary() {
      foodSummaryPromise ||= loadOptionalJson("./data/wechat-food-summary.json", {
        timeoutMs: 30000,
        retries: 1
      });
      return foodSummaryPromise;
    }
  };
}

export function scheduleIdle(task, options = {}) {
  const requestIdle = options.requestIdleCallbackImpl ?? globalThis.requestIdleCallback;
  if (typeof requestIdle === "function") return requestIdle(task, { timeout: 1500 });
  const setTimer = options.setTimeoutImpl ?? globalThis.setTimeout;
  return setTimer(task, 50);
}
```

- [ ] **Step 4: Run focused and syntax tests**

Run:

```powershell
node --check public/static-site/app-data.js
node --test tests/app-data.test.mjs
```

Expected: both commands exit 0 and all `app-data` tests pass.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/app-data.js tests/app-data.test.mjs
git commit -m "feat: add progressive data loader"
```

### Task 3: Make county and food data non-blocking

**Files:**
- Modify: `public/static-site/app.js:580-713,4108-4130`
- Modify: `tests/rendered-html.test.mjs`
- Test: `tests/app-data.test.mjs`

- [ ] **Step 1: Write a failing source contract for startup order**

Replace the old `loadMapData` source assertions in `tests/rendered-html.test.mjs` with:

```js
test("startup renders the China map before deferred summaries hydrate", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /await\s+loadCriticalMapData\s*\(/);
  assert.match(app, /initMap\s*\(\s*\)[\s\S]*renderPanel\s*\(\s*\)[\s\S]*scheduleIdle/);
  assert.match(app, /loadCountySummary\s*\(\s*\)/);
  assert.match(app, /loadFoodSummary\s*\(\s*\)/);
  assert.doesNotMatch(app, /Promise\.all\s*\(\s*\[[\s\S]*counties-summary[\s\S]*wechat-food-summary/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test --test-name-pattern="startup renders" tests/rendered-html.test.mjs
```

Expected: FAIL because the current `loadMapData()` awaits both summaries.

- [ ] **Step 3: Replace startup loading with critical then deferred hydration**

At the top of `app.js`, import:

```js
import {
  createDeferredDataLoaders,
  createJsonLoader,
  loadCriticalMapData,
  scheduleIdle
} from "./app-data.js";
```

Replace the local `loadJson`, `loadOptionalJson`, and `loadMapData` functions with:

```js
const { loadJson, loadOptionalJson } = createJsonLoader();
const deferredData = createDeferredDataLoaders({ loadOptionalJson });

async function loadMapData() {
  const { mapData, cities, failedBoundaryPaths } = await loadCriticalMapData({ loadJson });
  initializeCorePlaces(cities, mapData);
  state.failedBoundaryPaths = failedBoundaryPaths;
}

function initializeCorePlaces(cities, mapData) {
  const displayCities = cities
    .filter((city) => !municipalityNames.has(city.province) || city.name === city.province)
    .map((city) => ({ ...city, ...(municipalityCoordinates[city.name] || {}) }));
  displayCities.push({ ...taiwanRegion });
  state.hiddenMunicipalityChildren = cities.filter(
    (city) => municipalityNames.has(city.province) && city.name !== city.province
  );
  state.mapData = mapData;
  state.cities = displayCities.map((city) => ({
    ...city,
    searchText: normalizeSearchText(`${city.name} ${city.province} ${city.pinyin}`)
  }));
  state.counties = buildMunicipalityCountyEntries(state.hiddenMunicipalityChildren, state.cities)
    .map(normalizeCountyRecord);
  rebuildPlaceIndexes();
  hydrateFoodArticles(null);
}

function rebuildPlaceIndexes() {
  state.cityById = new Map(state.cities.map((city) => [city.id, city]));
  state.placeById = buildPlaceMap(state.cities, state.counties);
  state.cityByKey = buildCityKeyMap(state.cities, state.hiddenMunicipalityChildren);
  state.cityByProvinceKey = buildCityProvinceKeyMap(state.cities, state.hiddenMunicipalityChildren);
  state.cityKeyEntries = Array.from(state.cityByKey.entries()).sort((a, b) => b[0].length - a[0].length);
}

async function hydrateDeferredSummaries() {
  const [countyData, foodData] = await Promise.all([
    deferredData.loadCountySummary(),
    deferredData.loadFoodSummary()
  ]);
  if (Array.isArray(countyData?.counties)) {
    mergeCountyRecords(countyData.counties);
    rebuildPlaceIndexes();
  }
  hydrateFoodArticles(foodData);
  updateSearchResults();
  renderFoodPanel();
  if (!state.tripPlan) restoreTripState();
  renderPanel();
}
```

Add `failedBoundaryPaths: []` to the shared application state before using these functions.

Change `initApp()` so the first render precedes scheduling:

```js
await loadMapData();
initMap();
restoreTripState();
setMobileView("plan");
renderRoutes();
renderPanel();
document.documentElement.dataset.appReady = "map";
if (state.failedBoundaryPaths.length) {
  selectionHint.textContent = `已有 ${state.failedBoundaryPaths.length} 个边界分片加载失败，正在后台保留城市规划功能。`;
}
scheduleIdle(() => {
  hydrateDeferredSummaries()
    .then(() => { document.documentElement.dataset.appReady = "complete"; })
    .catch((error) => console.warn("deferred summaries unavailable", error));
});
```

Keep the existing per-city county/food chunk loaders unchanged; they remain the interaction fallback.

- [ ] **Step 4: Run focused tests, syntax, and the full suite**

Run:

```powershell
node --check public/static-site/app.js
node --test tests/app-data.test.mjs tests/rendered-html.test.mjs
npm test
```

Expected: all commands exit 0; the full suite has zero failures.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/app.js tests/rendered-html.test.mjs
git commit -m "perf: unblock map startup from optional summaries"
```

### Task 4: Extract and test incremental place indexing

**Files:**
- Create: `public/static-site/place-index.js`
- Replace: `tests/place-index.test.mjs`
- Modify: `public/static-site/app.js:714-762,827-928`

- [ ] **Step 1: Write failing pure place-index tests**

Replace `tests/place-index.test.mjs` with tests importing:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlaceIndex,
  hydrateCountySummary,
  normalizeSearchText
} from "../public/static-site/place-index.js";

test("county hydration is idempotent and preserves cities", () => {
  const city = { id: "hangzhou", name: "杭州", province: "浙江", pinyin: "hangzhou", lon: 120, lat: 30 };
  const county = { id: "xihu", name: "西湖区", parentCityId: "hangzhou", parentCityName: "杭州" };
  const index = createPlaceIndex({ cities: [city], counties: [] });
  hydrateCountySummary(index, [county, county]);
  hydrateCountySummary(index, [county]);
  assert.equal(index.counties.length, 1);
  assert.equal(index.placeById.get("hangzhou").name, "杭州");
  assert.equal(index.placeById.get("xihu").name, "西湖区");
});

test("normalized search supports Chinese and pinyin without losing existing text", () => {
  assert.equal(normalizeSearchText(" 杭州 HángZhōu "), "杭州 hangzhou");
});
```

- [ ] **Step 2: Run and verify RED**

Run `node --test tests/place-index.test.mjs`.

Expected: FAIL because `place-index.js` does not exist.

- [ ] **Step 3: Extract the existing normalization and indexing functions**

Move these functions from `app.js` into `place-index.js`, preserving their current bodies: `normalizeKey`, `normalizeSearchText`, `buildCityKeyMap`, `buildCityProvinceKeyMap`, `buildMunicipalityCountyEntries`, `buildPlaceMap`, `normalizeCountyRecord`, and the deduplication logic from `mergeCountyRecords`.

Export this stable API:

```js
export function createPlaceIndex({ cities, counties, municipalityChildren = [] }) {
  const index = {
    cities: [...cities],
    counties: [],
    municipalityChildren: [...municipalityChildren],
    cityById: new Map(),
    placeById: new Map(),
    cityByKey: new Map(),
    cityByProvinceKey: new Map(),
    cityKeyEntries: []
  };
  hydrateCountySummary(index, counties);
  rebuildPlaceIndex(index);
  return index;
}

export function hydrateCountySummary(index, records) {
  const byId = new Map(index.counties.map((county) => [county.id, county]));
  for (const record of Array.isArray(records) ? records : []) {
    const county = normalizeCountyRecord(record);
    if (county.id) byId.set(county.id, county);
  }
  index.counties = Array.from(byId.values());
  rebuildPlaceIndex(index);
  return index;
}
```

`rebuildPlaceIndex` must recreate all maps from the current arrays, and `app.js` must assign the resulting maps back to its shared context. No DOM access belongs in this module.

- [ ] **Step 4: Verify focused and full tests**

Run:

```powershell
node --check public/static-site/place-index.js
node --test tests/place-index.test.mjs tests/rendered-html.test.mjs
npm test
```

Expected: zero failures.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/place-index.js public/static-site/app.js tests/place-index.test.mjs
git commit -m "refactor: isolate incremental place indexing"
```

### Task 5: Extract the Leaflet China-map core

**Files:**
- Create: `public/static-site/map-core.js`
- Modify: `public/static-site/app.js:763-1291,2624-2704,3762-3947`
- Modify: `tests/module-boundaries.test.mjs`

- [ ] **Step 1: Add a failing ownership contract**

Extend `tests/module-boundaries.test.mjs`:

```js
test("map-core owns Leaflet setup and app owns no direct map constructor", async () => {
  const [app, mapCore] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(new URL("../public/static-site/map-core.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(app, /L\.map\s*\(/);
  assert.doesNotMatch(app, /L\.geoJSON\s*\(/);
  assert.match(mapCore, /export function createMapController/);
  assert.match(mapCore, /L\.map\s*\(/);
  assert.match(mapCore, /L\.geoJSON\s*\(/);
});
```

Run `node --test --test-name-pattern="map-core owns" tests/module-boundaries.test.mjs` and expect FAIL.

- [ ] **Step 2: Define the map-controller boundary**

Create `map-core.js` with the controller contract:

```js
export function createMapController({
  L,
  state,
  elements,
  callbacks,
  helpers
}) {
  const context = { L, state, elements, callbacks, helpers };
  return {
    init: () => initMap(context),
    fitChina: () => fitChina(context),
    renderRoutes: () => renderRoutes(context),
    updateCityStyles: () => updateCityStyles(context),
    enterChinaView: () => enterChinaView(context),
    setMobileView: (view) => setMobileView(context, view),
    destroy() {
      if (state.map) state.map.remove();
      state.map = null;
    }
  };
}
```

For this mechanical extraction, move the complete existing bodies of `initMap`, `renderChinaLayer`, `matchFeatureToCity`, `provinceNameFromFeature`, `featureStyle`, `renderCities`, `cityStyle`, `updateCityStyles`, `updateVisibleLabels`, `fitChina`, `renderRoutes`, `curvedRoutePoints`, `setMobileView`, route metric display helpers, and haversine fallback helpers into the closure. Replace cross-feature calls with explicit callbacks:

```js
callbacks.onCityClick(cityId);
callbacks.onPlaceClick(placeId);
callbacks.onViewportChanged?.();
callbacks.onRouteMetricsChanged?.(route);
```

Pass string formatting, place lookup, transport profile, and feature lookup through `helpers`; do not import `app.js` from `map-core.js`.

- [ ] **Step 3: Wire `app.js` to the controller**

Import `createMapController`, instantiate it after critical data is initialized, and replace direct function calls with `mapController.init()`, `mapController.fitChina()`, `mapController.renderRoutes()`, and `mapController.updateCityStyles()`.

- [ ] **Step 4: Run syntax, ownership, and full regression tests**

Run:

```powershell
node --check public/static-site/map-core.js
node --check public/static-site/app.js
node --test tests/module-boundaries.test.mjs tests/rendered-html.test.mjs
npm test
```

Expected: zero failures and no `L.map`/`L.geoJSON` ownership in `app.js`.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/map-core.js public/static-site/app.js tests/module-boundaries.test.mjs
git commit -m "refactor: extract Leaflet map core"
```

### Task 6: Extract food content behind one deferred module promise

**Files:**
- Create: `public/static-site/food-content.js`
- Replace: `tests/food-content.test.mjs`
- Modify: `public/static-site/app.js:653-713,2043-2077,3583-3757`
- Modify: `tests/module-boundaries.test.mjs`

- [ ] **Step 1: Write failing idempotent food tests**

Replace `tests/food-content.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createFoodStore } from "../public/static-site/food-content.js";

test("summary and city chunk hydration are idempotent", () => {
  const knownPlaces = new Map([["hangzhou", { id: "hangzhou" }]]);
  const store = createFoodStore({ knownPlaces, normalizeSearchText: (value) => value.toLowerCase() });
  const article = { id: "a1", cityId: "hangzhou", placeId: "hangzhou", title: "West Lake Food" };
  store.hydrate([article, article]);
  store.hydrate([{ ...article, description: "updated" }]);
  assert.equal(store.articles.length, 1);
  assert.equal(store.byCity.get("hangzhou").length, 1);
  assert.equal(store.byId.get("a1").description, "updated");
});
```

Run `node --test tests/food-content.test.mjs` and expect FAIL.

- [ ] **Step 2: Move food ownership into `food-content.js`**

Move the complete current bodies for article normalization/merge/grouping, food suggestions, panel rendering, article markers/popups, article reader paths, local cover handling, and per-city food chunk loading. Export:

```js
export function createFoodStore({ knownPlaces, normalizeSearchText }) {
  const store = {
    articles: [],
    byId: new Map(),
    byCity: new Map(),
    byPlace: new Map(),
    hydrate(records) {
      // Use the existing merge-by-id behavior, filter against knownPlaces,
      // rebuild all three indexes, and return store.
    }
  };
  return store;
}

export function createFoodController({ state, elements, data, helpers }) {
  const store = createFoodStore({
    knownPlaces: state.placeById,
    normalizeSearchText: helpers.normalizeSearchText
  });
  const context = { state, elements, data, helpers, store };
  return {
    hydrateSummary(summary) {
      store.hydrate(summary?.articles);
      helpers.enrichPlaceSearchTextWithArticles(store);
      renderFoodPanel(context);
    },
    ensureCity: (cityId) => ensureCityFoodArticles(context, cityId),
    renderPanel: () => renderFoodPanel(context),
    renderMarkers: (city, bounds) => renderFoodArticleMarkers(context, city, bounds),
    articlesForCity: (cityId) => store.byCity.get(cityId) || [],
    articlesForPlace: (placeId) => store.byPlace.get(placeId) || []
  };
}
```

The comments above identify exact existing bodies to move; do not replace them with new behavior. `knownPlaces` must be refreshable after county hydration so county articles remain discoverable.

- [ ] **Step 3: Add a shared dynamic import in `app.js`**

Use exactly one promise:

```js
let foodModulePromise;
function loadFoodModule() {
  foodModulePromise ||= import("./food-content.js");
  return foodModulePromise;
}
```

Background hydration calls `loadFoodModule()` after map readiness. City-detail and trip recommendation consumers await the same promise; no click is discarded while loading.

- [ ] **Step 4: Verify ownership and regression**

Extend `module-boundaries.test.mjs` to assert `app.js` contains the dynamic import but no `function renderFoodPanel`, `foodArticlePopupHtml`, or `wechat-food-summary.json`. Run syntax checks, focused tests, then `npm test`; expect zero failures.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/food-content.js public/static-site/app.js tests/food-content.test.mjs tests/module-boundaries.test.mjs
git commit -m "refactor: lazy load food content module"
```

### Task 7: Extract city detail and preserve all live/local fallbacks

**Files:**
- Create: `public/static-site/city-detail.js`
- Modify: `public/static-site/app.js:124-469,2706-3582`
- Modify: `tests/module-boundaries.test.mjs`

- [ ] **Step 1: Write a failing ownership and fallback contract**

Add:

```js
test("city detail owns districts landmarks metro and stations", async () => {
  const [app, detail] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(new URL("../public/static-site/city-detail.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(app, /geo\.datav\.aliyun\.com|overpass-api\.de|metro-networks\.json|railway-stations-12306\.json/);
  assert.match(detail, /geo\.datav\.aliyun\.com/);
  assert.match(detail, /overpass-api\.de/);
  assert.match(detail, /metro-networks\.json/);
  assert.match(detail, /railway-stations-12306\.json/);
  assert.match(detail, /export function createCityDetailController/);
});
```

Run the named test and expect FAIL.

- [ ] **Step 2: Move the complete city-detail subsystem**

Move the curated landmark/station/subway catalogs and all functions from `enterCityView` through `landmarkSymbol` into `city-detail.js`. Preserve their existing bodies and timeout values. Expose only:

```js
export function createCityDetailController({ L, state, elements, callbacks, helpers }) {
  const context = { L, state, elements, callbacks, helpers };
  return {
    enter: (cityId) => enterCityView(context, cityId),
    exit: (options = {}) => exitCityView(context, options),
    async prefetch() {
      await Promise.all([
        helpers.loadMetroNetworkData(),
        helpers.loadPassengerStationNames()
      ]);
    },
    counts: (city) => cityDetailCounts(context, city)
  };
}
```

Inject `ensureCityCounties`, food `ensureCity/renderMarkers`, place-index hydration, map-controller layer restoration, status rendering, and safe HTML/URL helpers through callbacks/helpers. Keep local catalogs as the first fallback and OSM/DataV as optional enhancement.

- [ ] **Step 3: Use one dynamic import and idle prefetch**

In `app.js`:

```js
let cityDetailModulePromise;
function loadCityDetailModule() {
  cityDetailModulePromise ||= import("./city-detail.js");
  return cityDetailModulePromise;
}

async function enterCityView(cityId) {
  const module = await loadCityDetailModule();
  const controller = getOrCreateCityDetailController(module);
  return controller.enter(cityId);
}
```

After map readiness, idle-schedule `loadCityDetailModule()` but do not fetch metro/station datasets until the browser is idle or a city is entered.

- [ ] **Step 4: Verify all fallback strings and full tests**

Run syntax checks for both modules, the ownership test, `npm test`, and a source search confirming all four URLs occur only in `city-detail.js`. Expected: zero failures and one owner for each external/local detail source.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/city-detail.js public/static-site/app.js tests/module-boundaries.test.mjs
git commit -m "refactor: lazy load complete city detail"
```

### Task 8: Extract trip DOM coordination and lazy-load guide export

**Files:**
- Create: `public/static-site/trip-controller.js`
- Modify: `public/static-site/app.js:1-46,1292-2623,3762-4107`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/module-boundaries.test.mjs`

- [ ] **Step 1: Write failing module ownership tests**

Add assertions that `app.js` no longer statically imports `trip-plan.js`, `trip-editor.js`, `trip-archive.js`, or `guide-export.js`; dynamically imports `trip-controller.js`; and that `trip-controller.js` dynamically imports `guide-export.js` while statically importing the first three domain modules.

```js
assert.match(app, /import\(["']\.\/trip-controller\.js["']\)/);
assert.doesNotMatch(app, /^import[\s\S]*from ["']\.\/guide-export\.js["']/m);
assert.match(tripController, /from ["']\.\/trip-plan\.js["']/);
assert.match(tripController, /from ["']\.\/trip-editor\.js["']/);
assert.match(tripController, /from ["']\.\/trip-archive\.js["']/);
assert.match(tripController, /import\(["']\.\/guide-export\.js["']\)/);
```

Run the named tests and expect FAIL.

- [ ] **Step 2: Move trip coordination without changing domain behavior**

Move the current trip-plan synchronization, form/dialog handling, panel/calendar rendering, archive recovery/persistence/share/import/export, route edits, transport/pace controls, and guide model construction into `trip-controller.js`. Export:

```js
export function createTripController({ state, elements, callbacks, helpers }) {
  let guideModulePromise;
  const loadGuideModule = () => (guideModulePromise ||= import("./guide-export.js"));
  const context = { state, elements, callbacks, helpers, loadGuideModule };

  return {
    init: () => initializeTripController(context),
    render: () => renderPanel(context),
    handlePlaceClick: (placeId) => handlePlaceClick(context, placeId),
    undoRoute: () => undoRoute(context),
    clearRoutes: () => clearRoutes(context),
    setTransportMode: (mode) => setTransportMode(context, mode),
    setTripPace: (pace) => setTripPace(context, pace),
    exportMarkdown: () => exportMarkdownGuide(context),
    exportHtml: () => exportPrintableHtmlGuide(context),
    prefetchExports() { return loadGuideModule(); },
    destroy: () => destroyTripController(context)
  };
}
```

The existing TripPlan v2 domain modules remain byte-for-byte behavior compatible. Bind each control once inside the controller and remove its old listener from `app.js`.

- [ ] **Step 3: Queue early trip commands on one module promise**

In `app.js`:

```js
let tripControllerPromise;
function loadTripController() {
  tripControllerPromise ||= import("./trip-controller.js")
    .then((module) => module.createTripController(createTripContext()))
    .then(async (controller) => {
      await controller.init();
      return controller;
    });
  return tripControllerPromise;
}
```

Start this promise in parallel with critical map data. Any map city selection calls `loadTripController().then((controller) => controller.handlePlaceClick(placeId))`, preserving clicks during module loading. Idle-prefetch only the guide module after the controller is ready.

- [ ] **Step 4: Verify domain, archive, editor, guide, and ownership suites**

Run:

```powershell
node --check public/static-site/trip-controller.js
node --check public/static-site/app.js
node --test tests/trip-plan.test.mjs tests/trip-editor.test.mjs tests/trip-archive.test.mjs tests/guide-export.test.mjs tests/rendered-html.test.mjs tests/module-boundaries.test.mjs
npm test
```

Expected: all existing behavior suites and the full test command pass with zero failures.

- [ ] **Step 5: Commit**

```powershell
git add public/static-site/trip-controller.js public/static-site/app.js tests/rendered-html.test.mjs tests/module-boundaries.test.mjs
git commit -m "refactor: lazy load trip UI and guide export"
```

### Task 9: Add browser performance and full-function smoke coverage

**Files:**
- Create: `tests/browser-performance.test.mjs`
- Create: `playwright.config.mjs`
- Modify: `package.json`
- Modify: lockfile
- Modify: `public/static-site/index.html`

- [ ] **Step 1: Install Playwright test tooling without runtime deployment dependencies**

Run:

```powershell
npm install --save-dev @playwright/test
npx playwright install chromium
```

Expected: package and lockfile update; Chromium installation exits 0.

Create `playwright.config.mjs` so the suite owns its local server lifecycle:

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser-performance.test.mjs",
  use: { baseURL: process.env.STATIC_SITE_URL || "http://127.0.0.1:4173" },
  webServer: process.env.STATIC_SITE_URL ? undefined : {
    command: "python -m http.server 4173 --directory public/static-site",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: true
  }
});
```

- [ ] **Step 2: Add a failing readiness-order browser test**

Create `tests/browser-performance.test.mjs` that starts a local static server in test setup, intercepts `counties-summary.json` and `wechat-food-summary.json` until released, and proves `data-app-ready="map"` appears first:

```js
import { test, expect } from "@playwright/test";

test("map is usable while county and food summaries are still pending", async ({ page }) => {
  let releaseDeferred;
  const gate = new Promise((resolve) => { releaseDeferred = resolve; });
  await page.route(/(counties-summary|wechat-food-summary)\.json/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "map");
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(372);
  await expect(page.locator("#citySearch")).toBeEnabled();
  releaseDeferred();
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "complete");
});

test("route editing and every file import/export path remain available", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", /map|complete/);

  await page.locator("#citySearch").fill("北京");
  await page.locator(".search-result.city").first().click();
  await page.locator("#citySearch").fill("上海");
  await page.locator(".search-result.city").first().click();
  await expect(page.locator("#routeCount")).toHaveText("1");

  await page.locator("#tripNameInput").fill("性能回归行程");
  await page.locator("#tripNameInput").dispatchEvent("change");

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportTripFileBtn").click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  await page.locator("#tripImportInput").setInputFiles(jsonPath);
  await expect(page.locator("#routeCount")).toHaveText("1");

  for (const selector of ["#exportMarkdownBtn", "#exportHtmlBtn"]) {
    const downloadPromise = page.waitForEvent("download");
    await page.locator(selector).click();
    const download = await downloadPromise;
    expect((await download.createReadStream())).toBeTruthy();
  }
});

test("deferred county food and city detail features hydrate completely", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "complete");
  await page.locator("#citySearch").fill("福清");
  await page.locator(".search-result.county").first().click();
  await expect(page.locator("#exitCityViewBtn")).toBeVisible();
  await expect(page.locator("#foodArticleList .food-card").first()).toBeVisible();
  await expect(page.locator(".leaflet-overlay-pane")).toBeVisible();
  await page.locator("#exitCityViewBtn").click();
  await expect(page.locator("#exitCityViewBtn")).toBeHidden();
});
```

The second test covers route creation, trip editing, JSON export/import, and both guide downloads. The third test uses a known food-backed county and proves deferred county, food, and city-detail behavior reaches the UI.

- [ ] **Step 3: Run and verify RED before readiness hooks are finalized**

Run the local static server and browser suite. Expected: readiness/order assertion fails until the final integration exposes the exact state transitions and preserves all 372 path elements.

- [ ] **Step 4: Finalize accessible readiness states**

Keep `document.documentElement.dataset.appReady` as an automation/diagnostic signal and update the visible status card during deferred failure without removing map interaction. Do not hide or disable any permanent control.

- [ ] **Step 5: Run the full browser and unit suites**

Run:

```powershell
npm test
npx playwright test tests/browser-performance.test.mjs --reporter=line
```

Expected: unit suites and all three browser smoke tests pass.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json playwright.config.mjs public/static-site/index.html tests/browser-performance.test.mjs
git commit -m "test: cover progressive loading in browser"
```

### Task 10: Enable immutable caching and reproducible precompression

**Files:**
- Create: `scripts/precompress_static_assets.py`
- Modify: `deploy/nginx.conf`
- Modify: `public/static-site/index.html`
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Write failing cache/config assertions**

Add a test that reads `deploy/nginx.conf` and asserts:

```js
assert.match(nginx, /location = \/index\.html[\s\S]*Cache-Control["']?\s+no-cache/);
assert.match(nginx, /location ~\* [\s\S]*max-age=31536000[\s\S]*immutable/);
assert.match(nginx, /gzip_static on/);
```

Run the named test and expect FAIL.

- [ ] **Step 2: Configure HTML revalidation and asset caching**

Use this location ordering in `deploy/nginx.conf`:

```nginx
location = /index.html {
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
}

location = / {
    add_header Cache-Control "no-cache" always;
    try_files /index.html =404;
}

location ~* \.(?:js|css|json|svg|woff2)$ {
    set $asset_cache "no-cache";
    if ($arg_v != "") {
        set $asset_cache "public, max-age=31536000, immutable";
    }
    add_header Cache-Control $asset_cache always;
    try_files $uri =404;
}

location / {
    try_files $uri $uri/ =404;
}
```

Keep the existing gzip settings.

- [ ] **Step 3: Add deterministic precompression**

Create `scripts/precompress_static_assets.py`:

```python
from pathlib import Path
import gzip

ROOT = Path(__file__).resolve().parents[1] / "public" / "static-site"
SUFFIXES = {".html", ".js", ".css", ".json", ".svg"}

for source in sorted(path for path in ROOT.rglob("*") if path.suffix in SUFFIXES):
    target = source.with_name(source.name + ".gz")
    with source.open("rb") as source_file, gzip.GzipFile(
        filename="", mode="wb", fileobj=target.open("wb"), compresslevel=9, mtime=0
    ) as output:
        output.write(source_file.read())
```

Run it and confirm every deployed application module plus all eight boundary chunks has a `.gz` sibling. Do not commit generated `.gz` files unless the repository already tracks that artifact class; deployment may generate them on the server from the uploaded source.

- [ ] **Step 4: Bump the single release version**

Change `ASSET_VERSION` and `index.html` app query to `progressive-1`. Append `?v=progressive-1` to every static and dynamic local module import specifier, including imports between extracted modules, so all application requests receive immutable caching. Add a source test that extracts every relative `.js` import specifier and asserts it ends in `?v=progressive-1`. Remove old `landmark-poi-*` and `calendar-planner-*` cache keys. A release bump is one repository-wide replacement of this token, guarded by the source test.

- [ ] **Step 5: Validate Nginx and all local tests**

Run:

```powershell
python scripts/precompress_static_assets.py
docker run --rm -v "${PWD}/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:stable-alpine nginx -t
npm test
npx playwright test tests/browser-performance.test.mjs --reporter=line
```

Expected: Nginx syntax successful and all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add deploy/nginx.conf scripts/precompress_static_assets.py public/static-site/index.html public/static-site/app-data.js tests/rendered-html.test.mjs
git commit -m "perf: cache and precompress versioned assets"
```

### Task 11: Measure budgets, deploy safely, and run the completion audit

**Files:**
- Modify only if a measured budget fails: the responsible module from Tasks 2-8
- No generated server backup files are committed

- [ ] **Step 1: Measure local gzip budgets**

Run the precompression script, then list raw/gzip sizes for every startup-critical JS file and boundary chunk. Expected:

- every boundary `.json.gz` is below 10 KB;
- every startup-critical application `.js.gz` is below 20 KB;
- no county or food summary is referenced by the critical loader;
- `app.js` is a composition entry, not the largest implementation file.

If a budget fails, return to the owning extraction task, add a failing size/ownership assertion, split that responsibility once, and rerun the full suite.

- [ ] **Step 2: Create a remote rollback copy and upload exact static assets**

Use timestamped copy-on-server deployment:

```powershell
ssh ykk@47.99.144.228 "set -e; stamp=$(date +%Y%m%d-%H%M%S); cp -a /home/ykk/travel-map/site /home/ykk/travel-map/site-backup-$stamp"
scp -r public/static-site/* ykk@47.99.144.228:/home/ykk/travel-map/site/
scp deploy/nginx.conf ykk@47.99.144.228:/home/ykk/travel-map/nginx.conf
```

Do not delete the rollback copy until public verification passes.

- [ ] **Step 3: Precompress and reload Nginx on the server**

Upload/run the precompression script or run equivalent `gzip -kf9` over changed text assets, then:

```powershell
ssh ykk@47.99.144.228 "set -e; docker exec travel-map-web nginx -t; docker exec travel-map-web nginx -s reload"
```

Expected: configuration syntax successful and reload notice.

- [ ] **Step 4: Verify public status, compression, and cache headers**

For `/`, `app.js`, every module, cities JSON, and all eight boundary chunks, use `curl.exe` with `Accept-Encoding: gzip`. Expected:

- HTTP 200;
- `Content-Encoding: gzip` for compressible assets;
- `Cache-Control: no-cache` for `/` and `/index.html`;
- one-year immutable caching for versioned JS/CSS/JSON;
- no response timeout within the configured 45-second diagnostic window.

- [ ] **Step 5: Run browser smoke tests against public deployment**

```powershell
$env:STATIC_SITE_URL = "http://47.99.144.228/"
npx playwright test tests/browser-performance.test.mjs --reporter=line
```

Expected: map-before-summary, full route/trip/import/export, and county/food/city-detail tests all pass against the public server.

- [ ] **Step 6: Run the final functional and source audit**

Run fresh:

```powershell
npm test
node --check public/static-site/app.js
node --check public/static-site/app-data.js
node --check public/static-site/place-index.js
node --check public/static-site/map-core.js
node --check public/static-site/food-content.js
node --check public/static-site/city-detail.js
node --check public/static-site/trip-controller.js
```

Then verify each invariant from the design against test output and deployed browser behavior: 372 boundaries, city/county search, routes, all trip edits, persistence/share/import/JSON export, Markdown/HTML export, districts, landmarks, metro, railway/subway stations, food panel/markers, and desktop/mobile controls. Completion is not established by unit tests alone.

- [ ] **Step 7: Commit any measurement-driven correction, then report evidence**

If no correction was required, do not create an empty commit. Report before/after critical requests, gzip bytes, cache headers, browser smoke results, and full test totals. Only then mark the active goal complete.

---

## Plan Self-Review

- Spec coverage: Tasks 2-3 cover critical/deferred loading; Tasks 4-8 cover all prescribed module boundaries; Task 9 covers browser-visible function preservation; Task 10 covers caching and compression; Task 11 covers deployment, rollback, public measurements, and every functional invariant.
- Scope: all tasks contribute to one frontend delivery path and share one application context; no independent product feature is introduced.
- Consistency: `createJsonLoader`, `loadCriticalMapData`, `createDeferredDataLoaders`, `createPlaceIndex`, `createMapController`, `createFoodController`, `createCityDetailController`, and `createTripController` retain the same names and ownership throughout the plan.
- Placeholder scan: implementation comments that reference existing bodies are mechanical move instructions tied to exact named functions and line ranges; no behavior is deferred or left unspecified.
