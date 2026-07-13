import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_TRIP_STORAGE_KEY,
  TRIP_STORAGE_KEY,
  TRIP_PLAN_VERSION,
  applyTripCommand,
  autoScheduleTrip,
  createTripPlan,
  dayDate,
  routePlaceIds
} from "../public/static-site/trip-plan.js";

function ids() {
  let value = 0;
  return (prefix) => `${prefix}-${++value}`;
}

test("creates a versioned trip without requiring a start date", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  assert.equal(plan.version, TRIP_PLAN_VERSION);
  assert.equal(TRIP_STORAGE_KEY, "route-studio-trip-v2");
  assert.equal(LEGACY_TRIP_STORAGE_KEY, "route-studio-trip-v1");
  assert.equal(plan.startDate, null);
  assert.deepEqual(plan.days, [
    {
      id: "day-1",
      cityEntries: [
        {
          id: "city-entry-3",
          visitId: "visit-2",
          placeId: "beijing",
          manuallyPlaced: false
        }
      ],
      overnightPlaceId: "beijing",
      items: [],
      lodging: null,
      manuallyEdited: false
    }
  ]);
  assert.deepEqual(routePlaceIds(plan), ["beijing"]);
  assert.equal(dayDate(plan, 0), null);

  const emptyPlan = createTripPlan({ placeIds: [], idFactory: ids() });
  assert.deepEqual(emptyPlan.days, []);

  const repeatedPlan = createTripPlan({ placeIds: ["a", "a", "b", "b", "a"], idFactory: ids() });
  assert.deepEqual(routePlaceIds(repeatedPlan), ["a", "b", "a"]);
});

test("derives calendar dates without persisting day numbers", () => {
  const plan = createTripPlan({
    placeIds: ["beijing", "zhengzhou"],
    startDate: "2026-10-01",
    idFactory: ids()
  });
  plan.days.push({ id: "day-extra", cityEntries: [], overnightPlaceId: null, items: [], lodging: null, manuallyEdited: false });
  assert.equal(dayDate(plan, 0), "2026-10-01");
  assert.equal(dayDate(plan, 1), "2026-10-02");
  assert.equal("dayNumber" in plan.days[0], false);
});

test("auto schedule splits a route at the pace limit", () => {
  const plan = autoScheduleTrip({
    placeIds: ["beijing", "zhengzhou", "wuhan"],
    durations: { "beijing>zhengzhou": 3 * 3600, "zhengzhou>wuhan": 3 * 3600 },
    paceProfile: { dailyTravelLimitSeconds: 4 * 3600, maxDailyPlaces: 3 },
    idFactory: ids()
  });
  assert.equal(plan.days.length, 2);
  assert.deepEqual(
    plan.days.map((day) => day.cityEntries.map((entry) => entry.placeId)),
    [["beijing", "zhengzhou"], ["zhengzhou", "wuhan"]]
  );
  assert.equal(plan.days[0].cityEntries[1].visitId, plan.days[1].cityEntries[0].visitId);
  assert.deepEqual(routePlaceIds(plan), ["beijing", "zhengzhou", "wuhan"]);
});

test("auto schedule starts a new visit when returning to a place", () => {
  const plan = autoScheduleTrip({
    placeIds: ["a", "b", "a"],
    paceProfile: { dailyTravelLimitSeconds: 8 * 3600, maxDailyPlaces: 3 },
    idFactory: ids()
  });
  const aEntries = plan.days.flatMap((day) => day.cityEntries).filter((entry) => entry.placeId === "a");
  assert.equal(aEntries.length, 2);
  assert.notEqual(aEntries[0].visitId, aEntries[1].visitId);
});

test("auto schedule ignores an adjacent repeated place", () => {
  const plan = autoScheduleTrip({
    placeIds: ["a", "b", "b"],
    paceProfile: { dailyTravelLimitSeconds: 8 * 3600, maxDailyPlaces: 2 },
    idFactory: ids()
  });
  assert.equal(plan.days.length, 1);
  assert.deepEqual(routePlaceIds(plan), ["a", "b"]);
});

test("sets one visit to three consecutive days", () => {
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory: ids() });
  const visitId = plan.days[0].cityEntries[0].visitId;
  const result = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration: 3 }, { idFactory: ids() });
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.plan.days.length, 3);
  assert.equal(result.plan.days.every((day) => day.cityEntries[0].visitId === visitId), true);
});

test("rejects invalid visit durations without changing the plan", () => {
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory: ids() });
  const visitId = plan.days[0].cityEntries[0].visitId;
  [NaN, 1.5, Infinity, "2"].forEach((duration) => {
    const result = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration });
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.changed, false);
    assert.equal(result.plan, plan);
  });
});

test("clamps integer visit durations and returns the original plan for no-ops", () => {
  const idFactory = ids();
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory });
  const visitId = plan.days[0].cityEntries[0].visitId;

  const noOp = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration: 1 }, { idFactory });
  assert.equal(noOp.changed, false);
  assert.equal(noOp.plan, plan);

  const clampedLow = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration: -3 }, { idFactory });
  assert.equal(clampedLow.changed, false);
  assert.equal(clampedLow.plan, plan);

  const clampedHigh = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration: 99 }, { idFactory });
  assert.equal(clampedHigh.changed, true);
  assert.equal(clampedHigh.plan.days.length, 7);
});

test("reports every manually populated day before shortening a visit", () => {
  const idFactory = ids();
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory });
  const visitId = plan.days[0].cityEntries[0].visitId;
  const expanded = applyTripCommand(
    plan,
    { type: "set-visit-duration", visitId, duration: 3 },
    { idFactory }
  ).plan;
  expanded.days[1].items.push({ id: "item-1" });
  expanded.days[2].lodging = { id: "lodging-1" };
  const before = structuredClone(expanded);

  const result = applyTripCommand(expanded, { type: "set-visit-duration", visitId, duration: 1 });

  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.changed, false);
  assert.equal(result.plan, expanded);
  assert.deepEqual(result.affectedDayIds, [expanded.days[1].id, expanded.days[2].id]);
  assert.deepEqual(expanded, before);

  const forced = applyTripCommand(
    expanded,
    { type: "set-visit-duration", visitId, duration: 1 },
    { force: true }
  );
  assert.equal(forced.requiresConfirmation, false);
  assert.equal(forced.changed, true);
  assert.equal(forced.plan.days.length, 1);
  assert.deepEqual(expanded, before);
});

test("force shortening cleans a removed place from a shared day", () => {
  const idFactory = ids();
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory });
  const visitId = plan.days[0].cityEntries[0].visitId;
  const expanded = applyTripCommand(
    plan,
    { type: "set-visit-duration", visitId, duration: 2 },
    { idFactory }
  ).plan;
  const sharedDay = expanded.days[1];
  sharedDay.cityEntries.push({
    id: idFactory("city-entry"),
    visitId: idFactory("visit"),
    placeId: "leshan",
    manuallyPlaced: true
  });
  sharedDay.overnightPlaceId = "chengdu";
  sharedDay.items = [
    { id: "activity", placeId: "chengdu" },
    { id: "transport", fromPlaceId: "leshan", toPlaceId: "chengdu" },
    { id: "keep", placeId: "leshan" }
  ];
  sharedDay.lodging = { id: "lodging", placeId: "chengdu" };
  const before = structuredClone(expanded);

  const result = applyTripCommand(
    expanded,
    { type: "set-visit-duration", visitId, duration: 1 },
    { force: true }
  );

  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.changed, true);
  assert.equal(result.plan.days.length, 2);
  assert.deepEqual(result.plan.days[1].cityEntries.map((entry) => entry.placeId), ["leshan"]);
  assert.deepEqual(result.plan.days[1].items.map((item) => item.id), ["keep"]);
  assert.equal(result.plan.days[1].lodging, null);
  assert.equal(result.plan.days[1].overnightPlaceId, "leshan");
  assert.deepEqual(expanded, before);
});

test("moves a city entry to another day without changing its visit", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.days.push({ id: "day-2", cityEntries: [], overnightPlaceId: null, items: [], lodging: null, manuallyEdited: false });
  const entry = plan.days[0].cityEntries[0];
  const before = structuredClone(plan);
  const result = applyTripCommand(plan, { type: "move-city", entryId: entry.id, targetDayId: "day-2", targetIndex: 0 });
  assert.equal(result.plan.days[0].cityEntries.length, 0);
  assert.equal(result.plan.days[0].overnightPlaceId, null);
  assert.equal(result.plan.days[1].cityEntries[0].placeId, "beijing");
  assert.equal(result.plan.days[1].cityEntries[0].visitId, entry.visitId);
  assert.equal(result.plan.days[1].overnightPlaceId, "beijing");
  assert.equal(result.plan.days[1].manuallyEdited, true);
  assert.deepEqual(plan, before);
});

test("returns the original plan for unknown commands and missing targets", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  const entry = plan.days[0].cityEntries[0];
  const commands = [
    { type: "unknown" },
    { type: "move-city", entryId: entry.id, targetDayId: "missing-day" },
    { type: "move-city", entryId: "missing-entry", targetDayId: plan.days[0].id },
    { type: "set-visit-duration", visitId: "missing-visit", duration: 2 }
  ];

  commands.forEach((command) => {
    const result = applyTripCommand(plan, command);
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.changed, false);
    assert.equal(result.plan, plan);
  });
});
