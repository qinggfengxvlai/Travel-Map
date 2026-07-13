export const TRIP_PLAN_VERSION = 2;
export const TRIP_STORAGE_KEY = "route-studio-trip-v2";
export const LEGACY_TRIP_STORAGE_KEY = "route-studio-trip-v1";

function defaultIdFactory(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function blankDay(idFactory) {
  return {
    id: idFactory("day"),
    cityEntries: [],
    overnightPlaceId: null,
    items: [],
    lodging: null,
    manuallyEdited: false
  };
}

export function createTripPlan({
  placeIds = [],
  name = "我的旅行",
  startDate = null,
  pace = "standard",
  idFactory = defaultIdFactory
} = {}) {
  const day = blankDay(idFactory);
  placeIds.forEach((placeId) => {
    const visitId = idFactory("visit");
    day.cityEntries.push({ id: idFactory("city-entry"), visitId, placeId, manuallyPlaced: false });
    day.overnightPlaceId = placeId;
  });
  return {
    version: TRIP_PLAN_VERSION,
    id: idFactory("trip"),
    name,
    startDate,
    pace,
    days: placeIds.length ? [day] : [],
    savedAt: new Date().toISOString()
  };
}

export function dayDate(plan, dayIndex) {
  if (!plan.startDate) return null;
  const [year, month, day] = plan.startDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + dayIndex));
  return date.toISOString().slice(0, 10);
}

export function routePlaceIds(plan) {
  const flattened = plan.days.flatMap((day) => day.cityEntries.map((entry) => entry.placeId));
  return flattened.filter((placeId, index) => index === 0 || flattened[index - 1] !== placeId);
}
