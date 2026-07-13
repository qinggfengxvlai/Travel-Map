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
  routePlaceIds,
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
    { id: "item-1", type: "activity", title: "一" },
    { id: "item-2", type: "activity", title: "二" }
  ];
  plan.days.push({
    id: "day-2",
    cityEntries: [],
    overnightPlaceId: null,
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
