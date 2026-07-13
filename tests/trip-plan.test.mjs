import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_TRIP_STORAGE_KEY,
  TRIP_STORAGE_KEY,
  TRIP_PLAN_VERSION,
  applyTripCommand,
  autoScheduleTrip,
  compactTripPlan,
  createTripPlan,
  dayDate,
  migrateTripState,
  normalizeTripPlan,
  reconcileRoutePlaces,
  routePlaceIds,
  shouldUseTripFile,
  timeToMinutes,
  validateTripPlan
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
    { type: "set-visit-duration", visitId: "missing-visit", duration: 2 },
    { type: "upsert-item", dayId: "missing-day", item: { type: "activity" } },
    { type: "copy-item", itemId: "missing-item" },
    { type: "remove-item", itemId: "missing-item" },
    { type: "move-item", itemId: "missing-item", targetDayId: plan.days[0].id },
    { type: "move-item", itemId: "item-1", targetDayId: "missing-day" },
    { type: "remove-city", entryId: "missing-entry" },
    { type: "set-lodging", dayId: "missing-day", lodging: null },
    { type: "set-overnight", dayId: "missing-day", placeId: null }
  ];

  commands.forEach((command) => {
    const result = applyTripCommand(plan, command);
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.changed, false);
    assert.equal(result.plan, plan);
  });
});

test("adds transport, activity and lodging through commands", () => {
  let plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  const dayId = plan.days[0].id;
  plan = applyTripCommand(plan, {
    type: "upsert-item",
    dayId,
    item: { type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou", serviceNo: "G123", startTime: "22:30", endTime: "01:10", endDayOffset: 1, note: "" }
  }, { idFactory: ids() }).plan;
  plan = applyTripCommand(plan, {
    type: "set-lodging",
    dayId,
    lodging: { placeId: "zhengzhou", name: "站前酒店", address: "", checkInTime: "18:00", checkOutTime: "09:00", note: "" }
  }).plan;
  assert.equal(plan.days[0].items[0].endDayOffset, 1);
  assert.equal(plan.days[0].lodging.name, "站前酒店");
});

test("reports overlap, arrival and lodging warnings", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  const day = plan.days[0];
  day.overnightPlaceId = "zhengzhou";
  day.items = [
    { id: "t1", type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou", startTime: "09:00", endTime: "12:00", endDayOffset: 0 },
    { id: "a1", type: "activity", placeId: "zhengzhou", title: "博物馆", startTime: "10:00", endTime: "11:00" },
    { id: "a2", type: "activity", placeId: "zhengzhou", title: "公园", startTime: "10:30", endTime: "12:30" }
  ];
  day.lodging = { placeId: "beijing", name: "错误城市酒店" };
  const codes = validateTripPlan(plan, { paceProfile: { dailyTravelLimitSeconds: 4 * 3600 } }).map((warning) => warning.code);
  assert.equal(codes.includes("time-overlap"), true);
  assert.equal(codes.includes("activity-before-arrival"), true);
  assert.equal(codes.includes("lodging-city-mismatch"), true);
});

test("upserts items with stable IDs and immutable inputs", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  const dayId = plan.days[0].id;
  const item = {
    type: "activity",
    placeId: "beijing",
    title: "早餐",
    startTime: "08:00",
    endTime: "09:00",
    manuallyEdited: false
  };
  const beforePlan = structuredClone(plan);
  const beforeItem = structuredClone(item);
  const itemIdFactory = ids();

  const added = applyTripCommand(plan, { type: "upsert-item", dayId, item }, { idFactory: itemIdFactory });

  assert.equal(added.requiresConfirmation, false);
  assert.equal(added.changed, true);
  assert.equal(added.plan.days[0].items[0].id, "item-1");
  assert.equal(added.plan.days[0].items[0].manuallyEdited, true);
  assert.equal(added.plan.days[0].manuallyEdited, true);
  assert.deepEqual(plan, beforePlan);
  assert.deepEqual(item, beforeItem);

  const existingId = added.plan.days[0].items[0].id;
  const update = { ...added.plan.days[0].items[0], title: "早午餐", manuallyEdited: false };
  const updated = applyTripCommand(
    added.plan,
    { type: "upsert-item", dayId, item: update },
    { idFactory: () => assert.fail("existing items must not receive a new ID") }
  );
  assert.equal(updated.plan.days[0].items.length, 1);
  assert.equal(updated.plan.days[0].items[0].id, existingId);
  assert.equal(updated.plan.days[0].items[0].title, "早午餐");
  assert.equal(updated.plan.days[0].items[0].manuallyEdited, true);
  assert.equal(update.manuallyEdited, false);

  const addedWithUnknownId = applyTripCommand(
    updated.plan,
    { type: "upsert-item", dayId, item: { ...item, id: "external-id" } },
    { idFactory: itemIdFactory }
  );
  assert.equal(addedWithUnknownId.plan.days[0].items[1].id, "item-2");
});

test("returns the original plan for semantic item and lodging no-ops", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  const day = plan.days[0];
  day.manuallyEdited = true;
  day.items = [
    {
      id: "item-1",
      type: "activity",
      placeId: "a",
      title: "早餐",
      startTime: "08:00",
      endTime: "09:00",
      manuallyEdited: true
    },
    {
      id: "item-2",
      type: "activity",
      placeId: "a",
      title: "散步",
      startTime: "09:00",
      endTime: "10:00",
      manuallyEdited: true
    }
  ];
  day.lodging = { placeId: "a", name: "酒店", address: "路边" };
  const before = structuredClone(plan);
  const commands = [
    { type: "upsert-item", dayId: day.id, item: { title: "早餐", id: "item-1" } },
    { type: "set-lodging", dayId: day.id, lodging: { address: "路边", name: "酒店", placeId: "a" } },
    { type: "set-overnight", dayId: day.id, placeId: "a" },
    { type: "move-item", itemId: "item-2", targetDayId: day.id, targetIndex: 1 }
  ];

  commands.forEach((command) => {
    const result = applyTripCommand(plan, command);
    assert.equal(result.requiresConfirmation, false);
    assert.equal(result.changed, false);
    assert.equal(result.plan, plan);
  });
  assert.deepEqual(plan, before);
});

test("copies, removes and moves items without losing their IDs", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.days[0].items = [
    { id: "item-1", type: "activity", placeId: "beijing", title: "一" },
    { id: "item-2", type: "activity", placeId: "beijing", title: "二" }
  ];
  plan.days.push({
    id: "day-2",
    cityEntries: [{ id: "city-entry-day-2", visitId: "visit-day-2", placeId: "beijing" }],
    overnightPlaceId: "beijing",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const copied = applyTripCommand(
    plan,
    { type: "copy-item", itemId: "item-1" },
    { idFactory: () => "item-copy" }
  );
  assert.equal(copied.changed, true);
  assert.equal(copied.requiresConfirmation, false);
  assert.deepEqual(copied.plan.days[0].items.map((item) => item.id), ["item-1", "item-copy", "item-2"]);
  assert.equal(copied.plan.days[0].items[1].manuallyEdited, true);
  assert.equal(copied.plan.days[0].manuallyEdited, true);
  assert.deepEqual(plan, before);

  const movedWithinDay = applyTripCommand(copied.plan, {
    type: "move-item",
    itemId: "item-2",
    targetDayId: copied.plan.days[0].id,
    targetIndex: -100
  });
  assert.deepEqual(movedWithinDay.plan.days[0].items.map((item) => item.id), ["item-2", "item-1", "item-copy"]);

  const movedAcrossDays = applyTripCommand(movedWithinDay.plan, {
    type: "move-item",
    itemId: "item-copy",
    targetDayId: "day-2",
    targetIndex: 100
  });
  assert.deepEqual(
    movedAcrossDays.plan.days.flatMap((day) => day.items.map((item) => item.id)),
    ["item-2", "item-1", "item-copy"]
  );
  assert.equal(movedAcrossDays.plan.days[1].items[0].id, "item-copy");
  assert.equal(movedAcrossDays.plan.days[0].manuallyEdited, true);
  assert.equal(movedAcrossDays.plan.days[1].manuallyEdited, true);

  const removed = applyTripCommand(movedAcrossDays.plan, { type: "remove-item", itemId: "item-1" });
  assert.equal(removed.changed, true);
  assert.equal(removed.requiresConfirmation, false);
  assert.deepEqual(removed.plan.days[0].items.map((item) => item.id), ["item-2"]);
  assert.equal(movedAcrossDays.plan.days[0].items.some((item) => item.id === "item-1"), true);
});

test("rejects item moves that would break day and place associations atomically", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.days[0].items = [{
    id: "beijing-activity",
    type: "activity",
    placeId: "beijing",
    title: "Forbidden move"
  }];
  plan.days.push({
    id: "day-shanghai",
    cityEntries: [{ id: "shanghai-entry", visitId: "shanghai-visit", placeId: "shanghai" }],
    overnightPlaceId: "shanghai",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const result = applyTripCommand(plan, {
    type: "move-item",
    itemId: "beijing-activity",
    targetDayId: "day-shanghai",
    targetIndex: 0
  });

  assert.equal(result.changed, false);
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.blockedReason, "item-place-mismatch");
  assert.strictEqual(result.plan, plan);
  assert.deepEqual(plan, before);
});

test("allows overnight transport only when its destination is on the same or following day", () => {
  const plan = createTripPlan({ placeIds: ["a", "b"], idFactory: ids() });
  plan.days[0].items = [{
    id: "overnight-a-b",
    type: "transport",
    fromPlaceId: "a",
    toPlaceId: "b",
    endDayOffset: 1
  }, {
    id: "same-day-a-b",
    type: "transport",
    fromPlaceId: "a",
    toPlaceId: "b",
    endDayOffset: 0
  }];
  plan.days.push({
    id: "day-a",
    cityEntries: [{ id: "entry-a", visitId: "visit-a", placeId: "a" }],
    overnightPlaceId: "a",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  plan.days.push({
    id: "day-b",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b" }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: false
  }, {
    id: "day-c",
    cityEntries: [{ id: "entry-c", visitId: "visit-c", placeId: "c" }],
    overnightPlaceId: "c",
    items: [],
    lodging: null,
    manuallyEdited: false
  });

  const valid = applyTripCommand(plan, {
    type: "move-item",
    itemId: "overnight-a-b",
    targetDayId: "day-a",
    targetIndex: 0
  });
  assert.equal(valid.changed, true);
  assert.equal(valid.blockedReason, undefined);

  const sameDayInvalid = applyTripCommand(plan, {
    type: "move-item",
    itemId: "same-day-a-b",
    targetDayId: "day-a",
    targetIndex: 0
  });
  assert.equal(sameDayInvalid.changed, false);
  assert.equal(sameDayInvalid.blockedReason, "item-place-mismatch");

  const invalid = applyTripCommand(plan, {
    type: "move-item",
    itemId: "overnight-a-b",
    targetDayId: "day-c",
    targetIndex: 0
  });
  assert.equal(invalid.changed, false);
  assert.equal(invalid.blockedReason, "item-place-mismatch");
});

test("confirms and cleans related content before moving the final city occurrence", () => {
  const plan = {
    version: 2,
    id: "trip-city-move",
    name: "Move cleanup",
    startDate: null,
    pace: "standard",
    savedAt: "2026-07-14T00:00:00.000Z",
    days: [{
      id: "day-before",
      cityEntries: [{ id: "entry-x", visitId: "visit-x", placeId: "x" }],
      overnightPlaceId: "x",
      items: [{
        id: "overnight-arrival",
        type: "transport",
        fromPlaceId: "x",
        toPlaceId: "a",
        endDayOffset: 1
      }],
      lodging: null,
      manuallyEdited: false
    }, {
      id: "day-source",
      cityEntries: [
        { id: "entry-a", visitId: "visit-a", placeId: "a" },
        { id: "entry-b", visitId: "visit-b", placeId: "b" }
      ],
      overnightPlaceId: "a",
      items: [
        { id: "activity-a", type: "activity", placeId: "a", title: "Remove" },
        { id: "activity-b", type: "activity", placeId: "b", title: "Keep" }
      ],
      lodging: { placeId: "a", name: "Source lodging" },
      manuallyEdited: false
    }, {
      id: "day-target",
      cityEntries: [{ id: "entry-c", visitId: "visit-c", placeId: "c" }],
      overnightPlaceId: "c",
      items: [],
      lodging: { placeId: "c", name: "Target lodging" },
      manuallyEdited: false
    }]
  };
  const before = structuredClone(plan);
  const command = { type: "move-city", entryId: "entry-a", targetDayId: "day-target", targetIndex: 1 };

  const confirmation = applyTripCommand(plan, command);
  assert.equal(confirmation.requiresConfirmation, true);
  assert.equal(confirmation.changed, false);
  assert.equal(confirmation.confirmationReason, "cleanup-associated-content");
  assert.deepEqual(confirmation.affectedDayIds, ["day-before", "day-source"]);
  assert.strictEqual(confirmation.plan, plan);
  assert.deepEqual(plan, before);

  const moved = applyTripCommand(plan, command, { force: true });
  assert.equal(moved.requiresConfirmation, false);
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.plan.days[0].items, []);
  assert.deepEqual(moved.plan.days[1].cityEntries.map((entry) => entry.placeId), ["b"]);
  assert.deepEqual(moved.plan.days[1].items.map((item) => item.id), ["activity-b"]);
  assert.equal(moved.plan.days[1].lodging, null);
  assert.equal(moved.plan.days[1].overnightPlaceId, "b");
  assert.deepEqual(moved.plan.days[2].cityEntries.map((entry) => entry.placeId), ["c", "a"]);
  assert.deepEqual(moved.plan.days[2].lodging, { placeId: "c", name: "Target lodging" });
  assert.deepEqual(plan, before);
});

test("confirms and consistently cleans a city with related content", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  const day = plan.days[0];
  const beijingEntry = day.cityEntries.find((entry) => entry.placeId === "beijing");
  day.items = [
    { id: "beijing-activity", type: "activity", placeId: "beijing" },
    { id: "outbound", type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou" },
    { id: "keep", type: "activity", placeId: "zhengzhou" }
  ];
  day.lodging = { placeId: "beijing", name: "待删除酒店" };
  const before = structuredClone(plan);

  const confirmation = applyTripCommand(plan, { type: "remove-city", entryId: beijingEntry.id });
  assert.equal(confirmation.requiresConfirmation, true);
  assert.equal(confirmation.changed, false);
  assert.equal(confirmation.plan, plan);
  assert.deepEqual(confirmation.affectedDayIds, [day.id]);
  assert.deepEqual(plan, before);

  const removed = applyTripCommand(
    plan,
    { type: "remove-city", entryId: beijingEntry.id },
    { force: true }
  );
  assert.equal(removed.requiresConfirmation, false);
  assert.equal(removed.changed, true);
  assert.deepEqual(removed.plan.days[0].cityEntries.map((entry) => entry.placeId), ["zhengzhou"]);
  assert.deepEqual(removed.plan.days[0].items.map((item) => item.id), ["keep"]);
  assert.equal(removed.plan.days[0].lodging, null);
  assert.equal(removed.plan.days[0].overnightPlaceId, "zhengzhou");
  assert.equal(removed.plan.days[0].manuallyEdited, true);
  assert.deepEqual(plan, before);
});

test("confirms and removes overnight transport linked to a removed city occurrence", () => {
  const plan = createTripPlan({ placeIds: ["a", "b"], idFactory: ids() });
  const firstDay = plan.days[0];
  firstDay.items = [
    {
      id: "day-one-to-b",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "09:00",
      endTime: "10:00",
      endDayOffset: 0
    },
    {
      id: "overnight-to-b",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "22:30",
      endTime: "01:10",
      endDayOffset: 1
    },
    {
      id: "overnight-to-c",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "c",
      startTime: "23:00",
      endTime: "02:00",
      endDayOffset: 1
    }
  ];
  plan.days.push({
    id: "day-2",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: true }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const confirmation = applyTripCommand(plan, { type: "remove-city", entryId: "entry-b" });
  assert.equal(confirmation.requiresConfirmation, true);
  assert.equal(confirmation.changed, false);
  assert.equal(confirmation.plan, plan);
  assert.deepEqual(confirmation.affectedDayIds, [firstDay.id, "day-2"]);
  assert.deepEqual(plan, before);

  const removed = applyTripCommand(
    plan,
    { type: "remove-city", entryId: "entry-b" },
    { force: true }
  );
  assert.equal(removed.requiresConfirmation, false);
  assert.equal(removed.changed, true);
  assert.equal(removed.plan.days.length, 1);
  assert.deepEqual(
    removed.plan.days[0].items.map((item) => item.id),
    ["day-one-to-b", "overnight-to-c"]
  );
  assert.equal(
    removed.plan.days.some((day) => day.items.some((item) => item.id === "overnight-to-b")),
    false
  );
  assert.equal(removed.plan.days[0].cityEntries.some((entry) => entry.placeId === "b"), true);
  assert.equal(removed.plan.days[0].manuallyEdited, true);
  assert.deepEqual(plan, before);
});

test("treats an untimed previous-day overnight transport as a structural arrival", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  plan.days[0].items = [{
    id: "too-early",
    type: "transport",
    fromPlaceId: "a",
    toPlaceId: "b",
    startTime: "",
    endTime: "",
    endDayOffset: "1"
  }];
  plan.days.push({
    id: "day-before",
    cityEntries: [{ id: "entry-before", visitId: "visit-before", placeId: "a", manuallyPlaced: false }],
    overnightPlaceId: "a",
    items: [{
      id: "untimed-night",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "",
      endTime: "invalid",
      endDayOffset: "1"
    }, {
      id: "offset-zero",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "",
      endTime: "",
      endDayOffset: "0"
    }],
    lodging: null,
    manuallyEdited: false
  }, {
    id: "day-target",
    cityEntries: [{ id: "entry-target-b", visitId: "visit-target-b", placeId: "b", manuallyPlaced: false }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);
  const command = { type: "remove-city", entryId: "entry-target-b" };

  const guarded = applyTripCommand(plan, command);
  assert.equal(guarded.requiresConfirmation, true);
  assert.equal(guarded.changed, false);
  assert.deepEqual(guarded.affectedDayIds, ["day-before", "day-target"]);
  assert.equal(guarded.plan, plan);

  const forced = applyTripCommand(plan, command, { force: true });
  assert.equal(forced.changed, true);
  assert.equal(forced.plan.days.some((day) => day.id === "day-target"), false);
  assert.deepEqual(forced.plan.days[0].items.map((item) => item.id), ["too-early"]);
  assert.deepEqual(
    forced.plan.days.find((day) => day.id === "day-before").items.map((item) => item.id),
    ["offset-zero"]
  );
  assert.deepEqual(plan, before);
});

test("removes a day when its final city is removed", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  const result = applyTripCommand(plan, {
    type: "remove-city",
    entryId: plan.days[0].cityEntries[0].id
  });
  assert.equal(result.changed, true);
  assert.equal(result.requiresConfirmation, false);
  assert.deepEqual(result.plan.days, []);
  assert.equal(plan.days.length, 1);
});

test("sets lodging and limits overnight places to the current day", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  const dayId = plan.days[0].id;
  const lodging = { placeId: "zhengzhou", name: "站前酒店" };

  const lodged = applyTripCommand(plan, { type: "set-lodging", dayId, lodging });
  assert.equal(lodged.changed, true);
  assert.equal(lodged.requiresConfirmation, false);
  assert.notEqual(lodged.plan.days[0].lodging, lodging);
  assert.deepEqual(lodged.plan.days[0].lodging, lodging);
  assert.equal(lodged.plan.days[0].manuallyEdited, true);
  lodging.name = "输入随后变化";
  assert.equal(lodged.plan.days[0].lodging.name, "站前酒店");
  assert.equal(plan.days[0].lodging, null);

  const invalid = applyTripCommand(plan, { type: "set-overnight", dayId, placeId: "wuhan" });
  assert.equal(invalid.changed, false);
  assert.equal(invalid.plan, plan);

  const clearedOvernight = applyTripCommand(plan, { type: "set-overnight", dayId, placeId: null });
  assert.equal(clearedOvernight.changed, true);
  assert.equal(clearedOvernight.plan.days[0].overnightPlaceId, null);
  assert.equal(clearedOvernight.plan.days[0].manuallyEdited, true);

  const clearedLodging = applyTripCommand(lodged.plan, { type: "set-lodging", dayId, lodging: null });
  assert.equal(clearedLodging.changed, true);
  assert.equal(clearedLodging.plan.days[0].lodging, null);
});

test("updates only explicit metadata and can clear the start date", () => {
  const plan = createTripPlan({
    placeIds: ["beijing"],
    name: "旧行程",
    startDate: "2026-10-01",
    pace: "standard",
    idFactory: ids()
  });
  const before = structuredClone(plan);

  const patched = applyTripCommand(plan, {
    type: "update-metadata",
    patch: { name: "新行程", startDate: null }
  });
  assert.equal(patched.changed, true);
  assert.equal(patched.requiresConfirmation, false);
  assert.equal(patched.plan.name, "新行程");
  assert.equal(patched.plan.startDate, null);
  assert.equal(patched.plan.pace, "standard");
  assert.deepEqual(plan, before);

  const direct = applyTripCommand(patched.plan, { type: "update-metadata", pace: "relaxed" });
  assert.equal(direct.plan.pace, "relaxed");
  assert.equal(direct.plan.name, "新行程");

  const noOp = applyTripCommand(direct.plan, {
    type: "update-metadata",
    patch: { pace: "relaxed", ignored: "value" }
  });
  assert.equal(noOp.changed, false);
  assert.equal(noOp.plan, direct.plan);
});

test("resolves plan pace consistently across compact edits and undo", async () => {
  const tripPlanModule = await import("../public/static-site/trip-plan.js");
  assert.equal(typeof tripPlanModule.resolveTripPace, "function");
  const standardPlan = createTripPlan({ placeIds: ["beijing"], pace: "standard", idFactory: ids() });
  const compactResult = applyTripCommand(standardPlan, {
    type: "update-metadata",
    patch: { pace: "compact" }
  });

  let statePace = tripPlanModule.resolveTripPace(compactResult.plan, "standard");
  assert.equal(statePace, "compact");
  statePace = tripPlanModule.resolveTripPace(standardPlan, statePace);
  assert.equal(statePace, "standard");

  const compactAgain = applyTripCommand(standardPlan, {
    type: "update-metadata",
    patch: { pace: "compact" }
  });
  assert.equal(compactAgain.changed, true);
  assert.equal(tripPlanModule.resolveTripPace(compactAgain.plan, statePace), "compact");
  assert.equal(tripPlanModule.resolveTripPace({ pace: "unsupported" }, "standard"), "standard");
  assert.equal(tripPlanModule.resolveTripPace(null, "compact"), "compact");
});

test("parses only valid HH:mm values", () => {
  assert.equal(timeToMinutes("00:00"), 0);
  assert.equal(timeToMinutes("09:05"), 9 * 60 + 5);
  assert.equal(timeToMinutes("23:59"), 23 * 60 + 59);
  [
    undefined,
    null,
    "",
    "9:05",
    "24:00",
    "09:60",
    "09:5",
    " 09:05",
    "09:05 ",
    ["09:05"],
    new String("09:05"),
    905,
    {}
  ].forEach((value) => {
    assert.equal(timeToMinutes(value), null);
  });
});

test("accepts overnight transport and rejects invalid or crossing activities", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  plan.days[0].items = [
    { id: "night-train", type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou", startTime: "22:30", endTime: "01:10", endDayOffset: 1 },
    { id: "missing", type: "activity", placeId: "beijing", startTime: "", endTime: "10:00" },
    { id: "zero", type: "activity", placeId: "beijing", startTime: "10:00", endTime: "10:00" },
    { id: "crossing-activity", type: "activity", placeId: "beijing", startTime: "23:00", endTime: "01:00", endDayOffset: 1 }
  ];
  plan.days.push({
    id: "day-next",
    cityEntries: [{ id: "entry-next", visitId: "visit-next", placeId: "zhengzhou", manuallyPlaced: true }],
    overnightPlaceId: null,
    items: [{ id: "early-activity", type: "activity", placeId: "zhengzhou", startTime: "00:30", endTime: "02:00" }],
    lodging: null,
    manuallyEdited: false
  });

  const warnings = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 24 * 3600, playWindowSeconds: 24 * 3600 }
  });
  const missingIds = warnings
    .filter((warning) => warning.code === "missing-time")
    .flatMap((warning) => warning.itemIds);
  assert.equal(missingIds.includes("night-train"), false);
  assert.deepEqual(new Set(missingIds), new Set(["missing", "zero", "crossing-activity"]));

  const crossDayOverlaps = warnings.filter((warning) =>
    warning.code === "time-overlap" &&
    warning.itemIds.includes("night-train") &&
    warning.itemIds.includes("early-activity")
  );
  assert.equal(crossDayOverlaps.length, 1);
  assert.equal(crossDayOverlaps[0].dayId, "day-next");
});

test("uses the most recent departed transport for arrival warnings", () => {
  const plan = createTripPlan({ placeIds: ["b"], idFactory: ids() });
  plan.days[0].overnightPlaceId = null;
  plan.days[0].items = [
    {
      id: "historical-arrival",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "08:00",
      endTime: "09:00",
      endDayOffset: 0
    }
  ];
  plan.days.push({
    id: "current-day",
    cityEntries: [{ id: "current-b", visitId: "current-visit", placeId: "b", manuallyPlaced: true }],
    overnightPlaceId: null,
    items: [
      { id: "activity", type: "activity", placeId: "b", startTime: "10:00", endTime: "11:00" },
      {
        id: "current-arrival",
        type: "transport",
        fromPlaceId: "a",
        toPlaceId: "b",
        startTime: "09:00",
        endTime: "12:00",
        endDayOffset: 0
      }
    ],
    lodging: null,
    manuallyEdited: false
  });

  const warning = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 24 * 3600 }
  }).find((candidate) => candidate.code === "activity-before-arrival" && candidate.itemIds.includes("activity"));
  assert.ok(warning);
  assert.deepEqual(warning.itemIds, ["activity", "current-arrival"]);
});

test("does not deduct overnight transport outside daytime play windows", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  plan.days[0].overnightPlaceId = null;
  plan.days[0].items = [
    {
      id: "night-train",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "22:30",
      endTime: "01:10",
      endDayOffset: 1
    }
  ];
  plan.days.push({
    id: "day-2",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: true }],
    overnightPlaceId: null,
    items: [],
    lodging: null,
    manuallyEdited: false
  });

  const playWarnings = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 24 * 3600, playWindowSeconds: 3 * 3600 }
  }).filter((warning) => warning.code === "play-time-short");
  assert.deepEqual(playWarnings, []);
});

test("charges cross-day transport only to the day windows it intersects", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  plan.days[0].overnightPlaceId = null;
  plan.days[0].items = [
    {
      id: "long-overnight",
      type: "transport",
      fromPlaceId: "a",
      toPlaceId: "b",
      startTime: "21:00",
      endTime: "10:00",
      endDayOffset: 1
    }
  ];
  plan.days.push({
    id: "day-2",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: true }],
    overnightPlaceId: null,
    items: [],
    lodging: null,
    manuallyEdited: false
  });

  const warningDayIds = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 24 * 3600, playWindowSeconds: 3 * 3600 }
  }).filter((warning) => warning.code === "play-time-short").map((warning) => warning.dayId);
  assert.deepEqual(warningDayIds, ["day-2"]);
});

test("does not double count overlapping transport inside a play window", () => {
  const plan = createTripPlan({ placeIds: ["a", "b"], idFactory: ids() });
  const day = plan.days[0];
  day.overnightPlaceId = null;
  day.items = [
    { id: "first", type: "transport", fromPlaceId: "a", toPlaceId: "b", startTime: "08:00", endTime: "11:00", endDayOffset: 0 },
    { id: "second", type: "transport", fromPlaceId: "b", toPlaceId: "a", startTime: "09:00", endTime: "12:00", endDayOffset: 0 }
  ];

  const playWarnings = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 24 * 3600, playWindowSeconds: 6 * 3600 }
  }).filter((warning) => warning.code === "play-time-short");
  assert.deepEqual(playWarnings, []);
});

test("reports daily feasibility warnings with a complete structure", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "zhengzhou"], idFactory: ids() });
  const day = plan.days[0];
  day.overnightPlaceId = "wuhan";
  day.lodging = null;
  day.items = [
    { id: "outbound", type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou", startTime: "08:00", endTime: "10:00", endDayOffset: 0 },
    { id: "return", type: "transport", fromPlaceId: "zhengzhou", toPlaceId: "beijing", startTime: "11:00", endTime: "13:00", endDayOffset: 0 }
  ];

  const warnings = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 3 * 3600, playWindowSeconds: 5 * 3600 }
  });
  const codes = warnings.map((warning) => warning.code);
  ["travel-over-limit", "play-time-short", "overnight-city-missing", "lodging-missing"].forEach((code) => {
    assert.equal(codes.includes(code), true);
  });
  warnings.forEach((warning) => {
    assert.equal(Object.hasOwn(warning, "code"), true);
    assert.equal(Object.hasOwn(warning, "dayId"), true);
    assert.equal(Object.hasOwn(warning, "itemIds"), true);
    assert.equal(warning.severity, "warning");
    assert.equal(Array.isArray(warning.itemIds), true);
  });

  day.overnightPlaceId = "zhengzhou";
  day.lodging = { placeId: "zhengzhou", name: "酒店" };
  day.items = [
    { id: "long-trip", type: "transport", fromPlaceId: "beijing", toPlaceId: "zhengzhou", startTime: "08:00", endTime: "21:00", endDayOffset: 0 }
  ];
  const defaultWindowCodes = validateTripPlan(plan, {
    paceProfile: { dailyTravelLimitSeconds: 14 * 3600 }
  }).map((warning) => warning.code);
  assert.equal(defaultWindowCodes.includes("play-time-short"), true);
  assert.equal(defaultWindowCodes.includes("travel-over-limit"), false);
});

test("inserts a new route place without moving manually edited days", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "wuhan"], idFactory: ids() });
  plan.days[0].manuallyEdited = true;
  const result = reconcileRoutePlaces(plan, ["beijing", "zhengzhou", "wuhan"], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(result.plan), ["beijing", "zhengzhou", "wuhan"]);
  assert.equal(result.plan.days[0].id, plan.days[0].id);
});

test("rejects invalid route place inputs before changing a plan", () => {
  const plan = createTripPlan({ placeIds: ["a", "b"], idFactory: ids() });
  const before = structuredClone(plan);
  [undefined, null, "a,b", {}, ["a", " "], ["a", 7]].forEach((nextPlaceIds) => {
    assert.throws(
      () => reconcileRoutePlaces(plan, nextPlaceIds, { idFactory: ids() }),
      { name: "TypeError", message: "路线地点格式无效" }
    );
    assert.deepEqual(plan, before);
  });

  const trimmed = reconcileRoutePlaces(plan, [" a ", " b "], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(trimmed.plan), ["a", "b"]);
});

test("inserts a repeated route occurrence with a distinct visit", () => {
  const plan = createTripPlan({ placeIds: ["a", "b"], idFactory: ids() });
  const dayId = plan.days[0].id;
  const [firstA, existingB] = plan.days[0].cityEntries;

  const result = reconcileRoutePlaces(plan, ["a", "b", "a"], { idFactory: ids() });
  const entries = result.plan.days[0].cityEntries;
  const aEntries = entries.filter((entry) => entry.placeId === "a");
  assert.deepEqual(routePlaceIds(result.plan), ["a", "b", "a"]);
  assert.equal(result.plan.days[0].id, dayId);
  assert.equal(entries[0].id, firstA.id);
  assert.equal(entries[1].id, existingB.id);
  assert.equal(aEntries.length, 2);
  assert.notEqual(aEntries[0].visitId, aEntries[1].visitId);
});

test("removes only an unmatched repeated route occurrence", () => {
  const plan = createTripPlan({ placeIds: ["a", "b", "a"], idFactory: ids() });
  const dayId = plan.days[0].id;
  const [firstA, existingB, finalA] = plan.days[0].cityEntries;
  plan.days[0].items = [{ id: "activity-a", type: "activity", placeId: "a" }];
  plan.days[0].lodging = { placeId: "a", name: "A 酒店" };

  const result = reconcileRoutePlaces(plan, ["a", "b"], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(result.plan), ["a", "b"]);
  assert.equal(result.plan.days[0].id, dayId);
  assert.deepEqual(result.plan.days[0].cityEntries.map((entry) => entry.id), [firstA.id, existingB.id]);
  assert.equal(result.plan.days[0].cityEntries.some((entry) => entry.id === finalA.id), false);
  assert.deepEqual(result.plan.days[0].items, [{ id: "activity-a", type: "activity", placeId: "a" }]);
  assert.deepEqual(result.plan.days[0].lodging, { placeId: "a", name: "A 酒店" });
});

test("blocks and authorizes removal of only the protected repeated occurrence", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  const firstAEntryId = plan.days[0].cityEntries[0].id;
  plan.days.push({
    id: "day-b",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: false }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: false
  }, {
    id: "day-final-a",
    cityEntries: [{ id: "entry-final-a", visitId: "visit-final-a", placeId: "a", manuallyPlaced: true }],
    overnightPlaceId: "a",
    items: [],
    lodging: null,
    manuallyEdited: true
  });
  const before = structuredClone(plan);

  const blocked = reconcileRoutePlaces(plan, ["a", "b"], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(blocked.plan), ["a", "b", "a"]);
  assert.deepEqual(blocked.blockedRemovals, [{ placeId: "a", dayIds: ["day-final-a"] }]);
  assert.deepEqual(plan, before);

  const removed = reconcileRoutePlaces(plan, ["a", "b"], {
    idFactory: ids(),
    allowRemovalIds: new Set(["a"])
  });
  assert.deepEqual(removed.blockedRemovals, []);
  assert.deepEqual(routePlaceIds(removed.plan), ["a", "b"]);
  assert.equal(removed.plan.days.length, 2);
  assert.equal(removed.plan.days[0].cityEntries[0].id, firstAEntryId);
  assert.equal(removed.plan.days.some((day) => day.id === "day-final-a"), false);
  assert.deepEqual(plan, before);
});

test("aggregates protection when multiple unmatched occurrences leave a day", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  plan.days.push({
    id: "day-b",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: false }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: false
  }, {
    id: "day-tail",
    cityEntries: [
      { id: "entry-extra-a-1", visitId: "visit-extra-a-1", placeId: "a", manuallyPlaced: false },
      { id: "entry-c", visitId: "visit-c", placeId: "c", manuallyPlaced: false },
      { id: "entry-extra-a-2", visitId: "visit-extra-a-2", placeId: "a", manuallyPlaced: false }
    ],
    overnightPlaceId: "a",
    items: [{ id: "activity-a", type: "activity", placeId: "a" }],
    lodging: { placeId: "a", name: "A 酒店" },
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const blocked = reconcileRoutePlaces(plan, ["a", "b", "c"], { idFactory: ids() });
  assert.deepEqual(blocked.blockedRemovals, [{ placeId: "a", dayIds: ["day-tail"] }]);
  assert.deepEqual(blocked.plan, before);

  const removed = reconcileRoutePlaces(plan, ["a", "b", "c"], {
    idFactory: ids(),
    allowRemovalIds: new Set(["a"])
  });
  const tailDay = removed.plan.days.find((day) => day.id === "day-tail");
  assert.deepEqual(routePlaceIds(removed.plan), ["a", "b", "c"]);
  assert.deepEqual(tailDay.cityEntries.map((entry) => entry.placeId), ["c"]);
  assert.deepEqual(tailDay.items, []);
  assert.equal(tailDay.lodging, null);
  assert.equal(tailDay.overnightPlaceId, "c");
  assert.deepEqual(plan, before);
});

test("keeps blocked route reconciliation transactional during reordering", () => {
  const plan = createTripPlan({ placeIds: ["a"], idFactory: ids() });
  plan.days.push({
    id: "day-b",
    cityEntries: [{ id: "entry-b", visitId: "visit-b", placeId: "b", manuallyPlaced: false }],
    overnightPlaceId: "b",
    items: [],
    lodging: null,
    manuallyEdited: true
  }, {
    id: "day-c",
    cityEntries: [{ id: "entry-c", visitId: "visit-c", placeId: "c", manuallyPlaced: false }],
    overnightPlaceId: "c",
    items: [{ id: "activity-c", type: "activity", placeId: "c" }],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const blocked = reconcileRoutePlaces(plan, ["c", "b", "a"], { idFactory: ids() });
  assert.equal(blocked.plan, plan);
  assert.deepEqual(routePlaceIds(blocked.plan), ["a", "b", "c"]);
  assert.deepEqual(blocked.blockedRemovals, [
    { placeId: "b", dayIds: ["day-b"] },
    { placeId: "c", dayIds: ["day-c"] }
  ]);
  assert.deepEqual(plan, before);

  const allowed = reconcileRoutePlaces(plan, ["c", "b", "a"], {
    idFactory: ids(),
    allowRemovalIds: new Set(["b", "c"])
  });
  assert.deepEqual(allowed.blockedRemovals, []);
  assert.deepEqual(routePlaceIds(allowed.plan), ["c", "b", "a"]);
  assert.deepEqual(plan, before);
});

test("migrates the existing route snapshot to v2", () => {
  const result = migrateTripState({
    transportMode: "highspeed",
    tripPace: "standard",
    selectedCityId: "wuhan",
    routes: [{ from: "beijing", to: "zhengzhou" }, { from: "zhengzhou", to: "wuhan" }]
  }, { idFactory: ids(), paceProfile: { dailyTravelLimitSeconds: 4 * 3600, maxDailyPlaces: 3 } });
  assert.equal(result.version, 2);
  assert.deepEqual(routePlaceIds(result), ["beijing", "zhengzhou", "wuhan"]);
});

test("uses a trip file when the final URL exceeds 12000 characters", () => {
  assert.equal(shouldUseTripFile("https://example.test/#trip=" + "x".repeat(12000)), true);
  assert.equal(compactTripPlan(createTripPlan({ placeIds: ["beijing"], idFactory: ids() })).version, 2);
});

test("blocks protected route removals with unique ordered day IDs", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "wuhan"], idFactory: ids() });
  const firstDay = plan.days[0];
  firstDay.manuallyEdited = true;
  firstDay.items = [
    { id: "keep-beijing", type: "activity", placeId: "beijing" },
    {
      id: "remove-wuhan",
      type: "transport",
      placeId: "wuhan",
      fromPlaceId: "wuhan",
      toPlaceId: "wuhan"
    }
  ];
  plan.days.push({
    id: "day-later",
    cityEntries: [
      { id: "entry-zhengzhou", visitId: "visit-zhengzhou", placeId: "zhengzhou", manuallyPlaced: false }
    ],
    overnightPlaceId: "zhengzhou",
    items: [
      { id: "arrive-zhengzhou", type: "transport", fromPlaceId: "wuhan", toPlaceId: "zhengzhou" },
      { id: "keep-zhengzhou", type: "activity", placeId: "zhengzhou" }
    ],
    lodging: { placeId: "wuhan", name: "旧酒店" },
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const blocked = reconcileRoutePlaces(plan, ["beijing", "zhengzhou"], { idFactory: ids() });
  assert.equal(blocked.plan, plan);
  assert.deepEqual(blocked.plan, before);
  assert.deepEqual(blocked.blockedRemovals, [{
    placeId: "wuhan",
    dayIds: [firstDay.id, "day-later"]
  }]);
  assert.deepEqual(plan, before);

  const removed = reconcileRoutePlaces(plan, ["beijing", "zhengzhou"], {
    idFactory: ids(),
    allowRemovalIds: new Set(["wuhan"])
  });
  assert.deepEqual(removed.blockedRemovals, []);
  assert.deepEqual(routePlaceIds(removed.plan), ["beijing", "zhengzhou"]);
  assert.deepEqual(removed.plan.days[0].items.map((item) => item.id), ["keep-beijing"]);
  assert.equal(removed.plan.days[0].lodging, null);
  assert.equal(removed.plan.days[0].overnightPlaceId, "beijing");
  assert.deepEqual(removed.plan.days[1].items.map((item) => item.id), ["keep-zhengzhou"]);
  assert.equal(removed.plan.days[1].lodging, null);
  assert.equal(removed.plan.days[1].overnightPlaceId, "zhengzhou");
  assert.deepEqual(plan, before);
});

test("removes an unprotected route place and its empty day", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.days.push({
    id: "day-wuhan",
    cityEntries: [
      { id: "entry-wuhan", visitId: "visit-wuhan", placeId: "wuhan", manuallyPlaced: false }
    ],
    overnightPlaceId: "wuhan",
    items: [],
    lodging: null,
    manuallyEdited: false
  });
  const before = structuredClone(plan);

  const result = reconcileRoutePlaces(plan, ["beijing"], { idFactory: ids() });
  assert.deepEqual(result.blockedRemovals, []);
  assert.deepEqual(routePlaceIds(result.plan), ["beijing"]);
  assert.equal(result.plan.days.length, 1);
  assert.deepEqual(plan, before);
});

test("creates a day when reconciling a route without existing anchors", () => {
  const plan = createTripPlan({ placeIds: [], idFactory: ids() });
  const result = reconcileRoutePlaces(plan, ["wuhan"], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(result.plan), ["wuhan"]);
  assert.equal(result.plan.days.length, 1);
  assert.equal(result.plan.days[0].manuallyEdited, false);
  assert.equal(result.plan.days[0].cityEntries[0].manuallyPlaced, false);
});

test("recomputes the target day overnight place after route insertion", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  const result = reconcileRoutePlaces(plan, ["beijing", "wuhan"], { idFactory: ids() });
  assert.equal(result.plan.days[0].overnightPlaceId, "wuhan");
});

test("rejects invalid trip plan roots", () => {
  [null, undefined, "trip", [], {}, { days: null }].forEach((value) => {
    assert.throws(
      () => normalizeTripPlan(value),
      { name: "TypeError", message: "行程文件格式无效" }
    );
  });
});

test("normalizes missing fields and filters unsupported items", () => {
  const source = {
    version: 99,
    id: "",
    name: "旅".repeat(65),
    startDate: "2026-02-29",
    pace: "rushed",
    days: [{
      cityEntries: [null, "beijing", {}, { placeId: 42, manuallyPlaced: "yes" }],
      overnightPlaceId: "42",
      items: [
        null,
        { id: "unsupported", type: "note" },
        {
          type: "transport",
          fromPlaceId: 1,
          toPlaceId: 42,
          serviceNo: 99,
          startTime: 800,
          endTime: "09:00",
          note: null,
          endDayOffset: 2,
          manuallyEdited: 1
        },
        {
          type: "activity",
          sourceType: "museum",
          sourceId: 9,
          placeId: 42,
          title: "",
          startTime: "10:00"
        }
      ],
      lodging: { placeId: 42, name: 7, address: null, checkInTime: "15:00", checkOutTime: 1200 },
      manuallyEdited: "yes"
    }],
    savedAt: 123
  };
  const before = structuredClone(source);

  const result = normalizeTripPlan(source, { idFactory: ids() });
  assert.equal(result.version, TRIP_PLAN_VERSION);
  assert.match(result.id, /^trip-/);
  assert.equal(result.name, "旅".repeat(60));
  assert.equal(result.startDate, null);
  assert.equal(result.pace, "standard");
  assert.equal(Number.isNaN(Date.parse(result.savedAt)), false);
  assert.deepEqual(Object.keys(result.days[0]).sort(), [
    "cityEntries", "id", "items", "lodging", "manuallyEdited", "overnightPlaceId"
  ]);
  assert.equal(result.days[0].overnightPlaceId, "42");
  assert.equal(result.days[0].manuallyEdited, true);
  assert.equal(result.days[0].cityEntries.length, 1);
  assert.equal(result.days[0].cityEntries[0].placeId, "42");
  assert.equal(result.days[0].cityEntries[0].manuallyPlaced, true);
  assert.match(result.days[0].cityEntries[0].id, /^city-entry-/);
  assert.match(result.days[0].cityEntries[0].visitId, /^visit-/);

  const [transport, activity] = result.days[0].items;
  assert.deepEqual(Object.keys(transport).sort(), [
    "endDayOffset", "endTime", "fromPlaceId", "id", "manuallyEdited", "note", "serviceNo", "startTime", "toPlaceId", "type"
  ]);
  assert.equal(transport.fromPlaceId, "1");
  assert.equal(transport.toPlaceId, "42");
  assert.equal(transport.serviceNo, "99");
  assert.equal(transport.startTime, "");
  assert.equal(transport.endTime, "09:00");
  assert.equal(transport.note, "");
  assert.equal(transport.endDayOffset, 0);
  assert.equal(transport.manuallyEdited, true);
  assert.deepEqual(Object.keys(activity).sort(), [
    "endTime", "id", "manuallyEdited", "note", "placeId", "sourceId", "sourceType", "startTime", "title", "type"
  ]);
  assert.equal(activity.sourceType, "custom");
  assert.equal(activity.sourceId, null);
  assert.equal(activity.placeId, "42");
  assert.equal(activity.title, "未命名活动");
  assert.deepEqual(result.days[0].lodging, {
    placeId: "42",
    name: "7",
    address: "",
    checkInTime: "15:00",
    checkOutTime: "1200",
    note: ""
  });
  assert.deepEqual(source, before);
});

test("repairs non-string structure IDs and fills empty relationship fields", () => {
  const result = normalizeTripPlan({
    id: 9,
    name: 10,
    days: [{
      id: 11,
      cityEntries: [{ id: 12, visitId: 13, placeId: "beijing" }],
      overnightPlaceId: 14,
      items: [
        { id: 15, type: "transport" },
        { id: 16, type: "activity", sourceId: 17 }
      ],
      lodging: {}
    }],
    savedAt: "legacy-timestamp"
  }, { idFactory: ids() });

  assert.match(result.id, /^trip-/);
  assert.equal(result.name, "我的旅行");
  assert.equal(Number.isNaN(Date.parse(result.savedAt)), false);
  assert.notEqual(result.savedAt, "legacy-timestamp");
  assert.match(result.days[0].id, /^day-/);
  assert.match(result.days[0].cityEntries[0].id, /^city-entry-/);
  assert.match(result.days[0].cityEntries[0].visitId, /^visit-/);
  assert.equal(result.days[0].overnightPlaceId, null);
  assert.deepEqual(
    {
      fromPlaceId: result.days[0].items[0].fromPlaceId,
      toPlaceId: result.days[0].items[0].toPlaceId,
      serviceNo: result.days[0].items[0].serviceNo
    },
    { fromPlaceId: "", toPlaceId: "", serviceNo: "" }
  );
  assert.match(result.days[0].items[0].id, /^item-/);
  assert.equal(result.days[0].items[1].sourceId, null);
  assert.equal(result.days[0].items[1].placeId, "");
  assert.equal(result.days[0].items[1].title, "未命名活动");
  assert.deepEqual(result.days[0].lodging, {
    placeId: "",
    name: "",
    address: "",
    checkInTime: "",
    checkOutTime: "",
    note: ""
  });
});

test("normalizes target IDs globally and assigns visits by route occurrence", () => {
  const source = {
    id: "   ",
    days: [{
      id: " day-shared ",
      cityEntries: [
        { id: " entry-shared ", visitId: " visit-shared ", placeId: "a" }
      ],
      items: [
        { id: " item-shared ", type: "activity", placeId: "a" }
      ]
    }, {
      id: "day-shared",
      cityEntries: [
        { id: "entry-shared", visitId: "ignored-adjacent", placeId: "a" },
        { id: "   ", visitId: "visit-shared", placeId: "b" },
        { id: "entry-shared", visitId: "visit-shared", placeId: "a" }
      ],
      items: [{ id: "item-shared", type: "transport", fromPlaceId: "a", toPlaceId: "b" }]
    }]
  };
  const before = structuredClone(source);

  const result = normalizeTripPlan(source, { idFactory: ids() });
  const entries = result.days.flatMap((day) => day.cityEntries);
  const items = result.days.flatMap((day) => day.items);
  const dayIds = result.days.map((day) => day.id);
  const entryIds = entries.map((entry) => entry.id);
  const itemIds = items.map((item) => item.id);
  assert.equal(result.id.trim().length > 0, true);
  assert.equal(new Set(dayIds).size, dayIds.length);
  assert.equal(new Set(entryIds).size, entryIds.length);
  assert.equal(new Set(itemIds).size, itemIds.length);
  [...dayIds, ...entryIds, ...itemIds].forEach((id) => {
    assert.equal(id, id.trim());
    assert.equal(id.length > 0, true);
  });
  assert.equal(dayIds[0], "day-shared");
  assert.equal(entryIds[0], "entry-shared");
  assert.equal(itemIds[0], "item-shared");
  assert.equal(entries[0].visitId, entries[1].visitId);
  assert.notEqual(entries[1].visitId, entries[2].visitId);
  assert.notEqual(entries[2].visitId, entries[3].visitId);
  assert.notEqual(entries[0].visitId, entries[3].visitId);
  assert.deepEqual(source, before);
});

test("retries colliding generated IDs and fails when uniqueness is exhausted", () => {
  const generated = ["day-1", "   ", "day-2"];
  const result = normalizeTripPlan({
    id: "trip",
    days: [{ id: "day-1" }, { id: "day-1" }]
  }, { idFactory: () => generated.shift() });
  assert.deepEqual(result.days.map((day) => day.id), ["day-1", "day-2"]);
  assert.deepEqual(generated, []);

  assert.throws(
    () => normalizeTripPlan({
      id: "trip",
      days: [{ id: "day-1" }, { id: "day-1" }]
    }, { idFactory: () => "day-1" }),
    TypeError
  );
});

test("accepts only real strict calendar dates including years below 100", () => {
  const normalizedDate = (startDate) => normalizeTripPlan({ startDate, days: [] }, { idFactory: ids() }).startDate;
  ["2026-02-29", "1900-02-29", "2026-04-31", "2026-2-03", "2026-13-01", "not-a-date"].forEach((value) => {
    assert.equal(normalizedDate(value), null);
  });
  ["2024-02-29", "2000-02-29", "0099-01-01"].forEach((value) => {
    assert.equal(normalizedDate(value), value);
  });
});

test("derives normalized dates below year 100 without remapping the century", () => {
  const plan = normalizeTripPlan({
    startDate: "0099-01-01",
    days: [{}, {}]
  }, { idFactory: ids() });
  assert.equal(dayDate(plan, 0), "0099-01-01");
  assert.equal(dayDate(plan, 1), "0099-01-02");
});

test("normalizes v2 trip data during migration", () => {
  const source = {
    version: 2,
    id: 9,
    name: null,
    startDate: "2026-02-29",
    pace: "rushed",
    days: [{
      id: 10,
      cityEntries: [{ id: 11, visitId: 12, placeId: 13 }],
      items: [{ id: "unsupported", type: "note" }],
      lodging: "invalid"
    }]
  };
  const before = structuredClone(source);

  const result = migrateTripState(source, { idFactory: ids() });
  assert.equal(result.version, TRIP_PLAN_VERSION);
  assert.match(result.id, /^trip-/);
  assert.equal(result.name, "我的旅行");
  assert.equal(result.startDate, null);
  assert.equal(result.pace, "standard");
  assert.match(result.days[0].id, /^day-/);
  assert.equal(result.days[0].cityEntries[0].placeId, "13");
  assert.deepEqual(result.days[0].items, []);
  assert.equal(result.days[0].lodging, null);
  assert.deepEqual(source, before);
});

test("rejects malformed v2 snapshots instead of treating them as legacy data", () => {
  [{ version: TRIP_PLAN_VERSION, days: null }, { version: TRIP_PLAN_VERSION }].forEach((source) => {
    assert.throws(
      () => migrateTripState(source, { idFactory: ids() }),
      { name: "TypeError", message: "行程文件格式无效" }
    );
  });
});

test("rejects unsupported explicit trip versions without mutating snapshots", () => {
  [3, "2", null].forEach((version) => {
    const source = {
      version,
      id: "complete-trip",
      days: [{
        id: "complete-day",
        cityEntries: [{ id: "complete-entry", visitId: "complete-visit", placeId: "wuhan" }]
      }],
      routes: [{ from: "beijing", to: "wuhan" }]
    };
    const before = structuredClone(source);

    assert.throws(
      () => migrateTripState(source, { idFactory: ids() }),
      { name: "TypeError", message: "不支持的行程版本" }
    );
    assert.deepEqual(source, before);
  });
});

test("migrates explicit v1 and unversioned legacy snapshots", () => {
  [{
    version: 1,
    routes: [{ from: "beijing", to: "wuhan" }]
  }, {
    routes: [{ from: "beijing", to: "wuhan" }]
  }].forEach((source) => {
    const before = structuredClone(source);
    const result = migrateTripState(source, { idFactory: ids() });

    assert.equal(result.version, TRIP_PLAN_VERSION);
    assert.deepEqual(routePlaceIds(result), ["beijing", "wuhan"]);
    assert.deepEqual(source, before);
  });
});

test("migrates a selected city when an old snapshot has no routes", () => {
  const result = migrateTripState({ selectedCityId: "wuhan", tripPace: "relaxed" }, { idFactory: ids() });
  assert.deepEqual(routePlaceIds(result), ["wuhan"]);
  assert.equal(result.name, "我的旅行");
  assert.equal(result.pace, "relaxed");

  const empty = migrateTripState({}, { idFactory: ids() });
  assert.deepEqual(empty.days, []);
});

test("canonicalizes saved timestamps and legacy pace values", () => {
  const validTimestamp = normalizeTripPlan({
    savedAt: "2026-07-13T20:00:00+08:00",
    days: []
  }, { idFactory: ids() });
  assert.equal(validTimestamp.savedAt, "2026-07-13T12:00:00.000Z");

  const invalidTimestamp = normalizeTripPlan({ savedAt: "not-a-date", days: [] }, { idFactory: ids() });
  assert.equal(Number.isNaN(Date.parse(invalidTimestamp.savedAt)), false);
  assert.notEqual(invalidTimestamp.savedAt, "not-a-date");

  const migrated = migrateTripState({ selectedCityId: "wuhan", tripPace: "rushed" }, { idFactory: ids() });
  assert.equal(migrated.pace, "standard");
});

test("compacts a trip without mutating or dropping user content", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.savedAt = "2026-07-13T12:00:00.000Z";
  plan.days[0].items.push({
    id: "activity-1",
    type: "activity",
    placeId: "beijing",
    title: "故宫",
    note: "保留"
  });
  plan.days[0].lodging = { placeId: "beijing", name: "酒店", note: "高层" };
  const before = structuredClone(plan);
  const expected = structuredClone(plan);
  delete expected.savedAt;

  const result = compactTripPlan(plan);
  assert.deepEqual(result, expected);
  assert.equal(result.version, TRIP_PLAN_VERSION);
  assert.notEqual(result.days, plan.days);
  assert.deepEqual(plan, before);
});

test("uses a trip file only beyond the 12000 character boundary", () => {
  assert.equal(shouldUseTripFile("x".repeat(12000)), false);
  assert.equal(shouldUseTripFile("x".repeat(12001)), true);
  [null, undefined, 12001, {}, [], new String("x".repeat(12001))].forEach((value) => {
    assert.equal(shouldUseTripFile(value), false);
  });
});
