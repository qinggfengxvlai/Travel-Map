function defaultEscapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function isFoodPayload(value) {
  return Boolean(value) && typeof value === "object" && Array.isArray(value.articles);
}

function validArticle(article) {
  return Boolean(article) && typeof article === "object" && typeof article.id === "string" && article.id.length > 0;
}

function articleSearchText(article, normalizeSearchText) {
  if (typeof article.searchText === "string" && article.searchText) return article.searchText;
  return normalizeSearchText([
    article.title,
    article.description,
    article.cityName,
    article.countyName,
    ...(Array.isArray(article.foods) ? article.foods : [])
  ].filter(Boolean).join(" "));
}

function groupArticles(articles, field) {
  const grouped = new Map();
  articles.forEach((article) => {
    const key = article[field];
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(article);
  });
  return grouped;
}

export function createFoodStore({ knownPlaces, normalizeSearchText }) {
  if (!(knownPlaces instanceof Map)) throw new TypeError("knownPlaces must be a Map");
  if (typeof normalizeSearchText !== "function") throw new TypeError("normalizeSearchText must be a function");

  let places = knownPlaces;
  const sourceById = new Map();
  const baseSearchTextByPlace = new Map();
  const placeObjectById = new Map();
  const store = {
    articles: [],
    byId: new Map(),
    byCity: new Map(),
    byPlace: new Map(),

    refreshKnownPlaces(nextKnownPlaces) {
      if (!(nextKnownPlaces instanceof Map)) return store;
      places = nextKnownPlaces;
      captureBaseSearchText();
      enrichKnownPlaces();
      return store;
    },

    hydrate(records, { source = "city" } = {}) {
      if (!Array.isArray(records) || !records.length) return store;
      const incomingSource = source === "summary" ? "summary" : "city";
      const mergedById = new Map(store.articles.map((item) => [item.id, item]));
      let acceptedRecord = false;

      records.forEach((record) => {
        if (!validArticle(record)) return;
        if (!places.has(record.placeId) && !places.has(record.cityId)) return;
        acceptedRecord = true;
        const normalizedRecord = {
          ...record,
          searchText: articleSearchText(record, normalizeSearchText)
        };
        const previous = mergedById.get(record.id);
        const previousSource = sourceById.get(record.id);
        let merged;
        if (!previous) {
          merged = normalizedRecord;
        } else if (incomingSource === "city") {
          merged = { ...previous, ...normalizedRecord };
        } else if (previousSource === "city") {
          merged = { ...normalizedRecord, ...previous };
        } else {
          merged = { ...previous, ...normalizedRecord };
        }
        mergedById.set(record.id, merged);
        if (incomingSource === "city" || previousSource !== "city") sourceById.set(record.id, incomingSource);
      });

      if (!acceptedRecord) return store;
      store.articles = Array.from(mergedById.values()).sort((left, right) => (
        Number(left.day || 0) - Number(right.day || 0) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      ));
      rebuildIndexes();
      return store;
    }
  };

  function captureBaseSearchText() {
    places.forEach((place, id) => {
      if (!place || typeof place !== "object" || placeObjectById.get(id) === place) return;
      placeObjectById.set(id, place);
      baseSearchTextByPlace.set(id, String(place.searchText || ""));
    });
  }

  function enrichKnownPlaces() {
    places.forEach((place, id) => {
      if (!place || typeof place !== "object") return;
      const articles = place.placeType === "county"
        ? store.byPlace.get(id) || []
        : store.byCity.get(id) || [];
      const articleText = articles.flatMap((item) => [
        item.title,
        item.description,
        ...(Array.isArray(item.foods) ? item.foods : [])
      ]).filter(Boolean).join(" ");
      place.searchText = normalizeSearchText(`${baseSearchTextByPlace.get(id) || ""} ${articleText}`);
    });
  }

  function rebuildIndexes() {
    store.byId = new Map(store.articles.map((item) => [item.id, item]));
    store.byCity = groupArticles(store.articles, "cityId");
    store.byPlace = groupArticles(store.articles, "placeId");
    captureBaseSearchText();
    enrichKnownPlaces();
  }

  captureBaseSearchText();
  return store;
}

function safeExternalUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function safeLocalPath(value) {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(candidate)) return "";
  return candidate;
}

function foodMarkerOffset(index) {
  if (!index) return { lat: 0, lon: 0 };
  const angle = index * 1.9;
  const radius = Math.min(0.035, 0.006 + index * 0.0025);
  return {
    lat: Math.sin(angle) * radius,
    lon: Math.cos(angle) * radius
  };
}

export function createFoodController({ state, elements = {}, data = {}, helpers = {} }) {
  if (!state || !(state.placeById instanceof Map)) throw new TypeError("state.placeById must be a Map");
  if (typeof helpers.normalizeSearchText !== "function") throw new TypeError("helpers.normalizeSearchText must be a function");

  const escapeHtml = helpers.escapeHtml || defaultEscapeHtml;
  const hasCoordinates = helpers.hasCoordinates || ((value) => (
    Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lon))
  ));
  const shouldUseLocalArticleAssets = helpers.shouldUseLocalArticleAssets || (() => (
    ["", "localhost", "127.0.0.1"].includes(helpers.location?.hostname)
  ));
  const validatePayload = helpers.isFoodArticlesPayload || isFoodPayload;
  const loadOptionalJson = data.loadOptionalJson;
  const loadedCityIds = new Set();
  const cityLoadPromises = new Map();
  const store = createFoodStore({
    knownPlaces: state.placeById,
    normalizeSearchText: helpers.normalizeSearchText
  });

  function articleReaderPath(article) {
    const externalUrl = safeExternalUrl(article.url);
    if (!shouldUseLocalArticleAssets()) return externalUrl || "#";
    return [article.readerPath, article.pdfPath, article.htmlPath, article.markdownPath]
      .map(safeLocalPath)
      .find(Boolean) || externalUrl || "#";
  }

  function articleCoverImage(article) {
    return shouldUseLocalArticleAssets() ? safeLocalPath(article.coverImage) : "";
  }

  function popupHtml(article) {
    const readerPath = articleReaderPath(article);
    const coverImage = articleCoverImage(article);
    const cover = coverImage
      ? `<img class="food-popup-cover" src="${escapeHtml(coverImage)}" alt="" loading="lazy" />`
      : "";
    const foods = (Array.isArray(article.foods) ? article.foods : [])
      .slice(0, 8)
      .map((food) => `<span>${escapeHtml(food)}</span>`)
      .join("");
    const originalUrl = safeExternalUrl(article.url);
    return `
      <article class="food-popup">
        ${cover}
        <p class="food-popup-kicker">${article.day ? `第 ${article.day} 天` : "食行记"} · ${escapeHtml(article.locationText || article.cityName || "")}</p>
        <h3>${escapeHtml(article.title || "")}</h3>
        <p>${escapeHtml(article.description || "")}</p>
        <div class="food-tags">${foods}</div>
        <div class="food-popup-actions">
          <a href="${escapeHtml(readerPath)}" target="_blank" rel="noopener">${article.pdfPath ? "打开 PDF" : "打开图文页"}</a>
          ${originalUrl ? `<a href="${escapeHtml(originalUrl)}" target="_blank" rel="noopener">原文</a>` : ""}
        </div>
      </article>
    `;
  }

  function articlesForCity(cityId) {
    return store.byCity.get(cityId) || [];
  }

  function articlesForPlace(placeId) {
    return store.byPlace.get(placeId) || [];
  }

  function selectedArticles({ selected, viewMode, activeCityViewId } = {}) {
    if (selected?.placeType === "county") return articlesForPlace(selected.id);
    if (selected) return articlesForCity(selected.id);
    if (viewMode === "city" && activeCityViewId) return articlesForCity(activeCityViewId);
    return [];
  }

  function renderPanel(selection = {}) {
    const articleCount = elements.articleCount || elements.foodArticleCount;
    const articleList = elements.articleList || elements.foodArticleList;
    const emptyState = elements.emptyState || elements.foodEmptyState;
    if (!articleList || !articleCount || !emptyState) return [];
    const articles = selectedArticles(selection);
    articleCount.textContent = `${articles.length} 篇`;
    articleList.replaceChildren();
    emptyState.hidden = articles.length > 0;
    const documentRef = elements.document;
    if (!documentRef || typeof documentRef.createElement !== "function") return articles;

    articles.slice(0, 8).forEach((item) => {
      const card = documentRef.createElement("article");
      card.className = "food-card";
      const readerPath = articleReaderPath(item);
      const coverImage = articleCoverImage(item);
      const cover = coverImage
        ? `<img src="${escapeHtml(coverImage)}" alt="" loading="lazy" />`
        : `<span class="food-card-placeholder">食</span>`;
      card.innerHTML = `
        <a class="food-card-media" href="${escapeHtml(readerPath)}" target="_blank" rel="noopener">${cover}</a>
        <div class="food-card-body">
          <p>${item.day ? `第 ${item.day} 天` : "食行记"} · ${escapeHtml(item.locationText || item.cityName || "")}</p>
          <h3><a href="${escapeHtml(readerPath)}" target="_blank" rel="noopener">${escapeHtml(item.title || "")}</a></h3>
          <span>${escapeHtml((item.foods || []).slice(0, 5).join("、") || item.description || "")}</span>
        </div>
      `;
      articleList.append(card);
    });
    return articles;
  }

  function renderMarkers(articles) {
    const placeOffsets = new Map();
    return (Array.isArray(articles) ? articles : [])
      .filter(hasCoordinates)
      .map((item) => {
        const offsetIndex = placeOffsets.get(item.placeId) || 0;
        placeOffsets.set(item.placeId, offsetIndex + 1);
        const offset = foodMarkerOffset(offsetIndex);
        return {
          title: item.title,
          lat: Number(item.lat) + offset.lat,
          lon: Number(item.lon) + offset.lon,
          popupHtml: popupHtml(item)
        };
      });
  }

  async function ensureCity(cityId, { isCurrent = () => true } = {}) {
    if (!cityId || loadedCityIds.has(cityId)) return articlesForCity(cityId);
    if (typeof loadOptionalJson !== "function") return articlesForCity(cityId);
    if (!cityLoadPromises.has(cityId)) {
      const request = Promise.resolve(loadOptionalJson(`./data/food-articles/by-city/${cityId}.json`, { quiet: true }))
        .finally(() => cityLoadPromises.delete(cityId));
      cityLoadPromises.set(cityId, request);
    }
    const payload = await cityLoadPromises.get(cityId);
    if (!isCurrent() || !validatePayload(payload)) return articlesForCity(cityId);
    store.hydrate(payload.articles, { source: "city" });
    loadedCityIds.add(cityId);
    return articlesForCity(cityId);
  }

  function suggestionsForPlace(place, city) {
    const articles = place?.placeType === "county"
      ? articlesForPlace(place.id)
      : articlesForCity(city?.id || place?.id);
    return articles.slice(0, 3).flatMap((item) => (item.foods || []).slice(0, 3));
  }

  return {
    store,
    refreshKnownPlaces(knownPlaces) {
      store.refreshKnownPlaces(knownPlaces);
      return store;
    },
    hydrateSummary(summary) {
      if (validatePayload(summary)) store.hydrate(summary.articles, { source: "summary" });
      return store;
    },
    ensureCity,
    renderPanel,
    renderMarkers,
    articlesForCity,
    articlesForPlace,
    articleCountForCity: (cityId) => articlesForCity(cityId).length,
    articleCountForPlace: (placeId) => articlesForPlace(placeId).length,
    suggestionsForPlace,
    articleReaderPath,
    articleCoverImage
  };
}
