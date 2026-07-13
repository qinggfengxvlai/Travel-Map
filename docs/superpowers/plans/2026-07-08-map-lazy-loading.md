# Map Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split county and food article detail data into city-level chunks so the map loads lighter summary data on startup.

**Architecture:** Add one data build script that derives summary and by-city files from existing canonical data. Update `app.js` so startup hydrates summaries, then city detail rendering calls explicit `ensureCityCounties` and `ensureCityFoodArticles` helpers before drawing county and food layers.

**Tech Stack:** Static HTML, Leaflet, browser `fetch`, Node.js data generation scripts.

---

### Task 1: Generate Lazy Data Files

**Files:**
- Create: `scripts/build_lazy_map_data.js`
- Generate: `data/counties-summary.json`
- Generate: `data/counties/by-city/*.json`
- Generate: `data/wechat-food-summary.json`
- Generate: `data/food-articles/by-city/*.json`

- [ ] Add a Node script that reads `data/china-counties.json` and `data/wechat-food-articles.json`, groups records by `parentCityId` / `cityId`, writes summary files, and writes city chunk files.
- [ ] Run `node scripts\build_lazy_map_data.js`.
- [ ] Confirm the script reports county and article chunk counts.

### Task 2: Update Startup Data Loading

**Files:**
- Modify: `app.js`

- [ ] Change `loadMapData` so it loads `china-prefectures.json`, `china-cities.json`, `counties-summary.json`, and `wechat-food-summary.json`.
- [ ] Keep `state.counties` as summary records at startup.
- [ ] Add caches for loaded county chunks and food article chunks.
- [ ] Hydrate food search/counts from summary data.

### Task 3: Add City Chunk Loaders

**Files:**
- Modify: `app.js`

- [ ] Add `ensureCityCounties(cityId)` that fetches `data/counties/by-city/<cityId>.json`, upgrades `state.counties`, and registers full records in `state.placeById`.
- [ ] Add `ensureCityFoodArticles(cityId)` that fetches `data/food-articles/by-city/<cityId>.json`, upgrades `state.foodArticles`, and refreshes article group maps.
- [ ] Make city detail rendering call both helpers before computing subareas and rendering food markers.

### Task 4: Preserve Search Behavior

**Files:**
- Modify: `app.js`

- [ ] When a county search result is selected, load its parent city's county chunk before using coordinates or route selection.
- [ ] Keep article badges and food keyword search powered by summary data.

### Task 5: Verify

**Files:**
- Modify: none

- [ ] Run `node --check app.js`.
- [ ] Run `node --check scripts\build_lazy_map_data.js`.
- [ ] Run `node scripts\build_lazy_map_data.js`.
- [ ] Request `http://127.0.0.1:4177/?v=lazy-data-1`.
- [ ] Use browser automation or direct data checks to confirm a food city loads chunks on demand.
