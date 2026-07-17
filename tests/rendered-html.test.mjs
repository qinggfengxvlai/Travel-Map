import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../public/static-site/index.html", import.meta.url);
const appUrl = new URL("../public/static-site/app.js", import.meta.url);
const stylesUrl = new URL("../public/static-site/styles.css", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);
const litePrefectureUrls = Array.from(
  { length: 8 },
  (_, index) => new URL(`../public/static-site/data/china-prefectures-lite-${index + 1}.json`, import.meta.url)
);
const plannerIds = [
  "tripNameInput",
  "tripStartDateInput",
  "autoScheduleBtn",
  "undoTripEditBtn",
  "tripHealth",
  "tripEditorRoot",
  "itineraryEmptyState"
];

const tripItemFormNames = [
  "dayId",
  "itemId",
  "type",
  "placeId",
  "title",
  "serviceNo",
  "fromPlaceId",
  "toPlaceId",
  "startTime",
  "endTime",
  "endDayOffset",
  "address",
  "note"
];

function balancedCodeBlock(source, bodyStart, label) {
  let depth = 0;
  let mode = "code";
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (mode === "line-comment") {
      if (char === "\n") mode = "code";
      continue;
    }
    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }
    if (mode !== "code") {
      if (char === "\\") index += 1;
      else if (char === mode) mode = "code";
      continue;
    }
    if (char === "/" && next === "/") {
      mode = "line-comment";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      mode = "block-comment";
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      mode = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart, index + 1);
  }
  assert.fail(`expected complete ${label} body`);
}

function matchingParen(source, openIndex, label) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) return index;
  }
  assert.fail(`expected complete ${label} parameters`);
}

function functionSource(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = source.search(signature);
  assert.notEqual(start, -1, `expected ${name} function`);
  const parametersStart = source.indexOf("(", start);
  const parametersEnd = matchingParen(source, parametersStart, name);
  const bodyStart = source.indexOf("{", parametersEnd);
  const body = balancedCodeBlock(source, bodyStart, name);
  return source.slice(start, bodyStart) + body;
}

function arrowCallCallbackSource(source, callName) {
  const signature = new RegExp(`\\b${callName}\\s*\\(`);
  const match = signature.exec(source);
  assert.ok(match, `expected ${callName} arrow callback`);
  const arrow = source.indexOf("=>", match.index + match[0].length);
  assert.notEqual(arrow, -1, `expected ${callName} arrow callback`);
  const bodyStart = source.indexOf("{", arrow + 2);
  return balancedCodeBlock(source, bodyStart, `${callName} arrow callback`);
}

test("arrow callback extraction excludes statements after the scheduled callback", () => {
  const incorrectStartup = "scheduleIdle(() => {}); hydrateDeferredSummaries();";
  const callback = arrowCallCallbackSource(incorrectStartup, "scheduleIdle");

  assert.doesNotMatch(callback, /hydrateDeferredSummaries/);
});

test("arrow callback extraction ignores braces in templates and comments with destructured args", () => {
  const source = `
    scheduleIdle(({ deadline }) => {
      const message = \`brace } and interpolation \${deadline ? "{" : "}"}\`;
      // A comment must not close the callback: }
      /* Nor should a block comment: { } */
      hydrateDeferredSummaries(message);
    });
    hydrateDeferredSummaries("outside");
  `;

  const callback = arrowCallCallbackSource(source, "scheduleIdle");
  assert.match(callback, /hydrateDeferredSummaries\(message\)/);
  assert.doesNotMatch(callback, /outside/);
});

test("static page exposes each calendar planner control exactly once", async () => {
  const html = await readFile(htmlUrl, "utf8");

  for (const id of plannerIds) {
    const matches = html.match(new RegExp(`id=["']${id}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one #${id}`);
  }
});

test("static page loads the versioned app entry as a module", async () => {
  const html = await readFile(htmlUrl, "utf8");

  assert.match(
    html,
    /<script\s+type=["']module["']\s+src=["']\.\/app\.js\?v=calendar-planner-5["']><\/script>/
  );
});

test("static page contains accessible trip editing, import and JSON export controls", async () => {
  const html = await readFile(htmlUrl, "utf8");

  assert.match(html, /<dialog\b[^>]*\bid=["']tripItemDialog["']/);
  assert.match(html, /<form\b[^>]*\bid=["']tripItemForm["']/);
  assert.match(html, /<button\b[^>]*\bid=["']tripImportBtn["'][^>]*\btype=["']button["']/);
  assert.match(html, /<button\b[^>]*\bid=["']exportTripFileBtn["'][^>]*\btype=["']button["'][^>]*\bdisabled\b/);
  assert.match(html, /<input\b[^>]*\bid=["']tripImportInput["'][^>]*\btype=["']file["']/);
  assert.match(html, /<button\b[^>]*\btype=["']submit["'][^>]*>/);
  assert.match(html, /<button\b[^>]*\bid=["']tripItemCancelBtn["'][^>]*\btype=["']button["']/);
  assert.match(html, /<dialog\b[^>]*\baria-labelledby=["']tripItemDialogTitle["']/);

  for (const name of tripItemFormNames) {
    const matches = html.match(new RegExp(`\\bname=["']${name}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one form field named ${name}`);
  }

  for (const id of [
    "tripItemDialog",
    "tripItemForm",
    "tripImportBtn",
    "tripImportInput",
    "exportTripFileBtn"
  ]) {
    const matches = html.match(new RegExp(`\\bid=["']${id}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one #${id}`);
  }
});

test("static page exposes distinct Markdown and printable HTML guide exports", async () => {
  const html = await readFile(htmlUrl, "utf8");

  for (const id of ["exportMarkdownBtn", "exportHtmlBtn"]) {
    const matches = html.match(new RegExp(`\\bid=["']${id}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one #${id}`);
    assert.match(
      html,
      new RegExp(`<button\\b[^>]*\\bid=["']${id}["'][^>]*\\btype=["']button["'][^>]*\\bdisabled\\b`)
    );
  }

  assert.match(
    html,
    /<[^>]+\bclass=["'][^"']*\bguide-export-actions\b[^"']*["'][^>]+\brole=["']group["']/
  );
  assert.doesNotMatch(html, /\bid=["']exportBtn["']/);
});

test("static page does not contain duplicate element IDs", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicateIds, []);
});

test("app coordinates TripPlan through the calendar modules and one commit entry", async () => {
  const app = await readFile(appUrl, "utf8");

  for (const api of [
    "applyTripCommand",
    "createTripPlan",
    "autoScheduleTrip",
    "reconcileRoutePlaces",
    "routePlaceIds",
    "validateTripPlan",
    "commandForTripItemForm",
    "mountTripEditor",
    "renderTripEditorMarkup"
  ]) {
    assert.match(app, new RegExp(`\\b${api}\\b`), `expected app.js to use ${api}`);
  }

  assert.equal(
    (app.match(/function\s+commitTripPlan\s*\(/g) ?? []).length,
    1,
    "expected one commitTripPlan definition"
  );
  assert.match(app, /function\s+syncRoutesFromTripPlan\s*\(/);
});

test("app renders critical map data before hydrating optional summaries", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /import\s*\{[\s\S]*?createJsonLoader[\s\S]*?createDeferredDataLoaders[\s\S]*?loadCriticalMapData[\s\S]*?scheduleIdle[\s\S]*?\}\s*from\s*["']\.\/app-data\.js["']/
  );
  assert.match(
    app,
    /const\s*\{\s*loadJson\s*,\s*loadOptionalJson\s*\}\s*=\s*createJsonLoader\s*\(\s*\)\s*;/
  );
  assert.match(
    app,
    /const\s+deferredData\s*=\s*createDeferredDataLoaders\s*\(\s*\{\s*loadOptionalJson\s*\}\s*\)\s*;/
  );
  assert.doesNotMatch(
    app,
    /\b(?:async\s+)?function\s+(?:loadJson|loadOptionalJson)\s*\(/
  );

  const loadMapData = functionSource(app, "loadMapData");
  assert.match(loadMapData, /await\s+loadCriticalMapData\s*\(\s*\{\s*loadJson\s*\}\s*\)/);
  assert.match(loadMapData, /hydrateFoodArticles\s*\(\s*null\s*\)/);
  assert.doesNotMatch(loadMapData, /Promise\.all|prefectureBoundaryPaths|counties-summary|wechat-food-summary|loadCountySummary|loadFoodSummary/);

  const deferredHydration = functionSource(app, "hydrateDeferredSummaries");
  assert.match(deferredHydration, /loadCountySummary\s*\(/);
  assert.match(deferredHydration, /loadFoodSummary\s*\(/);
  assert.match(deferredHydration, /Promise\.allSettled\s*\(/);
  assert.match(deferredHydration, /mergeCountyRecords\s*\(/);
  assert.match(
    deferredHydration,
    /if\s*\(\s*shouldRetryTripRestoreAfterCountyHydration\s*\)[\s\S]*?restoreTripState\s*\(/
  );
  assert.match(deferredHydration, /updateSearchResults\s*\(/);
  assert.match(deferredHydration, /renderFoodPanel\s*\(/);
  assert.match(deferredHydration, /renderPanel\s*\(/);
  assert.equal((app.match(/loadCountySummary\s*\(/g) ?? []).length, 1);
  assert.equal((app.match(/loadFoodSummary\s*\(/g) ?? []).length, 1);

  const initApp = functionSource(app, "initApp");
  const startupSteps = [
    "await loadMapData()",
    "initMap()",
    "restoreTripState()",
    'setMobileView("plan")',
    "renderRoutes()",
    "renderPanel()",
    'document.documentElement.dataset.appReady = "map"',
    "scheduleIdle("
  ];
  let previousIndex = -1;
  for (const step of startupSteps) {
    const index = initApp.indexOf(step);
    assert.ok(index > previousIndex, `expected ${step} after the previous startup step`);
    previousIndex = index;
  }
  const idleCallback = arrowCallCallbackSource(initApp, "scheduleIdle");
  assert.match(idleCallback, /hydrateDeferredSummaries\s*\(\s*\)/);
  assert.match(
    idleCallback,
    /hydrateDeferredSummaries\s*\(\s*\)[\s\S]*?\.then\s*\([\s\S]*?applyDeferredReadiness/
  );
  assert.match(initApp, /shouldRetryTripRestoreAfterCountyHydration\s*=\s*initialRecovery\.status\s*===\s*["']deferred["']/);
  assert.match(app, /failedBoundaryPaths:\s*\[\]/);
  assert.match(loadMapData, /state\.failedBoundaryPaths\s*=/);
  assert.match(app, /state\.failedBoundaryPaths\.length[\s\S]*?renderOperationalWarnings/);

  assert.match(app, /if\s*\(\s*bounds\.isValid\s*\(\s*\)\s*\)/);
  assert.match(app, /L\.latLngBounds\s*\(\s*state\.cities\.map/);
  assert.doesNotMatch(app, /throw new Error\s*\(\s*["']china-prefectures data is empty["']\s*\)/);
  assert.match(app, /loadOptionalJson\s*\(\s*`\.\/data\/counties\/by-city\/\$\{cityId\}\.json`/);
  assert.match(app, /loadOptionalJson\s*\(\s*`\.\/data\/food-articles\/by-city\/\$\{cityId\}\.json`/);
});

test("app wires deferred recovery, merge precedence, retryability and readiness policies", async () => {
  const app = await readFile(appUrl, "utf8");
  const prepareMigration = functionSource(app, "prepareTripMigration");
  const restore = functionSource(app, "restoreTripState");
  const hydrate = functionSource(app, "hydrateDeferredSummaries");
  const ensureCounties = functionSource(app, "ensureCityCounties");
  const ensureFood = functionSource(app, "ensureCityFoodArticles");
  const hydrateFood = functionSource(app, "hydrateFoodArticles");
  const commit = functionSource(app, "commitTripPlan");
  const init = functionSource(app, "initApp");
  const idleCallback = arrowCallCallbackSource(init, "scheduleIdle");

  assert.match(prepareMigration, /prepareLegacyRecoveryData\s*\(/);
  assert.doesNotMatch(prepareMigration, /placeById\s*\(/);
  assert.match(restore, /selectTripRecoveryCandidate\s*\(/);
  assert.match(restore, /status\s*===\s*["']deferred["']/);
  assert.ok(
    restore.indexOf("selectTripRecoveryCandidate(") < restore.indexOf("backupLegacyTripRaw("),
    "candidate validation must precede legacy backup"
  );
  assert.match(init, /initialRecovery\.status\s*===\s*["']deferred["']/);
  assert.doesNotMatch(init, /shouldRetryTripRestoreAfterCountyHydration\s*=\s*!state\.tripPlan/);

  assert.match(hydrate, /classifyDeferredSummaryData\s*\(/);
  assert.match(hydrate, /hydrateFoodArticles\s*\(\s*foodData\s*\)/);
  assert.match(hydrateFood, /incomingSource:\s*["']summary["']/);
  assert.match(hydrate, /status\.countyValid/);
  assert.match(hydrate, /status\.foodValid/);
  assert.match(commit, /shouldRetryTripRestoreAfterCountyHydration\s*=\s*false/);

  assert.match(ensureCounties, /if\s*\(\s*!isCountyRecordsPayload\s*\(\s*data\s*\)\s*\)\s*return\s+citySubareas/);
  assert.ok(
    ensureCounties.indexOf("isCountyRecordsPayload(data)") < ensureCounties.indexOf("loadedCountyCityIds.add"),
    "county payload validation must precede the loaded marker"
  );
  assert.match(ensureCounties, /finally\s*\([\s\S]*?countyLoadPromises\.delete/);

  assert.match(ensureFood, /if\s*\(\s*!isFoodArticlesPayload\s*\(\s*data\s*\)\s*\)\s*return\s+articlesForCity/);
  assert.match(ensureFood, /incomingSource:\s*["']city["']/);
  assert.ok(
    ensureFood.indexOf("isFoodArticlesPayload(data)") < ensureFood.indexOf("loadedFoodArticleCityIds.add"),
    "food payload validation must precede the loaded marker"
  );
  assert.match(ensureFood, /finally\s*\([\s\S]*?foodArticleLoadPromises\.delete/);

  assert.match(idleCallback, /applyDeferredReadiness\s*\(/);
  assert.match(idleCallback, /catch\s*\([\s\S]*?applyDeferredInternalFailure/);
  assert.doesNotMatch(idleCallback, /finally\s*\(/);
  assert.match(app, /dataset\.missingDatasets/);
  assert.match(app, /dataset\.appReady\s*=\s*status\.readiness/);
  assert.match(app, /function\s+renderOperationalWarnings\s*\(/);
  assert.doesNotMatch(app, /function\s+showBoundaryLoadHint\s*\(/);
});

test("lightweight prefecture boundaries retain every city within the startup budget", async () => {
  const chunks = await Promise.all(
    litePrefectureUrls.map(async (url) => {
      const text = await readFile(url, "utf8");
      assert.ok(Buffer.byteLength(text) < 35_000);
      return JSON.parse(text);
    })
  );

  assert.ok(chunks.every((data) => data.type === "FeatureCollection"));
  assert.equal(chunks.reduce((total, data) => total + data.features.length, 0), 372);
});

test("app delegates archive behavior to the DOM-free trip archive module", async () => {
  const app = await readFile(appUrl, "utf8");
  const archiveApis = [
    "LEGACY_TRIP_BACKUP_KEY",
    "backupLegacyTripRaw",
    "captureTripArchiveSnapshot",
    "canExportTripFile",
    "clearTripArchive",
    "createLazyStorageAdapter",
    "finalizeLegacyMigration",
    "isLegacyTripPayload",
    "legacyMigrationPending",
    "readTripRecoveryCandidates",
    "restoreTripArchiveSnapshot",
    "shareUrlForTrip",
    "tripFileName",
    "tripFileExportPayload",
    "tripFileText",
    "writeTripPlanV2"
  ];

  assert.match(app, /from\s+["']\.\/trip-archive\.js["']/);
  for (const api of archiveApis) {
    assert.ok((app.match(new RegExp(`\\b${api}\\b`, "g")) ?? []).length >= 2, `expected app.js to use ${api}`);
  }
  assert.match(app, /\bshouldUseTripFile\s*\(/);
  assert.doesNotMatch(app, /const\s+TRIP_STORAGE_KEY\s*=/);
  assert.doesNotMatch(app, /function\s+(?:shareUrlForTrip|safeTripNameForFile)\s*\(/);
});

test("app wires visible trip import and JSON export controls", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /querySelector\s*\(\s*["']#tripImportBtn["']\s*\)/);
  assert.match(app, /querySelector\s*\(\s*["']#tripImportInput["']\s*\)/);
  assert.match(app, /querySelector\s*\(\s*["']#exportTripFileBtn["']\s*\)/);
  assert.match(app, /tripImportBtn\.addEventListener\s*\(\s*["']click["'][\s\S]*?tripImportInput\.click\s*\(/);
  assert.match(app, /tripImportInput\.addEventListener\s*\(\s*["']change["']\s*,\s*importTripFile\s*\)/);
  assert.match(app, /exportTripFileBtn\.addEventListener\s*\(\s*["']click["']\s*,\s*exportTripFile\s*\)/);
  assert.match(app, /exportTripFileBtn\.disabled\s*=\s*!canExportTripFile\s*\(/);
  assert.match(app, /function\s+exportTripFile\s*\([^)]*\)[\s\S]*?tripFileExportPayload\s*\([\s\S]*?downloadTextFile\s*\(/);
  assert.match(app, /exportPayload\.kind\s*===\s*["']legacy-emergency["'][\s\S]*?clearEmergencyLegacyTrip\s*\(/);
});

test("app builds one TripPlan v2 guide model and wires both guide renderers", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /import\s*\{\s*buildGuideModel\s*,\s*buildMarkdownGuide\s*,\s*buildPrintableHtml\s*\}\s*from\s*["']\.\/guide-export\.js["']/
  );
  assert.match(app, /\bsafeTripNameForFile\b[\s\S]*?from\s+["']\.\/trip-archive\.js["']/);
  assert.match(app, /querySelector\s*\(\s*["']#exportMarkdownBtn["']\s*\)/);
  assert.match(app, /querySelector\s*\(\s*["']#exportHtmlBtn["']\s*\)/);
  assert.match(
    app,
    /exportMarkdownBtn\.addEventListener\s*\(\s*["']click["']\s*,\s*exportMarkdownGuide\s*\)/
  );
  assert.match(
    app,
    /exportHtmlBtn\.addEventListener\s*\(\s*["']click["']\s*,\s*exportPrintableHtmlGuide\s*\)/
  );

  assert.equal(
    (app.match(/\bbuildGuideModel\s*\(/g) ?? []).length,
    1,
    "expected one shared GuideModel construction"
  );
  assert.match(
    app,
    /function\s+buildCurrentGuideModel\s*\([^)]*\)\s*\{[\s\S]*?buildGuideModel\s*\(\s*\{[\s\S]*?plan:\s*state\.tripPlan[\s\S]*?placeSnapshots:[\s\S]*?warnings:\s*validateTripPlan\s*\(\s*plan\s*,\s*\{\s*paceProfile:\s*tripPaceProfile\s*\(\s*plan\.pace\s*\)[\s\S]*?routeSegments:[\s\S]*?totals:/
  );
  assert.match(
    app,
    /function\s+exportMarkdownGuide\s*\([^)]*\)\s*\{[\s\S]*?const\s+model\s*=\s*buildCurrentGuideModel\s*\(\s*\)[\s\S]*?buildMarkdownGuide\s*\(\s*model\s*\)[\s\S]*?downloadTextFile\s*\([\s\S]*?["']text\/markdown;charset=utf-8["']/
  );
  assert.match(
    app,
    /function\s+exportPrintableHtmlGuide\s*\([^)]*\)\s*\{[\s\S]*?const\s+model\s*=\s*buildCurrentGuideModel\s*\(\s*\)[\s\S]*?buildPrintableHtml\s*\(\s*model\s*\)[\s\S]*?downloadTextFile\s*\([\s\S]*?["']text\/html;charset=utf-8["']/
  );
  assert.match(app, /exportMarkdownBtn\.disabled\s*=\s*!hasCalendar/);
  assert.match(app, /exportHtmlBtn\.disabled\s*=\s*!hasCalendar/);

  for (const oldName of ["exportRoutes", "buildGuideData", "buildTravelGuideMarkdown"]) {
    assert.doesNotMatch(app, new RegExp(`\\b${oldName}\\b`));
  }
});

test("app wires v2 writes, recovery and legacy lifecycle through archive transactions", async () => {
  const app = await readFile(appUrl, "utf8");
  const restore = functionSource(app, "restoreTripState");
  const importTrip = functionSource(app, "importTripFile");

  assert.match(app, /const\s+tripArchiveStorage\s*=\s*createLazyStorageAdapter\s*\(\s*\(\)\s*=>\s*window\.localStorage\s*\)/);
  assert.doesNotMatch(app, /storage:\s*window\.localStorage/);
  assert.match(app, /writeTripPlanV2\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage[\s\S]*?currentUrl:\s*window\.location\.href[\s\S]*?replaceUrl:/);
  assert.match(app, /readTripRecoveryCandidates\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage/);
  assert.match(app, /backupLegacyTripRaw\s*\(\s*\{\s*storage:\s*tripArchiveStorage,\s*raw:/);
  assert.match(app, /finalizeLegacyMigration\s*\(\s*\{\s*storage:\s*tripArchiveStorage\s*\}\s*\)/);
  assert.match(app, /clearTripArchive\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage/);
  assert.match(app, /restoreTripArchiveSnapshot\s*\(/);
  assert.match(app, /completeLegacyMigration:\s*false/);
  assert.ok(restore.indexOf("migrateTripState(") < restore.indexOf("backupLegacyTripRaw("));
  assert.match(restore, /commitTripPlan\s*\(\s*plan\s*,\s*\{[\s\S]*?recordHistory:\s*false[\s\S]*?completeLegacyMigration:\s*false/);
  assert.ok(importTrip.indexOf("migrateTripState(") < importTrip.indexOf("backupLegacyTripRaw("));
  assert.match(importTrip, /commitTripPlan\s*\(\s*plan\s*,\s*\{[\s\S]*?completeLegacyMigration:\s*false[\s\S]*?finally\s*\{[\s\S]*?input\.value\s*=\s*["']["']/);
  assert.match(app, /旧版存档备份失败[\s\S]*?rememberEmergencyLegacyTrip\s*\(\s*candidate\.raw\s*\)/);
  assert.match(app, /failureReason\s*=\s*["']backup["'][\s\S]*?rememberEmergencyLegacyTrip\s*\(\s*rawText\s*\)/);
  assert.match(app, /请保持页面打开，并在浏览器设置中检查本站点数据权限后重试/);
});

test("default npm test includes the trip archive regression suite", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

  assert.match(packageJson.scripts.test, /(?:^|\s)tests\/trip-archive\.test\.mjs(?:\s|$)/);
  assert.match(packageJson.scripts["test:build"], /npm run test/);
});

test("short sharing updates the address only in the clipboard fallback", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(
    app,
    /if\s*\(copied\)\s*\{[\s\S]*?return;[\s\S]*?replaceBrowserUrl\s*\(\s*shareUrl\s*\)/
  );
  assert.match(
    app,
    /if\s*\(shouldUseTripFile\s*\(\s*shareUrl\s*\)\)\s*\{[\s\S]*?downloadTripFile\s*\([\s\S]*?return;/
  );
});

test("app commits transport metadata and synchronizes transport state before rendering", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /state\.transportMode\s*=\s*resolveTripTransportMode\s*\(\s*nextPlan\s*\)/);
  assert.match(
    app,
    /function\s+setTransportMode\s*\([^)]*\)\s*\{[\s\S]*?applyTripCommand\s*\([\s\S]*?transportMode:\s*mode[\s\S]*?commitTripPlan\s*\(/
  );
  assert.match(app, /createTripPlan\s*\(\s*\{[\s\S]*?transportMode:\s*state\.transportMode/);
  assert.match(app, /const\s+metadata\s*=\s*\{[\s\S]*?transportMode:/);
});

test("calendar rendering uses validation and real edit callbacks", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /function\s+renderTripPlanner\s*\([^)]*\)\s*\{[\s\S]*?validateTripPlan\s*\(/);
  assert.match(app, /renderTripEditorMarkup\s*\(\s*\{[\s\S]*?warnings/);
  assert.match(app, /onCommand:\s*handleTripCommand/);
  assert.match(app, /onEditRequest:\s*openTripItemDialog/);
  assert.doesNotMatch(app, /on(?:Command|EditRequest):\s*\(\)\s*=>\s*\{\s*\}/);
});

test("calendar dialog styles include a scrollable mobile drawer and touch controls", async () => {
  const css = await readFile(stylesUrl, "utf8");

  assert.match(css, /#tripItemDialog\b/);
  assert.match(css, /\.trip-item-form\b/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?#tripItemDialog\b/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?\.drag-handle\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?min-height:\s*40px/);
});

test("guide export actions keep two bounded columns without text overflow", async () => {
  const css = await readFile(stylesUrl, "utf8");

  assert.match(
    css,
    /\.guide-export-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    css,
    /\.guide-export-actions\s+\.icon-button\s*\{[\s\S]*?min-width:\s*0[\s\S]*?overflow-wrap:\s*anywhere/
  );
});

test("renderPanel delegates calendar output and metadata controls use the commit path", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /function\s+renderPanel\s*\([^)]*\)\s*\{[\s\S]*?renderTripPlanner\s*\(/);
  assert.match(app, /function\s+setTripPace\s*\([^)]*\)\s*\{[\s\S]*?commitTripPlan\s*\(/);
  assert.match(app, /function\s+commitTripPlan\s*\([^)]*\)[\s\S]*?state\.tripPace\s*=\s*resolveTripPace/);
  assert.match(app, /function\s+renderPanel\s*\([^)]*\)\s*\{[\s\S]*?syncPaceButtons\s*\(\s*\)/);
});

test("calendar command wiring preserves focus and exposes blocked move feedback", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /function\s+handleTripCommand\s*\(\s*command\s*,\s*focusToken\s*\)/);
  assert.match(app, /blockedReason/);
  assert.match(app, /cleanup-associated-content/);
  assert.match(app, /commitTripPlan\s*\(\s*result\.plan\s*,\s*\{\s*focusToken\s*\}\s*\)/);
  assert.match(app, /closeTripItemDialog\s*\([^)]*\)[\s\S]*?handleTripCommand\s*\(\s*command\s*,\s*\{[\s\S]*?action:\s*["']day["'][\s\S]*?dayId/);
  assert.match(app, /restoreTripEditorFocus\s*\(\s*tripEditorRoot\s*,\s*focusToken\s*\)/);
});
