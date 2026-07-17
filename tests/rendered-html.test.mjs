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

function functionSource(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const start = source.search(signature);
  assert.notEqual(start, -1, `expected ${name} function`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`expected complete ${name} function body`);
}

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

  const loadMapData = functionSource(app, "loadMapData");
  assert.match(loadMapData, /await\s+loadCriticalMapData\s*\(\s*\{\s*loadJson\s*\}\s*\)/);
  assert.match(loadMapData, /hydrateFoodArticles\s*\(\s*null\s*\)/);
  assert.doesNotMatch(loadMapData, /Promise\.all|prefectureBoundaryPaths|counties-summary|wechat-food-summary|loadCountySummary|loadFoodSummary/);

  const deferredHydration = functionSource(app, "hydrateDeferredSummaries");
  assert.match(deferredHydration, /loadCountySummary\s*\(/);
  assert.match(deferredHydration, /loadFoodSummary\s*\(/);
  assert.match(deferredHydration, /Promise\.all\s*\(/);
  assert.match(deferredHydration, /mergeCountyRecords\s*\(/);
  assert.match(
    deferredHydration,
    /shouldRetryTripRestoreAfterCountyHydration\s*&&\s*!state\.tripPlan[\s\S]*?restoreTripState\s*\(/
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
  assert.match(initApp, /hydrateDeferredSummaries\s*\(\s*\)[\s\S]*?finally\s*\([\s\S]*?dataset\.appReady\s*=\s*["']complete["']/);
  assert.match(initApp, /shouldRetryTripRestoreAfterCountyHydration\s*=\s*!state\.tripPlan/);
  assert.match(app, /failedBoundaryPaths:\s*\[\]/);
  assert.match(loadMapData, /state\.failedBoundaryPaths\s*=/);
  assert.match(initApp, /state\.failedBoundaryPaths\.length[\s\S]*?showBoundaryLoadHint\s*\(/);

  assert.match(app, /if\s*\(\s*bounds\.isValid\s*\(\s*\)\s*\)/);
  assert.match(app, /L\.latLngBounds\s*\(\s*state\.cities\.map/);
  assert.doesNotMatch(app, /throw new Error\s*\(\s*["']china-prefectures data is empty["']\s*\)/);
  assert.match(app, /loadOptionalJson\s*\(\s*`\.\/data\/counties\/by-city\/\$\{cityId\}\.json`/);
  assert.match(app, /loadOptionalJson\s*\(\s*`\.\/data\/food-articles\/by-city\/\$\{cityId\}\.json`/);
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

  assert.match(app, /const\s+tripArchiveStorage\s*=\s*createLazyStorageAdapter\s*\(\s*\(\)\s*=>\s*window\.localStorage\s*\)/);
  assert.doesNotMatch(app, /storage:\s*window\.localStorage/);
  assert.match(app, /writeTripPlanV2\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage[\s\S]*?currentUrl:\s*window\.location\.href[\s\S]*?replaceUrl:/);
  assert.match(app, /readTripRecoveryCandidates\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage/);
  assert.match(app, /backupLegacyTripRaw\s*\(\s*\{\s*storage:\s*tripArchiveStorage,\s*raw:/);
  assert.match(app, /finalizeLegacyMigration\s*\(\s*\{\s*storage:\s*tripArchiveStorage\s*\}\s*\)/);
  assert.match(app, /clearTripArchive\s*\(\s*\{[\s\S]*?storage:\s*tripArchiveStorage/);
  assert.match(app, /restoreTripArchiveSnapshot\s*\(/);
  assert.match(app, /completeLegacyMigration:\s*false/);
  assert.match(
    app,
    /function\s+restoreTripState\s*\([^)]*\)\s*\{[\s\S]*?backupLegacyTripRaw\s*\([\s\S]*?migrateTripState\s*\([\s\S]*?commitTripPlan\s*\(\s*plan\s*,\s*\{[\s\S]*?recordHistory:\s*false[\s\S]*?completeLegacyMigration:\s*false/
  );
  assert.match(
    app,
    /async\s+function\s+importTripFile\s*\([^)]*\)\s*\{[\s\S]*?file\.text\s*\(\s*\)[\s\S]*?backupLegacyTripRaw\s*\([\s\S]*?migrateTripState\s*\([\s\S]*?commitTripPlan\s*\(\s*plan\s*,\s*\{[\s\S]*?completeLegacyMigration:\s*false[\s\S]*?finally\s*\{[\s\S]*?input\.value\s*=\s*["']["']/
  );
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
