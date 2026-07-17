import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createFoodController,
  createFoodStore
} from "../public/static-site/food-content.js";

const normalizeSearchText = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

function knownPlaces(...ids) {
  return new Map(ids.map((id) => [id, { id, searchText: id, placeType: id.includes("county") ? "county" : "city" }]));
}

function article(overrides = {}) {
  return {
    id: "food-1",
    cityId: "hangzhou",
    placeId: "hangzhou",
    title: "West Lake Food",
    description: "summary description",
    foods: ["noodles"],
    day: 2,
    lat: 30.25,
    lon: 120.16,
    ...overrides
  };
}

test("summary and city hydration preserve richer city fields in both arrival orders", () => {
  const summary = article({ title: "summary title", description: "summary description" });
  const city = article({ title: "city title", foods: ["city noodles"], readerPath: "./reader.html" });

  const summaryThenCity = createFoodStore({ knownPlaces: knownPlaces("hangzhou"), normalizeSearchText });
  summaryThenCity.hydrate([summary], { source: "summary" });
  summaryThenCity.hydrate([city], { source: "city" });

  const cityThenSummary = createFoodStore({ knownPlaces: knownPlaces("hangzhou"), normalizeSearchText });
  cityThenSummary.hydrate([city], { source: "city" });
  cityThenSummary.hydrate([summary], { source: "summary" });

  assert.deepEqual(summaryThenCity.articles, cityThenSummary.articles);
  assert.deepEqual(summaryThenCity.byId.get("food-1"), { ...summary, ...city, searchText: "city title summary description city noodles" });
});

test("hydration ignores malformed records, is idempotent by ID, and rebuilds every index", () => {
  const store = createFoodStore({ knownPlaces: knownPlaces("hangzhou", "west-lake-county"), normalizeSearchText });
  assert.strictEqual(store.hydrate(null, { source: "summary" }), store);
  assert.strictEqual(store.hydrate({}, { source: "summary" }), store);

  store.hydrate([
    null,
    {},
    article(),
    article(),
    article({ id: "food-2", placeId: "west-lake-county", day: 1 }),
    article({ id: "unknown", cityId: "missing", placeId: "missing" })
  ], { source: "city" });

  assert.deepEqual(store.articles.map(({ id }) => id), ["food-2", "food-1"]);
  assert.equal(store.byId.size, 2);
  assert.equal(store.byCity.get("hangzhou").length, 2);
  assert.equal(store.byPlace.get("west-lake-county").length, 1);
});

test("known places can refresh after county or runtime-place hydration", () => {
  const initialPlaces = knownPlaces("hangzhou");
  const store = createFoodStore({ knownPlaces: initialPlaces, normalizeSearchText });
  const countyArticle = article({ id: "county-food", placeId: "runtime-county" });

  store.hydrate([countyArticle], { source: "city" });
  assert.equal(store.byId.has("county-food"), true, "a known parent city keeps county content available");

  const refreshedPlaces = knownPlaces("hangzhou", "runtime-county");
  store.refreshKnownPlaces(refreshedPlaces);

  assert.equal(store.byPlace.get("runtime-county")[0].id, "county-food");
  assert.match(refreshedPlaces.get("runtime-county").searchText, /city noodles|noodles/);
});

function fakePanelElements() {
  const children = [];
  const document = {
    createElement(tagName) {
      return { tagName, className: "", innerHTML: "" };
    }
  };
  return {
    document,
    articleCount: { textContent: "" },
    articleList: {
      children,
      replaceChildren() { children.length = 0; },
      append(child) { children.push(child); }
    },
    emptyState: { hidden: false }
  };
}

function controllerForHostname(hostname) {
  return createFoodController({
    state: { placeById: knownPlaces("hangzhou") },
    helpers: { normalizeSearchText, location: { hostname } }
  });
}

test("reader paths preserve safe same-origin summaries and safe external URL precedence", () => {
  const production = controllerForHostname("travel.example.com");
  const localhost = controllerForHostname("localhost");
  const readerPath = "exports/wechat_articles/readers/food-1.html";
  const externalUrl = "https://mp.weixin.qq.com/s/example";

  assert.equal(production.articleReaderPath({ readerPath }), readerPath);
  assert.equal(production.articleReaderPath({ readerPath, url: externalUrl }), externalUrl);
  assert.equal(localhost.articleReaderPath({ readerPath, url: externalUrl }), readerPath);
  assert.equal(production.articleReaderPath({ readerPath, url: "javascript:alert(1)" }), readerPath);
  assert.equal(production.articleReaderPath({ readerPath: "../private.html" }), "#");
  assert.equal(production.articleReaderPath({ readerPath: "//evil.example/reader", url: "data:text/html,bad" }), "#");
  assert.equal(production.articleReaderPath({ readerPath: "javascript:alert(1)" }), "#");
});

test("production resolves a representative summary readerPath without an external URL", async () => {
  const summaryPath = new URL("../public/static-site/data/wechat-food-summary.json", import.meta.url);
  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  const record = summary.articles.find((item) => item.readerPath && !item.url);
  assert.ok(record, "fixture must include a summary-only reader path");

  const places = knownPlaces(record.cityId, record.placeId);
  const controller = createFoodController({
    state: { placeById: places },
    helpers: { normalizeSearchText, location: { hostname: "travel.example.com" } }
  });
  controller.hydrateSummary({ articles: [record] });

  assert.equal(controller.articlesForCity(record.cityId)[0].id, record.id);
  assert.equal(controller.articleReaderPath(record), record.readerPath);
});

test("controller retries invalid city chunks and renders safe local article assets and marker descriptors", async () => {
  const places = knownPlaces("hangzhou");
  const elements = fakePanelElements();
  const payloads = [null, { articles: [article({
    title: `<unsafe>`,
    foods: ["tea & cake"],
    coverImage: "./covers/local.jpg",
    readerPath: "./reader.html",
    url: "https://example.com/original"
  })] }];
  let requests = 0;
  const controller = createFoodController({
    state: { placeById: places },
    elements,
    data: {
      async loadOptionalJson(path) {
        requests += 1;
        assert.equal(path, "./data/food-articles/by-city/hangzhou.json");
        return payloads.shift();
      }
    },
    helpers: {
      normalizeSearchText,
      escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
      },
      hasCoordinates(value) { return Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lon)); },
      shouldUseLocalArticleAssets: () => true
    }
  });

  assert.deepEqual(await controller.ensureCity("hangzhou"), []);
  const loaded = await controller.ensureCity("hangzhou");
  assert.equal(requests, 2, "invalid payload must remain retryable");
  assert.equal(loaded.length, 1);

  controller.renderPanel({ selected: places.get("hangzhou"), viewMode: "china", activeCityViewId: null });
  assert.equal(elements.articleCount.textContent, "1 篇");
  assert.equal(elements.emptyState.hidden, true);
  assert.equal(elements.articleList.children.length, 1);
  assert.match(elements.articleList.children[0].innerHTML, /\.\/covers\/local\.jpg/);
  assert.match(elements.articleList.children[0].innerHTML, /href="\.\/reader\.html"/);
  assert.doesNotMatch(elements.articleList.children[0].innerHTML, /<unsafe>/);

  const markers = controller.renderMarkers(controller.articlesForCity("hangzhou"));
  assert.equal(markers.length, 1);
  assert.equal(markers[0].lat, 30.25);
  assert.equal(markers[0].lon, 120.16);
  assert.match(markers[0].popupHtml, /&lt;unsafe&gt;/);
  assert.match(markers[0].popupHtml, /\.\/covers\/local\.jpg/);
});

test("controller coalesces concurrent city loads and ignores stale completion without marking the city loaded", async () => {
  let resolve;
  let requests = 0;
  const pending = new Promise((done) => { resolve = done; });
  const controller = createFoodController({
    state: { placeById: knownPlaces("hangzhou") },
    elements: fakePanelElements(),
    data: { loadOptionalJson: async () => { requests += 1; return pending; } },
    helpers: { normalizeSearchText, isFoodArticlesPayload: (value) => Array.isArray(value?.articles) }
  });

  const first = controller.ensureCity("hangzhou", { isCurrent: () => false });
  const second = controller.ensureCity("hangzhou", { isCurrent: () => false });
  resolve({ articles: [article()] });
  await Promise.all([first, second]);
  assert.equal(requests, 1);
  assert.equal(controller.articlesForCity("hangzhou").length, 0);
});
