import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSET_VERSION,
  PREFECTURE_CHUNK_COUNT,
  createDeferredDataLoaders,
  createJsonLoader,
  loadCriticalMapData,
  scheduleIdle
} from "../public/static-site/app-data.js";

test("exports the progressive asset and boundary chunk versions", () => {
  assert.equal(ASSET_VERSION, "progressive-1");
  assert.equal(PREFECTURE_CHUNK_COUNT, 8);
});

test("critical map data requests only cities and all eight boundary chunks", async () => {
  const requested = [];
  const loadJson = async (path, options) => {
    requested.push({ path, options });
    if (path === "./data/china-cities.json") {
      return { cities: [{ id: "beijing", name: "Beijing" }] };
    }
    return { type: "FeatureCollection", features: [{ properties: { id: path } }] };
  };

  const result = await loadCriticalMapData({ loadJson });

  assert.equal(result.cities.length, 1);
  assert.equal(result.mapData.type, "FeatureCollection");
  assert.equal(result.mapData.features.length, 8);
  assert.deepEqual(result.failedBoundaryPaths, []);
  assert.equal(requested.length, 9);
  assert.ok(requested.every(({ path }) => !path.includes("counties-summary")));
  assert.ok(requested.every(({ path }) => !path.includes("wechat-food-summary")));
  assert.ok(requested.every(({ options }) => options.retries === 1 && options.timeoutMs === 20_000));
});

test("one exhausted boundary chunk returns seven features and its exact path", async () => {
  const loadJson = async (path) => {
    if (path === "./data/china-cities.json") return { cities: [{ id: "beijing" }] };
    if (path === "./data/china-prefectures-lite-4.json") throw new TypeError("offline");
    return { type: "FeatureCollection", features: [{ properties: { id: path } }] };
  };

  const result = await loadCriticalMapData({ loadJson, boundaryChunkCount: 8 });

  assert.equal(result.cities.length, 1);
  assert.equal(result.mapData.features.length, 7);
  assert.deepEqual(result.failedBoundaryPaths, ["./data/china-prefectures-lite-4.json"]);
});

test("city data remains mandatory when boundaries settle successfully", async () => {
  const loadJson = async (path) => path.includes("china-cities")
    ? { cities: [] }
    : { features: [] };

  await assert.rejects(
    loadCriticalMapData({ loadJson, boundaryChunkCount: 1 }),
    /china-cities data is empty/
  );
});

test("deferred county and food requests are independently memoized", async () => {
  const calls = [];
  const loadOptionalJson = async (path, options) => {
    calls.push({ path, options });
    await Promise.resolve();
    return { path };
  };
  const loaders = createDeferredDataLoaders({ loadOptionalJson });

  const [countyA, countyB, foodA, foodB] = await Promise.all([
    loaders.loadCountySummary(),
    loaders.loadCountySummary(),
    loaders.loadFoodSummary(),
    loaders.loadFoodSummary()
  ]);

  assert.strictEqual(countyA, countyB);
  assert.strictEqual(foodA, foodB);
  assert.equal(calls.filter(({ path }) => path.includes("counties-summary")).length, 1);
  assert.equal(calls.filter(({ path }) => path.includes("wechat-food-summary")).length, 1);
  assert.ok(calls.every(({ options }) => options.timeoutMs === 30_000 && options.retries === 1));
});

test("versioned JSON uses force-cache, combines signals, and retries once", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) throw new TypeError("temporary network error");
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const externalController = new AbortController();
  const { loadJson } = createJsonLoader({ fetchImpl, version: "test release" });

  const result = await loadJson("./data/chunk.json?part=1", {
    retries: 1,
    timeoutMs: 1_000,
    signal: externalController.signal
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, "./data/chunk.json?part=1&v=test%20release");
  assert.equal(requests[1].options.cache, "force-cache");
  assert.ok(requests[1].options.signal instanceof AbortSignal);
  assert.notStrictEqual(requests[1].options.signal, externalController.signal);
});

test("non-ok JSON responses reject with path and status", async () => {
  const { loadJson } = createJsonLoader({
    fetchImpl: async () => ({ ok: false, status: 503 }),
    version: "test"
  });

  await assert.rejects(loadJson("./data/down.json"), /\.\/data\/down\.json HTTP 503/);
});

test("optional JSON retries, returns null, and warns on failure without memoizing", async () => {
  let attempts = 0;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const { loadOptionalJson } = createJsonLoader({
      fetchImpl: async (_url, options) => {
        attempts += 1;
        assert.ok(options.signal instanceof AbortSignal);
        throw new TypeError("offline");
      }
    });

    assert.equal(await loadOptionalJson("./data/optional.json", { retries: 1, timeoutMs: 1_000 }), null);
    assert.equal(await loadOptionalJson("./data/optional.json", { quiet: true, timeoutMs: 1_000 }), null);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(attempts, 3);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "optional data unavailable");
  assert.equal(warnings[0][1], "./data/optional.json");
});

test("idle scheduling passes a 1500ms deadline to requestIdleCallback", () => {
  const task = () => {};
  let received;
  const handle = scheduleIdle(task, {
    requestIdleCallbackImpl: (callback, options) => {
      received = { callback, options };
      return 42;
    }
  });

  assert.equal(handle, 42);
  assert.strictEqual(received.callback, task);
  assert.deepEqual(received.options, { timeout: 1_500 });
});

test("idle scheduling falls back to a 50ms timer", () => {
  const calls = [];
  const handle = scheduleIdle(() => calls.push("ran"), {
    requestIdleCallbackImpl: null,
    setTimeoutImpl: (callback, delay) => {
      calls.push(delay);
      callback();
      return 7;
    }
  });

  assert.equal(handle, 7);
  assert.deepEqual(calls, [50, "ran"]);
});
