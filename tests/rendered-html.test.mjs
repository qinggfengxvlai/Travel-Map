import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../public/static-site/index.html", import.meta.url);
const appUrl = new URL("../public/static-site/app.js", import.meta.url);
const stylesUrl = new URL("../public/static-site/styles.css", import.meta.url);
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
    /<script\s+type=["']module["']\s+src=["']\.\/app\.js\?v=calendar-planner-1["']><\/script>/
  );
});

test("static page contains one accessible trip item dialog and import input", async () => {
  const html = await readFile(htmlUrl, "utf8");

  assert.match(html, /<dialog\b[^>]*\bid=["']tripItemDialog["']/);
  assert.match(html, /<form\b[^>]*\bid=["']tripItemForm["']/);
  assert.match(html, /<input\b[^>]*\bid=["']tripImportInput["'][^>]*\btype=["']file["']/);
  assert.match(html, /<button\b[^>]*\btype=["']submit["'][^>]*>/);
  assert.match(html, /<button\b[^>]*\bid=["']tripItemCancelBtn["'][^>]*\btype=["']button["']/);
  assert.match(html, /<dialog\b[^>]*\baria-labelledby=["']tripItemDialogTitle["']/);

  for (const name of tripItemFormNames) {
    const matches = html.match(new RegExp(`\\bname=["']${name}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one form field named ${name}`);
  }

  for (const id of ["tripItemDialog", "tripItemForm", "tripImportInput"]) {
    const matches = html.match(new RegExp(`\\bid=["']${id}["']`, "g")) ?? [];
    assert.equal(matches.length, 1, `expected exactly one #${id}`);
  }
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

test("calendar rendering uses validation and real edit callbacks", async () => {
  const app = await readFile(appUrl, "utf8");
  const start = app.indexOf("function renderTripPlanner(");
  const end = app.indexOf("\nfunction updateTotals(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const source = app.slice(start, end);
  assert.match(source, /validateTripPlan\s*\(/);
  assert.match(source, /renderTripEditorMarkup\s*\(\s*\{[\s\S]*?warnings/);
  assert.match(source, /onCommand:\s*handleTripCommand/);
  assert.match(source, /onEditRequest:\s*openTripItemDialog/);
  assert.doesNotMatch(source, /on(?:Command|EditRequest):\s*\(\)\s*=>\s*\{\s*\}/);
});

test("calendar dialog styles include a scrollable mobile drawer and touch controls", async () => {
  const css = await readFile(stylesUrl, "utf8");

  assert.match(css, /#tripItemDialog\b/);
  assert.match(css, /\.trip-item-form\b/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?#tripItemDialog\b/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?\.drag-handle\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*880px\)[\s\S]*?min-height:\s*40px/);
});

test("renderPanel delegates calendar output to the trip editor", async () => {
  const app = await readFile(appUrl, "utf8");
  const start = app.indexOf("function renderPanel(");
  const end = app.indexOf("\nfunction updateTotals(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const renderPanelSource = app.slice(start, end);
  assert.match(renderPanelSource, /renderTripPlanner\s*\(/);
  assert.doesNotMatch(renderPanelSource, /renderItineraryPanel\s*\(/);
});

test("the existing pace control commits TripPlan metadata", async () => {
  const app = await readFile(appUrl, "utf8");
  const start = app.indexOf("function setTripPace(");
  const end = app.indexOf("\nfunction syncTransportButtons(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const setTripPaceSource = app.slice(start, end);
  assert.match(setTripPaceSource, /commitTripPlan\s*\(/);
});

test("committing and undoing a plan synchronizes the pace state before rendering buttons", async () => {
  const app = await readFile(appUrl, "utf8");
  const start = app.indexOf("function commitTripPlan(");
  const end = app.indexOf("\nfunction tripIdentifier(", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const source = app.slice(start, end);
  assert.match(source, /state\.tripPace\s*=\s*resolveTripPace\s*\(\s*nextPlan\s*,\s*state\.tripPace\s*\)/);
  assert.ok(source.indexOf("state.tripPace =") < source.indexOf("renderPanel()"));
  assert.match(app, /function\s+renderPanel\s*\([^)]*\)\s*\{[\s\S]*?syncPaceButtons\s*\(\s*\)/);
  assert.match(app, /function\s+setTripPace\s*\([^)]*\)\s*\{[\s\S]*?state\.tripPace\s*===\s*pace/);
});

test("calendar commands preserve focus and expose blocked move feedback", async () => {
  const app = await readFile(appUrl, "utf8");
  const handleStart = app.indexOf("function handleTripCommand(");
  const handleEnd = app.indexOf("\nfunction tripFormControl(", handleStart);
  const submitStart = app.indexOf("function submitTripItemForm(");
  const submitEnd = app.indexOf("\nfunction updateTripNameMetadata(", submitStart);
  assert.notEqual(handleStart, -1);
  assert.notEqual(handleEnd, -1);
  assert.notEqual(submitStart, -1);
  assert.notEqual(submitEnd, -1);

  const handleSource = app.slice(handleStart, handleEnd);
  const submitSource = app.slice(submitStart, submitEnd);
  assert.match(handleSource, /function\s+handleTripCommand\s*\(\s*command\s*,\s*focusToken\s*\)/);
  assert.match(handleSource, /blockedReason/);
  assert.match(handleSource, /cleanup-associated-content/);
  assert.match(handleSource, /commitTripPlan\s*\(\s*result\.plan\s*,\s*\{\s*focusToken\s*\}\s*\)/);
  assert.ok(submitSource.indexOf("closeTripItemDialog") < submitSource.indexOf("handleTripCommand"));
  assert.match(submitSource, /handleTripCommand\s*\(\s*command\s*,\s*\{[\s\S]*?action:\s*"day"[\s\S]*?dayId/);
  assert.match(app, /restoreTripEditorFocus\s*\(\s*tripEditorRoot\s*,\s*focusToken\s*\)/);
});
