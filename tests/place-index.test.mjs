import test from "node:test";
import assert from "node:assert/strict";
import * as placeIndexModule from "../public/static-site/place-index.js";

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

test("exposes only the stable place-index API", () => {
  assert.deepEqual(Object.keys(placeIndexModule).sort(), [
    "createPlaceIndex",
    "hydrateCountySummary",
    "normalizeKey",
    "normalizeSearchText",
    "upsertRuntimePlaces"
  ]);
});

test("isolates the index from input arrays and their records", () => {
  const cityInput = cities.map((city) => ({ ...city }));
  const countyInput = [{ id: "county-input", name: "输入县", parentCityId: "lvliang" }];
  const childInput = municipalityChildren.map((child) => ({ ...child }));
  const index = createPlaceIndex({
    cities: cityInput,
    counties: countyInput,
    municipalityChildren: childInput
  });

  cityInput.push({ id: "late-city", name: "后来市" });
  countyInput.push({ id: "late-county", name: "后来县" });
  childInput.push({ name: "后来区", pinyin: "Later", province: "北京" });
  cityInput[0].name = "被外部修改";
  countyInput[0].name = "被外部修改";
  childInput[0].pinyin = "Mutated";

  assert.equal(index.cities.length, cities.length);
  assert.equal(index.placeById.has("late-city"), false);
  assert.equal(index.placeById.has("late-county"), false);
  assert.equal(index.municipalityChildren.length, municipalityChildren.length);
  assert.equal(index.cityById.get("beijing").name, cities[0].name);
  assert.equal(index.placeById.get("county-input").name, "输入县");
  assert.equal(index.municipalityChildren[0].pinyin, municipalityChildren[0].pinyin);
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

test("runtime places survive cross-city county hydration without entering canonical collections", () => {
  const index = createPlaceIndex({ cities, counties: [], municipalityChildren });
  const runtimeA = {
    id: "beijing-district-runtime-a",
    name: "运行时甲区",
    parentCityId: "beijing",
    lon: 116.5,
    lat: 39.8,
    placeType: "county"
  };

  placeIndexModule.upsertRuntimePlaces(index, [runtimeA]);
  hydrateCountySummary(index, [{
    id: "lvliang-county-b",
    name: "乙县",
    pinyin: "Yixian",
    parentCityId: "lvliang",
    parentCityName: "吕梁"
  }]);

  assert.equal(index.placeById.get(runtimeA.id).name, runtimeA.name);
  assert.equal(index.placeById.get("lvliang-county-b").name, "乙县");
  assert.equal(index.cityById.get("beijing").id, "beijing");
  assert.equal(index.cityById.get("lvliang").id, "lvliang");
  assert.equal(index.counties.some((county) => county.id === runtimeA.id), false);

  placeIndexModule.upsertRuntimePlaces(index, [{
    id: "lvliang-county-b",
    name: "运行时乙县详情",
    lon: 111.2,
    lat: 37.6,
    placeType: "county"
  }]);
  assert.equal(index.placeById.get("lvliang-county-b").name, "运行时乙县详情");
  assert.equal(index.counties.find((county) => county.id === "lvliang-county-b").name, "乙县");

  placeIndexModule.upsertRuntimePlaces(index, [{
    id: "beijing",
    name: "不能覆盖城市",
    placeType: "county"
  }]);
  assert.equal(index.placeById.get("beijing").name, cities[0].name);
  assert.equal(index.cityById.get("beijing").name, cities[0].name);
});

test("same-id raw county records merge before deriving searchable identity", () => {
  const index = createPlaceIndex({
    cities,
    municipalityChildren: [],
    counties: [
      {
        id: "county-raw-merge",
        name: "旧县",
        pinyin: "Jiuxian",
        province: "山西",
        parentCityId: "lvliang",
        parentCityName: "吕梁",
        parentCityPinyin: "Lvliang"
      },
      { id: "county-raw-merge", name: "新县" }
    ]
  });

  const county = index.placeById.get("county-raw-merge");
  assert.equal(county.name, "新县");
  assert.equal(county.pinyin, "Jiuxian");
  assert.match(county.searchText, /新县/);
  assert.match(county.searchText, /jiuxian/);
  assert.match(county.searchText, /吕梁/);
  assert.match(county.searchText, /lvliang/);
});

test("only non-empty string search text overrides derived county search text", () => {
  for (const [id, searchText] of [["blank", "   "], ["null", null], ["number", 42]]) {
    const index = createPlaceIndex({
      cities,
      municipalityChildren: [],
      counties: [{ id, name: `派生${id}县`, pinyin: "Derived", parentCityName: "北京", searchText }]
    });
    assert.match(index.placeById.get(id).searchText, /derived/);
    assert.match(index.placeById.get(id).searchText, /北京/);
  }

  const explicit = createPlaceIndex({
    cities,
    municipalityChildren: [],
    counties: [{ id: "explicit", name: "显式县", searchText: " custom-search " }]
  });
  assert.equal(explicit.placeById.get("explicit").searchText, " custom-search ");
});

test("county replacement recomputes derived search text and retains omitted fields", () => {
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

  hydrateCountySummary(index, [{
    id: "county-2",
    name: "新县名",
    pinyin: "Xinxian",
    parentCityId: "beijing",
    parentCityName: "北京"
  }]);

  const county = index.placeById.get("county-2");
  assert.equal(county.name, "新县名");
  assert.equal(county.parentCityId, "beijing");
  assert.equal(county.lon, 111);
  assert.match(county.searchText, /新县名/);
  assert.match(county.searchText, /xinxian/);
  assert.match(county.searchText, /北京/);
  assert.doesNotMatch(county.searchText, /旧县名|jiuxian/);

  hydrateCountySummary(index, [{
    id: "county-2",
    name: "自定义检索县",
    searchText: "explicit-search-text"
  }]);
  assert.equal(index.placeById.get("county-2").searchText, "explicit-search-text");
  assert.equal(index.placeById.get("county-2").lon, 111);
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
