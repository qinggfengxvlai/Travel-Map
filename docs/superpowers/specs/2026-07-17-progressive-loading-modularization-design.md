# Progressive Loading and Frontend Modularization Design

## 1. Goal

Improve first-load and repeat-load performance without removing or weakening any existing capability. The first usable state must include the complete China map, all 372 prefecture boundaries, city points, search, city selection, route creation, saved-trip recovery, and the current trip-planning controls. County search, food content, city details, landmarks, metro lines, railway stations, trip editing, sharing, import, and both export formats must remain available through progressive loading.

This design supersedes the startup flow in `2026-07-08-map-lazy-loading-design.md`: county and food summaries will no longer block initial map rendering.

## 2. Current Bottlenecks

- `app.js` is about 164 KB raw and 40 KB gzip, and contains unrelated map, city-detail, food, and trip UI concerns.
- Startup waits on eight boundary chunks, city data, the global county summary, and the global food summary in one `Promise.all`.
- The global county and food summaries are about 59 KB and 95 KB gzip respectively.
- Core JSON uses `cache: "no-store"`, so repeat visits redownload unchanged versioned data.
- The public HTTP connection has unstable throughput; therefore both transfer size and the number of startup-critical requests matter.

## 3. Chosen Architecture

Use a two-stage refactor so performance improves early while module boundaries remain testable.

### 3.1 Stage 1: Remove non-critical startup waits

The critical startup path loads only:

- Leaflet runtime and CSS;
- `china-cities.json`;
- all eight lightweight prefecture boundary chunks;
- saved trip state needed to restore the current route.

After the critical data is ready, the application immediately initializes Leaflet, renders boundaries and city points, restores the route, enables city search, and exposes the existing planner controls.

County and food summaries start in the background after the map becomes usable. They do not participate in the critical `Promise.all`.

### 3.2 Stage 2: Split behavior into modules

`app.js` becomes a composition entry instead of the implementation home for every feature. The target modules are:

- `app-data.js`: versioned JSON loading, timeout/retry policy, critical dataset loading, background summary promises, and readiness state.
- `map-core.js`: Leaflet initialization, China boundary/city rendering, labels, viewport fitting, map-level route layers, and map selection events.
- `place-index.js`: city/county normalization, search indexes, place lookup, and incremental enrichment when county or food summaries arrive.
- `city-detail.js`: city-detail boundary rendering, district labels, landmarks, metro lines, railway/subway stations, and external OSM/DataV fallbacks. Loaded with dynamic `import()` on first city-detail entry and prefetched during idle time.
- `food-content.js`: food summary hydration, city chunk hydration, article indexes, food panel rendering, and article markers. Loaded in the background and awaited only when a food-dependent interaction requires it.
- `trip-controller.js`: DOM coordination for the existing `trip-plan.js`, `trip-editor.js`, `trip-archive.js`, and `guide-export.js` modules. It preserves the current TripPlan v2 model and all import/export/share behavior.
- `app.js`: DOM lookup, shared state creation, module wiring, critical startup, background prefetch scheduling, and top-level error reporting only.

Module extraction will preserve existing pure domain modules and avoid duplicate state. A single application context owns mutable state; feature modules receive only the state slices and callbacks they need.

## 4. Progressive Loading Flow

```text
HTML + critical CSS + Leaflet
  -> app entry and static core modules
  -> cities + 8 boundary chunks + saved trip recovery
  -> render complete China map and enable core interaction
  -> schedule background county/food summary loads
  -> idle-prefetch city-detail and trip controller chunks
  -> user interaction awaits only the specific module/data it needs
```

### 4.1 County behavior

- City-name search is immediately available from city data.
- County search results appear as soon as the county summary finishes in the background.
- If a shared or saved trip references a county before the summary is ready, the application awaits the shared county-summary promise before resolving the place; it does not discard the route.
- Selecting a county continues to load its existing per-city county chunk before entering city detail.

### 4.2 Food behavior

- The food panel initially shows its existing empty/loading state without delaying the map.
- The global food summary hydrates indexes in the background and refreshes badges, search text, and the visible panel exactly once when ready.
- Entering a city awaits that city's existing food chunk if required, so article cards and markers remain complete even if background loading has not finished.

### 4.3 City-detail behavior

- The first city-detail action dynamically imports `city-detail.js` and shows the existing loading status while it loads.
- Subsequent city-detail visits reuse the same module promise.
- An idle prefetch begins after the map is interactive, reducing the chance that the user observes a delay.
- DataV and OSM failures keep the current local-data fallbacks and do not affect China-map interaction.

### 4.4 Trip behavior

- Saved/share state recovery occurs before initial route rendering.
- The trip controller may load in parallel with map data, but the map does not wait for export-specific code.
- Guide generators are dynamically imported on the first Markdown or HTML export and prefetched during idle time.
- Controls remain visible throughout; a command issued before its module is ready awaits the shared module promise and executes once, rather than being ignored.

## 5. Caching and Versioning

- Replace `no-store` for immutable versioned JS, CSS, and JSON with normal browser caching.
- Every deploy changes a single asset version constant or content-hashed filename, so new releases bypass old cached content.
- Nginx serves versioned assets with long-lived `Cache-Control: public, max-age=31536000, immutable` headers.
- `index.html` uses `no-cache` so the browser revalidates the entry document and discovers a new release.
- Precompressed gzip files are generated for every production JS, CSS, HTML, and JSON asset that benefits from compression.

Caching is a delivery optimization only; no application feature depends on stale data. A release version change invalidates all affected resources.

## 6. Concurrency, Errors, and Race Safety

- Every optional dataset has one memoized promise, preventing duplicate requests from background prefetch and user interaction.
- Critical city data remains mandatory. Boundary chunks retry once; if a chunk still fails, the map remains usable and reports incomplete boundary loading instead of silently claiming success.
- County and food failures retain existing per-city fallback loaders and show a scoped message only where the missing data matters.
- Incremental hydration is idempotent: repeated completion callbacks do not duplicate counties, articles, markers, or search records.
- Dynamic imports use one shared promise per module and surface a retryable UI error if loading fails.
- Background work is scheduled after critical rendering with `requestIdleCallback` when available and a short `setTimeout` fallback otherwise.

## 7. Functional Invariants

The refactor must preserve:

- all 372 city boundaries and existing map styling;
- city and county search;
- route creation, undo, clear, reset, and transport/pace controls;
- editable TripPlan v2 calendar, drag/move commands, validation, and undo;
- local persistence, legacy migration, sharing, JSON import/export;
- Markdown and printable HTML exports;
- district boundaries, landmarks, metro lines, railway and subway stations;
- food article search, panel content, markers, and article reader links;
- desktop and mobile interaction paths.

No dataset or UI control will be removed to meet a size target.

## 8. Performance Budgets

Budgets are measured with gzip transfer sizes from the deployed server:

- no county or food summary request may be required before China-map rendering;
- each critical boundary request remains below 10 KB gzip;
- no newly created startup-critical JavaScript chunk may exceed 20 KB gzip;
- the sum of startup-critical application JavaScript, excluding Leaflet, must be lower than the current application/module total;
- repeat requests for versioned assets must return cacheable headers;
- HTML must remain independently revalidatable.

Public-network timing is recorded before and after deployment, but absolute seconds are observational because the current route is unstable. Transfer bytes, request dependency order, cache headers, and browser readiness marks are the authoritative performance gates.

## 9. Testing Strategy

Follow TDD for each behavior change.

- Unit-test critical-data loading independently from background summary loading.
- Test memoization, retry, timeout, and idempotent hydration with real module functions.
- Test that county/food failures cannot reject critical startup.
- Test dynamic module promise reuse and interaction queuing.
- Preserve the existing 144 domain and rendered-structure tests.
- Add static dependency tests proving `app.js` no longer directly owns city-detail, food, and trip implementation blocks.
- Add data-integrity tests proving eight chunks still contain 372 features.
- Add a browser smoke test covering initial map readiness, city selection, route creation, county search after hydration, city detail, food content, trip editing, import/export, and both guide exports.
- Verify Nginx configuration, gzip responses, cache headers, and public resource status after deployment.

## 10. Rollout

1. Add instrumentation and regression tests for the current loading order.
2. Extract `app-data.js` and remove county/food summaries from the critical path.
3. Extract place indexing and map core while keeping behavior unchanged.
4. Extract city detail and food content behind memoized dynamic imports.
5. Extract trip DOM coordination and lazy-load export generators.
6. Enable versioned immutable caching and precompression.
7. Deploy, run functional/browser smoke checks, compare network evidence, and retain the previous static directory as a rollback copy until validation finishes.

Each step must leave the site deployable and all completed tests green. Deployment occurs only after local regression tests and syntax checks pass.
