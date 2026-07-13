import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../public/static-site/index.html", import.meta.url);
const appUrl = new URL("../public/static-site/app.js", import.meta.url);
const plannerIds = [
  "tripNameInput",
  "tripStartDateInput",
  "autoScheduleBtn",
  "undoTripEditBtn",
  "tripHealth",
  "tripEditorRoot",
  "itineraryEmptyState"
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

test("app coordinates TripPlan through the calendar modules and one commit entry", async () => {
  const app = await readFile(appUrl, "utf8");

  for (const api of [
    "createTripPlan",
    "autoScheduleTrip",
    "reconcileRoutePlaces",
    "routePlaceIds",
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
