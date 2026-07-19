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

const subwayStationCatalog = {
  beijing: [
    { name: "\u5929\u5b89\u95e8\u4e1c\u7ad9", lon: 116.407, lat: 39.908 },
    { name: "\u738b\u5e9c\u4e95\u7ad9", lon: 116.411, lat: 39.908 },
    { name: "\u897f\u5355\u7ad9", lon: 116.374, lat: 39.907 },
    { name: "\u56fd\u8d38\u7ad9", lon: 116.46, lat: 39.909 },
    { name: "\u4e09\u5143\u6865\u7ad9", lon: 116.456, lat: 39.961 }
  ],
  shanghai: [
    { name: "\u4eba\u6c11\u5e7f\u573a\u7ad9", lon: 121.475, lat: 31.233 },
    { name: "\u9646\u5bb6\u5634\u7ad9", lon: 121.502, lat: 31.239 },
    { name: "\u5357\u4eac\u4e1c\u8def\u7ad9", lon: 121.484, lat: 31.239 },
    { name: "\u9759\u5b89\u5bfa\u7ad9", lon: 121.446, lat: 31.224 },
    { name: "\u4e0a\u6d77\u706b\u8f66\u7ad9\u7ad9", lon: 121.455, lat: 31.249 }
  ],
  guangzhou: [
    { name: "\u516c\u56ed\u524d\u7ad9", lon: 113.265, lat: 23.125 },
    { name: "\u4f53\u80b2\u897f\u8def\u7ad9", lon: 113.321, lat: 23.132 },
    { name: "\u73e0\u6c5f\u65b0\u57ce\u7ad9", lon: 113.321, lat: 23.119 },
    { name: "\u5ba2\u6751\u7ad9", lon: 113.321, lat: 23.096 },
    { name: "\u5e7f\u5dde\u5357\u7ad9\u7ad9", lon: 113.269, lat: 22.989 }
  ],
  shenzhen: [
    { name: "\u4f1a\u5c55\u4e2d\u5fc3\u7ad9", lon: 114.062, lat: 22.535 },
    { name: "\u8d2d\u7269\u516c\u56ed\u7ad9", lon: 114.054, lat: 22.539 },
    { name: "\u4e16\u754c\u4e4b\u7a97\u7ad9", lon: 113.973, lat: 22.539 },
    { name: "\u8001\u8857\u7ad9", lon: 114.118, lat: 22.544 },
    { name: "\u6df1\u5733\u5317\u7ad9\u7ad9", lon: 114.029, lat: 22.61 }
  ],
  chengdu: [
    { name: "\u5929\u5e9c\u5e7f\u573a\u7ad9", lon: 104.066, lat: 30.657 },
    { name: "\u6625\u7199\u8def\u7ad9", lon: 104.081, lat: 30.655 },
    { name: "\u7701\u4f53\u80b2\u9986\u7ad9", lon: 104.064, lat: 30.637 },
    { name: "\u6210\u90fd\u4e1c\u5ba2\u7ad9\u7ad9", lon: 104.142, lat: 30.63 },
    { name: "\u4e00\u54c1\u5929\u4e0b\u7ad9", lon: 104.026, lat: 30.689 }
  ],
  wuhan: [
    { name: "\u6c5f\u6c49\u8def\u7ad9", lon: 114.29, lat: 30.585 },
    { name: "\u5faa\u793c\u95e8\u7ad9", lon: 114.285, lat: 30.593 },
    { name: "\u6d2a\u5c71\u5e7f\u573a\u7ad9", lon: 114.337, lat: 30.543 },
    { name: "\u6b66\u6c49\u706b\u8f66\u7ad9\u7ad9", lon: 114.425, lat: 30.607 },
    { name: "\u5149\u8c37\u5e7f\u573a\u7ad9", lon: 114.405, lat: 30.506 }
  ],
  xian: [
    { name: "\u949f\u697c\u7ad9", lon: 108.94, lat: 34.261 },
    { name: "\u5c0f\u5be8\u7ad9", lon: 108.953, lat: 34.229 },
    { name: "\u5927\u96c1\u5854\u7ad9", lon: 108.964, lat: 34.219 },
    { name: "\u5317\u5927\u8857\u7ad9", lon: 108.946, lat: 34.27 },
    { name: "\u897f\u5b89\u5317\u7ad9\u7ad9", lon: 108.945, lat: 34.382 }
  ],
  nanjing: [
    { name: "\u65b0\u8857\u53e3\u7ad9", lon: 118.784, lat: 32.041 },
    { name: "\u5927\u884c\u5bab\u7ad9", lon: 118.796, lat: 32.044 },
    { name: "\u9f13\u697c\u7ad9", lon: 118.779, lat: 32.064 },
    { name: "\u5357\u4eac\u7ad9\u7ad9", lon: 118.803, lat: 32.088 },
    { name: "\u5357\u4eac\u5357\u7ad9\u7ad9", lon: 118.797, lat: 31.971 }
  ],
  hangzhou: [
    { name: "\u9f99\u7fd4\u6865\u7ad9", lon: 120.169, lat: 30.258 },
    { name: "\u51e4\u8d77\u8def\u7ad9", lon: 120.164, lat: 30.267 },
    { name: "\u6b66\u6797\u5e7f\u573a\u7ad9", lon: 120.164, lat: 30.276 },
    { name: "\u676d\u5dde\u4e1c\u7ad9\u7ad9", lon: 120.219, lat: 30.291 },
    { name: "\u5b9a\u5b89\u8def\u7ad9", lon: 120.168, lat: 30.247 }
  ],
  chongqing: [
    { name: "\u89e3\u653e\u7891\u7ad9", lon: 106.577, lat: 29.558 },
    { name: "\u8f83\u573a\u53e3\u7ad9", lon: 106.574, lat: 29.554 },
    { name: "\u4e24\u8def\u53e3\u7ad9", lon: 106.55, lat: 29.552 },
    { name: "\u89c2\u97f3\u6865\u7ad9", lon: 106.532, lat: 29.578 },
    { name: "\u6c99\u576a\u575d\u7ad9", lon: 106.456, lat: 29.559 }
  ]
};

function requiredFunction(group, name) {
  const value = group?.[name];
  if (typeof value !== "function") throw new TypeError(`city detail ${name} must be a function`);
  return value;
}

export function createCityDetailController(options = {}) {
  if (!options || typeof options !== "object") throw new TypeError("city detail options are required");
  const { state, mapController, elements = {}, callbacks = {}, helpers = {} } = options;
  if (!state || typeof state !== "object") throw new TypeError("city detail state is required");
  if (!mapController || typeof mapController !== "object") throw new TypeError("city detail mapController is required");

  const cityById = requiredFunction(callbacks, "cityById");
  const loadFoodForCity = requiredFunction(callbacks, "loadFoodForCity");
  const foodArticleCountForCity = requiredFunction(callbacks, "foodArticleCountForCity");
  const renderPanel = requiredFunction(callbacks, "renderPanel");
  const syncPlaceIndex = requiredFunction(callbacks, "syncPlaceIndex");
  const getPlaceIndex = requiredFunction(callbacks, "getPlaceIndex");
  const escapeHtml = requiredFunction(helpers, "escapeHtml");
  const normalizeKey = requiredFunction(helpers, "normalizeKey");
  const normalizeSearchText = requiredFunction(helpers, "normalizeSearchText");
  const loadOptionalJson = requiredFunction(helpers, "loadOptionalJson");
  const isCountyRecordsPayload = requiredFunction(helpers, "isCountyRecordsPayload");
  const mergeCountyRecords = requiredFunction(helpers, "mergeCountyRecords");
  const upsertRuntimePlaces = requiredFunction(helpers, "upsertRuntimePlaces");
  const fetch = requiredFunction(helpers, "fetchImpl");
  const window = helpers.windowObject || globalThis;
  const exitCityViewBtn = elements.exitCityViewBtn || { hidden: true };

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

  async function enterCityView(cityId) {
    const city = cityById(cityId);
    if (!city || !state.map || !mapController) return;
  
    const detailSession = mapController.enterCityView(city.id);
    if (!detailSession) return;
    await loadCityDetail(city, detailSession);
    if (!mapController.isDetailSessionCurrent(detailSession)) return;
    exitCityViewBtn.hidden = false;
    renderPanel();
  }
  
  function exitCityView(options = {}) {
    mapController?.enterChinaView(options);
  }
  
  async function loadCityDetail(city, detailSession) {
    const isCurrent = () => mapController?.isDetailSessionCurrent(detailSession);
    if (!isCurrent()) return false;
    mapController.clearCityDetail();
    const [, cityFoodController] = await Promise.all([
      ensureCityCounties(city.id, { isCurrent }),
      loadFoodForCity(city.id, { isCurrent })
    ]);
    if (!isCurrent()) return false;
  
    const sourceLayer = state.cityFeatureLayers.get(city.id);
    const subareas = citySubareas(city);
    const districtData = await fetchCityDistrictBoundaries(city, { isCurrent });
    if (!isCurrent()) return false;
    const districts = Array.isArray(districtData?.features)
      ? districtData.features.map((feature) => {
          const place = districtPlaceFromFeature(city, feature);
          return {
            feature,
            name: feature.properties?.name || "\u4e0b\u8f96\u533a\u57df",
            placeId: place?.id || null,
            labelPoint: districtLabelPoint(feature)
          };
        })
      : [];
    const boundaryData = districtData || (sourceLayer && sourceLayer.feature);
    const queryBounds = cityDetailQueryBounds(boundaryData, districts.length ? [] : subareas);
    const landmarks = await resolveCityLandmarks(city, queryBounds, boundaryData, { isCurrent });
    if (!isCurrent()) return false;
    const stations = await resolveCityStations(city, queryBounds, boundaryData, { isCurrent });
    if (!isCurrent()) return false;
    const metroNetwork = await resolveCityMetroNetwork(city, { isCurrent });
    if (!isCurrent()) return false;
    const subwayStations = await resolveCitySubwayStations(city, queryBounds, boundaryData, metroNetwork, { isCurrent });
    if (!isCurrent()) return false;
    const foodArticles = cityFoodController?.articlesForCity(city.id) || [];
    return mapController.renderCityDetail({
      session: detailSession,
      city,
      sourceFeature: districts.length ? null : sourceLayer?.feature || null,
      districts,
      subareas,
      landmarks: landmarks.map((landmark) => ({
        ...landmark,
        symbol: landmarkSymbol(landmark.type),
        typeLabel: landmarkTypeLabel(landmark.type),
        popupHtml: landmarkPopupHtml(landmark, city)
      })),
      stations,
      metroLines: metroNetwork.lines || [],
      subwayStations,
      foodMarkers: cityFoodController?.renderMarkers(foodArticles) || [],
      foodArticleCount: foodArticles.length
    });
  }
  
  async function fetchCityDistrictBoundaries(city, { isCurrent = () => true } = {}) {
    const adcode = state.cityAdcodes.get(city.id);
    if (!adcode || !/^\d{6}$/.test(adcode) || adcode === "710000") return null;
    if (state.cityBoundaryCache.has(adcode)) return state.cityBoundaryCache.get(adcode);
  
    try {
      const response = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const usable = data && Array.isArray(data.features) && data.features.length ? data : null;
      if (isCurrent()) state.cityBoundaryCache.set(adcode, usable);
      return usable;
    } catch (error) {
      console.warn("district boundary fallback", city.name, error);
      if (isCurrent()) state.cityBoundaryCache.set(adcode, null);
      return null;
    }
  }
  
  function districtLabelPoint(feature) {
    const props = feature && feature.properties ? feature.properties : {};
    const point = Array.isArray(props.centroid) ? props.centroid : Array.isArray(props.center) ? props.center : null;
    if (!point || point.length < 2) return null;
    return { lon: point[0], lat: point[1] };
  }
  
  function cityDetailQueryBounds(boundaryData, points = []) {
    const bounds = { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity };
    const includePoint = (lon, lat) => {
      if (!Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) return;
      bounds.south = Math.min(bounds.south, Number(lat));
      bounds.west = Math.min(bounds.west, Number(lon));
      bounds.north = Math.max(bounds.north, Number(lat));
      bounds.east = Math.max(bounds.east, Number(lon));
    };
    const includeCoordinates = (coordinates) => {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]))) {
        includePoint(coordinates[0], coordinates[1]);
        return;
      }
      coordinates.forEach(includeCoordinates);
    };
    const includeGeoJson = (data) => {
      if (!data) return;
      if (data.type === "FeatureCollection") return data.features?.forEach(includeGeoJson);
      if (data.type === "Feature") return includeGeoJson(data.geometry);
      if (data.type === "GeometryCollection") return data.geometries?.forEach(includeGeoJson);
      includeCoordinates(data.coordinates);
    };
    includeGeoJson(boundaryData);
    points.forEach((point) => includePoint(point.lon, point.lat));
    return Number.isFinite(bounds.south) ? bounds : null;
  }
  
  function paddedQueryBounds(bounds, ratio) {
    if (!bounds) return null;
    const latPadding = (bounds.north - bounds.south) * ratio;
    const lonPadding = (bounds.east - bounds.west) * ratio;
    return {
      south: bounds.south - latPadding,
      west: bounds.west - lonPadding,
      north: bounds.north + latPadding,
      east: bounds.east + lonPadding
    };
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
  
    upsertRuntimePlaces(getPlaceIndex(), [place]);
    syncPlaceIndex();
    return place;
  }
  
  function citySubareas(city) {
    const direct = state.counties.filter((county) => county.parentCityId === city.id && hasCoordinates(county));
    if (direct.length) return direct;
    if (city.isRegion) return state.cities.filter((item) => item.province === city.province && item.id !== city.id);
    return [];
  }
  
  function hasCoordinates(place) {
    return Number.isFinite(Number(place && place.lon)) && Number.isFinite(Number(place && place.lat));
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
  
  async function resolveCityLandmarks(city, bounds, boundaryData, { isCurrent = () => true } = {}) {
    const cacheKey = state.cityAdcodes.get(city.id) || city.id;
    if (state.landmarkCache.has(cacheKey)) return state.landmarkCache.get(cacheKey);
  
    const curated = cityLandmarks(city).map((landmark) => ({ ...landmark, source: "curated" }));
    const live = await fetchTourismLandmarksFromOsm(city, bounds);
    const boundaryFiltered = boundaryData ? live.filter((landmark) => pointInGeoJson(landmark, boundaryData)) : live;
    const landmarks = mergeLandmarks(curated, boundaryFiltered, city);
    if (isCurrent()) state.landmarkCache.set(cacheKey, landmarks);
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
    const bbox = paddedQueryBounds(bounds, 0.04);
    if (!bbox) return [];
    const south = bbox.south.toFixed(5);
    const west = bbox.west.toFixed(5);
    const north = bbox.north.toFixed(5);
    const east = bbox.east.toFixed(5);
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
  
  async function resolveCityStations(city, bounds, boundaryData, { isCurrent = () => true } = {}) {
    const cacheKey = state.cityAdcodes.get(city.id) || city.id;
    if (state.stationCache.has(cacheKey)) return state.stationCache.get(cacheKey);
  
    const curatedStations = cityStations(city);
    const passengerStationNames = await fetchPassengerStationNames({ isCurrent });
    if (curatedStations.length) {
      const validatedStations = curatedStations.filter((station) => isPassengerStationName(station.name, passengerStationNames));
      if (isCurrent()) state.stationCache.set(cacheKey, validatedStations);
      return validatedStations;
    }
  
    const liveStations = passengerStationNames.size ? await fetchRailwayStationsFromOsm(city, bounds, passengerStationNames) : [];
    const filteredStations = boundaryData ? liveStations.filter((station) => pointInGeoJson(station, boundaryData)) : liveStations;
    if (isCurrent()) state.stationCache.set(cacheKey, filteredStations);
    return filteredStations;
  }
  
  async function resolveCityMetroNetwork(city, { isCurrent = () => true } = {}) {
    const empty = { lines: [], stations: [] };
    const data = await loadMetroNetworkData({ isCurrent });
    if (!data || !data.networks) return empty;
  
    const keys = metroCityKeys(city);
    const key = keys.find((item) => data.networks[item]);
    return key ? data.networks[key] : empty;
  }
  
  async function loadMetroNetworkData({ isCurrent = () => true } = {}) {
    if (state.metroNetworkData) return state.metroNetworkData;
    if (!state.metroNetworkPromise) {
      state.metroNetworkPromise = fetch("./data/metro-networks.json", { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .catch((error) => {
          console.warn("metro network data unavailable", error);
          return { networks: {} };
        });
    }
    const data = await state.metroNetworkPromise;
    if (isCurrent()) state.metroNetworkData = data;
    return data;
  }
  
  function metroCityKeys(city) {
    const key = normalizeKey(city.pinyin || city.name);
    const aliases = {
      hongkong: "xianggang",
      harbin: "haerbin",
      urumqi: "wulumuqi",
      wulumuqi: "wulumuqi",
      hohhot: "huhehaote",
      huhehaote: "huhehaote",
      xian: "xian"
    };
    return Array.from(new Set([aliases[key], key, normalizeKey(city.name)].filter(Boolean)));
  }
  
  async function resolveCitySubwayStations(city, bounds, boundaryData, metroNetwork = null, { isCurrent = () => true } = {}) {
    const cacheKey = state.cityAdcodes.get(city.id) || city.id;
    if (state.subwayStationCache.has(cacheKey)) return state.subwayStationCache.get(cacheKey);
  
    if (metroNetwork && Array.isArray(metroNetwork.stations) && metroNetwork.stations.length) {
      const stations = metroNetwork.stations.map((station) => ({
        ...station,
        source: "metro-network"
      }));
      if (isCurrent()) state.subwayStationCache.set(cacheKey, stations);
      return stations;
    }
  
    const curatedStations = citySubwayStations(city).map((station) => ({ ...station, source: "curated" }));
    const liveStations = await fetchSubwayStationsFromOsm(city, bounds);
    const filteredStations = boundaryData ? liveStations.filter((station) => pointInGeoJson(station, boundaryData)) : liveStations;
    const stations = mergeSubwayStations(curatedStations, filteredStations.length ? filteredStations : liveStations, city);
    if (isCurrent()) state.subwayStationCache.set(cacheKey, stations);
    return stations;
  }
  
  function citySubwayStations(city) {
    return catalogEntry(subwayStationCatalog, city) || [];
  }
  
  async function fetchPassengerStationNames({ isCurrent = () => true } = {}) {
    if (state.passengerStationNames) return state.passengerStationNames;
    if (!state.passengerStationNamesPromise) {
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
          return names;
        })
        .catch((error) => {
          console.warn("12306 passenger station list unavailable", error);
          return new Set();
        });
    }
    const names = await state.passengerStationNamesPromise;
    if (isCurrent()) state.passengerStationNames = names;
    return names;
  }
  
  function addPassengerStationName(names, name) {
    const lookupName = normalizeStationLookupName(name);
    if (lookupName) names.add(lookupName);
  }
  
  async function fetchRailwayStationsFromOsm(city, bounds, passengerStationNames) {
    const bbox = paddedQueryBounds(bounds, 0.03);
    if (!bbox) return [];
    const south = bbox.south.toFixed(5);
    const west = bbox.west.toFixed(5);
    const north = bbox.north.toFixed(5);
    const east = bbox.east.toFixed(5);
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
  
  async function fetchSubwayStationsFromOsm(city, bounds) {
    const bbox = paddedQueryBounds(bounds, 0.03);
    if (!bbox) return [];
    const south = bbox.south.toFixed(5);
    const west = bbox.west.toFixed(5);
    const north = bbox.north.toFixed(5);
    const east = bbox.east.toFixed(5);
    const filters = [
      "[railway=station][station=subway]",
      "[railway=station][subway=yes]",
      "[public_transport=station][subway=yes]",
      "[station=subway]",
      "[railway=halt][station=subway]",
      "[railway=subway_entrance][name]"
    ];
    const queryBody = ["node", "way", "relation"]
      .flatMap((type) => filters.map((filter) => `${type}(${south},${west},${north},${east})${filter};`))
      .join("");
    const query = `[out:json][timeout:12];(${queryBody});out center tags 220;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
    try {
      const data = await fetchJsonWithTimeout(url, { cache: "force-cache" }, 3500);
      return normalizeOsmSubwayStations(data.elements || [], city);
    } catch (error) {
      if (error.name !== "AbortError") console.warn("subway station fallback", city.name, error);
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
  
  function normalizeOsmSubwayStations(elements, city) {
    const stationsByName = new Map();
  
    elements.forEach((element) => {
      const tags = element.tags || {};
      if (!isSubwayStation(tags)) return;
  
      const lon = Number.isFinite(element.lon) ? element.lon : element.center && element.center.lon;
      const lat = Number.isFinite(element.lat) ? element.lat : element.center && element.center.lat;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  
      const rawName = tags["name:zh"] || tags.name || tags["name:en"];
      if (!rawName) return;
      const name = normalizeSubwayStationName(rawName);
      if (!name || isDisallowedSubwayStationName(name)) return;
  
      const key = normalizeStationLookupName(name);
      const priority = subwayStationPriority(tags, name);
      const existing = stationsByName.get(key);
      if (existing && existing.priority <= priority) return;
      stationsByName.set(key, {
        name,
        lon,
        lat,
        source: "openstreetmap",
        priority
      });
    });
  
    return Array.from(stationsByName.values())
      .map(({ priority, ...station }) => station)
      .sort((a, b) => distanceToCity(a, city) - distanceToCity(b, city))
      .slice(0, 160);
  }
  
  function mergeSubwayStations(curated, live, city) {
    const seen = new Set();
    return [...curated, ...live]
      .filter((station) => Number.isFinite(station.lon) && Number.isFinite(station.lat) && station.name)
      .sort((a, b) => Number(a.source !== "curated") - Number(b.source !== "curated") || distanceToCity(a, city) - distanceToCity(b, city))
      .filter((station) => {
        const key = normalizeStationLookupName(station.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 160);
  }
  
  function isSubwayStation(tags) {
    const railway = String(tags.railway || "").toLowerCase();
    const station = String(tags.station || "").toLowerCase();
    const subway = String(tags.subway || "").toLowerCase();
    const publicTransport = String(tags.public_transport || "").toLowerCase();
    const network = normalizeSearchText(tags.network || tags.operator || "");
    return (
      station === "subway" ||
      subway === "yes" ||
      railway === "subway_entrance" ||
      (railway === "station" && (network.includes("metro") || network.includes("subway") || network.includes("\u5730\u94c1") || network.includes("\u8f68\u9053\u4ea4\u901a"))) ||
      (publicTransport === "station" && (network.includes("metro") || network.includes("subway") || network.includes("\u5730\u94c1") || network.includes("\u8f68\u9053\u4ea4\u901a")))
    );
  }
  
  function subwayStationPriority(tags, name) {
    const railway = String(tags.railway || "").toLowerCase();
    const station = String(tags.station || "").toLowerCase();
    if (station === "subway" && railway === "station") return 0;
    if (station === "subway") return 1;
    if (railway === "station") return 2;
    if (railway === "subway_entrance") return 5;
    return 9;
  }
  
  function normalizeSubwayStationName(name) {
    const text = String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(?:\s|,|-)*(?:exit|entrance)\s*[a-z0-9-]*$/i, "")
      .replace(/[A-Z0-9\uff21-\uff3a\uff10-\uff19]*\s*(?:\u53e3|\u51fa\u5165\u53e3|\u51fa\u53e3)$/u, "")
      .trim();
    if (!text) return "";
    return /\u7ad9$/u.test(text) ? text : `${text}\u7ad9`;
  }
  
  function isDisallowedSubwayStationName(name) {
    return /\u51fa\u5165\u53e3|\u51fa\u53e3|\u7535\u68af|\u901a\u9053|\u6362\u4e58\u5385|\u505c\u8f66\u573a|\u8f66\u8f86\u6bb5|\u505c\u8f66\u573a|\u8f66\u5e93/u.test(String(name || ""));
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
    return mapController.distanceBetween({ lon: point.lon, lat: point.lat }, city);
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
      stations: state.activeStationCount,
      subwayStations: state.activeSubwayStationCount,
      foodArticles: foodArticleCountForCity(city.id)
    };
  }
  
  async function ensureCityCounties(cityId, { isCurrent = () => true } = {}) {
    if (!cityId || state.loadedCountyCityIds.has(cityId)) return citySubareas(cityById(cityId));
    if (!state.countyLoadPromises.has(cityId)) {
      const request = loadOptionalJson(`./data/counties/by-city/${cityId}.json`, { quiet: true })
        .finally(() => state.countyLoadPromises.delete(cityId));
      state.countyLoadPromises.set(cityId, request);
    }
    const data = await state.countyLoadPromises.get(cityId);
    if (!isCurrent()) return citySubareas(cityById(cityId));
    if (!isCountyRecordsPayload(data)) return citySubareas(cityById(cityId));
    const counties = data.counties;
    mergeCountyRecords(getPlaceIndex(), counties);
    syncPlaceIndex();
    state.loadedCountyCityIds.add(cityId);
    return counties;
  }

  return Object.freeze({
    enter: enterCityView,
    exit: exitCityView,
    load: loadCityDetail,
    counts: cityDetailCounts,
    subareas: citySubareas,
    landmarks: cityLandmarks,
    ensureCounties: ensureCityCounties,
    async prefetch() {
      await Promise.all([loadMetroNetworkData(), fetchPassengerStationNames()]);
    }
  });
}
