export const ASSET_VERSION = "progressive-1";
export const PREFECTURE_CHUNK_COUNT = 8;

function withVersion(path, version) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(version)}`;
}

export function createJsonLoader({ fetchImpl = fetch, version = ASSET_VERSION } = {}) {
  async function loadJson(path, options = {}) {
    const attempts = Number(options.retries || 0) + 1;
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const timeoutSignal = options.timeoutMs
          ? AbortSignal.timeout(options.timeoutMs)
          : null;
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
    try {
      return await loadJson(path, {
        cache: options.cache,
        retries: options.retries,
        signal: options.signal,
        timeoutMs: options.timeoutMs
      });
    } catch (error) {
      if (!options.quiet) console.warn("optional data unavailable", path, error);
      return null;
    }
  }

  return { loadJson, loadOptionalJson };
}

export async function loadCriticalMapData({ loadJson }) {
  const boundaryPaths = Array.from(
    { length: PREFECTURE_CHUNK_COUNT },
    (_, index) => `./data/china-prefectures-lite-${index + 1}.json`
  );
  const requestOptions = { retries: 1, timeoutMs: 20_000 };
  const [boundaryResults, cityData] = await Promise.all([
    Promise.allSettled(boundaryPaths.map((path) => loadJson(path, requestOptions))),
    loadJson("./data/china-cities.json", requestOptions)
  ]);
  const cities = Array.isArray(cityData?.cities) ? cityData.cities : [];
  if (!cities.length) throw new Error("china-cities data is empty");

  const chunks = boundaryResults
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  return {
    cities,
    mapData: {
      type: "FeatureCollection",
      features: chunks.flatMap((chunk) => Array.isArray(chunk?.features) ? chunk.features : [])
    },
    failedBoundaryPaths: boundaryPaths.filter(
      (_path, index) => boundaryResults[index].status === "rejected"
    )
  };
}

export function createDeferredDataLoaders({ loadOptionalJson }) {
  let countySummaryPromise;
  let foodSummaryPromise;

  return {
    loadCountySummary() {
      countySummaryPromise ??= Promise.resolve(loadOptionalJson("./data/counties-summary.json", {
        timeoutMs: 30_000,
        retries: 1
      }));
      return countySummaryPromise;
    },
    loadFoodSummary() {
      foodSummaryPromise ??= Promise.resolve(loadOptionalJson("./data/wechat-food-summary.json", {
        timeoutMs: 30_000,
        retries: 1
      }));
      return foodSummaryPromise;
    }
  };
}

export function scheduleIdle(task, options = {}) {
  const requestIdle = options.requestIdleCallbackImpl ?? globalThis.requestIdleCallback;
  if (typeof requestIdle === "function") return requestIdle(task, { timeout: 1_500 });
  const setTimer = options.setTimeoutImpl ?? globalThis.setTimeout;
  return setTimer(task, 50);
}
