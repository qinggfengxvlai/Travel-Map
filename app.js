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

const CITY_CLICK_DELAY_MS = 180;

const landmarkCatalog = {
  beijing: [
    { name: "\u6545\u5bab\u535a\u7269\u9662", type: "building", lon: 116.397, lat: 39.917 },
    { name: "\u5929\u5b89\u95e8\u5e7f\u573a", type: "building", lon: 116.397, lat: 39.905 },
    { name: "\u9890\u548c\u56ed", type: "scenic", lon: 116.273, lat: 39.999 }
  ],
  shanghai: [
    { name: "\u5916\u6ee9", type: "scenic", lon: 121.49, lat: 31.24 },
    { name: "\u4e1c\u65b9\u660e\u73e0", type: "building", lon: 121.499, lat: 31.24 },
    { name: "\u4e0a\u6d77\u535a\u7269\u9986", type: "building", lon: 121.476, lat: 31.229 }
  ],
  guangzhou: [
    { name: "\u5e7f\u5dde\u5854", type: "building", lon: 113.324, lat: 23.106 },
    { name: "\u9648\u5bb6\u7960", type: "building", lon: 113.257, lat: 23.129 },
    { name: "\u8d8a\u79c0\u516c\u56ed", type: "scenic", lon: 113.269, lat: 23.142 }
  ],
  shenzhen: [
    { name: "\u5e73\u5b89\u91d1\u878d\u4e2d\u5fc3", type: "building", lon: 114.05, lat: 22.537 },
    { name: "\u4e16\u754c\u4e4b\u7a97", type: "scenic", lon: 113.973, lat: 22.539 },
    { name: "\u83b2\u82b1\u5c71\u516c\u56ed", type: "scenic", lon: 114.064, lat: 22.555 }
  ],
  chengdu: [
    { name: "\u6b66\u4faf\u7960", type: "building", lon: 104.047, lat: 30.642 },
    { name: "\u5bbd\u7a84\u5df7\u5b50", type: "scenic", lon: 104.057, lat: 30.669 },
    { name: "\u5927\u718a\u732b\u57fa\u5730", type: "scenic", lon: 104.145, lat: 30.735 }
  ],
  xian: [
    { name: "\u897f\u5b89\u57ce\u5899", type: "building", lon: 108.943, lat: 34.262 },
    { name: "\u5927\u96c1\u5854", type: "building", lon: 108.964, lat: 34.219 },
    { name: "\u949f\u697c", type: "building", lon: 108.94, lat: 34.261 }
  ],
  wuhan: [
    { name: "\u9ec4\u9e64\u697c", type: "building", lon: 114.306, lat: 30.545 },
    { name: "\u4e1c\u6e56", type: "scenic", lon: 114.386, lat: 30.558 },
    { name: "\u6c49\u53e3\u6c5f\u6ee9", type: "scenic", lon: 114.303, lat: 30.596 }
  ],
  hangzhou: [
    { name: "\u897f\u6e56", type: "scenic", lon: 120.143, lat: 30.244 },
    { name: "\u7075\u9690\u5bfa", type: "building", lon: 120.101, lat: 30.24 },
    { name: "\u94b1\u5858\u6c5f", type: "scenic", lon: 120.205, lat: 30.205 }
  ],
  nanjing: [
    { name: "\u592b\u5b50\u5e99", type: "building", lon: 118.789, lat: 32.021 },
    { name: "\u4e2d\u5c71\u9675", type: "scenic", lon: 118.849, lat: 32.06 },
    { name: "\u5357\u4eac\u603b\u7edf\u5e9c", type: "building", lon: 118.796, lat: 32.045 }
  ],
  chongqing: [
    { name: "\u6d2a\u5d16\u6d1e", type: "building", lon: 106.584, lat: 29.563 },
    { name: "\u89e3\u653e\u7891", type: "building", lon: 106.577, lat: 29.558 },
    { name: "\u78c1\u5668\u53e3", type: "scenic", lon: 106.45, lat: 29.582 }
  ],
  xiamen: [
    { name: "\u9f13\u6d6a\u5c7f", type: "scenic", lon: 118.066, lat: 24.447 },
    { name: "\u5357\u666e\u9640\u5bfa", type: "building", lon: 118.099, lat: 24.445 },
    { name: "\u53a6\u95e8\u5927\u5b66", type: "building", lon: 118.096, lat: 24.438 }
  ],
  suzhou: [
    { name: "\u62d9\u653f\u56ed", type: "scenic", lon: 120.629, lat: 31.324 },
    { name: "\u864e\u4e18", type: "scenic", lon: 120.576, lat: 31.339 },
    { name: "\u5e73\u6c5f\u8def", type: "scenic", lon: 120.631, lat: 31.313 }
  ],
  ningbo: [
    { name: "\u5929\u4e00\u9601", type: "museum", lon: 121.54, lat: 29.873 },
    { name: "\u4e1c\u94b1\u6e56", type: "scenic", lon: 121.629, lat: 29.785 },
    { name: "\u5b81\u6ce2\u8001\u5916\u6ee9", type: "historic", lon: 121.56, lat: 29.886 }
  ],
  qingdao: [
    { name: "\u6808\u6865", type: "scenic", lon: 120.319, lat: 36.061 },
    { name: "\u516b\u5927\u5173", type: "historic", lon: 120.353, lat: 36.054 },
    { name: "\u9752\u5c9b\u5564\u9152\u535a\u7269\u9986", type: "museum", lon: 120.357, lat: 36.08 }
  ],
  tianjin: [
    { name: "\u4e94\u5927\u9053", type: "historic", lon: 117.201, lat: 39.117 },
    { name: "\u5929\u6d25\u4e4b\u773c", type: "scenic", lon: 117.197, lat: 39.153 },
    { name: "\u53e4\u6587\u5316\u8857", type: "historic", lon: 117.199, lat: 39.142 }
  ]
};

const landmarkCatalogExtensions = {
  anqing: [
    { name: "天柱山风景区", type: "scenic5a", lon: 116.459, lat: 30.734 },
    { name: "五千年文博园", type: "scenic4a", lon: 116.302, lat: 30.435 },
    { name: "巨石山景区", type: "scenic4a", lon: 117.021, lat: 30.477 },
    { name: "明堂山风景区", type: "scenic4a", lon: 116.201, lat: 30.947 },
    { name: "大别山彩虹瀑布", type: "scenic4a", lon: 116.154, lat: 30.941 },
    { name: "孔城老街", type: "scenic4a", lon: 116.95, lat: 31.036 },
    { name: "安庆博物馆", type: "museum", lon: 117.05, lat: 30.532 }
  ],
  jiaxing: [
    { name: "乌镇景区", type: "scenic5a", lon: 120.49, lat: 30.746 },
    { name: "西塘古镇", type: "scenic5a", lon: 120.89, lat: 30.947 },
    { name: "南湖旅游区", type: "scenic5a", lon: 120.764, lat: 30.754 },
    { name: "海盐南北湖景区", type: "scenic4a", lon: 120.882, lat: 30.389 },
    { name: "嘉兴博物馆", type: "museum", lon: 120.757, lat: 30.743 }
  ],
  ningbo: [
    { name: "天一阁·月湖景区", type: "scenic5a", lon: 121.54, lat: 29.873 },
    { name: "溪口-滕头旅游景区", type: "scenic5a", lon: 121.276, lat: 29.689 },
    { name: "东钱湖旅游度假区", type: "scenic4a", lon: 121.629, lat: 29.785 },
    { name: "宁波博物馆", type: "museum", lon: 121.544, lat: 29.817 }
  ],
  hangzhou: [
    { name: "西湖风景名胜区", type: "scenic5a", lon: 120.143, lat: 30.244 },
    { name: "西溪湿地旅游区", type: "scenic5a", lon: 120.063, lat: 30.269 },
    { name: "良渚古城遗址公园", type: "scenic4a", lon: 119.983, lat: 30.395 },
    { name: "中国丝绸博物馆", type: "museum", lon: 120.145, lat: 30.222 },
    { name: "浙江省博物馆", type: "museum", lon: 120.147, lat: 30.255 }
  ],
  beijing: [
    { name: "故宫博物院", type: "scenic5a", lon: 116.397, lat: 39.917 },
    { name: "天坛公园", type: "scenic5a", lon: 116.411, lat: 39.882 },
    { name: "颐和园", type: "scenic5a", lon: 116.273, lat: 39.999 },
    { name: "中国国家博物馆", type: "museum", lon: 116.401, lat: 39.905 }
  ],
  shanghai: [
    { name: "东方明珠广播电视塔", type: "scenic5a", lon: 121.499, lat: 31.24 },
    { name: "上海科技馆", type: "scenic5a", lon: 121.541, lat: 31.218 },
    { name: "上海博物馆", type: "museum", lon: 121.476, lat: 31.229 }
  ],
  suzhou: [
    { name: "苏州园林", type: "scenic5a", lon: 120.629, lat: 31.324 },
    { name: "周庄古镇", type: "scenic5a", lon: 120.844, lat: 31.117 },
    { name: "同里古镇", type: "scenic5a", lon: 120.716, lat: 31.159 },
    { name: "苏州博物馆", type: "museum", lon: 120.627, lat: 31.323 }
  ],
  nanjing: [
    { name: "钟山风景名胜区", type: "scenic5a", lon: 118.849, lat: 32.06 },
    { name: "夫子庙-秦淮风光带", type: "scenic5a", lon: 118.789, lat: 32.021 },
    { name: "南京博物院", type: "museum", lon: 118.83, lat: 32.04 }
  ],
  qingdao: [
    { name: "崂山风景名胜区", type: "scenic5a", lon: 120.638, lat: 36.191 },
    { name: "青岛啤酒博物馆", type: "scenic4a", lon: 120.357, lat: 36.08 },
    { name: "青岛市博物馆", type: "museum", lon: 120.475, lat: 36.108 }
  ]
};

const municipalities = new Set(["北京", "上海", "天津", "重庆"]);
const stationCatalog = {
  beijing: [
    { name: "\u5317\u4eac\u7ad9", lon: 116.427, lat: 39.902 },
    { name: "\u5317\u4eac\u897f\u7ad9", lon: 116.321, lat: 39.895 },
    { name: "\u5317\u4eac\u5357\u7ad9", lon: 116.379, lat: 39.865 }
  ],
  shanghai: [
    { name: "\u4e0a\u6d77\u7ad9", lon: 121.455, lat: 31.249 },
    { name: "\u4e0a\u6d77\u8679\u6865\u7ad9", lon: 121.321, lat: 31.194 },
    { name: "\u4e0a\u6d77\u5357\u7ad9", lon: 121.43, lat: 31.154 }
  ],
  guangzhou: [
    { name: "\u5e7f\u5dde\u7ad9", lon: 113.264, lat: 23.149 },
    { name: "\u5e7f\u5dde\u5357\u7ad9", lon: 113.269, lat: 22.989 },
    { name: "\u5e7f\u5dde\u4e1c\u7ad9", lon: 113.324, lat: 23.151 }
  ],
  shenzhen: [
    { name: "\u6df1\u5733\u7ad9", lon: 114.117, lat: 22.532 },
    { name: "\u6df1\u5733\u5317\u7ad9", lon: 114.029, lat: 22.61 },
    { name: "\u798f\u7530\u7ad9", lon: 114.055, lat: 22.543 }
  ],
  chengdu: [
    { name: "\u6210\u90fd\u4e1c\u7ad9", lon: 104.142, lat: 30.63 },
    { name: "\u6210\u90fd\u5357\u7ad9", lon: 104.068, lat: 30.606 },
    { name: "\u6210\u90fd\u897f\u7ad9", lon: 103.989, lat: 30.682 }
  ],
  xian: [
    { name: "\u897f\u5b89\u7ad9", lon: 108.964, lat: 34.278 },
    { name: "\u897f\u5b89\u5317\u7ad9", lon: 108.945, lat: 34.382 }
  ],
  wuhan: [
    { name: "\u6b66\u6c49\u7ad9", lon: 114.425, lat: 30.607 },
    { name: "\u6c49\u53e3\u7ad9", lon: 114.255, lat: 30.618 },
    { name: "\u6b66\u660c\u7ad9", lon: 114.317, lat: 30.529 }
  ],
  hangzhou: [
    { name: "\u676d\u5dde\u4e1c\u7ad9", lon: 120.219, lat: 30.291 },
    { name: "\u676d\u5dde\u7ad9", lon: 120.178, lat: 30.245 },
    { name: "\u676d\u5dde\u897f\u7ad9", lon: 119.999, lat: 30.297 }
  ],
  nanjing: [
    { name: "\u5357\u4eac\u7ad9", lon: 118.803, lat: 32.088 },
    { name: "\u5357\u4eac\u5357\u7ad9", lon: 118.797, lat: 31.97 },
    { name: "\u4ed9\u6797\u7ad9", lon: 118.914, lat: 32.105 }
  ],
  chongqing: [
    { name: "\u91cd\u5e86\u5317\u7ad9", lon: 106.55, lat: 29.612 },
    { name: "\u91cd\u5e86\u897f\u7ad9", lon: 106.44, lat: 29.5 },
    { name: "\u6c99\u576a\u575d\u7ad9", lon: 106.46, lat: 29.556 }
  ],
  xiamen: [
    { name: "\u53a6\u95e8\u7ad9", lon: 118.116, lat: 24.468 },
    { name: "\u53a6\u95e8\u5317\u7ad9", lon: 118.075, lat: 24.642 },
    { name: "\u53a6\u95e8\u9ad8\u5d0e\u7ad9", lon: 118.115, lat: 24.543 }
  ],
  suzhou: [
    { name: "\u82cf\u5dde\u7ad9", lon: 120.606, lat: 31.33 },
    { name: "\u82cf\u5dde\u5317\u7ad9", lon: 120.645, lat: 31.428 },
    { name: "\u82cf\u5dde\u56ed\u533a\u7ad9", lon: 120.706, lat: 31.342 }
  ],
  ningbo: [
    { name: "\u5b81\u6ce2\u7ad9", lon: 121.543, lat: 29.862 },
    { name: "\u5b81\u6ce2\u4e1c\u7ad9", lon: 121.589, lat: 29.86 },
    { name: "\u5e84\u6865\u7ad9", lon: 121.548, lat: 29.942 },
    { name: "\u4f59\u59da\u7ad9", lon: 121.154, lat: 30.046 },
    { name: "\u4f59\u59da\u5317\u7ad9", lon: 121.155, lat: 30.079 },
    { name: "\u5949\u5316\u7ad9", lon: 121.406, lat: 29.655 },
    { name: "\u5b81\u6d77\u7ad9", lon: 121.421, lat: 29.287 }
  ],
  qingdao: [
    { name: "\u9752\u5c9b\u7ad9", lon: 120.312, lat: 36.063 },
    { name: "\u9752\u5c9b\u5317\u7ad9", lon: 120.374, lat: 36.169 },
    { name: "\u9752\u5c9b\u897f\u7ad9", lon: 119.997, lat: 35.875 }
  ],
  tianjin: [
    { name: "\u5929\u6d25\u7ad9", lon: 117.21, lat: 39.134 },
    { name: "\u5929\u6d25\u897f\u7ad9", lon: 117.169, lat: 39.164 },
    { name: "\u5929\u6d25\u5357\u7ad9", lon: 117.063, lat: 39.057 }
  ]
};

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
const provinceCodeNames = {
  11: "\u5317\u4eac",
  12: "\u5929\u6d25",
  13: "\u6cb3\u5317",
  14: "\u5c71\u897f",
  15: "\u5185\u8499\u53e4",
  21: "\u8fbd\u5b81",
  22: "\u5409\u6797",
  23: "\u9ed1\u9f99\u6c5f",
  31: "\u4e0a\u6d77",
  32: "\u6c5f\u82cf",
  33: "\u6d59\u6c5f",
  34: "\u5b89\u5fbd",
  35: "\u798f\u5efa",
  36: "\u6c5f\u897f",
  37: "\u5c71\u4e1c",
  41: "\u6cb3\u5357",
  42: "\u6e56\u5317",
  43: "\u6e56\u5357",
  44: "\u5e7f\u4e1c",
  45: "\u5e7f\u897f",
  46: "\u6d77\u5357",
  50: "\u91cd\u5e86",
  51: "\u56db\u5ddd",
  52: "\u8d35\u5dde",
  53: "\u4e91\u5357",
  54: "\u897f\u85cf",
  61: "\u9655\u897f",
  62: "\u7518\u8083",
  63: "\u9752\u6d77",
  64: "\u5b81\u590f",
  65: "\u65b0\u7586",
  71: "\u53f0\u6e7e",
  81: "\u9999\u6e2f",
  82: "\u6fb3\u95e8"
};

const state = {
  selectedCityId: null,
  transportMode: "highspeed",
  viewMode: "china",
  activeCityViewId: null,
  activeDistrictBoundaryCount: 0,
  activeLandmarkCount: 0,
  activeStationCount: 0,
  pendingCityClickTimer: null,
  routes: [],
  nextRouteId: 1,
  map: null,
  canvasRenderer: null,
  chinaLayer: null,
  cityLayer: null,
  labelLayer: null,
  routeLayer: null,
  cityDetailLayer: null,
  cityById: new Map(),
  placeById: new Map(),
  cityByKey: new Map(),
  cityByProvinceKey: new Map(),
  cityKeyEntries: [],
  cityFeatureLayers: new Map(),
  cityAdcodes: new Map(),
  cityBoundaryCache: new Map(),
  stationCache: new Map(),
  landmarkCache: new Map(),
  passengerStationNames: null,
  passengerStationNamesPromise: null,
  searchResults: [],
  featureCityIds: new WeakMap(),
  cities: [],
  counties: [],
  hiddenMunicipalityChildren: [],
  mapData: null
};

const selectionTitle = document.querySelector("#selectionTitle");
const selectionHint = document.querySelector("#selectionHint");
const routeList = document.querySelector("#routeList");
const emptyState = document.querySelector("#emptyState");
const undoBtn = document.querySelector("#undoBtn");
const clearBtn = document.querySelector("#clearBtn");
const resetViewBtn = document.querySelector("#resetViewBtn");
const exportBtn = document.querySelector("#exportBtn");
const citySearch = document.querySelector("#citySearch");
const clearSearchBtn = document.querySelector("#clearSearchBtn");
const searchResults = document.querySelector("#searchResults");
const cityCount = document.querySelector("#cityCount");
const routeCount = document.querySelector("#routeCount");
const totalDistance = document.querySelector("#totalDistance");
const totalDuration = document.querySelector("#totalDuration");
const chainLabel = document.querySelector("#chainLabel");
const availableCityCount = document.querySelector("#availableCityCount");
const transportButtons = Array.from(document.querySelectorAll("[data-mode]"));
const exitCityViewBtn = document.querySelector("#exitCityViewBtn");
const mapBadgeLabel = document.querySelector(".map-badge span");

async function loadJson(path) {
  const response = await fetch(`${path}?v=landmark-poi-4`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

async function loadMapData() {
  const [mapData, cityData, countyData] = await Promise.all([
    loadJson("./data/china-prefectures.json"),
    loadJson("./data/china-cities.json"),
    loadJson("./data/china-counties.json")
  ]);

  const cities = cityData && cityData.cities ? cityData.cities : [];
  if (!mapData || !Array.isArray(mapData.features)) throw new Error("china-prefectures data is empty");
  if (!cities.length) throw new Error("china-cities data is empty");

  const displayCities = cities
    .filter((city) => !municipalityNames.has(city.province) || city.name === city.province)
    .map((city) => ({
      ...city,
      ...(municipalityCoordinates[city.name] || {})
    }));
  displayCities.push({ ...taiwanRegion });

  state.hiddenMunicipalityChildren = cities.filter((city) => municipalityNames.has(city.province) && city.name !== city.province);
  state.mapData = mapData;
  state.cities = displayCities.map((city) => ({
    ...city,
    searchText: normalizeSearchText(`${city.name} ${city.province} ${city.pinyin}`)
  }));
  state.counties = [
    ...(countyData && countyData.counties ? countyData.counties : []),
    ...buildMunicipalityCountyEntries(state.hiddenMunicipalityChildren, state.cities)
  ].map((county) => ({
      ...county,
      placeType: "county",
      searchText: normalizeSearchText(`${county.name} ${county.province} ${county.pinyin} ${county.parentCityName} ${county.parentCityPinyin}`),
      searchType: "county"
    }));
  state.cityById = new Map(state.cities.map((city) => [city.id, city]));
  state.placeById = buildPlaceMap(state.cities, state.counties);
  state.cityByKey = buildCityKeyMap(state.cities, state.hiddenMunicipalityChildren);
  state.cityByProvinceKey = buildCityProvinceKeyMap(state.cities, state.hiddenMunicipalityChildren);
  state.cityKeyEntries = Array.from(state.cityByKey.entries()).sort((a, b) => b[0].length - a[0].length);
}

function buildMunicipalityCountyEntries(children, displayCities) {
  const municipalityByName = new Map(displayCities.filter((city) => municipalityNames.has(city.name)).map((city) => [city.name, city]));
  return children.flatMap((child) => {
    const parent = municipalityByName.get(child.province);
    if (!parent) return [];
    return [{
      id: `${parent.id}-${child.pinyin}`,
      name: child.name,
      pinyin: child.pinyin,
      code: child.code || "",
      lon: child.lon,
      lat: child.lat,
      province: child.province,
      parentCityId: parent.id,
      parentCityName: parent.name,
      parentCityPinyin: parent.pinyin
    }];
  });
}

function buildPlaceMap(cities, counties) {
  const map = new Map();
  cities.forEach((city) => map.set(city.id, { ...city, placeType: "city" }));
  counties.forEach((county) => map.set(county.id, { ...county, placeType: "county" }));
  return map;
}

function initMap() {
  if (!window.L) throw new Error("Leaflet renderer did not load");

  state.canvasRenderer = L.canvas({ padding: 0.65, tolerance: 8 });
  state.map = L.map("travelMap", {
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
  state.routeLayer = L.layerGroup().addTo(state.map);
  state.cityLayer = L.layerGroup().addTo(state.map);
  state.labelLayer = L.layerGroup([], { pane: "cityLabels" }).addTo(state.map);
  state.cityDetailLayer = L.layerGroup().addTo(state.map);

  renderChinaLayer();
  renderCities();
  fitChina();
  updateVisibleLabels();
  state.map.on("moveend zoomend", updateVisibleLabels);
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
        click: () => queueCityClick(city.id),
        dblclick: (event) => {
          if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
          enterCityView(city.id);
        },
        mouseover: () => layer.setStyle({ fillOpacity: 0.98, weight: 1.45, color: "#78916c" }),
        mouseout: () => layer.setStyle(featureStyle(feature))
      });
    }
  }).addTo(state.map);
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/meng$/g, "")
    .replace(/diqu$/g, "")
    .replace(/zhou$/g, "");
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function buildCityKeyMap(cities, municipalityChildren = []) {
  const aliases = new Map([
    ["enshi", "enshi"],
    ["linzhi", "linzhi"],
    ["luliang", "lvliang"],
    ["lvliang", "lvliang"],
    ["kezilesukeerkezi", "kezhou"]
  ]);
  const map = new Map();
  cities.forEach((city) => {
    const key = normalizeKey(city.pinyin);
    map.set(key, city);
    map.set(normalizeKey(city.name), city);
  });
  municipalityChildren.forEach((child) => {
    const parent = cities.find((city) => city.name === child.province);
    if (!parent) return;
    map.set(normalizeKey(child.pinyin), parent);
    map.set(normalizeKey(child.name), parent);
  });
  aliases.forEach((cityKey, featureKey) => {
    const city = map.get(normalizeKey(cityKey));
    if (city) map.set(normalizeKey(featureKey), city);
  });
  return map;
}

function buildCityProvinceKeyMap(cities, municipalityChildren = []) {
  const map = new Map();
  const setCity = (city, province, keyValue) => {
    const key = normalizeKey(keyValue);
    if (!province || !key) return;
    map.set(`${province}|${key}`, city);
  };

  cities.forEach((city) => {
    setCity(city, city.province, city.pinyin);
    setCity(city, city.province, city.name);
  });

  municipalityChildren.forEach((child) => {
    const parent = cities.find((city) => city.name === child.province);
    if (!parent) return;
    setCity(parent, child.province, child.pinyin);
    setCity(parent, child.province, child.name);
  });

  return map;
}

function matchFeatureToCity(feature) {
  if (feature && feature.properties && String(feature.properties.id || "") === "710000") return cityById("taiwan-region");

  const featureName = feature && feature.properties ? feature.properties.name : "";
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
    if (foundInProvince) return foundInProvince[1];

    return null;
  }

  if (state.cityByKey.has(featureKey)) return state.cityByKey.get(featureKey);

  const found = state.cityKeyEntries.find(([cityKey]) => cityKey.length >= 3 && (featureKey.startsWith(cityKey) || cityKey.startsWith(featureKey)));
  return found ? found[1] : null;
}

function provinceNameFromFeature(feature) {
  const id = feature && feature.properties ? String(feature.properties.id || "") : "";
  return provinceCodeNames[id.slice(0, 2)] || "";
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
    marker.on("click", () => queueCityClick(city.id));
    marker.on("dblclick", (event) => {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      enterCityView(city.id);
    });
    marker.addTo(state.cityLayer);
    city.marker = marker;
  });
}

function cityStyle(cityId) {
  const visited = new Set(state.routes.flatMap((route) => [route.from, route.to]));
  const isSelected = cityId === state.selectedCityId;
  const isVisited = visited.has(cityId);
  return {
    radius: isSelected ? 7 : isVisited ? 5 : 3.4,
    color: isSelected ? "#e84d3d" : isVisited ? "#168f7d" : "#fffaf0",
    weight: isSelected ? 2.5 : 1.25,
    fillColor: isSelected ? "#ffe7bd" : isVisited ? "#168f7d" : "#e84d3d",
    fillOpacity: isSelected ? 1 : 0.92,
    opacity: 1
  };
}

function updateCityStyles() {
  state.cities.forEach((city) => {
    if (city.marker) city.marker.setStyle(cityStyle(city.id));
  });
  if (state.chinaLayer) state.chinaLayer.setStyle(featureStyle);
  updateVisibleLabels();
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
    button.className = "search-result";
    button.type = "button";
    button.setAttribute("role", "option");
    button.innerHTML = searchResultHtml(item);
    button.addEventListener("click", () => selectSearchResult(item));
    searchResults.append(button);
  });
}

function searchResultHtml(item) {
  if (item.searchType === "county") {
    return `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.parentCityName)} · ${escapeHtml(item.province)} / ${escapeHtml(item.pinyin)}</span>`;
  }

  return `<strong>${escapeHtml(item.name)}</strong><span>\u5e02\u7ea7\u884c\u653f\u533a · ${escapeHtml(item.province)} / ${escapeHtml(item.pinyin)}</span>`;
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
  const targetCityId = item.searchType === "county" ? item.parentCityId : item.id;
  const targetCity = cityById(targetCityId);
  if (!targetCity) return;

  if (item.searchType === "county") {
    if (state.viewMode !== "city" || state.activeCityViewId !== targetCity.id) {
      await enterCityView(targetCity.id);
    }
    state.map.flyTo([item.lat, item.lon], Math.max(state.map.getZoom(), 10), { duration: 0.45 });
    handlePlaceClick(item.id);
  } else {
    if (state.viewMode === "city") exitCityView({ fit: false });
    state.map.flyTo([item.lat, item.lon], Math.max(state.map.getZoom(), 10), { duration: 0.45 });
    handlePlaceClick(targetCity.id);
  }
  citySearch.value = "";
  updateSearchResults();
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

    const marker = L.marker([city.lat, city.lon], {
      pane: "cityLabels",
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "city-name-marker",
        html: `<span style="font-size:${fontSize}px">${escapeHtml(city.name)}</span>`,
        iconSize: null,
        iconAnchor: [0, 0]
      })
    });
    marker.addTo(state.labelLayer);
  });
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

function landmarkPopupHtml(landmark, city) {
  const typeLabel = landmarkTypeLabel(landmark.type);
  const description = landmarkDescription(landmark, city);
  const address = landmark.address ? `<p class="landmark-popup-address">${escapeHtml(landmark.address)}</p>` : "";
  const sourceLabel = landmark.source === "openstreetmap" ? "\u5f00\u653e\u5730\u56fe\u6570\u636e" : "\u7cbe\u9009\u666f\u70b9";
  const website = safeExternalUrl(landmark.website);
  const websiteLink = website
    ? `<a class="landmark-popup-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">\u67e5\u770b\u5b98\u65b9\u6216\u8be6\u60c5\u9875</a>`
    : "";

  return `
    <article class="landmark-popup">
      <p class="landmark-popup-kicker">${escapeHtml(city.name)} · ${escapeHtml(typeLabel)}</p>
      <h3>${escapeHtml(landmark.name)}</h3>
      <p>${escapeHtml(description)}</p>
      ${address}
      <div class="landmark-popup-meta">
        <span>${escapeHtml(sourceLabel)}</span>
        <span>${Number(landmark.lat).toFixed(3)}, ${Number(landmark.lon).toFixed(3)}</span>
      </div>
      ${websiteLink}
    </article>
  `;
}

function landmarkDescription(landmark, city) {
  const existing = cleanLandmarkText(landmark.description);
  if (existing) return existing;

  const name = landmark.name;
  const cityName = city.name;
  const type = landmark.type || "scenic";
  if (type === "scenic5a") {
    return `${name}\u662f${cityName}\u7684\u56fd\u5bb65A\u7ea7\u65c5\u6e38\u666f\u533a\uff0c\u9002\u5408\u4f5c\u4e3a\u57ce\u5e02\u884c\u7a0b\u4e2d\u7684\u91cd\u70b9\u6e38\u89c8\u70b9\u3002`;
  }
  if (type === "scenic4a") {
    return `${name}\u662f${cityName}\u7684\u56fd\u5bb64A\u7ea7\u65c5\u6e38\u666f\u533a\uff0c\u5177\u6709\u8f83\u9ad8\u7684\u89c2\u5149\u548c\u4f11\u95f2\u4ef7\u503c\u3002`;
  }
  if (type === "museum") {
    return `${name}\u662f${cityName}\u503c\u5f97\u505c\u7559\u7684\u535a\u7269\u9986\u6216\u5c55\u89c8\u7c7b\u573a\u9986\uff0c\u9002\u5408\u4e86\u89e3\u5f53\u5730\u5386\u53f2\u3001\u6587\u5316\u4e0e\u57ce\u5e02\u8bb0\u5fc6\u3002`;
  }
  if (type === "historic") {
    return `${name}\u662f${cityName}\u7684\u5386\u53f2\u6587\u5316\u666f\u70b9\uff0c\u9002\u5408\u7eb3\u5165\u6df1\u5ea6\u6e38\u89c8\u6216\u57ce\u5e02\u6f2b\u6b65\u8def\u7ebf\u3002`;
  }
  if (type === "building") {
    return `${name}\u662f${cityName}\u7684\u53ef\u6e38\u89c8\u5730\u6807\uff0c\u9002\u5408\u62cd\u7167\u3001\u6253\u5361\u6216\u4f5c\u4e3a\u884c\u7a0b\u8def\u7ebf\u53c2\u7167\u70b9\u3002`;
  }
  if (type === "park") {
    return `${name}\u662f${cityName}\u7684\u516c\u56ed\u6216\u4f11\u95f2\u533a\uff0c\u9002\u5408\u5b89\u6392\u8f7b\u677e\u7684\u6e38\u89c8\u548c\u77ed\u9014\u505c\u7559\u3002`;
  }
  return `${name}\u662f${cityName}\u7684\u7ecf\u5178\u65c5\u6e38\u666f\u70b9\uff0c\u53ef\u4f5c\u4e3a\u5f53\u5730\u89c2\u5149\u3001\u62cd\u7167\u548c\u8def\u7ebf\u89c4\u5212\u7684\u5019\u9009\u70b9\u3002`;
}

function cleanLandmarkText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^Q\d+$/i.test(text)) return "";
  return text.length > 140 ? `${text.slice(0, 138)}...` : text;
}

function safeExternalUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function fitChina() {
  if (!state.chinaLayer) return;
  state.map.fitBounds(state.chinaLayer.getBounds(), {
    paddingTopLeft: [28, 28],
    paddingBottomRight: [28, 28],
    animate: false
  });
}

async function resetMapView() {
  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    if (activeCity) {
      await renderCityDetail(activeCity);
      renderPanel();
    }
    return;
  }
  fitChina();
}

function renderRoutes() {
  state.routeLayer.clearLayers();

  state.routes.forEach((route) => {
    const from = placeById(route.from);
    const to = placeById(route.to);
    if (!from || !to) return;

    L.polyline([[from.lat, from.lon], [to.lat, to.lon]], {
      renderer: state.canvasRenderer,
      color: route.status === "error" ? "#d75b4f" : "#1f9d8a",
      weight: 12,
      opacity: 0.14,
      interactive: false
    }).addTo(state.routeLayer);

    L.polyline([[from.lat, from.lon], [to.lat, to.lon]], {
      renderer: state.canvasRenderer,
      color: route.status === "error" ? "#d75b4f" : route.status === "loading" ? "#e7aa38" : "#168f7d",
      weight: 4,
      opacity: 0.92,
      dashArray: route.status === "success" ? "12 8" : route.status === "error" ? "4 10" : "6 10",
      lineCap: "round",
      interactive: false
    }).addTo(state.routeLayer);
  });
}

function renderPanel() {
  const selected = placeById(state.selectedCityId);
  syncTransportButtons();

  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    const detailCounts = activeCity ? cityDetailCounts(activeCity) : { subareas: 0, landmarks: 0, stations: 0 };
    const subareaText = state.activeDistrictBoundaryCount
      ? `${state.activeDistrictBoundaryCount} \u4e2a\u4e0b\u8f96\u533a\u57df\u8fb9\u754c`
      : `${detailCounts.subareas} \u4e2a\u533a\u53bf\u70b9`;
    selectionTitle.textContent = activeCity ? `\u57ce\u5e02\u89c6\u56fe\uff1a${activeCity.name}` : "\u57ce\u5e02\u89c6\u56fe";
    selectionHint.textContent = activeCity
      ? `\u5df2\u9690\u85cf\u4e2d\u56fd\u603b\u56fe\uff0c\u6b63\u5728\u663e\u793a ${subareaText}\u3001${detailCounts.landmarks} \u4e2a\u5730\u6807/\u666f\u70b9\u4e0e ${state.activeStationCount} \u4e2a\u706b\u8f66\u7ad9\uff0c\u533a\u53bf\u8fb9\u754c\u53ef\u70b9\u51fb\u7eb3\u5165\u884c\u7a0b\u3002`
      : "\u53cc\u51fb\u57ce\u5e02\u53ef\u8fdb\u5165\u72ec\u7acb\u57ce\u5e02\u89c6\u56fe\u3002";
  } else if (selected) {
    selectionTitle.textContent = labels.fromCity(selected.name);
    selectionHint.textContent = `${placeContext(selected)} · ${labels.nextHint}`;
  } else {
    selectionTitle.textContent = labels.chooseStart;
    selectionHint.textContent = labels.chooseHint;
  }

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
  exportBtn.disabled = state.routes.length === 0;
  cityCount.textContent = String(state.cities.length);
  if (state.viewMode === "city") {
    const activeCity = cityById(state.activeCityViewId);
    const detailCounts = activeCity ? cityDetailCounts(activeCity) : { subareas: 0, landmarks: 0, stations: 0 };
    availableCityCount.textContent = String(detailCounts.subareas + detailCounts.landmarks + state.activeStationCount);
    if (mapBadgeLabel) mapBadgeLabel.textContent = "\u57ce\u5e02\u5185\u70b9\u4f4d";
  } else {
    availableCityCount.textContent = String(state.cities.length);
    if (mapBadgeLabel) mapBadgeLabel.textContent = "\u53ef\u70b9\u51fb\u57ce\u5e02";
  }
  routeCount.textContent = String(state.routes.length);
  updateCityStyles();
  updateTotals();
  chainLabel.textContent = buildChainLabel();
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
    handlePlaceClick(placeId);
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
  const city = cityById(cityId);
  if (!city || !state.map || !state.cityDetailLayer) return;

  cancelQueuedCityClick();
  state.viewMode = "city";
  state.activeCityViewId = city.id;

  [state.chinaLayer, state.cityLayer, state.labelLayer].forEach((layer) => {
    if (layer && state.map.hasLayer(layer)) state.map.removeLayer(layer);
  });
  if (state.routeLayer && !state.map.hasLayer(state.routeLayer)) state.routeLayer.addTo(state.map);
  if (!state.map.hasLayer(state.cityDetailLayer)) state.cityDetailLayer.addTo(state.map);
  await renderCityDetail(city);
  exitCityViewBtn.hidden = false;
  renderPanel();
}

function exitCityView(options = {}) {
  if (!state.map) return;
  cancelQueuedCityClick();
  state.viewMode = "china";
  state.activeCityViewId = null;
  state.activeDistrictBoundaryCount = 0;
  state.activeLandmarkCount = 0;
  state.activeStationCount = 0;
  if (state.cityDetailLayer) state.cityDetailLayer.clearLayers();

  [state.chinaLayer, state.routeLayer, state.cityLayer, state.labelLayer].forEach((layer) => {
    if (layer && !state.map.hasLayer(layer)) layer.addTo(state.map);
  });
  exitCityViewBtn.hidden = true;
  renderRoutes();
  updateCityStyles();
  if (options.fit !== false) fitChina();
  renderPanel();
}

async function renderCityDetail(city) {
  state.cityDetailLayer.clearLayers();
  const detailBounds = L.latLngBounds([]);
  const sourceLayer = state.cityFeatureLayers.get(city.id);
  const subareas = citySubareas(city);
  const districtData = await fetchCityDistrictBoundaries(city);
  if (state.viewMode !== "city" || state.activeCityViewId !== city.id) return;
  state.activeDistrictBoundaryCount = districtData && Array.isArray(districtData.features) ? districtData.features.length : 0;

  if (!state.activeDistrictBoundaryCount && sourceLayer && sourceLayer.feature) {
    const outline = L.geoJSON(sourceLayer.feature, {
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

  if (districtData && Array.isArray(districtData.features) && districtData.features.length) {
    const districtLayer = L.geoJSON(districtData, {
      renderer: state.canvasRenderer,
      interactive: true,
      style: districtBoundaryStyle,
      onEachFeature: (feature, layer) => {
        const name = feature.properties && feature.properties.name ? feature.properties.name : "\u4e0b\u8f96\u533a\u57df";
        const districtPlace = districtPlaceFromFeature(city, feature);
        layer.bindTooltip(`${name} / ${city.name}`, {
          className: "city-tooltip",
          direction: "center",
          opacity: 0.96,
          sticky: true
        });
        layer.on({
          click: () => districtPlace && queuePlaceClick(districtPlace.id),
          mouseover: () => layer.setStyle({ fillOpacity: 0.96, weight: 1.6, color: "#234f44" }),
          mouseout: () => layer.setStyle(districtBoundaryStyle(feature))
        });
        const labelPoint = districtLabelPoint(feature);
        if (labelPoint) addDetailLabel(name, labelPoint.lat, labelPoint.lon, "city-detail-label", 12);
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
        .on("click", () => queuePlaceClick(area.id))
        .addTo(state.cityDetailLayer);
      addDetailLabel(area.name, area.lat, area.lon, "city-detail-label", 12);
    });
  }

  const boundaryData = districtData || (sourceLayer && sourceLayer.feature);
  const landmarks = await resolveCityLandmarks(city, detailBounds, boundaryData);
  if (state.viewMode !== "city" || state.activeCityViewId !== city.id) return;
  state.activeLandmarkCount = landmarks.length;

  landmarks.forEach((landmark) => {
    detailBounds.extend([landmark.lat, landmark.lon]);
    L.marker([landmark.lat, landmark.lon], {
      icon: L.divIcon({
        className: "",
        html: `<span class="landmark-marker ${escapeHtml(landmark.type || "scenic")}"><span>${landmarkSymbol(landmark.type)}</span></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    })
      .bindTooltip(`${landmark.name} / ${landmarkTypeLabel(landmark.type)}`, {
        className: "city-tooltip",
        direction: "top",
        offset: [0, -8],
        opacity: 1,
        sticky: true
      })
      .bindPopup(landmarkPopupHtml(landmark, city), {
        className: "landmark-popup-shell",
        maxWidth: 280,
        minWidth: 220
      })
      .addTo(state.cityDetailLayer);
    addDetailLabel(landmark.name, landmark.lat, landmark.lon, "landmark-label", 13);
  });

  const stations = await resolveCityStations(city, detailBounds, boundaryData);
  if (state.viewMode !== "city" || state.activeCityViewId !== city.id) return;
  state.activeStationCount = stations.length;

  stations.forEach((station) => {
    detailBounds.extend([station.lat, station.lon]);
    L.marker([station.lat, station.lon], {
      icon: L.divIcon({
        className: "",
        html: `<span class="station-marker"><span>\u706b</span></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    })
      .bindTooltip(`${station.name} / \u706b\u8f66\u7ad9`, {
        className: "city-tooltip",
        direction: "top",
        offset: [0, -8],
        opacity: 1,
        sticky: true
      })
      .addTo(state.cityDetailLayer);
    addDetailLabel(station.name, station.lat, station.lon, "station-label", 13);
  });

  if (!detailBounds.isValid()) return;
  state.map.fitBounds(detailBounds.pad(0.18), {
    paddingTopLeft: [28, 28],
    paddingBottomRight: [28, 28],
    animate: true,
    duration: 0.35
  });
}

function districtBoundaryStyle(feature) {
  const index = feature && feature.properties ? Number(feature.properties.subFeatureIndex || 0) : 0;
  const fills = ["#dfe9d7", "#e9f1dd", "#d7e8dc", "#edf0d8", "#dbeade"];
  return {
    color: "#6f8c73",
    weight: 1.05,
    fillColor: fills[index % fills.length],
    fillOpacity: 0.86,
    opacity: 0.96
  };
}

async function fetchCityDistrictBoundaries(city) {
  const adcode = state.cityAdcodes.get(city.id);
  if (!adcode || !/^\d{6}$/.test(adcode) || adcode === "710000") return null;
  if (state.cityBoundaryCache.has(adcode)) return state.cityBoundaryCache.get(adcode);

  try {
    const response = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const usable = data && Array.isArray(data.features) && data.features.length ? data : null;
    state.cityBoundaryCache.set(adcode, usable);
    return usable;
  } catch (error) {
    console.warn("district boundary fallback", city.name, error);
    state.cityBoundaryCache.set(adcode, null);
    return null;
  }
}

function districtLabelPoint(feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const point = Array.isArray(props.centroid) ? props.centroid : Array.isArray(props.center) ? props.center : null;
  if (!point || point.length < 2) return null;
  return { lon: point[0], lat: point[1] };
}

function districtPlaceFromFeature(city, feature) {
  const props = feature && feature.properties ? feature.properties : {};
  const labelPoint = districtLabelPoint(feature);
  if (!labelPoint) return null;

  const adcode = String(props.adcode || props.id || "").trim();
  const name = String(props.name || "\u4e0b\u8f96\u533a\u57df").trim();
  const existing = citySubareas(city).find((area) => {
    const sameCode = adcode && String(area.code || "").trim() === adcode;
    const sameName = normalizeSearchText(area.name) === normalizeSearchText(name);
    return sameCode || sameName;
  });

  const place = {
    ...(existing || {}),
    id: existing ? existing.id : `${city.id}-district-${adcode || normalizeKey(name)}`,
    name,
    pinyin: existing ? existing.pinyin : normalizeKey(name),
    code: adcode || (existing && existing.code) || "",
    lon: labelPoint.lon,
    lat: labelPoint.lat,
    province: city.province,
    parentCityId: city.id,
    parentCityName: city.name,
    parentCityPinyin: city.pinyin,
    placeType: "county"
  };

  state.placeById.set(place.id, place);
  return place;
}

function addDetailLabel(name, lat, lon, className, fontSize) {
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

function citySubareas(city) {
  const direct = state.counties.filter((county) => county.parentCityId === city.id);
  if (direct.length) return direct;
  if (city.isRegion) return state.cities.filter((item) => item.province === city.province && item.id !== city.id);
  return [];
}

function catalogEntry(catalog, city) {
  const keys = [
    city.pinyin,
    normalizeKey(city.pinyin),
    city.name,
    normalizeKey(city.name)
  ].filter(Boolean);
  return keys.map((key) => catalog[key]).find(Boolean);
}

function cityLandmarks(city) {
  const known = catalogEntry(landmarkCatalog, city) || [];
  const extended = catalogEntry(landmarkCatalogExtensions, city) || [];
  return mergeLandmarks(known, extended, city);
}

async function resolveCityLandmarks(city, bounds, boundaryData) {
  const cacheKey = state.cityAdcodes.get(city.id) || city.id;
  if (state.landmarkCache.has(cacheKey)) return state.landmarkCache.get(cacheKey);

  const curated = cityLandmarks(city).map((landmark) => ({ ...landmark, source: "curated" }));
  const live = await fetchTourismLandmarksFromOsm(city, bounds);
  const boundaryFiltered = boundaryData ? live.filter((landmark) => pointInGeoJson(landmark, boundaryData)) : live;
  const landmarks = mergeLandmarks(curated, boundaryFiltered, city);
  state.landmarkCache.set(cacheKey, landmarks);
  return landmarks;
}

function mergeLandmarks(curated, live, city) {
  const seen = new Set();
  return [...curated, ...live]
    .filter((landmark) => Number.isFinite(landmark.lon) && Number.isFinite(landmark.lat) && landmark.name)
    .sort((a, b) => landmarkPriority(a) - landmarkPriority(b) || distanceToCity(a, city) - distanceToCity(b, city))
    .filter((landmark) => {
      const key = normalizeSearchText(landmark.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 36);
}

function landmarkPriority(landmark) {
  return {
    scenic5a: 0,
    scenic4a: 1,
    museum: 2,
    historic: 3,
    scenic: 4,
    park: 5,
    building: 6
  }[landmark.type] ?? 9;
}

async function fetchTourismLandmarksFromOsm(city, bounds) {
  if (!bounds || !bounds.isValid()) return [];
  const bbox = bounds.pad(0.04);
  const south = bbox.getSouth().toFixed(5);
  const west = bbox.getWest().toFixed(5);
  const north = bbox.getNorth().toFixed(5);
  const east = bbox.getEast().toFixed(5);
  const selector = `[tourism~"^(attraction|museum|theme_park|zoo|aquarium|viewpoint|gallery)$"]`;
  const query = `[out:json][timeout:16];(node(${south},${west},${north},${east})${selector};way(${south},${west},${north},${east})${selector};relation(${south},${west},${north},${east})${selector};node(${south},${west},${north},${east})[historic][name];way(${south},${west},${north},${east})[historic][name];relation(${south},${west},${north},${east})[historic][name];);out center tags 120;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const data = await fetchJsonWithTimeout(url, { cache: "force-cache" }, 6500);
    return normalizeOsmLandmarks(data.elements || []);
  } catch (error) {
    if (error.name !== "AbortError") console.warn("tourism landmark fallback", city.name, error);
    return [];
  }
}

function normalizeOsmLandmarks(elements) {
  const landmarks = [];
  const seen = new Set();

  elements.forEach((element) => {
    const tags = element.tags || {};
    const rawName = tags["name:zh"] || tags.name || tags["name:en"];
    const lon = Number.isFinite(element.lon) ? element.lon : element.center && element.center.lon;
    const lat = Number.isFinite(element.lat) ? element.lat : element.center && element.center.lat;
    if (!rawName || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (!isTourismLandmark(tags, rawName)) return;

    const name = String(rawName).trim();
    const key = `${normalizeSearchText(name)}|${lon.toFixed(3)}|${lat.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    landmarks.push({
      name,
      lon,
      lat,
      type: landmarkTypeFromTags(tags, name),
      description: cleanLandmarkText(tags["description:zh"] || tags.description || tags.wikipedia || tags.wikidata),
      address: cleanLandmarkText(tags["addr:full"] || [tags["addr:city"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join("")),
      website: tags.website || tags["contact:website"] || "",
      source: "openstreetmap"
    });
  });

  return landmarks;
}

function isTourismLandmark(tags, name) {
  const tourism = String(tags.tourism || "").toLowerCase();
  const historic = String(tags.historic || "").toLowerCase();
  const text = normalizeSearchText(`${name} ${tags.name || ""}`);
  if (/酒店|宾馆|客栈|民宿|餐厅|停车|厕所|售票|入口|服务区|游客中心/.test(String(name))) return false;
  if (tourism && !["attraction", "museum", "theme_park", "zoo", "aquarium", "viewpoint", "gallery"].includes(tourism)) return false;
  return Boolean(tourism || historic || text.includes("博物馆") || text.includes("景区") || text.includes("风景区"));
}

function landmarkTypeFromTags(tags, name) {
  const text = `${name} ${tags.name || ""} ${tags.description || ""} ${tags.tourism || ""}`;
  const tourism = String(tags.tourism || "").toLowerCase();
  const historic = String(tags.historic || "").toLowerCase();
  if (/5A|AAAAA|五A|5级|5A级/i.test(text)) return "scenic5a";
  if (/4A|AAAA|四A|4级|4A级/i.test(text)) return "scenic4a";
  if (tourism === "museum" || tourism === "gallery" || /博物馆|纪念馆|陈列馆|美术馆|科技馆|展览馆/.test(name)) return "museum";
  if (historic || /古城|古镇|遗址|故居|寺|庙|塔|陵|祠|宫|旧址/.test(name)) return "historic";
  if (tourism === "zoo" || tourism === "aquarium" || tourism === "theme_park" || tourism === "viewpoint" || tourism === "attraction") return "scenic";
  return "scenic";
}

function cityStations(city) {
  const known = catalogEntry(stationCatalog, city);
  return known || [];
}

async function resolveCityStations(city, bounds, boundaryData) {
  const cacheKey = state.cityAdcodes.get(city.id) || city.id;
  if (state.stationCache.has(cacheKey)) return state.stationCache.get(cacheKey);

  const curatedStations = cityStations(city);
  const passengerStationNames = await fetchPassengerStationNames();
  if (curatedStations.length) {
    const validatedStations = curatedStations.filter((station) => isPassengerStationName(station.name, passengerStationNames));
    state.stationCache.set(cacheKey, validatedStations);
    return validatedStations;
  }

  const liveStations = passengerStationNames.size ? await fetchRailwayStationsFromOsm(city, bounds, passengerStationNames) : [];
  const filteredStations = boundaryData ? liveStations.filter((station) => pointInGeoJson(station, boundaryData)) : liveStations;
  state.stationCache.set(cacheKey, filteredStations);
  return filteredStations;
}

async function fetchPassengerStationNames() {
  if (state.passengerStationNames) return state.passengerStationNames;
  if (state.passengerStationNamesPromise) return state.passengerStationNamesPromise;

  state.passengerStationNamesPromise = fetch("./data/railway-stations-12306.json", {
    cache: "force-cache"
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const names = new Set();
      (data.stations || []).forEach((station) => {
        const stationName = station.name || station.stationName;
        if (!stationName) return;
        addPassengerStationName(names, stationName);
        addPassengerStationName(names, normalizeStationName(stationName));
      });
      state.passengerStationNames = names;
      return names;
    })
    .catch((error) => {
      console.warn("12306 passenger station list unavailable", error);
      state.passengerStationNames = new Set();
      return state.passengerStationNames;
    });

  return state.passengerStationNamesPromise;
}

function addPassengerStationName(names, name) {
  const lookupName = normalizeStationLookupName(name);
  if (lookupName) names.add(lookupName);
}

async function fetchRailwayStationsFromOsm(city, bounds, passengerStationNames) {
  if (!bounds || !bounds.isValid()) return [];
  const bbox = bounds.pad(0.03);
  const south = bbox.getSouth().toFixed(5);
  const west = bbox.getWest().toFixed(5);
  const north = bbox.getNorth().toFixed(5);
  const east = bbox.getEast().toFixed(5);
  const query = `[out:json][timeout:12];(node(${south},${west},${north},${east})[railway=station];way(${south},${west},${north},${east})[railway=station];relation(${south},${west},${north},${east})[railway=station];);out center tags 80;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const data = await fetchJsonWithTimeout(url, { cache: "force-cache" }, 6500);
    return normalizeOsmStations(data.elements || [], city, passengerStationNames);
  } catch (error) {
    if (error.name !== "AbortError") console.warn("railway station fallback", city.name, error);
    return [];
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function normalizeOsmStations(elements, city, passengerStationNames) {
  const stations = [];
  const seen = new Set();
  const hasPassengerWhitelist = passengerStationNames && passengerStationNames.size > 0;

  elements.forEach((element) => {
    const tags = element.tags || {};
    if (!isRailwayTrainStation(tags)) return;

    const lon = Number.isFinite(element.lon) ? element.lon : element.center && element.center.lon;
    const lat = Number.isFinite(element.lat) ? element.lat : element.center && element.center.lat;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    const rawName = tags["name:zh"] || tags.name || tags["name:en"];
    if (!rawName) return;
    const name = normalizeStationName(rawName);
    if (isDisallowedRailwayFacilityName(name)) return;
    if (hasPassengerWhitelist && !isPassengerStationName(name, passengerStationNames)) return;

    const key = `${normalizeKey(name)}|${lon.toFixed(3)}|${lat.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    stations.push({ name, lon, lat, source: hasPassengerWhitelist ? "openstreetmap+12306" : "openstreetmap" });
  });

  return stations
    .sort((a, b) => distanceToCity(a, city) - distanceToCity(b, city))
    .slice(0, 24);
}

function isRailwayTrainStation(tags) {
  const station = String(tags.station || "").toLowerCase();
  const subway = String(tags.subway || "").toLowerCase();
  const network = normalizeSearchText(tags.network || "");
  const name = normalizeSearchText(tags.name || tags["name:zh"] || "");

  if (station === "subway" || subway === "yes") return false;
  if (network.includes("轨道交通") || network.includes("metro") || network.includes("subway")) return false;
  if (name.includes("地铁") || name.includes("轨道交通")) return false;
  return tags.railway === "station";
}

function normalizeStationName(name) {
  const text = String(name).trim();
  return /站$/.test(text) ? text : `${text}\u7ad9`;
}

function normalizeStationLookupName(name) {
  return normalizeSearchText(String(name || "").trim().replace(/\u7ad9$/u, ""));
}

function isPassengerStationName(name, passengerStationNames) {
  return passengerStationNames.has(normalizeStationLookupName(name));
}

function isDisallowedRailwayFacilityName(name) {
  return /港区|港站|货场|货运|编组|线路所|信号|车辆|动车所|机务|工业|专用|车场|北仑港|穿山港|中宅/u.test(String(name || ""));
}

function distanceToCity(point, city) {
  return haversineDistance({ lon: point.lon, lat: point.lat }, city);
}

function pointInGeoJson(point, data) {
  if (!data) return false;
  if (data.type === "FeatureCollection") {
    return data.features.some((feature) => pointInGeoJson(point, feature));
  }
  if (data.type === "Feature") return pointInGeoJson(point, data.geometry);
  if (data.type === "Polygon") return pointInPolygonCoordinates(point, data.coordinates);
  if (data.type === "MultiPolygon") return data.coordinates.some((polygon) => pointInPolygonCoordinates(point, polygon));
  return false;
}

function pointInPolygonCoordinates(point, rings) {
  if (!rings || !rings.length || !pointInRing(point, rings[0])) return false;
  return !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function pointInRing(point, ring) {
  let inside = false;
  const x = point.lon;
  const y = point.lat;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function landmarkTypeLabel(type) {
  return {
    scenic5a: "\u56fd\u5bb65A\u7ea7\u666f\u533a",
    scenic4a: "\u56fd\u5bb64A\u7ea7\u666f\u533a",
    scenic: "\u7ecf\u5178\u666f\u70b9",
    museum: "\u535a\u7269\u9986/\u5c55\u9986",
    historic: "\u5386\u53f2\u666f\u70b9",
    park: "\u516c\u56ed/\u4f11\u95f2\u533a",
    building: "\u53ef\u6e38\u89c8\u5730\u6807"
  }[type] || "\u65c5\u6e38\u5730\u6807";
}

function landmarkSymbol(type) {
  return {
    scenic5a: "5A",
    scenic4a: "4A",
    museum: "\u25a3",
    historic: "\u25c6",
    park: "\u25cf",
    building: "\u25a0"
  }[type] || "\u25cf";
}

function cityDetailCounts(city) {
  return {
    subareas: citySubareas(city).length,
    landmarks: state.activeLandmarkCount || cityLandmarks(city).length,
    stations: state.activeStationCount
  };
}

function transportProfile(mode = state.transportMode) {
  return transportProfiles[mode] || transportProfiles.highspeed;
}

function setTransportMode(mode) {
  if (!transportProfiles[mode] || state.transportMode === mode) return;
  state.transportMode = mode;
  syncTransportButtons();
  recalculateRoutesForTransport();
  renderRoutes();
  renderPanel();
}

function syncTransportButtons() {
  transportButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.transportMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
}

function recalculateRoutesForTransport() {
  state.routes.forEach((route) => {
    const from = placeById(route.from);
    const to = placeById(route.to);
    if (!from || !to) return;

    const estimate = estimateRailRoute(from, to, state.transportMode);
    Object.assign(route, {
      status: "success",
      distance: estimate.distance,
      duration: estimate.duration,
      fallback: true,
      error: null,
      transportMode: estimate.mode,
      transportLabel: estimate.label
    });
  });
}

function handlePlaceClick(placeId) {
  const place = placeById(placeId);
  if (!place) return;

  if (!state.selectedCityId) {
    state.selectedCityId = placeId;
    renderPanel();
    return;
  }

  if (state.selectedCityId === placeId) {
    state.selectedCityId = null;
    renderPanel();
    return;
  }

  const route = {
    id: state.nextRouteId,
    from: state.selectedCityId,
    to: placeId,
    status: "loading",
    distance: null,
    duration: null,
    fallback: false,
    error: null,
    transportMode: state.transportMode,
    transportLabel: transportProfile().label
  };
  state.nextRouteId += 1;
  state.routes.push(route);
  state.selectedCityId = placeId;
  renderRoutes();
  renderPanel();
  calculateRouteMetrics(route);
}

function handleCityClick(cityId) {
  handlePlaceClick(cityId);
}

function calculateRouteMetrics(route) {
  const from = placeById(route.from);
  const to = placeById(route.to);
  if (!from || !to) return;
  const estimate = estimateRailRoute(from, to, route.transportMode || state.transportMode);

  updateRouteMetrics(route, {
    status: "success",
    distance: estimate.distance,
    duration: estimate.duration,
    fallback: true,
    error: null,
    transportMode: estimate.mode,
    transportLabel: estimate.label
  });
}

function updateRouteMetrics(route, updates) {
  if (!state.routes.includes(route)) return;
  Object.assign(route, updates);
  renderRoutes();
  renderPanel();
}

function estimateRailRoute(from, to, mode = state.transportMode) {
  const profile = transportProfile(mode);
  const distance = haversineDistance(from, to) * profile.detourFactor;
  const duration = distance / (profile.speedKmh * 1000 / 3600) + profile.bufferMinutes * 60;
  return {
    distance,
    duration,
    mode: transportProfiles[mode] ? mode : "highspeed",
    label: profile.label
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

function undoRoute() {
  const removed = state.routes.pop();
  if (removed) state.selectedCityId = removed.from;
  renderRoutes();
  renderPanel();
}

function clearRoutes() {
  state.routes = [];
  state.selectedCityId = null;
  renderRoutes();
  renderPanel();
}

function exportRoutes() {
  if (!state.routes.length) return;

  const totals = routeTotals();
  const routePlaces = [placeById(state.routes[0].from), ...state.routes.map((route) => placeById(route.to))].filter(Boolean);
  const currentTransport = transportProfile();
  const payload = {
    app: "Route Studio",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    summary: {
      transportMode: state.transportMode,
      transportLabel: currentTransport.label,
      cityCount: routePlaces.length,
      segmentCount: state.routes.length,
      chain: routePlaces.map(placeSnapshot),
      distanceMeters: Math.round(totals.distanceMeters),
      distanceText: totals.measuredSegmentCount ? formatDistance(totals.distanceMeters) : labels.pending,
      durationSeconds: Math.round(totals.durationSeconds),
      durationText: totals.measuredSegmentCount ? formatDuration(totals.durationSeconds) : labels.pending,
      hasFallback: totals.hasFallback,
      hasLoading: totals.hasLoading
    },
    segments: state.routes.map((route, index) => {
      const from = placeById(route.from);
      const to = placeById(route.to);
      return {
        index: index + 1,
        from: placeSnapshot(from),
        to: placeSnapshot(to),
        status: route.status,
        distanceMeters: hasMetrics(route) ? Math.round(route.distance) : null,
        distanceText: hasMetrics(route) ? formatDistance(route.distance) : labels.pending,
        durationSeconds: hasMetrics(route) ? Math.round(route.duration) : null,
        durationText: hasMetrics(route) ? formatDuration(route.duration) : labels.pending,
        transportMode: route.transportMode || state.transportMode,
        transportLabel: route.transportLabel || currentTransport.label,
        fallback: Boolean(route.fallback),
        error: route.error || null
      };
    })
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `route-studio-${timestampForFile()}.json`;
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

async function initApp() {
  try {
    selectionTitle.textContent = "\u6b63\u5728\u542f\u52a8 Leaflet Canvas";
    selectionHint.textContent = "\u6b63\u5728\u8bfb\u53d6\u672c\u5730 GeoJSON \u548c\u57ce\u5e02\u5750\u6807\u6570\u636e...";
    await loadMapData();
    initMap();
    renderRoutes();
    renderPanel();
  } catch (error) {
    console.error(error);
    selectionTitle.textContent = "\u5730\u56fe\u6e32\u67d3\u542f\u52a8\u5931\u8d25";
    selectionHint.textContent = error.message;
    cityCount.textContent = "0";
    availableCityCount.textContent = "0";
  }
}

undoBtn.addEventListener("click", undoRoute);
clearBtn.addEventListener("click", clearRoutes);
resetViewBtn.addEventListener("click", resetMapView);
exportBtn.addEventListener("click", exportRoutes);
exitCityViewBtn.addEventListener("click", () => exitCityView());
transportButtons.forEach((button) => button.addEventListener("click", () => setTransportMode(button.dataset.mode)));
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
