import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlaceIndex,
  hydrateCountySummary,
  normalizeKey,
  normalizeSearchText
} from "../public/static-site/place-index.js";

const cities = [
  { id: "beijing", name: "北京", province: "北京", pinyin: "Běi Jīng", lon: 116.4, lat: 39.9 },
  { id: "lvliang", name: "吕梁", province: "山西", pinyin: "Lüliang", lon: 111.1, lat: 37.5 }
];

const municipalityChildren = [
  { name: "朝阳区", pinyin: "Chaoyang Qu", province: "北京", code: "110105", lon: 116.49, lat: 39.92 }
];

test("normalizes Chinese search text and accented/spaced pinyin keys", () => {
  assert.equal(normalizeSearchText(" 北 京  Běi Jīng "), "北京beijing");
  assert.equal(normalizeKey("Lǚ-liáng Dìqū"), "luliang");
});

test("creates municipality counties, aliases, and city key maps without a DOM", () => {
  assert.equal(typeof document, "undefined");
  const index = createPlaceIndex({ cities, counties: [], municipalityChildren });

  const child = index.placeById.get("beijing-Chaoyang Qu");
  assert.equal(child.name, "朝阳区");
  assert.equal(child.parentCityId, "beijing");
  assert.equal(child.placeType, "county");
  assert.equal(index.cityByKey.get("chaoyangqu").id, "beijing");
  assert.equal(index.cityByProvinceKey.get("北京|chaoyangqu").id, "beijing");
  assert.equal(index.cityByKey.get("luliang").id, "lvliang");
  assert.deepEqual(index.cityKeyEntries, [...index.cityByKey.entries()].sort((a, b) => b[0].length - a[0].length));
});

test("hydrates counties idempotently, deduplicates by id, and preserves cities", () => {
  const index = createPlaceIndex({ cities, counties: [], municipalityChildren });
  const originalCities = index.cities;
  const records = [
    { id: "county-1", name: "测试县", pinyin: "Ceshi", province: "测试省", parentCityId: "lvliang", parentCityName: "吕梁" },
    { id: "county-1", name: "测试县（新）", pinyin: "Ceshi", province: "测试省", parentCityId: "lvliang", parentCityName: "吕梁" }
  ];

  hydrateCountySummary(index, records);
  hydrateCountySummary(index, records);

  assert.strictEqual(index.cities, originalCities);
  assert.equal(index.cityById.size, 2);
  assert.equal(index.counties.filter((county) => county.id === "county-1").length, 1);
  assert.equal(index.placeById.get("county-1").name, "测试县（新）");
  assert.equal(index.placeById.get("beijing").placeType, "city");
});

test("replaces a county by id while retaining omitted existing fields", () => {
  const index = createPlaceIndex({
    cities,
    municipalityChildren,
    counties: [{
      id: "county-2",
      name: "旧县名",
      pinyin: "Jiuxian",
      province: "山西",
      parentCityId: "lvliang",
      parentCityName: "吕梁",
      lon: 111,
      lat: 37
    }]
  });

  hydrateCountySummary(index, [{ id: "county-2", name: "新县名" }]);

  const county = index.placeById.get("county-2");
  assert.equal(county.name, "新县名");
  assert.equal(county.parentCityId, "lvliang");
  assert.equal(county.lon, 111);
  assert.match(county.searchText, /旧县名/);
});

test("ignores malformed county records and rebuilds every derived map", () => {
  const index = createPlaceIndex({ cities, counties: null, municipalityChildren });
  const oldCityMap = index.cityById;
  const oldPlaceMap = index.placeById;
  const oldKeyMap = index.cityByKey;

  const merged = hydrateCountySummary(index, [null, {}, { id: "" }, { id: "valid", name: "有效县", parentCityId: "beijing" }]);

  assert.deepEqual(merged.map((county) => county.id), ["valid"]);
  assert.notStrictEqual(index.cityById, oldCityMap);
  assert.notStrictEqual(index.placeById, oldPlaceMap);
  assert.notStrictEqual(index.cityByKey, oldKeyMap);
  assert.equal(index.counties.some((county) => !county.id), false);
  assert.equal(index.placeById.get("valid").searchType, "county");
});
