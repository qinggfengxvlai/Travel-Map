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
  assert.deepEqual(requested.map(({ path }) => path), [
    "./data/china-prefectures-lite-1.json",
    "./data/china-prefectures-lite-2.json",
    "./data/china-prefectures-lite-3.json",
    "./data/china-prefectures-lite-4.json",
    "./data/china-prefectures-lite-5.json",
    "./data/china-prefectures-lite-6.json",
    "./data/china-prefectures-lite-7.json",
    "./data/china-prefectures-lite-8.json",
    "./data/china-cities.json"
  ]);
  assert.ok(requested.every(({ options }) => options.retries === 1 && options.timeoutMs === 20_000));
});

test("critical map data has no public boundary chunk count override", async () => {
  const accessed = [];
  const options = new Proxy({
    loadJson: async (path) => path.includes("china-cities")
      ? { cities: [{ id: "beijing" }] }
      : { features: [] }
  }, {
    get(target, property, receiver) {
      accessed.push(property);
      return Reflect.get(target, property, receiver);
    }
  });

  await loadCriticalMapData(options);

  assert.deepEqual(accessed, ["loadJson"]);
});

test("one exhausted boundary chunk retries once and returns the other seven features", async () => {
  const attempts = new Map();
  const fetchImpl = async (url) => {
    attempts.set(url, (attempts.get(url) || 0) + 1);
    if (url === "./data/china-prefectures-lite-4.json?v=critical-test") {
      throw new TypeError("offline");
    }
    if (url === "./data/china-cities.json?v=critical-test") {
      return { ok: true, json: async () => ({ cities: [{ id: "beijing" }] }) };
    }
    return {
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [{ properties: { id: url } }] })
    };
  };
  const { loadJson } = createJsonLoader({ fetchImpl, version: "critical-test" });

  const result = await loadCriticalMapData({ loadJson });

  assert.equal(result.cities.length, 1);
  assert.equal(result.mapData.features.length, 7);
  assert.deepEqual(result.failedBoundaryPaths, ["./data/china-prefectures-lite-4.json"]);
  assert.deepEqual(Object.fromEntries(attempts), {
    "./data/china-prefectures-lite-1.json?v=critical-test": 1,
    "./data/china-prefectures-lite-2.json?v=critical-test": 1,
    "./data/china-prefectures-lite-3.json?v=critical-test": 1,
    "./data/china-prefectures-lite-4.json?v=critical-test": 2,
    "./data/china-prefectures-lite-5.json?v=critical-test": 1,
    "./data/china-prefectures-lite-6.json?v=critical-test": 1,
    "./data/china-prefectures-lite-7.json?v=critical-test": 1,
    "./data/china-prefectures-lite-8.json?v=critical-test": 1,
    "./data/china-cities.json?v=critical-test": 1
  });
});

test("city data remains mandatory when boundaries settle successfully", async () => {
  const loadJson = async (path) => path.includes("china-cities")
    ? { cities: [] }
    : { features: [] };

  await assert.rejects(
    loadCriticalMapData({ loadJson }),
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

test("versioned JSON appends a question-mark query when none exists", async () => {
  let requestedUrl;
  const { loadJson } = createJsonLoader({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => ({ ok: true }) };
    },
    version: "test-release"
  });

  await loadJson("./data/chunk.json");

  assert.equal(requestedUrl, "./data/chunk.json?v=test-release");
});

function pendingUntilAborted(onSignal) {
  return async (_url, { signal }) => new Promise((_resolve, reject) => {
    onSignal(signal);
    const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) rejectAbort();
    else signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

test("an external abort reaches the combined fetch signal and rejects loadJson", async () => {
  const externalController = new AbortController();
  let releaseSignal;
  const signalReady = new Promise((resolve) => { releaseSignal = resolve; });
  let combinedSignal;
  const { loadJson } = createJsonLoader({
    fetchImpl: pendingUntilAborted((signal) => {
      combinedSignal = signal;
      releaseSignal();
    })
  });

  const request = loadJson("./data/pending.json", {
    signal: externalController.signal,
    timeoutMs: 1_000
  });
  await signalReady;
  externalController.abort();

  await assert.rejects(request, { name: "AbortError" });
  assert.equal(combinedSignal.aborted, true);
});

test("a request timeout aborts a pending fetch and rejects loadJson", async () => {
  let observedSignal;
  const { loadJson } = createJsonLoader({
    fetchImpl: pendingUntilAborted((signal) => { observedSignal = signal; })
  });

  await assert.rejects(
    loadJson("./data/slow.json", { timeoutMs: 1 }),
    { name: "AbortError" }
  );
  assert.equal(observedSignal.aborted, true);
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
