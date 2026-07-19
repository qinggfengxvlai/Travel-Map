import {
  classifyDeferredSummaryData,
  createLatestAsyncRefresh,
  createJsonLoader,
  createDeferredDataLoaders,
  isCountyRecordsPayload,
  loadCriticalMapData,
  scheduleIdle
} from "./app-data.js?v=progressive-1";
import {
  createPlaceIndex,
  hydrateCountySummary as mergeCountyRecords,
  normalizeKey,
  normalizeSearchText,
  upsertRuntimePlaces
} from "./place-index.js?v=progressive-1";
import { createMapController } from "./map-core.js?v=progressive-1";

let LEGACY_TRIP_STORAGE_KEY;
let TRIP_PLAN_VERSION;
let TRIP_STORAGE_KEY;
let applyTripCommand;
let autoScheduleTrip;
let createTripPlan;
let dayDate;
let migrateTripState;
let normalizeTripPlan;
let reconcileRoutePlaces;
let resolveTripPace;
let resolveTripTransportMode;
let routePlaceIds;
let shouldUseTripFile;
let validateTripPlan;
let LEGACY_TRIP_BACKUP_KEY;
let MissingTripPlacesError;
let backupLegacyTripRaw;
let canExportTripFile;
let captureTripArchiveSnapshot;
let clearTripArchive;
let createLazyStorageAdapter;
let finalizeLegacyMigration;
let isLegacyTripPayload;
let legacyMigrationPending;
let prepareLegacyRecoveryData;
let readTripRecoveryCandidates;
let restoreTripArchiveSnapshot;
let safeTripNameForFile;
let selectTripRecoveryCandidate;
let shareUrlForTrip;
let tripFileExportPayload;
let tripFileName;
let tripFileText;
let writeTripPlanV2;
let commandForTripItemForm;
let mountTripEditor;
let renderTripEditorMarkup;
let restoreTripEditorFocus;
let tripArchiveStorage;
let tripControllerModulePromise;
let tripController;

const { loadJson, loadOptionalJson } = createJsonLoader();
const deferredData = createDeferredDataLoaders({ loadOptionalJson });
let placeIndex = null;
let mapController = null;
let foodModulePromise;
let foodControllerPromise;
let foodController = null;
let foodModuleFailureReported = false;
let cityDetailModulePromise;
let cityDetailControllerPromise;
let cityDetailController = null;
let cityDetailModuleFailureReported = false;
let cityDetailRefreshQueued = false;

function loadTripControllerModule() {
  tripControllerModulePromise ||= import("./trip-controller.js?v=progressive-1").then(async (module) => {
    ({
      LEGACY_TRIP_STORAGE_KEY,
      TRIP_PLAN_VERSION,
      TRIP_STORAGE_KEY,
      applyTripCommand,
      autoScheduleTrip,
      createTripPlan,
      dayDate,
      migrateTripState,
      normalizeTripPlan,
      reconcileRoutePlaces,
      resolveTripPace,
      resolveTripTransportMode,
      routePlaceIds,
      shouldUseTripFile,
      validateTripPlan,
      LEGACY_TRIP_BACKUP_KEY,
      MissingTripPlacesError,
      backupLegacyTripRaw,
      canExportTripFile,
      captureTripArchiveSnapshot,
      clearTripArchive,
      createLazyStorageAdapter,
      finalizeLegacyMigration,
      isLegacyTripPayload,
      legacyMigrationPending,
      prepareLegacyRecoveryData,
      readTripRecoveryCandidates,
      restoreTripArchiveSnapshot,
      safeTripNameForFile,
      selectTripRecoveryCandidate,
      shareUrlForTrip,
      tripFileExportPayload,
      tripFileName,
      tripFileText,
      writeTripPlanV2,
      commandForTripItemForm,
      mountTripEditor,
      renderTripEditorMarkup,
      restoreTripEditorFocus
    } = module);
    tripArchiveStorage ||= createLazyStorageAdapter(() => window.localStorage);
    tripController ||= module.createTripController();
    await tripController.init();
    return module;
  });
  return tripControllerModulePromise;
}

async function loadGuideModule() {
  await loadTripControllerModule();
  return tripController.loadGuideModule();
}

function queueTripAction(action) {
  return loadTripControllerModule()
    .then(action)
    .catch((error) => {
      console.error("trip module unavailable", error);
      selectionHint.textContent = "\u884c\u7a0b\u529f\u80fd\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002";
    });
}

function loadCityDetailModule() {
  cityDetailModulePromise ||= import("./city-detail.js?v=progressive-1");
  return cityDetailModulePromise;
}

function loadCityDetailController() {
  cityDetailControllerPromise ||= loadCityDetailModule().then(({ createCityDetailController }) => {
    cityDetailController = createCityDetailController({
      state,
      mapController,
      elements: { exitCityViewBtn },
      callbacks: {
        cityById,
        loadFoodForCity,
        foodArticleCountForCity,
        renderPanel,
        syncPlaceIndex,
        getPlaceIndex: () => placeIndex
      },
      helpers: {
        escapeHtml,
        normalizeKey,
        normalizeSearchText,
        hasCoordinates,
        loadOptionalJson,
        isCountyRecordsPayload,
        mergeCountyRecords,
        upsertRuntimePlaces,
        fetchImpl: window.fetch.bind(window),
        windowObject: window
      }
    });
    return cityDetailController;
  }).catch((error) => {
    cityDetailControllerPromise = null;
    throw error;
  });
  return cityDetailControllerPromise;
}

function reportCityDetailModuleFailure(error) {
  if (!cityDetailModuleFailureReported) {
    cityDetailModuleFailureReported = true;
    console.warn("city detail module unavailable", error);
  }
  state.deferredInternalError = true;
  renderOperationalWarnings();
}

function queueCityDetailModuleRefresh() {
  if (cityDetailController || cityDetailRefreshQueued) return;
  cityDetailRefreshQueued = true;
  loadCityDetailController()
    .then(() => {
      renderPanel();
      renderTripPlanner();
    })
    .catch(reportCityDetailModuleFailure)
    .finally(() => {
      cityDetailRefreshQueued = false;
    });
}


function loadFoodModule() {
  foodModulePromise ||= import("./food-content.js?v=progressive-1");
  return foodModulePromise;
}

function loadFoodController() {
  foodControllerPromise ||= loadFoodModule().then(({ createFoodController }) => {
    foodController = createFoodController({
      state,
      elements: {
        document,
        foodArticleCount,
        foodArticleList,
        foodEmptyState
      },
      data: { loadOptionalJson },
      helpers: {
        normalizeSearchText,
        escapeHtml,
        hasCoordinates,
        location: window.location
      }
    });
    return foodController;
  });
  return foodControllerPromise;
}

const labels = {
  chooseStart: "\u9009\u62e9\u51fa\u53d1\u57ce\u5e02",
  chooseHint: "\u70b9\u51fb\u4e2d\u56fd\u5730\u56fe\u4e0a\u7684\u5706\u5f62\u57ce\u5e02\u5750\u6807\u4f5c\u4e3a\u8d77\u70b9\u3002",
  fromCity: (name) => `\u4ece${name}\u51fa\u53d1`,
  nextHint: "\u7ee7\u7eed\u70b9\u51fb\u4e0b\u4e00\u4e2a\u57ce\u5e02\uff0c\u4f1a\u751f\u6210\u4e00\u6bb5\u65b0\u8def\u7ebf\uff0c\u5e76\u6309\u5f53\u524d\u4ea4\u901a\u5de5\u5177\u4f30\u7b97\u8ddd\u79bb\u4e0e\u65f6\u95f4\u3002",
  notStarted: "\u5c1a\u672a\u5f00\u59cb",
  pending: "\u5f85\u8ba1\u7b97",
  loading: "\u6b63\u5728\u8ba1\u7b97\u94c1\u8def\u884c\u7a0b...",
  success: "\u94c1\u8def\u4f30\u7b97\u884c\u7a0b",
  fallback: "\u5bfc\u822a API \u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u7528\u76f4\u7ebf\u8ddd\u79bb\u964d\u7ea7\u4f30\u7b97",
  segment: (index) => `\u7b2c ${index + 1} \u6bb5`,
  calculating: "\u8ba1\u7b97\u4e2d",
  estimate: "\u4f30\u7b97",
  highspeed: "\u9ad8\u94c1",
  train: "\u706b\u8f66",
  minute: "\u5206\u949f",
  hour: "\u5c0f\u65f6",
  day: "\u5929",
  approxSuffix: " \u4f30",
  loadingSuffix: " +"
};

const transportProfiles = {
  highspeed: {
    label: "\u9ad8\u94c1",
    speedKmh: 300,
    detourFactor: 1.08,
    bufferMinutes: 35
  },
  train: {
    label: "\u706b\u8f66",
    speedKmh: 180,
    detourFactor: 1.12,
    bufferMinutes: 25
  }
};

const tripPaceProfiles = {
  relaxed: {
    label: "\u8f7b\u677e",
    dailyTravelLimitSeconds: 3 * 60 * 60,
    hardTravelLimitSeconds: 6 * 60 * 60,
    maxDailyPlaces: 2,
    playWindowSeconds: 11 * 60 * 60,
    description: "\u5c11\u6362\u57ce\uff0c\u591a\u7559\u767d\uff0c\u9002\u5408\u4eb2\u5b50\u6216\u6162\u6e38\u3002"
  },
  standard: {
    label: "\u6807\u51c6",
    dailyTravelLimitSeconds: 4 * 60 * 60,
    hardTravelLimitSeconds: 8 * 60 * 60,
    maxDailyPlaces: 3,
    playWindowSeconds: 10 * 60 * 60,
    description: "\u4e00\u5929\u53ef\u8de8\u4e00\u6bb5\u4e2d\u7b49\u8ddd\u79bb\uff0c\u6e38\u73a9\u548c\u4ea4\u901a\u6bd4\u8f83\u5747\u8861\u3002"
  },
  compact: {
    label: "\u7d27\u51d1",
    dailyTravelLimitSeconds: 6 * 60 * 60,
    hardTravelLimitSeconds: 9 * 60 * 60,
    maxDailyPlaces: 4,
    playWindowSeconds: 12 * 60 * 60,
    description: "\u9002\u5408\u8d76\u8def\u6216\u57ce\u5e02\u6253\u5361\uff0c\u5efa\u8bae\u51cf\u5c11\u666f\u70b9\u6df1\u5ea6\u3002"
  }
};

const CITY_CLICK_DELAY_MS = 180;
const DAILY_TRAVEL_LIMIT_SECONDS = 4 * 60 * 60;
const MAX_DAILY_PLACES = 3;
const CITY_PLAY_WINDOW_SECONDS = 10 * 60 * 60;
const DEFAULT_TRIP_NAME = "\u6211\u7684\u65c5\u884c";
let legacyTripBackupPending = false;
let lastTripPersistenceResult = { stored: false, hashCleared: true };
let emergencyLegacyTripRaw = null;
let shouldRetryTripRestoreAfterCountyHydration = false;

const municipalityCoordinates = {
  "\u5317\u4eac": { lon: 116.4053, lat: 39.905 },
  "\u4e0a\u6d77": { lon: 121.4726, lat: 31.2317 },
  "\u5929\u6d25": { lon: 117.1902, lat: 39.1256 },
  "\u91cd\u5e86": { lon: 106.5516, lat: 29.563 }
};
const municipalityNames = new Set(["\u5317\u4eac", "\u4e0a\u6d77", "\u5929\u6d25", "\u91cd\u5e86"]);
const taiwanRegion = {
  id: "taiwan-region",
  name: "\u53f0\u6e7e",
  province: "\u53f0\u6e7e",
  pinyin: "taiwan",
  lon: 121.0,
  lat: 23.7,
  anchor: "\u53f0\u6e7e",
  isRegion: true
};
const state = {
  selectedCityId: null,
  transportMode: "highspeed",
  tripPace: "standard",
  tripPlan: null,
  tripHistory: [],
  tripEditorDestroy: null,
  viewMode: "china",
  activeCityViewId: null,
  activeDistrictBoundaryCount: 0,
  activeLandmarkCount: 0,
  activeStationCount: 0,
  activeSubwayLineCount: 0,
  activeSubwayStationCount: 0,
  activeFoodArticleCount: 0,
  pendingCityClickTimer: null,
  routes: [],
  nextRouteId: 1,
  map: null,
  canvasRenderer: null,
  chinaLayer: null,
  cityLayer: null,
  labelLayer: null,
  routeLayer: null,
  cityById: new Map(),
  placeById: new Map(),
  cityByKey: new Map(),
  cityByProvinceKey: new Map(),
  cityKeyEntries: [],
  cityFeatureLayers: new Map(),
  cityAdcodes: new Map(),
  cityBoundaryCache: new Map(),
  stationCache: new Map(),
  subwayStationCache: new Map(),
  landmarkCache: new Map(),
  metroNetworkData: null,
  metroNetworkPromise: null,
  passengerStationNames: null,
  passengerStationNamesPromise: null,
  loadedCountyCityIds: new Set(),
  countyLoadPromises: new Map(),
  searchResults: [],
  featureCityIds: new WeakMap(),
  cities: [],
  counties: [],
  hiddenMunicipalityChildren: [],
  mapData: null,
  failedBoundaryPaths: [],
  missingOptionalDatasets: [],
  deferredInternalError: false,
  panelBaseHint: ""
};

const selectionTitle = document.querySelector("#selectionTitle");
const selectionHint = document.querySelector("#selectionHint");
const routeList = document.querySelector("#routeList");
const emptyState = document.querySelector("#emptyState");
const undoBtn = document.querySelector("#undoBtn");
const clearBtn = document.querySelector("#clearBtn");
const resetViewBtn = document.querySelector("#resetViewBtn");
const saveTripBtn = document.querySelector("#saveTripBtn");
const shareTripBtn = document.querySelector("#shareTripBtn");
const tripImportBtn = document.querySelector("#tripImportBtn");
const tripImportInput = document.querySelector("#tripImportInput");
const exportTripFileBtn = document.querySelector("#exportTripFileBtn");
const exportMarkdownBtn = document.querySelector("#exportMarkdownBtn");
const exportHtmlBtn = document.querySelector("#exportHtmlBtn");
const citySearch = document.querySelector("#citySearch");
const clearSearchBtn = document.querySelector("#clearSearchBtn");
const searchResults = document.querySelector("#searchResults");
const cityCount = document.querySelector("#cityCount");
const routeCount = document.querySelector("#routeCount");
const totalDistance = document.querySelector("#totalDistance");
const totalDuration = document.querySelector("#totalDuration");
const chainLabel = document.querySelector("#chainLabel");
const availableCityCount = document.querySelector("#availableCityCount");
const foodArticleCount = document.querySelector("#foodArticleCount");
const foodArticleList = document.querySelector("#foodArticleList");
const foodEmptyState = document.querySelector("#foodEmptyState");
const itineraryMeta = document.querySelector("#itineraryMeta");
const itineraryList = document.querySelector("#itineraryList");
const tripNameInput = document.querySelector("#tripNameInput");
const tripStartDateInput = document.querySelector("#tripStartDateInput");
const autoScheduleBtn = document.querySelector("#autoScheduleBtn");
const undoTripEditBtn = document.querySelector("#undoTripEditBtn");
const tripEditorRoot = document.querySelector("#tripEditorRoot");
const itineraryEmptyState = document.querySelector("#itineraryEmptyState");
const tripHealth = document.querySelector("#tripHealth");
const tripItemDialog = document.querySelector("#tripItemDialog");
const tripItemForm = document.querySelector("#tripItemForm");
const tripItemDialogTitle = document.querySelector("#tripItemDialogTitle");
const tripItemTypeLabel = document.querySelector("#tripItemTypeLabel");
const tripItemTitleLabel = document.querySelector("#tripItemTitleLabel");
const tripItemStartTimeLabel = document.querySelector("#tripItemStartTimeLabel");
const tripItemEndTimeLabel = document.querySelector("#tripItemEndTimeLabel");
const tripItemPlaceId = document.querySelector("#tripItemPlaceId");
const tripItemTitle = document.querySelector("#tripItemTitle");
const tripLandmarkOptions = document.querySelector("#tripLandmarkOptions");
const tripItemCancelBtn = document.querySelector("#tripItemCancelBtn");
const tripArchiveStatus = document.querySelector("#tripArchiveStatus");
const appShell = document.querySelector(".app-shell");
const mobileViewButtons = Array.from(document.querySelectorAll("[data-mobile-view]"));
const transportButtons = Array.from(document.querySelectorAll("[data-mode]"));
const paceButtons = Array.from(document.querySelectorAll("[data-pace]"));
const exitCityViewBtn = document.querySelector("#exitCityViewBtn");
const mapBadgeLabel = document.querySelector(".map-badge span");
const foodInteractionRefresh = createLatestAsyncRefresh({
  load: loadFoodController,
  apply: (controller, selection) => controller.renderPanel(selection),
  refresh: () => renderTripPlanner()
});

async function loadMapData() {
  const criticalData = await loadCriticalMapData({ loadJson });
  const cities = criticalData.cities;

  const displayCities = cities
    .filter((city) => !municipalityNames.has(city.province) || city.name === city.province)
    .map((city) => ({
      ...city,
      ...(municipalityCoordinates[city.name] || {})
    }));
  displayCities.push({ ...taiwanRegion });

  state.hiddenMunicipalityChildren = cities.filter((city) => municipalityNames.has(city.province) && city.name !== city.province);
  state.mapData = criticalData.mapData;
  state.failedBoundaryPaths = criticalData.failedBoundaryPaths;
  placeIndex = createPlaceIndex({
    cities: displayCities,
    counties: [],
    municipalityChildren: state.hiddenMunicipalityChildren
  });
  syncPlaceIndex();
}

function syncPlaceIndex() {
  state.cities = placeIndex.cities;
  state.counties = placeIndex.counties;
  state.cityById = placeIndex.cityById;
  state.placeById = placeIndex.placeById;
  state.cityByKey = placeIndex.cityByKey;
  state.cityByProvinceKey = placeIndex.cityByProvinceKey;
  state.cityKeyEntries = placeIndex.cityKeyEntries;
  if (foodControllerPromise) {
    void foodControllerPromise
      .then((controller) => controller.refreshKnownPlaces(state.placeById))
      .catch(reportFoodModuleFailure);
  }
}

async function hydrateDeferredSummaries() {
  const countyRequest = deferredData.loadCountySummary();
  const foodRequest = deferredData.loadFoodSummary();
  const [countyResult, foodResult] = await Promise.allSettled([countyRequest, foodRequest]);
  const countyData = countyResult.status === "fulfilled" ? countyResult.value : null;
  const foodData = foodResult.status === "fulfilled" ? foodResult.value : null;
  const status = classifyDeferredSummaryData({ countyData, foodData });
  state.missingOptionalDatasets = status.missingDatasets;
  state.deferredInternalError = false;

  if (status.countyValid) {
    mergeCountyRecords(placeIndex, countyData.counties);
    syncPlaceIndex();
    if (shouldRetryTripRestoreAfterCountyHydration) {
      shouldRetryTripRestoreAfterCountyHydration = false;
      restoreTripState();
    }
  }

  let foodProcessingError = null;
  if (status.foodValid) {
    try {
      const controller = await loadFoodController();
      controller.refreshKnownPlaces(state.placeById);
      controller.hydrateSummary(foodData);
    } catch (error) {
      foodProcessingError = error;
    }
  }
  updateSearchResults();
  renderPanel();
  if (countyResult.status === "rejected" || foodResult.status === "rejected" || foodProcessingError) {
    throw new AggregateError(
      [countyResult, foodResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason)
        .concat(foodProcessingError ? [foodProcessingError] : []),
      "deferred summary loading failed"
    );
  }
  return status;
}

function updateSearchResults() {
  const query = normalizeSearchText(citySearch.value);
  searchResults.replaceChildren();

  if (!query) {
    state.searchResults = [];
    return;
  }

  state.searchResults = [
    ...state.cities.map((city) => ({ ...city, searchType: "city" })),
    ...state.counties
  ]
    .filter((item) => item.searchText.includes(query))
    .sort((a, b) => scoreSearchResult(a, query) - scoreSearchResult(b, query) || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, 8);

  if (!state.searchResults.length) {
    const empty = document.createElement("div");
    empty.className = "search-empty";
    empty.textContent = "\u6ca1\u6709\u627e\u5230\u5339\u914d\u884c\u653f\u533a";
    searchResults.append(empty);
    return;
  }

  state.searchResults.forEach((item) => {
    const button = document.createElement("button");
    button.className = `search-result ${item.searchType === "county" ? "county" : "city"}`;
    button.type = "button";
    button.setAttribute("role", "option");
    button.innerHTML = searchResultHtml(item);
    button.addEventListener("click", () => selectSearchResult(item));
    searchResults.append(button);
  });
}

function searchResultHtml(item) {
  const articleCount = foodArticleCountForPlace(item.id) || foodArticleCountForCity(item.searchType === "county" ? item.parentCityId : item.id);
  const articleBadge = articleCount ? `<em>${articleCount} \u7bc7\u98df\u884c\u8bb0</em>` : "";
  const typeLabel = item.searchType === "county" ? "\u533a\u53bf" : "\u57ce\u5e02";
  if (item.searchType === "county") {
    return `
      <span class="search-copy">
        <strong class="search-title"><span class="type-pill">${typeLabel}</span>${escapeHtml(item.name)}${articleBadge}</strong>
        <span>${escapeHtml(item.parentCityName)} \u00b7 ${escapeHtml(item.province)} / ${escapeHtml(item.pinyin)}</span>
      </span>
    `;
  }

  return `
    <span class="search-copy">
      <strong class="search-title"><span class="type-pill">${typeLabel}</span>${escapeHtml(item.name)}${articleBadge}</strong>
      <span>\u5e02\u7ea7\u884c\u653f\u533a \u00b7 ${escapeHtml(item.province)} / ${escapeHtml(item.pinyin)}</span>
    </span>
  `;
}

function scoreSearchResult(item, query) {
  const name = normalizeSearchText(item.name);
  const province = normalizeSearchText(item.province);
  const pinyin = normalizeSearchText(item.pinyin);
  const parentCity = normalizeSearchText(item.parentCityName || "");
  const typeOffset = item.searchType === "county" ? 0.35 : 0;
  if (name === query) return 0;
  if (pinyin === query) return 1 + typeOffset;
  if (name.startsWith(query)) return 2 + typeOffset;
  if (pinyin.startsWith(query)) return 3 + typeOffset;
  if (parentCity.startsWith(query)) return 4 + typeOffset;
  if (province.startsWith(query)) return 5 + typeOffset;
  return 9;
}

async function selectSearchResult(item) {
  if (!item || !state.map) return;
  await loadTripControllerModule();
  const targetCityId = item.searchType === "county" ? item.parentCityId : item.id;
  const targetCity = cityById(targetCityId);
  if (!targetCity) return;

  if (item.searchType === "county") {
    await ensureCityCounties(targetCity.id);
    const county = placeById(item.id) || item;
    if (state.viewMode !== "city" || state.activeCityViewId !== targetCity.id) {
      await enterCityView(targetCity.id);
    }
    if (hasCoordinates(county)) {
      mapController.focusPlace(county);
    }
    handlePlaceClick(county.id);
  } else {
    if (state.viewMode === "city") exitCityView({ fit: false });
    mapController.focusPlace(item);
    handlePlaceClick(targetCity.id);
  }
  citySearch.value = "";
  updateSearchResults();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

async function resetMapView() {
  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    if (activeCity) {
      const detailSession = mapController.enterCityView(activeCity.id);
      await loadCityDetail(activeCity, detailSession);
      if (mapController.isDetailSessionCurrent(detailSession)) renderPanel();
    }
    return;
  }
  mapController?.fitChina();
}

function isValidRouteId(routeId) {
  return (Number.isSafeInteger(routeId) && routeId > 0) ||
    (typeof routeId === "string" && routeId.trim().length > 0);
}

function syncRoutesFromTripPlan() {
  const placeIds = state.tripPlan ? routePlaceIds(state.tripPlan) : [];
  const previousRoutes = state.routes;
  const claimedRoutes = new Set();
  const claimedRouteIds = new Set();
  const reservedRouteIds = new Set(
    previousRoutes.map((route) => route?.id).filter(isValidRouteId)
  );
  const largestNumericId = previousRoutes.reduce(
    (largest, route) => Number.isSafeInteger(route?.id) ? Math.max(largest, route.id) : largest,
    0
  );
  state.nextRouteId = Math.max(
    Number.isSafeInteger(state.nextRouteId) && state.nextRouteId > 0 ? state.nextRouteId : 1,
    largestNumericId + 1
  );

  const allocateRouteId = () => {
    while (reservedRouteIds.has(state.nextRouteId)) state.nextRouteId += 1;
    const routeId = state.nextRouteId;
    state.nextRouteId += 1;
    reservedRouteIds.add(routeId);
    return routeId;
  };
  const routesToEstimate = [];
  const nextRoutes = placeIds.slice(1).map((to, index) => {
    const from = placeIds[index];
    const reusable = previousRoutes.find((route) =>
      !claimedRoutes.has(route) &&
      isValidRouteId(route?.id) &&
      !claimedRouteIds.has(route.id) &&
      route.from === from &&
      route.to === to &&
      route.transportMode === state.transportMode
    );
    if (reusable) {
      claimedRoutes.add(reusable);
      claimedRouteIds.add(reusable.id);
      return reusable;
    }

    const route = {
      id: allocateRouteId(),
      from,
      to,
      status: "loading",
      distance: null,
      duration: null,
      fallback: false,
      error: null,
      transportMode: state.transportMode,
      transportLabel: transportProfile().label
    };
    claimedRouteIds.add(route.id);
    routesToEstimate.push(route);
    return route;
  });

  state.routes = nextRoutes;
  state.selectedCityId = placeIds.at(-1) ?? null;
  routesToEstimate.forEach((route) => mapController?.calculateRouteMetrics(route));
}

function commitTripPlan(nextPlan, {
  recordHistory = true,
  message = "\u5df2\u81ea\u52a8\u4fdd\u5b58\u5230\u672c\u673a\u3002",
  focusToken = null,
  completeLegacyMigration = true
} = {}) {
  // Any committed plan (including clearing the current plan) is newer user-visible
  // state than a recovery attempt that was deferred during startup.
  shouldRetryTripRestoreAfterCountyHydration = false;
  if (recordHistory && state.tripPlan && state.tripPlan !== nextPlan) {
    state.tripHistory.push(structuredClone(state.tripPlan));
  }
  state.tripHistory = state.tripHistory.slice(-20);
  state.tripPlan = nextPlan;
  state.tripPace = resolveTripPace(nextPlan, state.tripPace);
  state.transportMode = resolveTripTransportMode(nextPlan);
  syncRoutesFromTripPlan();
  mapController?.renderRoutes();
  renderPanel();
  if (focusToken) {
    restoreTripEditorFocus(tripEditorRoot, focusToken);
    window.requestAnimationFrame(() => restoreTripEditorFocus(tripEditorRoot, focusToken));
  }
  const persisted = persistTripState(message);
  if (persisted && completeLegacyMigration) finalizeLegacyTripBackup(message);
  return persisted;
}

function tripIdentifier(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function affectedTripDayLabels(plan, dayIds) {
  const uniqueDayIds = [...new Set(Array.isArray(dayIds) ? dayIds : [])];
  return uniqueDayIds.flatMap((dayId) => {
    const dayIndex = plan.days.findIndex((day) => day.id === dayId);
    if (dayIndex < 0) return [];
    let date = null;
    try {
      date = dayDate(plan, dayIndex);
    } catch {
      date = null;
    }
    return [`\u7b2c ${dayIndex + 1} \u5929${date ? `\uff08${date}\uff09` : ""}`];
  });
}

function handleTripCommand(command, focusToken) {
  if (!state.tripPlan || !command || typeof command !== "object" || Array.isArray(command)) return false;
  let result = applyTripCommand(state.tripPlan, command);
  if (result.requiresConfirmation) {
    const labels = affectedTripDayLabels(state.tripPlan, result.affectedDayIds);
    const target = labels.length ? labels.join("\u3001") : "\u76f8\u5173\u65e5\u671f";
    const confirmationMessage = result.confirmationReason === "cleanup-associated-content"
      ? `\u79fb\u52a8\u57ce\u5e02\u4f1a\u6e05\u7406${target}\u4e2d\u4e0e\u8be5\u57ce\u5e02\u5173\u8054\u7684\u4ea4\u901a\u3001\u6d3b\u52a8\u6216\u4f4f\u5bbf\u5185\u5bb9\uff0c\u662f\u5426\u7ee7\u7eed\uff1f`
      : `\u6b64\u64cd\u4f5c\u4f1a\u5f71\u54cd${target}\u7684\u4ea4\u901a\u3001\u6d3b\u52a8\u6216\u4f4f\u5bbf\u5185\u5bb9\uff0c\u662f\u5426\u7ee7\u7eed\uff1f`;
    const confirmed = window.confirm(confirmationMessage);
    if (!confirmed) return false;
    result = applyTripCommand(state.tripPlan, command, { force: true });
  }
  if (!result.changed) {
    if (result.blockedReason === "item-place-mismatch") {
      updateArchiveStatus("\u9879\u76ee\u4e0e\u76ee\u6807\u65e5\u671f\u7684\u57ce\u5e02\u4e0d\u5339\u914d\uff0c\u672a\u6267\u884c\u79fb\u52a8\u3002", "error");
    }
    return false;
  }
  commitTripPlan(result.plan, { focusToken });
  return true;
}

function tripFormControl(name) {
  return tripItemForm?.elements?.namedItem(name) ?? null;
}

function setTripFormValue(name, value) {
  const control = tripFormControl(name);
  if (!control) return;
  if (control.type === "checkbox") {
    control.checked = value === 1 || value === "1" || value === true;
    return;
  }
  control.value = value === null || value === undefined ? "" : String(value);
}

function tripDayPlaceIds(day) {
  const placeIds = [];
  (Array.isArray(day?.cityEntries) ? day.cityEntries : []).forEach((entry) => {
    const placeId = tripIdentifier(entry?.placeId);
    if (placeId && !placeIds.includes(placeId)) placeIds.push(placeId);
  });
  return placeIds;
}

function populateTripPlaceSelect(control, placeIds, preferredPlaceId) {
  if (!control) return "";
  const options = placeIds.map((placeId) => {
    const option = document.createElement("option");
    option.value = placeId;
    option.textContent = placeById(placeId)?.name || placeId;
    return option;
  });
  control.replaceChildren(...options);
  const preferred = tripIdentifier(preferredPlaceId);
  const selected = preferred && placeIds.includes(preferred) ? preferred : (placeIds[0] || "");
  control.value = selected;
  return selected;
}

function landmarkNamesForPlace(placeId) {
  const place = placeById(placeId);
  const city = cityForPlace(place);
  if (!city) return [];
  const cacheKey = state.cityAdcodes.get(city.id) || city.id;
  const cached = state.landmarkCache.get(cacheKey) || [];
  return uniqueByName(
    [...cityLandmarks(city), ...cached]
      .map((landmark) => typeof landmark?.name === "string" ? landmark.name.trim() : "")
      .filter(Boolean)
  );
}

function renderTripLandmarkOptions(placeId) {
  const names = landmarkNamesForPlace(placeId);
  if (tripLandmarkOptions) {
    tripLandmarkOptions.replaceChildren(...names.map((name) => {
      const option = document.createElement("option");
      option.value = name;
      return option;
    }));
  }
  return names;
}

function configureTripItemForm(type) {
  const labels = {
    transport: { type: "\u4ea4\u901a", title: "\u8f66\u6b21\u6216\u73ed\u6b21", start: "\u51fa\u53d1\u65f6\u95f4", end: "\u5230\u8fbe\u65f6\u95f4" },
    activity: { type: "\u6d3b\u52a8", title: "\u6d3b\u52a8\u6807\u9898", start: "\u5f00\u59cb\u65f6\u95f4", end: "\u7ed3\u675f\u65f6\u95f4" },
    lodging: { type: "\u4f4f\u5bbf", title: "\u4f4f\u5bbf\u540d\u79f0", start: "\u5165\u4f4f\u65f6\u95f4", end: "\u9000\u623f\u65f6\u95f4" }
  }[type];
  if (!labels || !tripItemForm) return false;
  setTripFormValue("type", type);
  if (tripItemTypeLabel) tripItemTypeLabel.textContent = labels.type;
  if (tripItemTitleLabel) tripItemTitleLabel.textContent = labels.title;
  if (tripItemStartTimeLabel) tripItemStartTimeLabel.textContent = labels.start;
  if (tripItemEndTimeLabel) tripItemEndTimeLabel.textContent = labels.end;
  tripItemForm.querySelectorAll("[data-trip-types]").forEach((field) => {
    const supported = (field.dataset.tripTypes || "").split(/\s+/).includes(type);
    field.hidden = !supported;
    field.querySelectorAll("input, select, textarea").forEach((control) => {
      control.disabled = !supported;
    });
  });
  if (tripItemTitle) {
    if (type === "activity") tripItemTitle.setAttribute("list", "tripLandmarkOptions");
    else tripItemTitle.removeAttribute("list");
  }
  if (type !== "activity" && tripLandmarkOptions) tripLandmarkOptions.replaceChildren();
  return true;
}

function closeTripItemDialog(returnValue = "cancel") {
  if (!tripItemDialog) return;
  if (tripItemDialog.open && typeof tripItemDialog.close === "function") {
    tripItemDialog.close(returnValue);
  } else {
    tripItemDialog.removeAttribute("open");
  }
}

function openTripItemDialog(request = {}) {
  if (!tripItemDialog || !tripItemForm || !state.tripPlan) return;
  const dayId = tripIdentifier(request.dayId);
  const day = state.tripPlan.days.find((candidate) => candidate.id === dayId);
  if (!day) return;
  const placeIds = tripDayPlaceIds(day);
  if (!placeIds.length) {
    updateArchiveStatus("\u5f53\u5929\u6ca1\u6709\u53ef\u9009\u5730\u70b9\uff0c\u8bf7\u5148\u5b89\u6392\u57ce\u5e02\u3002", "error");
    return;
  }

  let type;
  let item = null;
  if (request.action === "add-transport") type = "transport";
  else if (request.action === "add-activity") type = "activity";
  else if (request.action === "edit-lodging") type = "lodging";
  else if (request.action === "edit-item") {
    const itemId = tripIdentifier(request.itemId);
    item = day.items.find((candidate) => candidate.id === itemId) || null;
    if (!item || (item.type !== "transport" && item.type !== "activity")) return;
    type = item.type;
  } else {
    return;
  }

  tripItemForm.reset();
  if (!configureTripItemForm(type)) return;
  setTripFormValue("dayId", day.id);
  setTripFormValue("itemId", item?.id || "");
  const isEditing = Boolean(item) || (type === "lodging" && day.lodging);
  if (tripItemDialogTitle) {
    tripItemDialogTitle.textContent = `${isEditing ? "\u7f16\u8f91" : "\u6dfb\u52a0"}${type === "transport" ? "\u4ea4\u901a" : type === "activity" ? "\u6d3b\u52a8" : "\u4f4f\u5bbf"}`;
  }

  if (type === "transport") {
    populateTripPlaceSelect(tripFormControl("fromPlaceId"), placeIds, item?.fromPlaceId || placeIds[0]);
    populateTripPlaceSelect(tripFormControl("toPlaceId"), placeIds, item?.toPlaceId || placeIds.at(-1));
    setTripFormValue("serviceNo", item?.serviceNo);
    setTripFormValue("startTime", item?.startTime);
    setTripFormValue("endTime", item?.endTime);
    setTripFormValue("endDayOffset", item?.endDayOffset);
    setTripFormValue("note", item?.note);
  } else if (type === "activity") {
    const selectedPlaceId = populateTripPlaceSelect(
      tripFormControl("placeId"),
      placeIds,
      item?.placeId || day.overnightPlaceId || placeIds[0]
    );
    renderTripLandmarkOptions(selectedPlaceId);
    setTripFormValue("title", item?.title);
    setTripFormValue("startTime", item?.startTime);
    setTripFormValue("endTime", item?.endTime);
    setTripFormValue("address", item?.address);
    setTripFormValue("note", item?.note);
  } else {
    const lodging = day.lodging || {};
    populateTripPlaceSelect(
      tripFormControl("placeId"),
      placeIds,
      lodging.placeId || day.overnightPlaceId || placeIds[0]
    );
    setTripFormValue("title", lodging.name);
    setTripFormValue("startTime", lodging.checkInTime);
    setTripFormValue("endTime", lodging.checkOutTime);
    setTripFormValue("address", lodging.address);
    setTripFormValue("note", lodging.note);
  }

  if (!tripItemDialog.open) {
    if (typeof tripItemDialog.showModal === "function") tripItemDialog.showModal();
    else tripItemDialog.setAttribute("open", "");
  }
  const focusControl = type === "transport" ? tripFormControl("serviceNo") : tripFormControl("title");
  window.requestAnimationFrame(() => focusControl?.focus());
}

function submitTripItemForm(event) {
  event.preventDefault();
  if (!tripItemForm || !state.tripPlan) return;
  const values = Object.fromEntries(new FormData(tripItemForm).entries());
  try {
    const command = commandForTripItemForm(values, {
      landmarkNames: values.type === "activity" ? landmarkNamesForPlace(values.placeId) : []
    });
    closeTripItemDialog("saved");
    handleTripCommand(command, { action: "day", dayId: command.dayId });
  } catch {
    updateArchiveStatus("\u8bf7\u8865\u5168\u5f53\u524d\u7f16\u8f91\u9879\u76ee\u7684\u5fc5\u586b\u4fe1\u606f\u3002", "error");
  }
}

function updateTripNameMetadata() {
  if (!tripNameInput || !state.tripPlan) return;
  const currentName = typeof state.tripPlan.name === "string" && state.tripPlan.name.trim()
    ? state.tripPlan.name.trim().slice(0, 60)
    : DEFAULT_TRIP_NAME;
  const requestedName = tripNameInput.value.trim().slice(0, 60);
  const name = requestedName || currentName;
  tripNameInput.value = name;
  handleTripCommand({ type: "update-metadata", patch: { name } });
}

function updateTripStartDateMetadata() {
  if (!tripStartDateInput || !state.tripPlan) return;
  handleTripCommand({
    type: "update-metadata",
    patch: { startDate: tripStartDateInput.value || null }
  });
}

function undoTripEdit() {
  const previous = state.tripHistory.pop();
  if (!previous) return;
  commitTripPlan(previous, {
    recordHistory: false,
    message: "\u5df2\u64a4\u9500\u4e0a\u4e00\u6b21\u884c\u7a0b\u7f16\u8f91\u3002"
  });
}

function routeDurationsForAutoSchedule(placeIds) {
  const durations = {};
  placeIds.slice(1).forEach((to, index) => {
    const from = placeIds[index];
    const indexedRoute = state.routes[index];
    const route = indexedRoute?.from === from && indexedRoute?.to === to
      ? indexedRoute
      : state.routes.find((candidate) => candidate.from === from && candidate.to === to);
    durations[`${from}>${to}`] = route ? routeDurationForPlanning(route) : 2 * 60 * 60;
  });
  return durations;
}

function autoScheduleCurrentTrip() {
  const plan = state.tripPlan;
  if (!plan || !Array.isArray(plan.days) || !plan.days.length) return;
  if (plan.days.some((day) => day.manuallyEdited)) {
    const confirmed = window.confirm(
      "\u81ea\u52a8\u6392\u671f\u4f1a\u91cd\u65b0\u6309\u5f53\u524d\u8282\u594f\u62c6\u5206\u65e5\u671f\uff0c\u5e76\u8986\u76d6\u5df2\u6709\u624b\u52a8\u65e5\u671f\u5b89\u6392\u3002\u662f\u5426\u7ee7\u7eed\uff1f"
    );
    if (!confirmed) return;
  }
  const placeIds = routePlaceIds(plan);
  const metadata = {
    name: typeof plan.name === "string" && plan.name.trim() ? plan.name : DEFAULT_TRIP_NAME,
    startDate: plan.startDate || null,
    pace: plan.pace || state.tripPace,
    transportMode: resolveTripTransportMode(plan)
  };
  const nextPlan = autoScheduleTrip({
    placeIds,
    durations: routeDurationsForAutoSchedule(placeIds),
    paceProfile: tripPaceProfile(metadata.pace),
    metadata
  });
  commitTripPlan(nextPlan, {
    message: "\u5df2\u6309\u5f53\u524d\u884c\u7a0b\u8282\u594f\u91cd\u65b0\u81ea\u52a8\u6392\u671f\u3002"
  });
}

function renderOperationalWarnings() {
  const warnings = [];
  const warningIds = [];
  if (state.failedBoundaryPaths.length) {
    warningIds.push("boundaries");
    warnings.push(`\u90e8\u5206\u5730\u56fe\u8fb9\u754c\u6682\u672a\u52a0\u8f7d\uff08${state.failedBoundaryPaths.length} \u4e2a\u5206\u5757\uff09\uff0c\u57ce\u5e02\u884c\u7a0b\u89c4\u5212\u4ecd\u53ef\u6b63\u5e38\u4f7f\u7528\u3002`);
  }
  if (state.missingOptionalDatasets.length) {
    warningIds.push(...state.missingOptionalDatasets);
    warnings.push(`\u53ef\u9009\u6570\u636e\u6682\u4e0d\u53ef\u7528\uff1a${state.missingOptionalDatasets.join(", ")}\u3002`);
  }
  if (state.deferredInternalError) {
    warningIds.push("internal");
    warnings.push("\u53ef\u9009\u6570\u636e\u5904\u7406\u53d1\u751f\u5185\u90e8\u9519\u8bef\uff0c\u5730\u56fe\u4ecd\u53ef\u4f7f\u7528\u3002");
  }
  selectionHint.dataset.operationalWarnings = warningIds.join(",");
  selectionHint.textContent = [state.panelBaseHint, ...warnings].filter(Boolean).join(" ");
}

function currentFoodSelection() {
  return {
    selected: state.selectedCityId ? placeById(state.selectedCityId) : null,
    viewMode: state.viewMode,
    activeCityViewId: state.activeCityViewId
  };
}

function reportFoodModuleFailure(error) {
  if (foodModuleFailureReported) return;
  foodModuleFailureReported = true;
  if (foodArticleCount) foodArticleCount.textContent = "暂不可用";
  applyDeferredInternalFailure(error);
}

function queueFoodPanelRender() {
  if (!document.documentElement.dataset.appReady) return;
  const selection = currentFoodSelection();
  void foodInteractionRefresh
    .schedule(selection, { refreshOnResolve: !foodController })
    .catch(reportFoodModuleFailure);
}

function foodArticleCountForCity(cityId) {
  return foodController?.articleCountForCity(cityId) || 0;
}

function foodArticleCountForPlace(placeId) {
  return foodController?.articleCountForPlace(placeId) || 0;
}

async function loadFoodForCity(cityId, options) {
  try {
    const controller = await loadFoodController();
    await controller.ensureCity(cityId, options);
    return controller;
  } catch (error) {
    reportFoodModuleFailure(error);
    return null;
  }
}

async function ensureFoodModuleForTrip() {
  try {
    return await loadFoodController();
  } catch (error) {
    reportFoodModuleFailure(error);
    return null;
  }
}

function renderPanel() {
  const selected = placeById(state.selectedCityId);
  syncTransportButtons();
  syncPaceButtons();

  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    const detailCounts = activeCity ? cityDetailCounts(activeCity) : { subareas: 0, landmarks: 0, stations: 0, subwayStations: 0, foodArticles: 0 };
    const subareaText = state.activeDistrictBoundaryCount
      ? `${state.activeDistrictBoundaryCount} \u4e2a\u4e0b\u8f96\u533a\u57df\u8fb9\u754c`
      : `${detailCounts.subareas} \u4e2a\u533a\u53bf\u70b9`;
    selectionTitle.textContent = activeCity ? `\u57ce\u5e02\u89c6\u56fe\uff1a${activeCity.name}` : "\u57ce\u5e02\u89c6\u56fe";
    selectionHint.textContent = activeCity
      ? `\u5df2\u9690\u85cf\u4e2d\u56fd\u603b\u56fe\uff0c\u6b63\u5728\u663e\u793a ${subareaText}\u3001${detailCounts.landmarks} \u4e2a\u5730\u6807/\u666f\u70b9\u3001${state.activeStationCount} \u4e2a\u706b\u8f66\u7ad9\u4e0e ${state.activeSubwayLineCount} \u6761\u5730\u94c1\u7ebf\u8def/${state.activeSubwayStationCount} \u4e2a\u5730\u94c1\u7ad9\u3001${state.activeFoodArticleCount} \u7bc7\u98df\u884c\u8bb0\uff0c\u533a\u53bf\u8fb9\u754c\u53ef\u70b9\u51fb\u7eb3\u5165\u884c\u7a0b\u3002`
      : "\u53cc\u51fb\u57ce\u5e02\u53ef\u8fdb\u5165\u72ec\u7acb\u57ce\u5e02\u89c6\u56fe\u3002";
  } else if (selected) {
    selectionTitle.textContent = labels.fromCity(selected.name);
    selectionHint.textContent = `${placeContext(selected)} · ${labels.nextHint}`;
  } else {
    selectionTitle.textContent = labels.chooseStart;
    selectionHint.textContent = labels.chooseHint;
  }
  state.panelBaseHint = selectionHint.textContent;
  renderOperationalWarnings();

  routeList.replaceChildren();
  state.routes.forEach((route, index) => {
    const from = placeById(route.from);
    const to = placeById(route.to);
    if (!from || !to) return;
    const item = document.createElement("li");
    item.className = `route-item ${route.status}`;
    item.innerHTML = `
      <div>
        <span class="segment">${from.name} &rarr; ${to.name}</span>
        <span class="route-status">${placeContext(from)} · ${placeContext(to)} · ${statusLabel(route)}</span>
      </div>
      <span class="meta">${routeMeta(route, index)}</span>
    `;
    routeList.append(item);
  });

  emptyState.hidden = state.routes.length > 0;
  undoBtn.disabled = state.routes.length === 0;
  clearBtn.disabled = state.routes.length === 0 && !state.selectedCityId;
  syncTripArchiveControls();
  cityCount.textContent = String(state.cities.length);
  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    const detailCounts = activeCity ? cityDetailCounts(activeCity) : { subareas: 0, landmarks: 0, stations: 0, subwayStations: 0, foodArticles: 0 };
    availableCityCount.textContent = String(detailCounts.subareas + detailCounts.landmarks + state.activeStationCount + state.activeSubwayStationCount + state.activeFoodArticleCount);
    if (mapBadgeLabel) mapBadgeLabel.textContent = "\u57ce\u5e02\u5185\u70b9\u4f4d";
  } else {
    availableCityCount.textContent = String(state.cities.length);
    if (mapBadgeLabel) mapBadgeLabel.textContent = "\u53ef\u70b9\u51fb\u57ce\u5e02";
  }
  routeCount.textContent = String(state.routes.length);
  mapController?.updateCityStyles();
  updateTotals();
  chainLabel.textContent = buildChainLabel();
  renderTripPlanner();
  queueFoodPanelRender();
}

function renderTripPlanner() {
  if (!tripEditorRoot || !itineraryMeta || !itineraryEmptyState || !tripHealth) return;
  if (typeof state.tripEditorDestroy === "function") state.tripEditorDestroy();
  state.tripEditorDestroy = null;
  tripEditorRoot.replaceChildren();

  const plan = state.tripPlan;
  const hasCalendar = Array.isArray(plan?.days) && plan.days.length > 0;
  if (tripNameInput && document.activeElement !== tripNameInput) tripNameInput.value = plan?.name || "";
  if (tripStartDateInput && document.activeElement !== tripStartDateInput) tripStartDateInput.value = plan?.startDate || "";
  if (autoScheduleBtn) autoScheduleBtn.disabled = !hasCalendar;
  if (undoTripEditBtn) undoTripEditBtn.disabled = state.tripHistory.length === 0;
  itineraryEmptyState.hidden = hasCalendar;

  if (!hasCalendar) {
    itineraryMeta.textContent = "\u5f85\u751f\u6210";
    tripHealth.hidden = true;
    tripHealth.className = "trip-health";
    tripHealth.textContent = "";
    return;
  }

  const pace = tripPaceProfile(plan.pace);
  const planPlaceIds = routePlaceIds(plan);
  const warnings = validateTripPlan(plan, { paceProfile: pace });
  itineraryMeta.textContent = `${plan.days.length} \u5929 \u00b7 ${pace.label} \u00b7 ${planPlaceIds.length} \u4e2a\u5730\u70b9`;
  const errorCount = state.routes.filter((route) => route.status === "error").length;
  const loadingCount = state.routes.filter((route) => route.status === "loading").length;
  const healthMessages = [];
  if (warnings.length) healthMessages.push(`\u53d1\u73b0 ${warnings.length} \u9879\u884c\u7a0b\u63d0\u9192`);
  if (errorCount) healthMessages.push(`${errorCount} \u6bb5\u8def\u7ebf\u6682\u65f6\u65e0\u6cd5\u4f30\u7b97`);
  else if (loadingCount) healthMessages.push(`\u6b63\u5728\u4f30\u7b97 ${loadingCount} \u6bb5\u8def\u7ebf`);
  if (!healthMessages.length) healthMessages.push(`${plan.days.length} \u5929\u884c\u7a0b\u5df2\u4e0e\u5730\u56fe\u8def\u7ebf\u540c\u6b65`);
  tripHealth.hidden = false;
  tripHealth.className = `trip-health${errorCount || warnings.length ? " warning" : ""}`;
  tripHealth.textContent = `${healthMessages.join("\uff1b")}\u3002`;

  tripEditorRoot.innerHTML = renderTripEditorMarkup({
    plan,
    warnings,
    placeName: (placeId) => placeById(placeId)?.name || placeId
  });
  state.tripEditorDestroy = mountTripEditor({
    root: tripEditorRoot,
    onCommand: handleTripCommand,
    onEditRequest: openTripItemDialog
  });
}

function updateTotals() {
  const totals = routeTotals();
  const suffix = totals.hasLoading ? labels.loadingSuffix : totals.hasFallback ? labels.approxSuffix : "";

  totalDistance.textContent = totals.measuredSegmentCount ? `${formatDistance(totals.distanceMeters)}${suffix}` : labels.pending;
  totalDuration.textContent = totals.measuredSegmentCount ? `${formatDuration(totals.durationSeconds)}${suffix}` : labels.pending;
}

function routeTotals() {
  const measuredRoutes = state.routes.filter(hasMetrics);
  return {
    distanceMeters: measuredRoutes.reduce((sum, route) => sum + route.distance, 0),
    durationSeconds: measuredRoutes.reduce((sum, route) => sum + route.duration, 0),
    measuredSegmentCount: measuredRoutes.length,
    hasFallback: measuredRoutes.some((route) => route.fallback),
    hasLoading: state.routes.some((route) => route.status === "loading")
  };
}

function buildChainLabel() {
  if (!state.routes.length) return state.selectedCityId ? placeById(state.selectedCityId).name : labels.notStarted;

  const names = [placeById(state.routes[0].from).name];
  state.routes.forEach((route) => names.push(placeById(route.to).name));
  return names.join(" \u2192 ");
}

function routePlaces() {
  if (state.routes.length) {
    return [placeById(state.routes[0].from), ...state.routes.map((route) => placeById(route.to))].filter(Boolean);
  }
  return state.selectedCityId ? [placeById(state.selectedCityId)].filter(Boolean) : [];
}

function buildItineraryDays() {
  const places = routePlaces();
  const pace = tripPaceProfile();
  if (!places.length) return [];
  if (!state.routes.length) {
    const day = createItineraryDay(places[0]);
    finalizeItineraryDay(day, 1, pace);
    return [day];
  }

  const days = [];
  let day = createItineraryDay(placeById(state.routes[0].from));
  state.routes.forEach((route) => {
    const from = placeById(route.from);
    const to = placeById(route.to);
    if (!from || !to) return;
    const duration = routeDurationForPlanning(route);
    const shouldStartNewDay = day.routes.length
      && (day.travelSeconds + duration > pace.dailyTravelLimitSeconds || day.places.length >= pace.maxDailyPlaces);

    if (shouldStartNewDay) {
      finalizeItineraryDay(day, days.length + 1, pace);
      days.push(day);
      day = createItineraryDay(from);
    }

    day.routes.push(route);
    day.travelSeconds += duration;
    if (day.places[day.places.length - 1]?.id !== to.id) day.places.push(to);
  });

  finalizeItineraryDay(day, days.length + 1, pace);
  days.push(day);
  return days;
}

function createItineraryDay(startPlace) {
  return {
    index: 0,
    places: startPlace ? [startPlace] : [],
    routes: [],
    travelSeconds: 0,
    overnight: startPlace || null
  };
}

function finalizeItineraryDay(day, index, pace = tripPaceProfile()) {
  day.index = index;
  day.pace = pace;
  day.overnight = day.places[day.places.length - 1] || null;
  day.playSeconds = Math.max(0, pace.playWindowSeconds - day.travelSeconds);
  day.warnings = itineraryDayWarnings(day, pace);
}

function routeDurationForPlanning(route) {
  if (hasMetrics(route)) return route.duration;
  return 2 * 60 * 60;
}

function itineraryDayWarnings(day, pace = tripPaceProfile()) {
  const warnings = [];
  if (day.routes.some((route) => route.status === "loading")) {
    warnings.push("\u6709\u8def\u7ebf\u6b63\u5728\u8ba1\u7b97\uff0c\u5148\u628a\u5f53\u5929\u5f53\u4f5c\u8349\u6848\u3002");
  }
  if (day.routes.some((route) => route.fallback)) {
    warnings.push("\u5305\u542b\u964d\u7ea7\u4f30\u7b97\uff0c\u51fa\u53d1\u524d\u9700\u8981\u6838\u5bf9\u5b9e\u9645\u8f66\u6b21\u3002");
  }
  if (day.travelSeconds > pace.hardTravelLimitSeconds) {
    warnings.push(`\u8fd9\u5929\u8de8\u57ce\u8d85\u8fc7 ${formatDuration(pace.hardTravelLimitSeconds)}\uff0c\u5efa\u8bae\u62c6\u6210\u4e24\u5929\u3002`);
  } else if (day.travelSeconds > pace.dailyTravelLimitSeconds) {
    warnings.push(`\u8fd9\u5929\u8d85\u8fc7\u201c${pace.label}\u201d\u5f3a\u5ea6\u4e0a\u9650\uff0c\u5efa\u8bae\u53ea\u5b89\u6392 1-2 \u4e2a\u6838\u5fc3\u70b9\u3002`);
  }
  return warnings;
}

function renderItineraryPanel() {
  if (!itineraryList || !itineraryMeta || !itineraryEmptyState || !tripHealth) return;
  const days = buildItineraryDays();
  itineraryList.replaceChildren();
  itineraryEmptyState.hidden = days.length > 0;

  if (!days.length) {
    itineraryMeta.textContent = "\u5f85\u751f\u6210";
    tripHealth.hidden = true;
    return;
  }

  const pace = tripPaceProfile();
  itineraryMeta.textContent = `${days.length} \u5929 \u00b7 ${pace.label} \u00b7 \u65e5\u5747\u8de8\u57ce\u4e0a\u9650 ${formatDuration(pace.dailyTravelLimitSeconds)}`;
  const health = itineraryHealth(days);
  tripHealth.hidden = false;
  tripHealth.className = `trip-health${health.warning ? " warning" : ""}`;
  tripHealth.textContent = health.text;

  days.forEach((day) => {
    const item = document.createElement("li");
    item.className = "day-card";
    item.innerHTML = itineraryDayHtml(day);
    itineraryList.append(item);
  });
}

function itineraryHealth(days) {
  const warningDays = days.filter((day) => day.warnings.length);
  if (warningDays.length) {
    return {
      warning: true,
      text: `\u6709 ${warningDays.length} \u5929\u9700\u8981\u6838\u5bf9\u8282\u594f\uff1a${warningDays[0].warnings[0]}`
    };
  }
  if (days.length === 1 && !state.routes.length) {
    return {
      warning: false,
      text: "\u5df2\u9009\u8d77\u70b9\uff0c\u7ee7\u7eed\u9009\u57ce\u5e02\u540e\u4f1a\u81ea\u52a8\u62c6\u6210\u6bcf\u65e5\u884c\u7a0b\u3002"
    };
  }
  return {
    warning: false,
    text: `${tripPaceProfile().description}\u5efa\u8bae\u628a\u8f66\u7968\u65f6\u523b\u548c\u666f\u70b9\u5f00\u653e\u65f6\u95f4\u4f5c\u4e3a\u6700\u7ec8\u786e\u8ba4\u3002`
  };
}

function itineraryDayHtml(day) {
  const cityLine = day.places.map((place) => escapeHtml(place.name)).join(" \u2192 ");
  const overnight = day.overnight ? escapeHtml(day.overnight.name) : "\u5f85\u5b9a";
  const travelText = day.routes.length
    ? `${day.routes.length} \u6bb5\u8de8\u57ce \u00b7 ${formatDuration(day.travelSeconds)}`
    : "\u672c\u5730\u6e38\u73a9";
  const playText = day.playSeconds ? formatDuration(day.playSeconds) : "\u5f88\u5c11";
  return `
    <header>
      <p class="day-meta">\u7b2c ${day.index} \u5929 \u00b7 \u8fc7\u591c ${overnight}</p>
      <h3>${cityLine}</h3>
      <p>${escapeHtml(travelText)} \u00b7 \u9884\u7559 ${escapeHtml(playText)} \u6e38\u73a9\u548c\u7528\u9910</p>
    </header>
    <ol class="day-plan">
      ${dayPlanItems(day).map((item) => `<li><strong>${item.label}</strong> ${item.text}</li>`).join("")}
    </ol>
    <p class="day-note">${escapeHtml(day.warnings[0] || "\u53ef\u6309\u8f66\u6b21\u5b9e\u9645\u5230\u8fbe\u65f6\u95f4\u524d\u540e\u632a\u52a8\u4e0a\u5348\u548c\u4e0b\u5348\u5b89\u6392\uff0c\u665a\u4e0a\u4fdd\u7559\u5f39\u6027\u4f11\u606f\u3002")}</p>
  `;
}

function dayPlanItems(day) {
  const schedule = dayScheduleBlocks(day);
  return [
    { label: "\u4e0a\u5348", text: escapeHtml(schedule.morning) },
    { label: "\u4e0b\u5348", text: escapeHtml(schedule.afternoon) },
    { label: "\u665a\u4e0a", text: escapeHtml(schedule.evening) },
    { label: "\u4f4f\u5bbf", text: escapeHtml(dayLodgingText(day)) }
  ];
}

function dayScheduleBlocks(day) {
  return {
    morning: dayMorningText(day),
    afternoon: dayAfternoonText(day),
    evening: dayEveningText(day)
  };
}

function dayMorningText(day) {
  if (day.routes.length) {
    return `${dayTransportText(day)}\u3002\u5efa\u8bae\u4e0a\u5348\u5b8c\u6210\u9000\u623f\u3001\u53d6\u7968\u548c\u8de8\u57ce\u79fb\u52a8\uff0c\u62b5\u8fbe\u540e\u5148\u5b89\u6392\u884c\u674e\u5bc4\u5b58\u6216\u9152\u5e97\u5165\u4f4f\u3002`;
  }
  const target = day.overnight || day.places[0];
  const highlights = placeHighlightText(target, 2);
  return highlights
    ? `${target.name}\uff1a${highlights}\uff0c\u9002\u5408\u4ece\u9152\u5e97\u5468\u8fb9\u6216\u4ea4\u901a\u67a2\u7ebd\u9644\u8fd1\u5f00\u59cb\u3002`
    : `${target?.name || "\u672c\u5730"}\uff1a\u5148\u719f\u6089\u9152\u5e97\u5468\u8fb9\u3001\u8f66\u7ad9\u548c\u4e3b\u5546\u5708\uff0c\u518d\u8fdb\u5165\u57ce\u5e02\u89c6\u56fe\u7ec6\u5316\u3002`;
}

function dayAfternoonText(day) {
  const target = day.overnight || day.places[day.places.length - 1];
  const highlights = placeHighlightText(target, 3);
  if (highlights) return `${target.name}\uff1a\u628a\u4e3b\u8981\u6e38\u73a9\u65f6\u95f4\u7559\u7ed9 ${highlights}\u3002`;
  if (target) {
    return `${target.name}\uff1a\u62b5\u8fbe\u540e\u4f18\u5148\u5b89\u6392\u4e3b\u57ce\u533a\u3001\u8f66\u7ad9\u5468\u8fb9\u6216\u57ce\u5e02\u89c6\u56fe\u91cc\u7684\u5df2\u6807\u6ce8\u70b9\u3002`;
  }
  return dayHighlightText(day);
}

function dayEveningText(day) {
  const target = day.overnight || day.places[day.places.length - 1];
  const foods = placeFoodText(target, 5);
  if (foods) return `${target.name}\uff1a\u665a\u9910\u4f18\u5148\u5c1d\u8bd5 ${foods}\uff0c\u9910\u540e\u9009\u9152\u5e97\u6216\u8f66\u7ad9\u5468\u8fb9\u8f7b\u677e\u6d3b\u52a8\u3002`;
  return `${dayFoodText(day)}\u665a\u4e0a\u5efa\u8bae\u5c31\u8fd1\u7528\u9910\uff0c\u7ed9\u7b2c\u4e8c\u5929\u7559\u51fa\u4f11\u606f\u65f6\u95f4\u3002`;
}

function dayTransportText(day) {
  if (!day.routes.length) return "\u672c\u65e5\u4e0d\u8de8\u57ce\uff0c\u9002\u5408\u4ece\u9152\u5e97\u5468\u8fb9\u5f00\u59cb\u8f7b\u677e\u719f\u6089\u57ce\u5e02\u3002";
  return day.routes.map((route) => {
    const from = placeById(route.from);
    const to = placeById(route.to);
    const label = route.transportLabel || transportProfile(route.transportMode).label;
    const duration = hasMetrics(route) ? formatDuration(route.duration) : labels.pending;
    return `${from?.name || ""} \u2192 ${to?.name || ""}\uff0c${label}\u7ea6 ${duration}`;
  }).join("\uff1b");
}

function dayHighlightText(day) {
  const sections = dayRecommendationPlaces(day)
    .map((place) => {
      const highlights = cityHighlightsForPlace(place).slice(0, 2);
      if (highlights.length) return `${place.name}\uff1a${highlights.join("\u3001")}`;
      if (day.overnight && place.id === day.overnight.id) {
        return `${place.name}\uff1a\u62b5\u8fbe\u540e\u4f18\u5148\u5b89\u6392\u4e3b\u57ce\u533a\u3001\u8f66\u7ad9\u5468\u8fb9\u6216\u57ce\u5e02\u89c6\u56fe\u91cc\u7684\u5df2\u6807\u6ce8\u70b9`;
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 3);
  if (sections.length) return sections.join("\uff1b");
  const target = day.overnight || day.places[day.places.length - 1];
  return target
    ? `\u62b5\u8fbe ${target.name} \u540e\uff0c\u8fdb\u5165\u57ce\u5e02\u89c6\u56fe\u4ece\u666f\u70b9\u3001\u533a\u53bf\u6216\u8f66\u7ad9\u70b9\u4f4d\u4e2d\u7ee7\u7eed\u7ec6\u5316\u3002`
    : "\u8fdb\u5165\u57ce\u5e02\u89c6\u56fe\u540e\uff0c\u4ece\u666f\u70b9\u3001\u533a\u53bf\u6216\u8f66\u7ad9\u70b9\u4f4d\u4e2d\u7ee7\u7eed\u7ec6\u5316\u3002";
}

function cityHighlightsForPlace(place) {
  const city = cityForPlace(place);
  if (!city) return [];
  const landmarks = cityLandmarks(city).slice(0, 3).map((landmark) => landmark.name);
  if (landmarks.length) return landmarks;
  return citySubareas(city).slice(0, 3).map((area) => area.name);
}

function placeHighlightText(place, limit = 3) {
  const highlights = cityHighlightsForPlace(place).slice(0, limit);
  return highlights.join("\u3001");
}

function dayFoodText(day) {
  const sections = dayRecommendationPlaces(day)
    .map((place) => {
      const foods = uniqueByName(currentFoodSuggestionsFor(place)).slice(0, 4);
      return foods.length ? `${place.name}\uff1a${foods.join("\u3001")}` : "";
    })
    .filter(Boolean)
    .slice(0, 3);
  if (sections.length) return sections.join("\uff1b");
  return "\u6682\u65e0\u5df2\u5339\u914d\u98df\u884c\u8bb0\uff0c\u53ef\u5148\u5c06\u665a\u9910\u7559\u7ed9\u5f53\u5730\u5c0f\u5403\u8857\u6216\u8f66\u7ad9\u5468\u8fb9\u3002";
}

function currentFoodSuggestionsFor(place) {
  const city = cityForPlace(place);
  return foodController?.suggestionsForPlace(place, city) || [];
}

function placeFoodText(place, limit = 5) {
  return uniqueByName(currentFoodSuggestionsFor(place)).slice(0, limit).join("\u3001");
}

function dayLodgingText(day) {
  if (!day.overnight) return "\u6682\u672a\u9009\u5b9a\u8fc7\u591c\u57ce\u5e02\u3002";
  const city = cityForPlace(day.overnight);
  const station = city ? cityStations(city)[0] : null;
  if (station) {
    const stationLabel = station.name.startsWith(day.overnight.name) ? station.name : `${day.overnight.name}${station.name}`;
    return `\u5efa\u8bae\u4f4f\u5728${stationLabel}\u6216\u4e3b\u5546\u5708\u5468\u8fb9\uff0c\u65b9\u4fbf\u6b21\u65e5\u51fa\u53d1\u3002`;
  }
  return `\u5efa\u8bae\u4f4f\u5728${day.overnight.name}\u4e3b\u57ce\u533a\u6216\u4ea4\u901a\u67a2\u7ebd\u5468\u8fb9\uff0c\u65b9\u4fbf\u8854\u63a5\u6b21\u65e5\u8def\u7ebf\u3002`;
}

function dayRecommendationPlaces(day) {
  const places = [];
  if (day.overnight) places.push(day.overnight);
  day.places.forEach((place) => {
    if (place && !places.some((item) => item.id === place.id)) places.push(place);
  });
  return places;
}

function cityForPlace(place) {
  if (!place) return null;
  if (place.placeType === "county" && place.parentCityId) return cityById(place.parentCityId) || place;
  return cityById(place.id) || place;
}

function uniqueByName(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function hasSerializableTrip() {
  return Boolean(state.tripPlan);
}

function syncTripArchiveControls() {
  const hasPlan = hasSerializableTrip();
  const hasCalendar = Array.isArray(state.tripPlan?.days) && state.tripPlan.days.length > 0;
  if (saveTripBtn) saveTripBtn.disabled = !hasPlan;
  if (shareTripBtn) shareTripBtn.disabled = !hasPlan;
  if (exportMarkdownBtn) exportMarkdownBtn.disabled = !hasCalendar;
  if (exportHtmlBtn) exportHtmlBtn.disabled = !hasCalendar;
  if (exportTripFileBtn) {
    exportTripFileBtn.disabled = !canExportTripFile({
      plan: state.tripPlan,
      emergencyLegacyRaw: emergencyLegacyTripRaw
    });
  }
}

function rememberEmergencyLegacyTrip(raw) {
  if (!canExportTripFile({ emergencyLegacyRaw: raw })) return false;
  emergencyLegacyTripRaw = raw;
  syncTripArchiveControls();
  return true;
}

function clearEmergencyLegacyTrip() {
  emergencyLegacyTripRaw = null;
  syncTripArchiveControls();
}

function archiveFailureGuidance() {
  if (canExportTripFile({
    plan: state.tripPlan,
    emergencyLegacyRaw: emergencyLegacyTripRaw
  })) {
    return "请点击页面上的“导出行程”保存文件后重试。";
  }
  return "请保持页面打开，并在浏览器设置中检查本站点数据权限后重试。";
}

function replaceBrowserUrl(nextUrl) {
  window.history.replaceState(null, "", nextUrl);
}

function persistTripState(message = "\u5df2\u81ea\u52a8\u4fdd\u5b58\u5230\u672c\u673a\u3002") {
  if (!hasSerializableTrip()) {
    return clearPersistedTripState();
  }
  lastTripPersistenceResult = writeTripPlanV2({
    storage: tripArchiveStorage,
    plan: state.tripPlan,
    currentUrl: window.location.href,
    replaceUrl: replaceBrowserUrl
  });
  if (!lastTripPersistenceResult.stored) {
    updateArchiveStatus("本机存储失败，当前行程仍保留在本页；请立即点击页面上的“导出行程”保存文件备份。", "error");
    return false;
  }
  if (!lastTripPersistenceResult.hashCleared) {
    const savedMessage = String(message || "行程已保存").replace(/[。；\s]+$/g, "");
    updateArchiveStatus(`${savedMessage}；但地址栏中的旧分享快照未能清理，请导出行程文件并避免刷新后使用旧快照。`, "error");
    return true;
  }
  updateArchiveStatus(message, "success");
  return true;
}

function finalizeLegacyTripBackup(message) {
  if (!legacyTripBackupPending) return true;
  const savedMessage = String(message || "行程已保存").replace(/[。；\s]+$/g, "");
  const result = finalizeLegacyMigration({ storage: tripArchiveStorage });
  legacyTripBackupPending = !result.ok;
  if (!result.ok) {
    const hashWarning = lastTripPersistenceResult.hashCleared ? "" : "，且地址栏旧分享快照未能清理";
    updateArchiveStatus(`${savedMessage}；但旧版 v1 存档或迁移备份未完全清理${hashWarning}。`, "error");
    return false;
  }
  if (!lastTripPersistenceResult.hashCleared) {
    updateArchiveStatus(`${savedMessage}；旧版 v1 存档与迁移备份已清理，但地址栏旧分享快照未能清理。`, "error");
    return true;
  }
  updateArchiveStatus(`${savedMessage}；旧版 v1 存档与迁移备份已清理。`, "success");
  return true;
}

function clearPersistedTripState() {
  clearEmergencyLegacyTrip();
  const result = clearTripArchive({
    storage: tripArchiveStorage,
    currentUrl: window.location.href,
    replaceUrl: replaceBrowserUrl
  });
  legacyTripBackupPending = result.failedKeys.some((key) => (
    key === LEGACY_TRIP_STORAGE_KEY || key === LEGACY_TRIP_BACKUP_KEY
  ));
  if (result.ok) {
    updateArchiveStatus("行程已清空，v2、旧版与迁移备份均已移除。", "success");
    return true;
  }
  updateArchiveStatus("行程已清空，但部分本机存档或分享地址未能移除；请检查浏览器站点数据。", "error");
  return false;
}

function isTripStateRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function prepareTripMigration(data, { allowLegacy = false } = {}) {
  if (!isTripStateRecord(data)) throw new TypeError("行程文件格式无效");
  const hasVersion = Object.hasOwn(data, "version");
  const isLegacy = !hasVersion || data.version === 1;
  if (isLegacy && !allowLegacy) throw new TypeError("分享链接不是 v2 行程");

  if (!isLegacy) {
    if (data.version !== TRIP_PLAN_VERSION) throw new TypeError("不支持的行程版本");
    return {
      data,
      isLegacy: false,
      paceProfile: tripPaceProfile()
    };
  }

  if (!isLegacyTripPayload(data)) throw new TypeError("旧版行程格式无效");
  const legacyData = prepareLegacyRecoveryData(data);
  const pace = tripPaceProfiles[data.tripPace] ? data.tripPace : state.tripPace;
  return {
    data: legacyData,
    isLegacy: true,
    paceProfile: tripPaceProfile(pace)
  };
}

function assertTripPlanCanRender(plan, { isLegacy = false } = {}) {
  const placeIds = routePlaceIds(plan);
  const missingPlaceIds = placeIds.filter((placeId) => !placeById(placeId));
  if (missingPlaceIds.length) {
    throw new MissingTripPlacesError(missingPlaceIds);
    /* obsolete missing-place error
    throw new TypeError("行程包含当前地图无法识别的地点");
    */
  }
  if (isLegacy && !placeIds.length) {
    throw new TypeError("旧版行程没有可恢复的地点");
  }
  return plan;
}

function captureTripImportSnapshot() {
  return {
    tripPlan: state.tripPlan,
    tripHistory: state.tripHistory.slice(),
    transportMode: state.transportMode,
    tripPace: state.tripPace,
    routes: state.routes,
    selectedCityId: state.selectedCityId,
    nextRouteId: state.nextRouteId,
    archiveSnapshot: captureTripArchiveSnapshot({ storage: tripArchiveStorage }),
    legacyTripBackupPending,
    lastTripPersistenceResult,
    emergencyLegacyTripRaw
  };
}

function rollbackTripImportSnapshot(snapshot, {
  restorePlan = false,
  restoreV2 = false,
  restoreBackup = false
} = {}) {
  let restored = true;
  legacyTripBackupPending = snapshot.legacyTripBackupPending;
  lastTripPersistenceResult = snapshot.lastTripPersistenceResult;
  emergencyLegacyTripRaw = snapshot.emergencyLegacyTripRaw;
  const keys = [
    ...(restoreV2 ? [TRIP_STORAGE_KEY] : []),
    ...(restoreBackup ? [LEGACY_TRIP_BACKUP_KEY] : [])
  ];
  if (keys.length) {
    const storageResult = restoreTripArchiveSnapshot({
      storage: tripArchiveStorage,
      snapshot: snapshot.archiveSnapshot,
      keys
    });
    restored = storageResult.ok && restored;
  }
  if (restorePlan) {
    state.tripPlan = snapshot.tripPlan;
    state.tripHistory = snapshot.tripHistory.slice();
    state.transportMode = snapshot.transportMode;
    state.tripPace = snapshot.tripPace;
    state.routes = snapshot.routes;
    state.selectedCityId = snapshot.selectedCityId;
    state.nextRouteId = snapshot.nextRouteId;
    try {
      syncTransportButtons();
      syncPaceButtons();
      mapController?.renderRoutes();
      renderPanel();
    } catch (error) {
      restored = false;
    }
  }
  syncTripArchiveControls();
  return restored;
}

function restoredTripMessage(source, failures) {
  const fallback = failures.size ? `${[...failures].join("、")}不可用；` : "";
  if (source === "hash") return `${fallback}已从分享链接恢复 v2 行程并保存到本机。`;
  if (source === "legacy") {
    return `${fallback}已迁移旧版行程并保存为 v2；原始备份会在第一次有效编辑保存后清理。`;
  }
  return `${fallback}已从本机 v2 存档恢复行程。`;
}

function restoreTripState() {
  const failures = new Set();
  try {
    legacyTripBackupPending = legacyMigrationPending({ storage: tripArchiveStorage });
  } catch (error) {
    legacyTripBackupPending = false;
    failures.add("旧版迁移状态读取失败");
  }
  let candidates = readTripRecoveryCandidates({
    storage: tripArchiveStorage,
    currentUrl: window.location.href
  });

  const recovery = selectTripRecoveryCandidate(candidates, (candidate) => {
    const data = JSON.parse(candidate.raw);
    const prepared = prepareTripMigration(data, { allowLegacy: candidate.allowLegacy });
    if (candidate.requireLegacy && !prepared.isLegacy) {
      throw new TypeError("Legacy recovery storage does not contain a v1 trip");
    }
    const migrated = migrateTripState(prepared.data, { paceProfile: prepared.paceProfile });
    const plan = normalizeTripPlan(migrated);
    assertTripPlanCanRender(plan, { isLegacy: prepared.isLegacy });
    return { prepared, plan };
  });

  recovery.failures.forEach(({ candidate }) => {
    failures.add(candidate.error ? `${candidate.label} read failed` : `${candidate.label} invalid`);
  });
  if (recovery.status === "deferred") {
    updateArchiveStatus("Saved trip recovery is waiting for optional place data.", "pending");
    return {
      status: "deferred",
      source: recovery.candidate.source,
      missingPlaceIds: recovery.error.missingPlaceIds
    };
  }
  if (recovery.status === "ready") {
    candidates = [{ ...recovery.candidate, recovered: recovery.value }];
  } else {
    candidates = [];
  }

  for (const candidate of candidates) {
    if (candidate.error) {
      failures.add(`${candidate.label}读取失败`);
      continue;
    }

    const previousPending = legacyTripBackupPending;
    let legacyArchiveSnapshot = null;
    let backupTouched = false;
    let commitAttempted = false;
    try {
      const { prepared, plan } = candidate.recovered;
      if (candidate.requireLegacy && !prepared.isLegacy) {
        throw new TypeError("旧版存档键中不是 v1 行程");
      }
      if (prepared.isLegacy) {
        try {
          legacyArchiveSnapshot = captureTripArchiveSnapshot({
            storage: tripArchiveStorage,
            keys: [LEGACY_TRIP_BACKUP_KEY]
          });
        } catch (error) {
          failures.add("旧版存档备份状态读取失败，未执行迁移");
          rememberEmergencyLegacyTrip(candidate.raw);
          continue;
        }
        const backupResult = backupLegacyTripRaw({
          storage: tripArchiveStorage,
          raw: candidate.raw
        });
        if (!backupResult.ok) {
          failures.add("旧版存档备份失败，未执行迁移");
          rememberEmergencyLegacyTrip(candidate.raw);
          continue;
        }
        backupTouched = true;
        legacyTripBackupPending = true;
      }
      commitAttempted = true;
      const committed = commitTripPlan(plan, {
        recordHistory: false,
        completeLegacyMigration: false,
        message: restoredTripMessage(candidate.source, failures)
      });
      clearEmergencyLegacyTrip();
      return {
        status: committed ? "restored" : "restored-with-persistence-error",
        source: candidate.source
      };
    } catch (error) {
      if (backupTouched && !commitAttempted) {
        const rollback = restoreTripArchiveSnapshot({
          storage: tripArchiveStorage,
          snapshot: legacyArchiveSnapshot,
          keys: [LEGACY_TRIP_BACKUP_KEY]
        });
        if (rollback.ok) {
          legacyTripBackupPending = previousPending;
        } else {
          legacyTripBackupPending = true;
          rememberEmergencyLegacyTrip(candidate.raw);
          failures.add("旧版存档备份回滚失败");
        }
      }
      failures.add(`${candidate.label}格式无效`);
    }
  }

  if (failures.size) {
    const backupFailure = [...failures].some((failure) => failure.includes("备份"));
    const storageFailure = [...failures].some((failure) => failure.includes("读取失败"));
    const guidance = canExportTripFile({ emergencyLegacyRaw: emergencyLegacyTripRaw })
      ? "请点击页面上的“导出行程”保存原始 v1 文件后重试。"
      : storageFailure
        ? "请保持页面打开，并在浏览器设置中检查本站点数据权限后重试。"
        : "";
    updateArchiveStatus(
      `${[...failures].join("、")}。当前行程未更改。${backupFailure || storageFailure ? guidance : ""}`,
      "error"
    );
  } else {
    updateArchiveStatus("行程会自动保存到本机。");
  }
  return { status: "unavailable" };
}

function downloadTripFile(plan) {
  const filename = tripFileName(plan, new Date());
  downloadTextFile(tripFileText(plan), filename, "application/json;charset=utf-8");
  return filename;
}

function exportTripFile() {
  const exportPayload = tripFileExportPayload({
    plan: state.tripPlan,
    emergencyLegacyRaw: emergencyLegacyTripRaw,
    timestamp: new Date()
  });
  if (!exportPayload) {
    updateArchiveStatus("当前没有可导出的行程。", "error");
    syncTripArchiveControls();
    return;
  }
  try {
    downloadTextFile(exportPayload.text, exportPayload.filename, "application/json;charset=utf-8");
    if (exportPayload.kind === "legacy-emergency") {
      clearEmergencyLegacyTrip();
      updateArchiveStatus(`已导出旧版应急行程文件 ${exportPayload.filename}；可用“导入行程”重新导入。`, "success");
    } else {
      updateArchiveStatus(`已导出行程文件 ${exportPayload.filename}。`, "success");
    }
  } catch (error) {
    updateArchiveStatus("行程文件导出失败，当前行程仍保留在本页，请重试。", "error");
  }
}

async function copyShareLink() {
  if (!hasSerializableTrip()) return;
  const persisted = persistTripState("已保存，正在准备分享。");
  const hashCleared = persisted && lastTripPersistenceResult.hashCleared;
  const shareUrl = shareUrlForTrip(state.tripPlan, window.location.href);
  if (shouldUseTripFile(shareUrl)) {
    try {
      const filename = downloadTripFile(state.tripPlan);
      if (!persisted) {
        updateArchiveStatus(`本机存储失败，但当前行程仍保留并已导出 ${filename}。`, "error");
      } else if (!hashCleared) {
        updateArchiveStatus(`分享内容较大，已导出 ${filename}；但地址栏旧分享快照未能清理。`, "error");
      } else {
        updateArchiveStatus(`分享内容较大，已导出 ${filename}，请发送该行程文件。`, "success");
      }
    } catch (error) {
      updateArchiveStatus("行程文件导出失败，当前行程仍保留在本页，请重试。", "error");
    }
    return;
  }

  let copied = false;
  try {
    await navigator.clipboard.writeText(shareUrl);
    copied = true;
  } catch (error) {
    copied = false;
  }

  if (copied) {
    if (!persisted) {
      updateArchiveStatus("分享链接已复制，但本机存储失败；请另行导出行程文件备份。", "error");
    } else if (!hashCleared) {
      updateArchiveStatus("分享链接已复制且 v2 已保存，但地址栏旧分享快照未能清理。", "error");
    } else {
      updateArchiveStatus("分享链接已复制，同行者打开后可恢复完整行程。", "success");
    }
    return;
  }

  let addressUpdated = false;
  try {
    replaceBrowserUrl(shareUrl);
    addressUpdated = true;
  } catch (error) {
    addressUpdated = false;
  }

  if (addressUpdated) {
    if (!persisted) {
      updateArchiveStatus("本机存储和剪贴板均不可用，短链接已放到地址栏；请导出行程文件备份。", "error");
    } else {
      updateArchiveStatus("剪贴板不可用，已将短链接放到地址栏。", "success");
    }
  } else {
    updateArchiveStatus("分享链接复制失败，当前行程未受影响；请导出行程文件备份。", "error");
  }
}

async function importTripFile(event) {
  const input = event.currentTarget;
  const file = input?.files?.[0];
  let snapshot = null;
  let backupTouched = false;
  let commitAttempted = false;
  let failureReason = "invalid";
  let rawText = null;
  try {
    if (!file) return;
    rawText = await file.text();
    const data = JSON.parse(rawText);
    const prepared = prepareTripMigration(data, { allowLegacy: true });
    const migrated = migrateTripState(prepared.data, { paceProfile: prepared.paceProfile });
    const plan = normalizeTripPlan(migrated);
    assertTripPlanCanRender(plan, { isLegacy: prepared.isLegacy });
    if (prepared.isLegacy) {
      try {
        snapshot = captureTripImportSnapshot();
      } catch (error) {
        failureReason = "backup";
        rememberEmergencyLegacyTrip(rawText);
        throw error;
      }
      const backupResult = backupLegacyTripRaw({
        storage: tripArchiveStorage,
        raw: rawText
      });
      if (!backupResult.ok) {
        failureReason = "backup";
        rememberEmergencyLegacyTrip(rawText);
        throw new Error("legacy trip backup failed");
      }
      backupTouched = true;
      legacyTripBackupPending = true;
    }

    if (!snapshot) {
      try {
        snapshot = captureTripImportSnapshot();
      } catch (error) {
        failureReason = "storage";
        throw error;
      }
    }

    commitAttempted = true;
    failureReason = "commit";
    const committed = commitTripPlan(plan, {
      completeLegacyMigration: false,
      message: prepared.isLegacy
        ? "旧版行程文件已迁移并保存为 v2；原始备份会在下一次有效编辑保存后清理。"
        : "v2 行程文件已导入并保存到本机。"
    });
    if (!committed) {
      throw new Error("trip import commit failed");
    }
    clearEmergencyLegacyTrip();
  } catch (error) {
    let rollbackSucceeded = true;
    if (snapshot) {
      legacyTripBackupPending = snapshot.legacyTripBackupPending;
      if (backupTouched || commitAttempted) {
        rollbackSucceeded = rollbackTripImportSnapshot(snapshot, {
          restorePlan: commitAttempted,
          restoreV2: commitAttempted,
          restoreBackup: backupTouched
        });
      }
    }

    if (!rollbackSucceeded) {
      updateArchiveStatus(`行程导入失败，且无法完全恢复导入前状态；${archiveFailureGuidance()}`, "error");
    } else if (failureReason === "backup") {
      updateArchiveStatus("旧版行程原文备份失败，未执行导入；当前行程、历史和 v2 存档均未更改。请点击页面上的“导出行程”保存刚选择的 v1 文件，并检查本机存储。", "error");
    } else if (failureReason === "storage") {
      updateArchiveStatus(`本机存储不可用，无法安全导入；当前行程和历史未更改。${archiveFailureGuidance()}`, "error");
    } else if (failureReason === "commit") {
      updateArchiveStatus(`行程文件保存失败，已恢复导入前的行程、历史和存档；${archiveFailureGuidance()}`, "error");
    } else {
      updateArchiveStatus("行程文件无效或无法读取，当前行程、编辑历史和本机存档均未更改。", "error");
    }
  } finally {
    if (input) input.value = "";
  }
}

function updateArchiveStatus(message, tone = "") {
  if (!tripArchiveStatus) return;
  tripArchiveStatus.textContent = message;
  tripArchiveStatus.className = `archive-status${tone ? ` ${tone}` : ""}`;
}

function placeContext(place) {
  if (!place) return "";
  if (place.placeType === "county") return `${place.parentCityName || place.province} / ${place.name}`;
  return place.province || "";
}

function statusLabel(route) {
  if (route.status === "success") return `${route.transportLabel || transportProfile().label} ${labels.success}`;
  if (route.status === "error") return route.error || labels.fallback;
  return labels.loading;
}

function routeMeta(route, index) {
  const prefix = labels.segment(index);
  if (route.status === "loading") return `${prefix} · ${labels.calculating}`;
  if (!hasMetrics(route)) return `${prefix} · ${labels.pending}`;

  const marker = route.transportLabel || transportProfile().label;
  return `${prefix} · ${marker} ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`;
}

function hasMetrics(route) {
  return typeof route.distance === "number" && typeof route.duration === "number";
}

function formatDistance(meters) {
  if (meters >= 100000) return `${Math.round(meters / 1000).toLocaleString("zh-CN")} km`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} ${labels.minute}`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes ? `${hours} ${labels.hour} ${restMinutes} ${labels.minute}` : `${hours} ${labels.hour}`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} ${labels.day} ${restHours} ${labels.hour}` : `${days} ${labels.day}`;
}

function cityById(id) {
  return state.cityById.get(id);
}

function placeById(id) {
  return state.placeById.get(id) || cityById(id);
}

function queuePlaceClick(placeId) {
  if (state.pendingCityClickTimer) window.clearTimeout(state.pendingCityClickTimer);
  state.pendingCityClickTimer = window.setTimeout(() => {
    state.pendingCityClickTimer = null;
    loadTripControllerModule()
      .then(() => handlePlaceClick(placeId))
      .catch((error) => console.error("trip controller unavailable", error));
  }, CITY_CLICK_DELAY_MS);
}

function queueCityClick(cityId) {
  queuePlaceClick(cityId);
}

function cancelQueuedCityClick() {
  if (!state.pendingCityClickTimer) return;
  window.clearTimeout(state.pendingCityClickTimer);
  state.pendingCityClickTimer = null;
}


async function enterCityView(cityId) {
  try {
    const controller = await loadCityDetailController();
    controller.enter(cityId).catch(reportCityDetailModuleFailure);
    return true;
  } catch (error) {
    reportCityDetailModuleFailure(error);
    return false;
  }
}

function exitCityView(options = {}) {
  if (cityDetailController) return cityDetailController.exit(options);
  return mapController?.enterChinaView(options);
}

async function loadCityDetail(city, detailSession) {
  try {
    const controller = await loadCityDetailController();
    return await controller.load(city, detailSession);
  } catch (error) {
    reportCityDetailModuleFailure(error);
    return false;
  }
}

function citySubareas(city) {
  if (cityDetailController) return cityDetailController.subareas(city);
  const direct = state.counties.filter((county) => county.parentCityId === city?.id && hasCoordinates(county));
  if (direct.length) return direct;
  if (city?.isRegion) return state.cities.filter((item) => item.province === city.province && item.id !== city.id);
  return [];
}

function cityLandmarks(city) {
  if (cityDetailController) return cityDetailController.landmarks(city);
  queueCityDetailModuleRefresh();
  return [];
}

function cityDetailCounts(city) {
  if (cityDetailController) return cityDetailController.counts(city);
  queueCityDetailModuleRefresh();
  return {
    subareas: citySubareas(city).length,
    landmarks: state.activeLandmarkCount || 0,
    stations: state.activeStationCount,
    subwayStations: state.activeSubwayStationCount,
    foodArticles: foodArticleCountForCity(city?.id)
  };
}

async function ensureCityCounties(cityId, options = {}) {
  try {
    const controller = await loadCityDetailController();
    return await controller.ensureCounties(cityId, options);
  } catch (error) {
    reportCityDetailModuleFailure(error);
    return citySubareas(cityById(cityId));
  }
}

function hasCoordinates(place) {
  return Number.isFinite(Number(place && place.lon)) && Number.isFinite(Number(place && place.lat));
}

function transportProfile(mode = state.transportMode) {
  return transportProfiles[mode] || transportProfiles.highspeed;
}

function tripPaceProfile(mode = state.tripPace) {
  return tripPaceProfiles[mode] || tripPaceProfiles.standard;
}

function setTransportMode(mode) {
  if (!transportProfiles[mode] || state.transportMode === mode) return;
  if (state.tripPlan) {
    const result = applyTripCommand(state.tripPlan, {
      type: "update-metadata",
      patch: { transportMode: mode }
    });
    if (result.changed) {
      commitTripPlan(result.plan, {
        message: "\u5df2\u66f4\u65b0\u4ea4\u901a\u65b9\u5f0f\u5e76\u4fdd\u5b58\u3002"
      });
    }
    return;
  }
  state.transportMode = mode;
  syncTransportButtons();
  mapController?.recalculateRoutesForTransport();
  mapController?.renderRoutes();
  renderPanel();
  updateArchiveStatus("\u4ea4\u901a\u65b9\u5f0f\u5df2\u66f4\u65b0\uff0c\u9009\u62e9\u57ce\u5e02\u540e\u4f1a\u81ea\u52a8\u4fdd\u5b58\u3002");
}

function setTripPace(pace) {
  if (!tripPaceProfiles[pace] || state.tripPace === pace) return;
  state.tripPace = pace;
  syncPaceButtons();
  if (state.tripPlan) {
    const nextPlan = structuredClone(state.tripPlan);
    nextPlan.pace = pace;
    nextPlan.savedAt = new Date().toISOString();
    commitTripPlan(nextPlan, {
      message: "\u5df2\u66f4\u65b0\u884c\u7a0b\u5f3a\u5ea6\u5e76\u4fdd\u5b58\u3002"
    });
    return;
  }
  renderPanel();
  updateArchiveStatus("\u884c\u7a0b\u5f3a\u5ea6\u5df2\u66f4\u65b0\uff0c\u9009\u62e9\u57ce\u5e02\u540e\u4f1a\u81ea\u52a8\u4fdd\u5b58\u3002");
}

function syncTransportButtons() {
  transportButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.transportMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
}

function syncPaceButtons() {
  paceButtons.forEach((button) => {
    const isActive = button.dataset.pace === state.tripPace;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
}

function handlePlaceClick(placeId) {
  const place = placeById(placeId);
  if (!place) return;

  if (!state.tripPlan) {
    const requestedName = tripNameInput?.value.trim();
    const plan = createTripPlan({
      placeIds: [placeId],
      ...(requestedName ? { name: requestedName } : {}),
      startDate: tripStartDateInput?.value || null,
      pace: state.tripPace,
      transportMode: state.transportMode
    });
    commitTripPlan(plan, { recordHistory: false });
    return;
  }

  const currentPlaceIds = routePlaceIds(state.tripPlan);
  if (currentPlaceIds.at(-1) === placeId) {
    state.selectedCityId = placeId;
    renderPanel();
    return;
  }

  const result = reconcileRoutePlaces(state.tripPlan, [...currentPlaceIds, placeId]);
  commitTripPlan(result.plan);
}

function handleCityClick(cityId) {
  handlePlaceClick(cityId);
}

function undoRoute() {
  if (!state.tripPlan) return;
  const placeIds = routePlaceIds(state.tripPlan);
  if (placeIds.length < 2) return;
  const result = reconcileRoutePlaces(state.tripPlan, placeIds.slice(0, -1));
  if (result.blockedRemovals.length) {
    updateArchiveStatus("\u672b\u5c3e\u5730\u70b9\u5305\u542b\u5df2\u7f16\u8f91\u5b89\u6392\uff0c\u6682\u672a\u64a4\u9500\u3002", "error");
    return;
  }
  commitTripPlan(result.plan, { message: "\u5df2\u64a4\u9500\u5e76\u4fdd\u5b58\u3002" });
}

function clearRoutes() {
  state.tripHistory = [];
  commitTripPlan(null, { recordHistory: false });
}

async function buildCurrentGuideModel() {
  const { buildGuideModel } = await loadGuideModule();
  const plan = state.tripPlan;
  if (!Array.isArray(plan?.days) || !plan.days.length) {
    throw new TypeError("\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u65e5\u5386\u884c\u7a0b");
  }

  const referencedPlaceIds = new Set();
  const addPlaceId = (placeId) => {
    if (typeof placeId === "string" && placeId) referencedPlaceIds.add(placeId);
  };
  plan.days.forEach((day) => {
    (Array.isArray(day?.cityEntries) ? day.cityEntries : []).forEach((entry) => addPlaceId(entry?.placeId));
    addPlaceId(day?.overnightPlaceId);
    (Array.isArray(day?.items) ? day.items : []).forEach((item) => {
      addPlaceId(item?.placeId);
      addPlaceId(item?.fromPlaceId);
      addPlaceId(item?.toPlaceId);
    });
    addPlaceId(day?.lodging?.placeId);
  });

  const placeSnapshots = new Map();
  referencedPlaceIds.forEach((placeId) => {
    const snapshot = placeSnapshot(placeById(placeId));
    if (snapshot) placeSnapshots.set(placeId, snapshot);
  });

  const routeSegments = state.routes.map((route) => {
    const segment = {
      fromPlaceId: route.from,
      toPlaceId: route.to,
      transportLabel: route.transportLabel || transportProfile(route.transportMode).label,
      fallback: Boolean(route.fallback),
      status: route.status === "success"
        ? "ready"
        : route.status === "loading"
          ? "\u8ba1\u7b97\u4e2d"
          : route.status === "error"
            ? "\u65e0\u6cd5\u4f30\u7b97"
            : route.status || labels.pending,
      error: route.error || null
    };
    if (hasMetrics(route)) {
      segment.distanceMeters = route.distance;
      segment.durationSeconds = route.duration;
    } else {
      segment.distanceText = labels.pending;
      segment.durationText = labels.pending;
    }
    return segment;
  });
  const routeSummary = routeTotals();
  const totals = {
    distanceText: routeSummary.measuredSegmentCount
      ? formatDistance(routeSummary.distanceMeters)
      : labels.pending,
    durationText: routeSummary.measuredSegmentCount
      ? formatDuration(routeSummary.durationSeconds)
      : labels.pending,
    segmentCount: state.routes.length,
    dayCount: plan.days.length
  };

  return buildGuideModel({
    plan: state.tripPlan,
    placeSnapshots: placeSnapshots,
    warnings: validateTripPlan(plan, { paceProfile: tripPaceProfile(plan.pace) }),
    routeSegments: routeSegments,
    totals: totals
  });
}

function guideFileName(plan, extension) {
  return `${safeTripNameForFile(plan?.name)}-${timestampForFile()}.${extension}`;
}

async function exportMarkdownGuide() {
  if (!Array.isArray(state.tripPlan?.days) || !state.tripPlan.days.length) {
    updateArchiveStatus("\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u65e5\u5386\u884c\u7a0b\u3002", "error");
    return;
  }
  try {
    await ensureFoodModuleForTrip();
    const { buildMarkdownGuide } = await loadGuideModule();
    const plan = state.tripPlan;
    const model = await buildCurrentGuideModel();
    const markdown = buildMarkdownGuide(model);
    const filename = guideFileName(plan, "md");
    downloadTextFile(markdown, filename, "text/markdown;charset=utf-8");
    updateArchiveStatus(`Markdown \u65c5\u884c\u6307\u5357\u5df2\u5bfc\u51fa\uff1a${filename}`, "success");
  } catch (error) {
    console.error("Markdown guide export failed", error);
    updateArchiveStatus("Markdown \u65c5\u884c\u6307\u5357\u5bfc\u51fa\u5931\u8d25\uff0c\u5f53\u524d\u884c\u7a0b\u672a\u66f4\u6539\u3002", "error");
  }
}

async function exportPrintableHtmlGuide() {
  if (!Array.isArray(state.tripPlan?.days) || !state.tripPlan.days.length) {
    updateArchiveStatus("\u5f53\u524d\u6ca1\u6709\u53ef\u5bfc\u51fa\u7684\u65e5\u5386\u884c\u7a0b\u3002", "error");
    return;
  }
  try {
    await ensureFoodModuleForTrip();
    const { buildPrintableHtml } = await loadGuideModule();
    const plan = state.tripPlan;
    const model = await buildCurrentGuideModel();
    const html = buildPrintableHtml(model);
    const filename = guideFileName(plan, "html");
    downloadTextFile(html, filename, "text/html;charset=utf-8");
    updateArchiveStatus(`\u6253\u5370\u7248 HTML \u65c5\u884c\u6307\u5357\u5df2\u5bfc\u51fa\uff1a${filename}`, "success");
  } catch (error) {
    console.error("Printable HTML guide export failed", error);
    updateArchiveStatus("\u6253\u5370\u7248 HTML \u65c5\u884c\u6307\u5357\u5bfc\u51fa\u5931\u8d25\uff0c\u5f53\u524d\u884c\u7a0b\u672a\u66f4\u6539\u3002", "error");
  }
}

function downloadTextFile(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function placeSnapshot(place) {
  if (!place) return null;
  return {
    id: place.id,
    name: place.name,
    province: place.province,
    pinyin: place.pinyin,
    lon: place.lon,
    lat: place.lat,
    placeType: place.placeType || "city",
    parentCityId: place.parentCityId || null,
    parentCityName: place.parentCityName || null
  };
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function applyDeferredReadiness(status) {
  document.documentElement.dataset.appReady = status.readiness;
  if (status.missingDatasets.length) {
    document.documentElement.dataset.missingDatasets = status.missingDatasets.join(",");
  } else {
    delete document.documentElement.dataset.missingDatasets;
  }
  delete document.documentElement.dataset.deferredError;
}

function applyDeferredInternalFailure(error) {
  state.deferredInternalError = true;
  document.documentElement.dataset.appReady = "degraded";
  document.documentElement.dataset.deferredError = "internal";
  if (state.missingOptionalDatasets.length) {
    document.documentElement.dataset.missingDatasets = state.missingOptionalDatasets.join(",");
  }
  renderOperationalWarnings();
  console.warn("deferred summaries unavailable", error);
}

async function initApp() {
  try {
    selectionTitle.textContent = "\u6b63\u5728\u542f\u52a8 Leaflet Canvas";
    selectionHint.textContent = "\u6b63\u5728\u8bfb\u53d6\u672c\u5730 GeoJSON \u548c\u57ce\u5e02\u5750\u6807\u6570\u636e...";
    const tripModuleLoading = loadTripControllerModule();
    await loadMapData();
    mapController = createMapController({
      L: window.L,
      state,
      elements: {
        mapTarget: "travelMap",
        appShell,
        mobileViewButtons,
        exitCityViewBtn
      },
      callbacks: {
        queueCityClick,
        queuePlaceClick,
        enterCityView,
        cancelQueuedCityClick,
        renderPanel,
        routeMetricsUpdated: () => {
          renderPanel();
          persistTripState();
        }
      },
      helpers: {
        normalizeKey,
        escapeHtml,
        articleCountForCity: foodArticleCountForCity,
        cityById,
        placeById,
        hasCoordinates,
        transportProfile: (mode) => ({
          ...transportProfile(mode),
          mode: transportProfiles[mode] ? mode : "highspeed"
        })
      }
    });
    mapController.init();
    document.documentElement.dataset.appReady = "map";
    await tripModuleLoading;
    const initialRecovery = restoreTripState();
    shouldRetryTripRestoreAfterCountyHydration = initialRecovery.status === "deferred";
    mapController.setMobileView("plan");
    mapController.renderRoutes();
    renderPanel();
    queueFoodPanelRender();
    scheduleIdle(() => {
      loadCityDetailController().catch(reportCityDetailModuleFailure);
      hydrateDeferredSummaries()
        .then((status) => applyDeferredReadiness(status))
        .catch((error) => applyDeferredInternalFailure(error));
    });
  } catch (error) {
    console.error(error);
    selectionTitle.textContent = "\u5730\u56fe\u6e32\u67d3\u542f\u52a8\u5931\u8d25";
    selectionHint.textContent = error.message;
    cityCount.textContent = "0";
    availableCityCount.textContent = "0";
  }
}

undoBtn.addEventListener("click", () => queueTripAction(() => undoRoute()));
clearBtn.addEventListener("click", () => queueTripAction(() => clearRoutes()));
resetViewBtn.addEventListener("click", resetMapView);
if (saveTripBtn) saveTripBtn.addEventListener("click", () => queueTripAction(() => persistTripState("\u5df2\u624b\u52a8\u4fdd\u5b58\u5230\u672c\u673a\u3002")));
if (shareTripBtn) shareTripBtn.addEventListener("click", () => queueTripAction(() => copyShareLink()));
if (tripImportBtn && tripImportInput) {
  tripImportBtn.addEventListener("click", () => tripImportInput.click());
}
if (tripImportInput) tripImportInput.addEventListener("change", (event) => queueTripAction(() => importTripFile(event)));
if (exportTripFileBtn) exportTripFileBtn.addEventListener("click", () => queueTripAction(() => exportTripFile()));
if (exportMarkdownBtn) exportMarkdownBtn.addEventListener("click", () => queueTripAction(() => exportMarkdownGuide()));
if (exportHtmlBtn) exportHtmlBtn.addEventListener("click", () => queueTripAction(() => exportPrintableHtmlGuide()));
exitCityViewBtn.addEventListener("click", () => exitCityView());
transportButtons.forEach((button) => button.addEventListener("click", () => queueTripAction(() => setTransportMode(button.dataset.mode))));
paceButtons.forEach((button) => button.addEventListener("click", () => queueTripAction(() => setTripPace(button.dataset.pace))));
mobileViewButtons.forEach((button) => button.addEventListener("click", () => mapController?.setMobileView(button.dataset.mobileView)));
if (tripNameInput) tripNameInput.addEventListener("change", () => queueTripAction(() => updateTripNameMetadata()));
if (tripStartDateInput) tripStartDateInput.addEventListener("change", () => queueTripAction(() => updateTripStartDateMetadata()));
if (autoScheduleBtn) autoScheduleBtn.addEventListener("click", () => queueTripAction(() => autoScheduleCurrentTrip()));
if (undoTripEditBtn) undoTripEditBtn.addEventListener("click", () => queueTripAction(() => undoTripEdit()));
if (tripItemForm) tripItemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  queueTripAction(() => submitTripItemForm(event));
});
if (tripItemCancelBtn) tripItemCancelBtn.addEventListener("click", () => queueTripAction(() => closeTripItemDialog()));
if (tripItemPlaceId) {
  tripItemPlaceId.addEventListener("change", () => {
    queueTripAction(() => {
      if (tripFormControl("type")?.value === "activity") renderTripLandmarkOptions(tripItemPlaceId.value);
    });
  });
}
citySearch.addEventListener("input", updateSearchResults);
citySearch.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !state.searchResults.length) return;
  event.preventDefault();
  selectSearchResult(state.searchResults[0]);
});
clearSearchBtn.addEventListener("click", () => {
  citySearch.value = "";
  updateSearchResults();
  citySearch.focus();
});

initApp();
