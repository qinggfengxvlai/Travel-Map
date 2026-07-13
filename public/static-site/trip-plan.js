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

export function cloneTripPlan(plan) {
  return structuredClone(plan);
}

export function autoScheduleTrip({ placeIds, durations = {}, paceProfile, idFactory = defaultIdFactory, metadata = {} }) {
  const plan = createTripPlan({ ...metadata, placeIds: [], idFactory });
  if (!placeIds.length) return plan;
  let day = blankDay(idFactory);
  let travelSeconds = 0;
  let currentVisitId = idFactory("visit");
  const addPlace = (placeId, visitId) => {
    if (day.cityEntries.at(-1)?.placeId !== placeId) {
      day.cityEntries.push({ id: idFactory("city-entry"), visitId, placeId, manuallyPlaced: false });
    }
    day.overnightPlaceId = placeId;
  };
  addPlace(placeIds[0], currentVisitId);
  for (let index = 1; index < placeIds.length; index += 1) {
    const from = placeIds[index - 1];
    const to = placeIds[index];
    if (from === to) {
      addPlace(to, currentVisitId);
      continue;
    }
    const duration = durations[`${from}>${to}`] ?? 2 * 3600;
    const mustSplit = day.cityEntries.length > 1 && (
      travelSeconds + duration > paceProfile.dailyTravelLimitSeconds ||
      day.cityEntries.length >= paceProfile.maxDailyPlaces
    );
    if (mustSplit) {
      plan.days.push(day);
      day = blankDay(idFactory);
      travelSeconds = 0;
      addPlace(from, currentVisitId);
    }
    travelSeconds += duration;
    currentVisitId = idFactory("visit");
    addPlace(to, currentVisitId);
  }
  plan.days.push(day);
  return plan;
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

function ensureValidOvernightPlace(day) {
  if (!day.cityEntries.some((entry) => entry.placeId === day.overnightPlaceId)) {
    day.overnightPlaceId = day.cityEntries.at(-1)?.placeId ?? null;
  }
}

function itemReferencesPlace(item, placeIds) {
  return placeIds.has(item.placeId) || placeIds.has(item.fromPlaceId) || placeIds.has(item.toPlaceId);
}

function locateEntry(plan, entryId) {
  for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex += 1) {
    const entryIndex = plan.days[dayIndex].cityEntries.findIndex((entry) => entry.id === entryId);
    if (entryIndex >= 0) return { dayIndex, entryIndex };
  }
  return null;
}

export function applyTripCommand(plan, command, { idFactory = defaultIdFactory, force = false } = {}) {
  const next = cloneTripPlan(plan);
  if (command.type === "move-city") {
    const source = locateEntry(next, command.entryId);
    const targetDay = next.days.find((day) => day.id === command.targetDayId);
    if (!source || !targetDay) return { plan, requiresConfirmation: false, changed: false };
    const sourceDay = next.days[source.dayIndex];
    const [entry] = sourceDay.cityEntries.splice(source.entryIndex, 1);
    targetDay.cityEntries.splice(command.targetIndex ?? targetDay.cityEntries.length, 0, { ...entry, manuallyPlaced: true });
    ensureValidOvernightPlace(sourceDay);
    sourceDay.manuallyEdited = true;
    targetDay.manuallyEdited = true;
    targetDay.overnightPlaceId ||= entry.placeId;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "set-visit-duration") {
    if (!Number.isFinite(command.duration) || !Number.isInteger(command.duration)) {
      return { plan, requiresConfirmation: false, changed: false };
    }
    const locations = [];
    next.days.forEach((day, dayIndex) => day.cityEntries.forEach((entry) => {
      if (entry.visitId === command.visitId) locations.push({ dayIndex, entry });
    }));
    if (!locations.length) return { plan, requiresConfirmation: false, changed: false };
    const duration = Math.max(1, Math.min(7, command.duration));
    if (duration === locations.length) return { plan, requiresConfirmation: false, changed: false };
    const placeId = locations[0].entry.placeId;
    const locationsToRemove = locations.slice(duration);
    const affectedDayIds = [...new Set(locationsToRemove
      .map((location) => next.days[location.dayIndex])
      .filter((day) => day.items.length > 0 || day.lodging)
      .map((day) => day.id))];
    if (affectedDayIds.length && !force) {
      return { plan, requiresConfirmation: true, changed: false, affectedDayIds };
    }
    while (locations.length < duration) {
      const insertAt = locations.at(-1).dayIndex + 1;
      const newDay = blankDay(idFactory);
      newDay.cityEntries.push({ id: idFactory("city-entry"), visitId: command.visitId, placeId, manuallyPlaced: true });
      newDay.overnightPlaceId = placeId;
      newDay.manuallyEdited = true;
      next.days.splice(insertAt, 0, newDay);
      locations.push({ dayIndex: insertAt, entry: newDay.cityEntries[0] });
    }
    const removalsByDay = new Map();
    locationsToRemove.forEach((location) => {
      const entries = removalsByDay.get(location.dayIndex) || [];
      entries.push(location.entry);
      removalsByDay.set(location.dayIndex, entries);
    });
    const removalDays = [...removalsByDay.entries()].sort(([left], [right]) => right - left);
    removalDays.forEach(([dayIndex, entries]) => {
      const day = next.days[dayIndex];
      const entryIds = new Set(entries.map((entry) => entry.id));
      const removedPlaceIds = new Set(entries.map((entry) => entry.placeId));
      day.cityEntries = day.cityEntries.filter((entry) => !entryIds.has(entry.id));
      if (!day.cityEntries.length) {
        next.days.splice(dayIndex, 1);
        return;
      }
      const remainingPlaceIds = new Set(day.cityEntries.map((entry) => entry.placeId));
      const orphanedPlaceIds = new Set([...removedPlaceIds].filter((id) => !remainingPlaceIds.has(id)));
      day.items = day.items.filter((item) => !itemReferencesPlace(item, orphanedPlaceIds));
      if (day.lodging && orphanedPlaceIds.has(day.lodging.placeId)) day.lodging = null;
      ensureValidOvernightPlace(day);
    });
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  return { plan, requiresConfirmation: false, changed: false };
}
