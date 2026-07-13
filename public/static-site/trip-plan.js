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

function locateItem(plan, itemId) {
  for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex += 1) {
    const itemIndex = plan.days[dayIndex].items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) return { dayIndex, itemIndex };
  }
  return null;
}

function safeInsertionIndex(value, length) {
  if (!Number.isFinite(value)) return length;
  return Math.max(0, Math.min(length, Math.trunc(value)));
}

function shallowEqualRecord(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.hasOwn(right, key) && Object.is(left[key], right[key])
  );
}

export function timeToMinutes(value) {
  if (typeof value !== "string") return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function absoluteInterval(item, dayIndex) {
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);
  if (start === null || end === null) return null;
  const requestedOffset = Number(item.endDayOffset || 0);
  if (!Number.isInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > 1) return null;
  if (item.type !== "transport" && requestedOffset !== 0) return null;
  const absoluteStart = dayIndex * 1440 + start;
  const absoluteEnd = dayIndex * 1440 + end + requestedOffset * 1440;
  if (absoluteEnd <= absoluteStart) return null;
  return { start: absoluteStart, end: absoluteEnd };
}

function previousArrivalReferences(plan, targetDayIndex, placeId) {
  const dayStart = targetDayIndex * 1440;
  const dayEnd = dayStart + 1440;
  const references = [];
  plan.days.forEach((day, dayIndex) => {
    if (dayIndex >= targetDayIndex) return;
    day.items.forEach((item) => {
      if (item.type !== "transport" || item.toPlaceId !== placeId) return;
      const interval = absoluteInterval(item, dayIndex);
      if (interval && interval.start < dayStart && interval.end >= dayStart && interval.end < dayEnd) {
        references.push({ dayIndex, item });
      }
    });
  });
  return references;
}

function intervalUnionMinutes(intervals) {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;
  let total = 0;
  sorted.slice(1).forEach((interval) => {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      return;
    }
    total += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  });
  return total + currentEnd - currentStart;
}

function addWarning(warnings, code, dayId, itemIds = []) {
  warnings.push({ code, dayId, itemIds, severity: "warning" });
}

export function validateTripPlan(plan, { paceProfile } = {}) {
  const warnings = [];
  const locatedItems = plan.days.flatMap((day, dayIndex) => day.items.map((item) => ({
    day,
    dayIndex,
    item,
    interval: absoluteInterval(item, dayIndex)
  })));
  const crossCityTravelItems = locatedItems.filter(({ item, interval }) =>
    item.type === "transport" && interval && item.fromPlaceId !== item.toPlaceId
  );

  locatedItems.forEach((current, index) => {
    if (!current.interval) {
      addWarning(warnings, "missing-time", current.day.id, [current.item.id]);
      return;
    }
    locatedItems.slice(index + 1).forEach((other) => {
      if (!other.interval) return;
      if (current.interval.start < other.interval.end && other.interval.start < current.interval.end) {
        const overlapDayIndex = Math.floor(Math.max(current.interval.start, other.interval.start) / 1440);
        const warningDayId = plan.days[overlapDayIndex]?.id ?? current.day.id;
        addWarning(warnings, "time-overlap", warningDayId, [current.item.id, other.item.id]);
      }
    });
  });

  locatedItems.filter(({ item }) => item.type === "activity").forEach((activity) => {
    if (!activity.interval) return;
    const arrival = locatedItems
      .filter((candidate) =>
        candidate.item.type === "transport" &&
        candidate.item.toPlaceId === activity.item.placeId &&
        candidate.interval &&
        candidate.interval.start <= activity.interval.start
      )
      .reduce(
        (latest, candidate) =>
          !latest || candidate.interval.start > latest.interval.start ? candidate : latest,
        null
      );
    if (arrival && activity.interval.start < arrival.interval.end) {
      addWarning(
        warnings,
        "activity-before-arrival",
        activity.day.id,
        [activity.item.id, arrival.item.id]
      );
    }
  });

  plan.days.forEach((day, dayIndex) => {
    if (day.lodging && day.overnightPlaceId && day.lodging.placeId !== day.overnightPlaceId) {
      addWarning(warnings, "lodging-city-mismatch", day.id);
    }
    if (day.overnightPlaceId && !day.cityEntries.some((entry) => entry.placeId === day.overnightPlaceId)) {
      addWarning(warnings, "overnight-city-missing", day.id);
    }

    const travelItems = crossCityTravelItems.filter(({ dayIndex: itemDayIndex }) => itemDayIndex === dayIndex);
    const travelSeconds = travelItems.reduce(
      (total, { interval }) => total + (interval.end - interval.start) * 60,
      0
    );
    const travelItemIds = travelItems.map(({ item }) => item.id);
    if (Number.isFinite(paceProfile?.dailyTravelLimitSeconds) &&
        travelSeconds > paceProfile.dailyTravelLimitSeconds) {
      addWarning(warnings, "travel-over-limit", day.id, travelItemIds);
    }
    const playWindowSeconds = Number.isFinite(paceProfile?.playWindowSeconds)
      ? paceProfile.playWindowSeconds
      : 14 * 3600;
    const playWindowStart = dayIndex * 1440 + 8 * 60;
    const playWindowEnd = playWindowStart + playWindowSeconds / 60;
    const playWindowTravel = crossCityTravelItems.flatMap((travelItem) => {
      const start = Math.max(travelItem.interval.start, playWindowStart);
      const end = Math.min(travelItem.interval.end, playWindowEnd);
      return start < end ? [{ ...travelItem, clippedInterval: { start, end } }] : [];
    });
    const occupiedPlaySeconds = intervalUnionMinutes(
      playWindowTravel.map(({ clippedInterval }) => clippedInterval)
    ) * 60;
    if (playWindowSeconds - occupiedPlaySeconds < 2 * 3600) {
      const playTravelItemIds = [...new Set(playWindowTravel.map(({ item }) => item.id))];
      addWarning(warnings, "play-time-short", day.id, playTravelItemIds);
    }
    if (day.overnightPlaceId && !day.lodging) {
      addWarning(warnings, "lodging-missing", day.id);
    }
  });

  return warnings;
}

export function applyTripCommand(plan, command, { idFactory = defaultIdFactory, force = false } = {}) {
  const next = cloneTripPlan(plan);
  if (command.type === "upsert-item") {
    const day = next.days.find((candidate) => candidate.id === command.dayId);
    if (!day || !command.item || typeof command.item !== "object" || Array.isArray(command.item)) {
      return { plan, requiresConfirmation: false, changed: false };
    }
    const itemIndex = day.items.findIndex((item) => item.id === command.item.id);
    if (itemIndex >= 0) {
      const existing = day.items[itemIndex];
      const updated = { ...existing, ...command.item, id: existing.id, manuallyEdited: true };
      if (shallowEqualRecord(existing, updated)) {
        return { plan, requiresConfirmation: false, changed: false };
      }
      day.items[itemIndex] = updated;
    } else {
      const item = { ...command.item };
      delete item.id;
      day.items.push({ ...item, id: idFactory("item"), manuallyEdited: true });
    }
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "copy-item") {
    const source = locateItem(next, command.itemId);
    if (!source) return { plan, requiresConfirmation: false, changed: false };
    const day = next.days[source.dayIndex];
    const copy = { ...day.items[source.itemIndex], id: idFactory("item"), manuallyEdited: true };
    day.items.splice(source.itemIndex + 1, 0, copy);
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "remove-item") {
    const source = locateItem(next, command.itemId);
    if (!source) return { plan, requiresConfirmation: false, changed: false };
    const day = next.days[source.dayIndex];
    day.items.splice(source.itemIndex, 1);
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "move-item") {
    const source = locateItem(next, command.itemId);
    const targetDay = next.days.find((day) => day.id === command.targetDayId);
    if (!source || !targetDay) return { plan, requiresConfirmation: false, changed: false };
    const sourceDay = next.days[source.dayIndex];
    if (sourceDay === targetDay) {
      const reordered = [...sourceDay.items];
      const [candidate] = reordered.splice(source.itemIndex, 1);
      const candidateIndex = safeInsertionIndex(command.targetIndex, reordered.length);
      reordered.splice(candidateIndex, 0, candidate);
      if (reordered.every((item, index) => item === sourceDay.items[index])) {
        return { plan, requiresConfirmation: false, changed: false };
      }
    }
    const [item] = sourceDay.items.splice(source.itemIndex, 1);
    const targetIndex = safeInsertionIndex(command.targetIndex, targetDay.items.length);
    targetDay.items.splice(targetIndex, 0, item);
    sourceDay.manuallyEdited = true;
    targetDay.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "remove-city") {
    const source = locateEntry(next, command.entryId);
    if (!source) return { plan, requiresConfirmation: false, changed: false };
    const day = next.days[source.dayIndex];
    const entry = day.cityEntries[source.entryIndex];
    const remainingEntries = day.cityEntries.filter((candidate) => candidate.id !== entry.id);
    const placeRemains = remainingEntries.some((candidate) => candidate.placeId === entry.placeId);
    const removedPlaceIds = new Set(placeRemains ? [] : [entry.placeId]);
    const previousArrivals = placeRemains
      ? []
      : previousArrivalReferences(next, source.dayIndex, entry.placeId);
    const removesWholeDay = remainingEntries.length === 0;
    const affectsItems = removesWholeDay
      ? day.items.length > 0
      : day.items.some((item) => itemReferencesPlace(item, removedPlaceIds));
    const affectsLodging = Boolean(day.lodging) && (
      removesWholeDay || removedPlaceIds.has(day.lodging.placeId)
    );
    const affectedDayIndexes = new Set();
    if (affectsItems || affectsLodging) affectedDayIndexes.add(source.dayIndex);
    if (previousArrivals.length) {
      previousArrivals.forEach(({ dayIndex }) => affectedDayIndexes.add(dayIndex));
      affectedDayIndexes.add(source.dayIndex);
    }
    if (affectedDayIndexes.size && !force) {
      return {
        plan,
        requiresConfirmation: true,
        changed: false,
        affectedDayIds: [...affectedDayIndexes]
          .sort((left, right) => left - right)
          .map((dayIndex) => next.days[dayIndex].id)
      };
    }
    const arrivalsByDay = new Map();
    previousArrivals.forEach(({ dayIndex, item }) => {
      const items = arrivalsByDay.get(dayIndex) || new Set();
      items.add(item);
      arrivalsByDay.set(dayIndex, items);
    });
    arrivalsByDay.forEach((items, dayIndex) => {
      const arrivalDay = next.days[dayIndex];
      arrivalDay.items = arrivalDay.items.filter((item) => !items.has(item));
      arrivalDay.manuallyEdited = true;
    });
    day.cityEntries.splice(source.entryIndex, 1);
    if (!day.cityEntries.length) {
      next.days.splice(source.dayIndex, 1);
      return { plan: next, requiresConfirmation: false, changed: true };
    }
    if (removedPlaceIds.size) {
      day.items = day.items.filter((item) => !itemReferencesPlace(item, removedPlaceIds));
      if (day.lodging && removedPlaceIds.has(day.lodging.placeId)) day.lodging = null;
    }
    ensureValidOvernightPlace(day);
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "set-lodging") {
    const day = next.days.find((candidate) => candidate.id === command.dayId);
    const validLodging = command.lodging === null || (
      command.lodging && typeof command.lodging === "object" && !Array.isArray(command.lodging)
    );
    if (!day || !validLodging) return { plan, requiresConfirmation: false, changed: false };
    const lodging = command.lodging === null ? null : { ...command.lodging };
    if (shallowEqualRecord(day.lodging, lodging)) {
      return { plan, requiresConfirmation: false, changed: false };
    }
    day.lodging = lodging;
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "set-overnight") {
    const day = next.days.find((candidate) => candidate.id === command.dayId);
    if (!day || (command.placeId !== null && !day.cityEntries.some((entry) => entry.placeId === command.placeId))) {
      return { plan, requiresConfirmation: false, changed: false };
    }
    if (day.overnightPlaceId === command.placeId) {
      return { plan, requiresConfirmation: false, changed: false };
    }
    day.overnightPlaceId = command.placeId;
    day.manuallyEdited = true;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "update-metadata") {
    const patch = command.patch && typeof command.patch === "object" && !Array.isArray(command.patch)
      ? command.patch
      : null;
    const updates = {};
    ["name", "startDate", "pace"].forEach((key) => {
      if (patch && Object.hasOwn(patch, key)) updates[key] = patch[key];
      else if (Object.hasOwn(command, key)) updates[key] = command[key];
    });
    const changedKeys = Object.keys(updates).filter((key) => !Object.is(plan[key], updates[key]));
    if (!changedKeys.length) return { plan, requiresConfirmation: false, changed: false };
    changedKeys.forEach((key) => {
      next[key] = updates[key];
    });
    return { plan: next, requiresConfirmation: false, changed: true };
  }
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
      day.manuallyEdited = true;
    });
    next.days.forEach((day) => {
      if (day.cityEntries.some((entry) => entry.visitId === command.visitId)) day.manuallyEdited = true;
    });
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  return { plan, requiresConfirmation: false, changed: false };
}
