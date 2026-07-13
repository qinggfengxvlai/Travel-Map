import test from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_TRIP_STORAGE_KEY,
  TRIP_STORAGE_KEY,
  TRIP_PLAN_VERSION,
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
