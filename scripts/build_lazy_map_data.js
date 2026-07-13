const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

function readJson(relativePath, fallback = null) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, payload) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function cleanDirectory(relativePath) {
  const dir = path.join(root, relativePath);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function countySummary(county) {
  return {
    id: county.id,
    name: county.name,
    pinyin: county.pinyin,
    province: county.province,
    parentCityId: county.parentCityId,
    parentCityName: county.parentCityName,
    parentCityPinyin: county.parentCityPinyin
  };
}

function foodSummary(article) {
  return {
    id: article.id,
    day: article.day,
    title: article.title,
    description: article.description,
    foods: article.foods || [],
    locationText: article.locationText,
    placeId: article.placeId,
    placeType: article.placeType,
    cityId: article.cityId,
    cityName: article.cityName,
    countyName: article.countyName,
    province: article.province,
    coverImage: article.coverImage,
    readerPath: article.readerPath || article.pdfPath || article.htmlPath || article.markdownPath
  };
}

function writeCountyChunks() {
  const source = readJson("data/china-counties.json", { counties: [] });
  const counties = Array.isArray(source.counties) ? source.counties : [];
  const byCity = groupBy(counties, (county) => county.parentCityId);

  cleanDirectory("data/counties/by-city");
  byCity.forEach((items, cityId) => {
    writeJson(`data/counties/by-city/${cityId}.json`, {
      source: {
        name: "china-counties by-city split",
        generatedAt: new Date().toISOString()
      },
      cityId,
      count: items.length,
      counties: items
    });
  });

  writeJson("data/counties-summary.json", {
    source: {
      name: "china-counties summary",
      generatedAt: new Date().toISOString()
    },
    count: counties.length,
    cityCount: byCity.size,
    counties: counties.map(countySummary)
  });

  return { countyCount: counties.length, countyCityCount: byCity.size };
}

function writeFoodChunks() {
  const source = readJson("data/wechat-food-articles.json", { articles: [], unmatched: [] });
  const articles = Array.isArray(source.articles) ? source.articles : [];
  const unmatched = Array.isArray(source.unmatched) ? source.unmatched : [];
  const byCity = groupBy(articles, (article) => article.cityId);
  const byCityIds = {};
  const byPlaceIds = {};

  cleanDirectory("data/food-articles/by-city");
  byCity.forEach((items, cityId) => {
    writeJson(`data/food-articles/by-city/${cityId}.json`, {
      source: {
        name: "wechat food articles by-city split",
        generatedAt: new Date().toISOString()
      },
      cityId,
      count: items.length,
      articles: items
    });
    byCityIds[cityId] = items.map((article) => article.id);
  });

  articles.forEach((article) => {
    if (!article.placeId) return;
    if (!byPlaceIds[article.placeId]) byPlaceIds[article.placeId] = [];
    byPlaceIds[article.placeId].push(article.id);
  });

  writeJson("data/wechat-food-summary.json", {
    source: {
      name: "wechat food articles summary",
      articleDir: source.source && source.source.articleDir,
      generatedAt: new Date().toISOString()
    },
    count: articles.length,
    unmatchedCount: unmatched.length,
    cityCount: byCity.size,
    articles: articles.map(foodSummary),
    byCity: byCityIds,
    byPlace: byPlaceIds,
    unmatched
  });

  return { articleCount: articles.length, foodCityCount: byCity.size, unmatchedCount: unmatched.length };
}

function main() {
  const countyResult = writeCountyChunks();
  const foodResult = writeFoodChunks();
  console.log(JSON.stringify({
    outputDir: path.relative(root, dataDir),
    ...countyResult,
    ...foodResult
  }, null, 2));
}

main();
