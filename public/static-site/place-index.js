export function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/meng$/g, "")
    .replace(/diqu$/g, "")
    .replace(/zhou$/g, "");
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

export function buildMunicipalityCountyEntries(children, displayCities) {
  const municipalityNames = new Set(
    (Array.isArray(children) ? children : [])
      .map((child) => child && child.province)
      .filter(Boolean)
  );
  const municipalityByName = new Map(
    (Array.isArray(displayCities) ? displayCities : [])
      .filter((city) => city && municipalityNames.has(city.name))
      .map((city) => [city.name, city])
  );

  return (Array.isArray(children) ? children : []).flatMap((child) => {
    if (!child || !child.pinyin) return [];
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

export function normalizeCountyRecord(county) {
  if (!county || typeof county !== "object" || !county.id) return null;
  return {
    ...county,
    placeType: "county",
    searchType: "county",
    searchText: county.searchText || normalizeSearchText(
      `${county.name || ""} ${county.province || ""} ${county.pinyin || ""} ${county.parentCityName || ""} ${county.parentCityPinyin || ""}`
    )
  };
}

export function buildPlaceMap(cities, counties) {
  const map = new Map();
  (Array.isArray(cities) ? cities : []).forEach((city) => {
    if (city && city.id) map.set(city.id, { ...city, placeType: "city" });
  });
  (Array.isArray(counties) ? counties : []).forEach((county) => {
    if (county && county.id) map.set(county.id, { ...county, placeType: "county" });
  });
  return map;
}

export function buildCityKeyMap(cities, municipalityChildren = []) {
  const aliases = new Map([
    ["enshi", "enshi"],
    ["linzhi", "linzhi"],
    ["luliang", "lvliang"],
    ["lvliang", "lvliang"],
    ["kezilesukeerkezi", "kezhou"]
  ]);
  const cityList = Array.isArray(cities) ? cities : [];
  const map = new Map();
  cityList.forEach((city) => {
    if (!city) return;
    map.set(normalizeKey(city.pinyin), city);
    map.set(normalizeKey(city.name), city);
  });
  (Array.isArray(municipalityChildren) ? municipalityChildren : []).forEach((child) => {
    if (!child) return;
    const parent = cityList.find((city) => city.name === child.province);
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

export function buildCityProvinceKeyMap(cities, municipalityChildren = []) {
  const cityList = Array.isArray(cities) ? cities : [];
  const map = new Map();
  const setCity = (city, province, keyValue) => {
    const key = normalizeKey(keyValue);
    if (!province || !key) return;
    map.set(`${province}|${key}`, city);
  };

  cityList.forEach((city) => {
    if (!city) return;
    setCity(city, city.province, city.pinyin);
    setCity(city, city.province, city.name);
  });
  (Array.isArray(municipalityChildren) ? municipalityChildren : []).forEach((child) => {
    if (!child) return;
    const parent = cityList.find((city) => city.name === child.province);
    if (!parent) return;
    setCity(parent, child.province, child.pinyin);
    setCity(parent, child.province, child.name);
  });
  return map;
}

function deduplicateCounties(counties) {
  const byId = new Map();
  (Array.isArray(counties) ? counties : []).forEach((county) => {
    const normalized = normalizeCountyRecord(county);
    if (!normalized) return;
    const existing = byId.get(normalized.id) || {};
    byId.set(normalized.id, normalizeCountyRecord({ ...existing, ...normalized }));
  });
  return Array.from(byId.values());
}

function rebuildDerivedIndexes(index) {
  index.cityById = new Map(index.cities.map((city) => [city.id, city]));
  index.placeById = buildPlaceMap(index.cities, index.counties);
  index.cityByKey = buildCityKeyMap(index.cities, index.municipalityChildren);
  index.cityByProvinceKey = buildCityProvinceKeyMap(index.cities, index.municipalityChildren);
  index.cityKeyEntries = Array.from(index.cityByKey.entries()).sort((a, b) => b[0].length - a[0].length);
  return index;
}

export function createPlaceIndex({ cities, counties, municipalityChildren = [] } = {}) {
  const cityList = (Array.isArray(cities) ? cities : [])
    .filter((city) => city && city.id)
    .map((city) => ({
      ...city,
      searchText: city.searchText || normalizeSearchText(`${city.name || ""} ${city.province || ""} ${city.pinyin || ""}`)
    }));
  const children = Array.isArray(municipalityChildren) ? municipalityChildren : [];
  const municipalityCounties = buildMunicipalityCountyEntries(children, cityList);
  const index = {
    cities: cityList,
    counties: deduplicateCounties([...municipalityCounties, ...(Array.isArray(counties) ? counties : [])]),
    municipalityChildren: children
  };
  return rebuildDerivedIndexes(index);
}

export function hydrateCountySummary(index, records) {
  if (!index || !Array.isArray(index.cities)) {
    throw new TypeError("A valid place index is required");
  }
  const byId = new Map(index.counties.map((county) => [county.id, county]));
  const merged = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== "object" || !record.id) return;
    const normalized = normalizeCountyRecord({ ...(byId.get(record.id) || {}), ...record });
    if (!normalized) return;
    byId.set(normalized.id, normalized);
    merged.push(normalized);
  });
  index.counties = deduplicateCounties(Array.from(byId.values()));
  rebuildDerivedIndexes(index);
  return merged;
}
