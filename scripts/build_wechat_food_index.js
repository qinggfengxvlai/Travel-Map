const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const articleDir = path.join(root, "exports", "wechat_articles");
const outputPath = path.join(root, "data", "wechat-food-articles.json");

const cityData = JSON.parse(fs.readFileSync(path.join(root, "data", "china-cities.json"), "utf8"));
const countyData = JSON.parse(fs.readFileSync(path.join(root, "data", "china-counties.json"), "utf8"));

const cities = cityData.cities || [];
const counties = countyData.counties || [];
const cityByName = new Map(cities.map((city) => [city.name, city]));
const countyByParentAndName = new Map(counties.map((county) => [`${county.parentCityName}|${county.name}`, county]));
const countiesByName = new Map();

for (const county of counties) {
  if (!countiesByName.has(county.name)) countiesByName.set(county.name, []);
  countiesByName.get(county.name).push(county);
}

function cleanLocationPart(value) {
  return String(value || "")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function extractDayAndLocation(title) {
  const match = String(title || "").match(/第(\d+)(?:\s*[~～-]\s*\d+)?天?\s+([^】]+)】/);
  if (!match) return { day: null, locationText: "" };
  return {
    day: Number(match[1]),
    locationText: cleanLocationPart(match[2])
  };
}

function foodKeywords(description, locationText) {
  const text = String(description || "");
  const marker = text.indexOf("：");
  const raw = marker >= 0 ? text.slice(marker + 1) : text.replace(locationText, "");
  return raw
    .replace(/\\x26amp;/g, "&")
    .split(/[、，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function firstLocalImage(imageDir) {
  if (!imageDir) return "";
  const localDir = path.join(articleDir, imageDir);
  if (!fs.existsSync(localDir)) return "";
  const image = fs.readdirSync(localDir)
    .filter((name) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name))
    .sort()[0];
  return image ? path.posix.join("exports/wechat_articles", imageDir.replaceAll("\\", "/"), image) : "";
}

function matchPlace(locationText) {
  const primaryLocation = locationText.split(/[&＆/／、,，]/)[0] || locationText;
  const parts = primaryLocation.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const cityName = parts[0];
    const countyName = parts[1];
    const county = countyByParentAndName.get(`${cityName}|${countyName}`);
    if (county) {
      return {
        placeId: county.id,
        placeType: "county",
        cityId: county.parentCityId,
        cityName: county.parentCityName,
        countyName: county.name,
        province: county.province,
        lon: county.lon,
        lat: county.lat,
        matchedBy: "city-county"
      };
    }
  }

  const primary = parts[0] || locationText;
  const city = cityByName.get(primary);
  if (city) {
    return {
      placeId: city.id,
      placeType: "city",
      cityId: city.id,
      cityName: city.name,
      countyName: "",
      province: city.province,
      lon: city.lon,
      lat: city.lat,
      matchedBy: "city"
    };
  }

  const sameNameCounties = countiesByName.get(primary) || [];
  if (sameNameCounties.length === 1) {
    const county = sameNameCounties[0];
    return {
      placeId: county.id,
      placeType: "county",
      cityId: county.parentCityId,
      cityName: county.parentCityName,
      countyName: county.name,
      province: county.province,
      lon: county.lon,
      lat: county.lat,
      matchedBy: "unique-county"
    };
  }

  return null;
}

function articleMarkdownPath(jsonFile) {
  return path.posix.join("exports/wechat_articles", jsonFile.replace(/\.json$/i, ".md"));
}

function articleReaderPaths(jsonFile) {
  const htmlPath = path.posix.join("exports/wechat_articles/readers", jsonFile.replace(/\.json$/i, ".html"));
  const pdfPath = path.posix.join("exports/wechat_articles/pdfs", jsonFile.replace(/\.json$/i, ".pdf"));
  const htmlExists = fs.existsSync(path.join(root, htmlPath));
  const pdfExists = fs.existsSync(path.join(root, pdfPath));
  return {
    htmlPath: htmlExists ? htmlPath : "",
    pdfPath: pdfExists ? pdfPath : "",
    readerPath: pdfExists ? pdfPath : htmlExists ? htmlPath : articleMarkdownPath(jsonFile)
  };
}

function buildIndex() {
  const files = fs.readdirSync(articleDir).filter((name) => name.endsWith(".json")).sort();
  const articles = [];
  const unmatched = [];

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(articleDir, file), "utf8"));
    const { day, locationText } = extractDayAndLocation(raw.title);
    const place = matchPlace(locationText);
    if (!place) {
      unmatched.push({ file, title: raw.title, locationText });
      continue;
    }

    const readerPaths = articleReaderPaths(file);
    articles.push({
      id: file.replace(/\.json$/i, ""),
      day,
      title: raw.title,
      author: raw.author || "",
      description: String(raw.description || "").replace(/\\x26amp;/g, "&"),
      url: raw.url || "",
      markdownPath: articleMarkdownPath(file),
      ...readerPaths,
      imageDir: raw.image_dir ? path.posix.join("exports/wechat_articles", raw.image_dir.replaceAll("\\", "/")) : "",
      coverImage: firstLocalImage(raw.image_dir),
      imageCount: Number(raw.image_count || 0),
      foods: foodKeywords(raw.description, locationText),
      locationText,
      ...place
    });
  }

  const byCity = {};
  const byPlace = {};
  for (const article of articles) {
    if (!byCity[article.cityId]) byCity[article.cityId] = [];
    if (!byPlace[article.placeId]) byPlace[article.placeId] = [];
    byCity[article.cityId].push(article.id);
    byPlace[article.placeId].push(article.id);
  }

  const payload = {
    source: {
      name: "宇哥食行记 555天图文快速链接",
      articleDir: "exports/wechat_articles",
      generatedAt: new Date().toISOString()
    },
    count: articles.length,
    unmatchedCount: unmatched.length,
    articles,
    byCity,
    byPlace,
    unmatched
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)}: ${articles.length} matched, ${unmatched.length} unmatched.`);
  if (unmatched.length) {
    console.log("First unmatched:");
    console.log(unmatched.slice(0, 12));
  }
}

buildIndex();
