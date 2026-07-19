export const TRIP_PLAN_VERSION = 2;
export const TRIP_STORAGE_KEY = "route-studio-trip-v2";
export const LEGACY_TRIP_STORAGE_KEY = "route-studio-trip-v1";
const VALID_TRIP_PACES = new Set(["relaxed", "standard", "compact"]);
const VALID_TRANSPORT_MODES = new Set(["highspeed", "train"]);

let fallbackIdCounter = 0;

function defaultIdFactory(prefix) {
  const secureUuid = globalThis.crypto?.randomUUID?.();
  if (secureUuid) return `${prefix}-${secureUuid}`;

  const randomPart = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomPart);
  } else {
    randomPart[0] = Math.floor(Math.random() * 0x100000000);
    randomPart[1] = Math.floor(Math.random() * 0x100000000);
  }
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}-${Array.from(randomPart, (value) => value.toString(36)).join("-")}`;
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
  transportMode = "highspeed",
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
    transportMode: VALID_TRANSPORT_MODES.has(transportMode) ? transportMode : "highspeed",
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
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

export function routePlaceIds(plan) {
  const flattened = plan.days.flatMap((day) => day.cityEntries.map((entry) => entry.placeId));
  return flattened.filter((placeId, index) => index === 0 || flattened[index - 1] !== placeId);
}

export function resolveTripPace(plan, fallback = "standard") {
  const safeFallback = VALID_TRIP_PACES.has(fallback) ? fallback : "standard";
  return VALID_TRIP_PACES.has(plan?.pace) ? plan.pace : safeFallback;
}

export function resolveTripTransportMode(plan, fallback = "highspeed") {
  const safeFallback = VALID_TRANSPORT_MODES.has(fallback) ? fallback : "highspeed";
  return VALID_TRANSPORT_MODES.has(plan?.transportMode) ? plan.transportMode : safeFallback;
}

function dayHasPlace(day, placeId) {
  return typeof placeId === "string" &&
    Array.isArray(day?.cityEntries) &&
    day.cityEntries.some((entry) => entry?.placeId === placeId);
}

export function canMoveTripItemToDay(plan, item, targetDayId) {
  if (!Array.isArray(plan?.days) || !item || typeof item !== "object" || Array.isArray(item)) return false;
  const targetDayIndex = plan.days.findIndex((day) => day?.id === targetDayId);
  if (targetDayIndex < 0) return false;
  const targetDay = plan.days[targetDayIndex];
  if (item.type === "activity") return dayHasPlace(targetDay, item.placeId);
  if (item.type !== "transport" || !dayHasPlace(targetDay, item.fromPlaceId)) return false;
  if (dayHasPlace(targetDay, item.toPlaceId)) return true;
  return Number(item.endDayOffset) === 1 && dayHasPlace(plan.days[targetDayIndex + 1], item.toPlaceId);
}

function ensureValidOvernightPlace(day) {
  if (!day.cityEntries.some((entry) => entry.placeId === day.overnightPlaceId)) {
    day.overnightPlaceId = day.cityEntries.at(-1)?.placeId ?? null;
  }
}

function itemReferencesPlace(item, placeIds) {
  return placeIds.has(item.placeId) || placeIds.has(item.fromPlaceId) || placeIds.has(item.toPlaceId);
}

function protectedDayIds(plan, placeId) {
  const placeIds = new Set([placeId]);
  const seenDayIds = new Set();
  const dayIds = [];
  plan.days.forEach((day) => {
    const appearsOnEditedDay = day.manuallyEdited &&
      day.cityEntries.some((entry) => entry.placeId === placeId);
    const affectsLodging = day.lodging?.placeId === placeId;
    const affectsItems = day.items.some((item) => itemReferencesPlace(item, placeIds));
    if ((appearsOnEditedDay || affectsLodging || affectsItems) && !seenDayIds.has(day.id)) {
      seenDayIds.add(day.id);
      dayIds.push(day.id);
    }
  });
  return dayIds;
}

function routeOccurrences(plan) {
  const occurrences = [];
  plan.days.forEach((day, dayIndex) => {
    day.cityEntries.forEach((entry) => {
      let occurrence = occurrences.at(-1);
      if (!occurrence || occurrence.placeId !== entry.placeId) {
        occurrence = { placeId: entry.placeId, entries: [] };
        occurrences.push(occurrence);
      }
      occurrence.entries.push({ dayIndex, dayId: day.id, entry });
    });
  });
  return occurrences;
}

function alignRouteOccurrences(current, requested) {
  const lengths = Array.from(
    { length: current.length + 1 },
    () => Array(requested.length + 1).fill(0)
  );
  for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
    for (let requestedIndex = requested.length - 1; requestedIndex >= 0; requestedIndex -= 1) {
      lengths[currentIndex][requestedIndex] = current[currentIndex].placeId === requested[requestedIndex]
        ? lengths[currentIndex + 1][requestedIndex + 1] + 1
        : Math.max(lengths[currentIndex + 1][requestedIndex], lengths[currentIndex][requestedIndex + 1]);
    }
  }

  const matches = [];
  let currentIndex = 0;
  let requestedIndex = 0;
  while (currentIndex < current.length && requestedIndex < requested.length) {
    if (current[currentIndex].placeId === requested[requestedIndex]) {
      matches.push({ currentIndex, requestedIndex });
      currentIndex += 1;
      requestedIndex += 1;
    } else if (lengths[currentIndex + 1][requestedIndex] > lengths[currentIndex][requestedIndex + 1]) {
      currentIndex += 1;
    } else {
      requestedIndex += 1;
    }
  }
  return matches;
}

function occurrenceProtectedDayIds(plan, occurrence, candidateEntries) {
  const dayIndexes = [...new Set(occurrence.entries.map(({ dayIndex }) => dayIndex))];
  const affectedDayIndexes = new Set();
  const placeIds = new Set([occurrence.placeId]);

  dayIndexes.forEach((dayIndex) => {
    const day = plan.days[dayIndex];
    if (day.manuallyEdited) affectedDayIndexes.add(dayIndex);
    const placeRemains = day.cityEntries.some((entry) =>
      entry.placeId === occurrence.placeId && !candidateEntries.has(entry)
    );
    if (placeRemains) return;
    if (day.lodging?.placeId === occurrence.placeId ||
        day.items.some((item) => itemReferencesPlace(item, placeIds))) {
      affectedDayIndexes.add(dayIndex);
    }
    const previousArrivals = previousArrivalReferences(plan, dayIndex, occurrence.placeId);
    if (previousArrivals.length) {
      affectedDayIndexes.add(dayIndex);
      previousArrivals.forEach(({ dayIndex: arrivalDayIndex }) => affectedDayIndexes.add(arrivalDayIndex));
    }
  });

  const seenDayIds = new Set();
  return [...affectedDayIndexes]
    .sort((left, right) => left - right)
    .flatMap((dayIndex) => {
      const dayId = plan.days[dayIndex].id;
      if (seenDayIds.has(dayId)) return [];
      seenDayIds.add(dayId);
      return [dayId];
    });
}

function normalizeRequestedPlaceIds(nextPlaceIds) {
  if (!Array.isArray(nextPlaceIds)) throw new TypeError("路线地点格式无效");
  const normalized = [];
  for (const placeId of nextPlaceIds) {
    if (typeof placeId !== "string" || !placeId.trim()) {
      throw new TypeError("路线地点格式无效");
    }
    normalized.push(placeId.trim());
  }
  return normalized.filter(
    (placeId, index) => index === 0 || normalized[index - 1] !== placeId
  );
}

export function reconcileRoutePlaces(
  plan,
  nextPlaceIds,
  { idFactory = defaultIdFactory, allowRemovalIds = new Set() } = {}
) {
  const requested = normalizeRequestedPlaceIds(nextPlaceIds);
  const next = cloneTripPlan(plan);
  const currentOccurrences = routeOccurrences(next);
  const matches = alignRouteOccurrences(currentOccurrences, requested);
  const matchedCurrentIndexes = new Set(matches.map(({ currentIndex }) => currentIndex));
  const requestedAnchors = Array(requested.length).fill(null);
  matches.forEach(({ currentIndex, requestedIndex }) => {
    const occurrence = currentOccurrences[currentIndex];
    requestedAnchors[requestedIndex] = {
      firstEntryId: occurrence.entries[0].entry.id,
      lastEntryId: occurrence.entries.at(-1).entry.id
    };
  });

  const requestedIds = new Set(requested);
  const unmatchedRetainedOccurrences = currentOccurrences
    .map((occurrence, currentIndex) => ({ occurrence, currentIndex }))
    .filter(({ occurrence, currentIndex }) =>
      !matchedCurrentIndexes.has(currentIndex) && requestedIds.has(occurrence.placeId)
    );
  const candidateEntriesByPlace = new Map();
  unmatchedRetainedOccurrences.forEach(({ occurrence }) => {
    const candidateEntries = candidateEntriesByPlace.get(occurrence.placeId) || new Set();
    occurrence.entries.forEach(({ entry }) => candidateEntries.add(entry));
    candidateEntriesByPlace.set(occurrence.placeId, candidateEntries);
  });
  const fullRemovalPlaceIds = new Set();
  const processedFullRemovals = new Set();
  const blockedDayIdsByPlace = new Map();
  const originalDayIds = next.days.map((day) => day.id);
  const entriesToRemove = new Set();
  const localRemovalTargets = new Map();
  const addBlockedRemoval = (placeId, dayIds) => {
    const blockedDayIds = blockedDayIdsByPlace.get(placeId) || new Set();
    dayIds.forEach((dayId) => blockedDayIds.add(dayId));
    blockedDayIdsByPlace.set(placeId, blockedDayIds);
  };

  currentOccurrences.forEach(({ placeId }) => {
    if (requestedIds.has(placeId) || processedFullRemovals.has(placeId)) return;
    processedFullRemovals.add(placeId);
    const dayIds = protectedDayIds(next, placeId);
    if (dayIds.length && !allowRemovalIds.has(placeId)) {
      addBlockedRemoval(placeId, dayIds);
      return;
    }
    fullRemovalPlaceIds.add(placeId);
  });

  unmatchedRetainedOccurrences.forEach(({ occurrence }) => {
    const dayIds = occurrenceProtectedDayIds(
      next,
      occurrence,
      candidateEntriesByPlace.get(occurrence.placeId)
    );
    if (dayIds.length && !allowRemovalIds.has(occurrence.placeId)) {
      addBlockedRemoval(occurrence.placeId, dayIds);
      return;
    }
    occurrence.entries.forEach(({ dayIndex, entry }) => {
      entriesToRemove.add(entry);
      const placeIds = localRemovalTargets.get(dayIndex) || new Set();
      placeIds.add(occurrence.placeId);
      localRemovalTargets.set(dayIndex, placeIds);
    });
  });

  const blockedRemovals = [...blockedDayIdsByPlace].map(([placeId, blockedDayIds]) => ({
    placeId,
    dayIds: originalDayIds.filter((dayId, index) =>
      blockedDayIds.has(dayId) && originalDayIds.indexOf(dayId) === index
    )
  }));
  if (blockedRemovals.length) return { plan, blockedRemovals };

  next.days.forEach((day) => {
    day.cityEntries = day.cityEntries.filter((entry) =>
      !fullRemovalPlaceIds.has(entry.placeId) && !entriesToRemove.has(entry)
    );
  });

  const cleanupTargets = new Map();
  localRemovalTargets.forEach((placeIds, dayIndex) => {
    const cleanupPlaceIds = new Set(
      [...placeIds].filter((placeId) =>
        !next.days[dayIndex].cityEntries.some((entry) => entry.placeId === placeId)
      )
    );
    if (cleanupPlaceIds.size) cleanupTargets.set(dayIndex, cleanupPlaceIds);
  });
  const arrivalItemsByDay = new Map();
  cleanupTargets.forEach((placeIds, targetDayIndex) => {
    placeIds.forEach((placeId) => {
      previousArrivalReferences(next, targetDayIndex, placeId).forEach(({ dayIndex, item }) => {
        const items = arrivalItemsByDay.get(dayIndex) || new Set();
        items.add(item);
        arrivalItemsByDay.set(dayIndex, items);
      });
    });
  });
  next.days.forEach((day, dayIndex) => {
    const cleanupPlaceIds = new Set([
      ...fullRemovalPlaceIds,
      ...(cleanupTargets.get(dayIndex) || [])
    ]);
    if (cleanupPlaceIds.size) {
      day.items = day.items.filter((item) => !itemReferencesPlace(item, cleanupPlaceIds));
      if (day.lodging && cleanupPlaceIds.has(day.lodging.placeId)) day.lodging = null;
    }
    const arrivalItems = arrivalItemsByDay.get(dayIndex);
    if (arrivalItems) day.items = day.items.filter((item) => !arrivalItems.has(item));
    ensureValidOvernightPlace(day);
  });
  next.days = next.days.filter((day) =>
    day.cityEntries.length || day.items.length || day.lodging
  );

  requested.forEach((placeId, requestedIndex) => {
    if (requestedAnchors[requestedIndex]) return;

    let target = null;
    let insertionIndex = 0;
    for (let index = requestedIndex - 1; index >= 0; index -= 1) {
      const anchor = requestedAnchors[index];
      const predecessor = anchor ? locateEntry(next, anchor.lastEntryId) : null;
      if (!predecessor) continue;
      target = next.days[predecessor.dayIndex];
      insertionIndex = predecessor.entryIndex + 1;
      break;
    }
    if (!target) {
      for (let index = requestedIndex + 1; index < requested.length; index += 1) {
        const anchor = requestedAnchors[index];
        const successor = anchor ? locateEntry(next, anchor.firstEntryId) : null;
        if (!successor) continue;
        target = next.days[successor.dayIndex];
        insertionIndex = successor.entryIndex;
        break;
      }
    }
    if (!target) {
      target = blankDay(idFactory);
      next.days.push(target);
    }

    const visitId = idFactory("visit");
    const entryId = idFactory("city-entry");
    target.cityEntries.splice(insertionIndex, 0, {
      id: entryId,
      visitId,
      placeId,
      manuallyPlaced: false
    });
    target.overnightPlaceId = target.cityEntries.at(-1)?.placeId ?? null;
    requestedAnchors[requestedIndex] = { firstEntryId: entryId, lastEntryId: entryId };
  });

  return { plan: next, blockedRemovals };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identifierOrNull(value) {
  if (value === null || value === undefined) return null;
  const identifier = String(value);
  return identifier ? identifier : null;
}

function trimmedId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function createUniqueIdAllocator(idFactory, prefix) {
  const usedIds = new Set();
  return (value) => {
    const existingId = trimmedId(value);
    if (existingId && !usedIds.has(existingId)) {
      usedIds.add(existingId);
      return existingId;
    }
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const generatedId = trimmedId(idFactory(prefix));
      if (!generatedId || usedIds.has(generatedId)) continue;
      usedIds.add(generatedId);
      return generatedId;
    }
    throw new TypeError("无法生成唯一行程 ID");
  };
}

function stringValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function stringField(value) {
  return typeof value === "string" ? value : "";
}

function validStartDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1] ? value : null;
}

function normalizedSavedAt(value) {
  const timestamp = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function normalizeTripItem(item, allocateItemId) {
  if (!isRecord(item) || (item.type !== "transport" && item.type !== "activity")) return null;
  const common = {
    id: allocateItemId(item.id),
    type: item.type,
    startTime: stringField(item.startTime),
    endTime: stringField(item.endTime),
    note: stringField(item.note),
    manuallyEdited: Boolean(item.manuallyEdited)
  };
  if (item.type === "transport") {
    return {
      ...common,
      fromPlaceId: stringValue(item.fromPlaceId),
      toPlaceId: stringValue(item.toPlaceId),
      serviceNo: stringValue(item.serviceNo),
      endDayOffset: item.endDayOffset === 1 ? 1 : 0
    };
  }
  const sourceTypes = new Set(["landmark", "food", "custom", "free"]);
  return {
    ...common,
    sourceType: sourceTypes.has(item.sourceType) ? item.sourceType : "custom",
    sourceId: typeof item.sourceId === "string" ? item.sourceId : null,
    placeId: stringValue(item.placeId),
    title: stringValue(item.title) || "未命名活动"
  };
}

function normalizeLodging(lodging) {
  if (!isRecord(lodging)) return null;
  return {
    placeId: stringValue(lodging.placeId),
    name: stringValue(lodging.name),
    address: stringValue(lodging.address),
    checkInTime: stringValue(lodging.checkInTime),
    checkOutTime: stringValue(lodging.checkOutTime),
    note: stringValue(lodging.note)
  };
}

export function normalizeTripPlan(data, { idFactory = defaultIdFactory } = {}) {
  if (!isRecord(data) || !Array.isArray(data.days)) {
    throw new TypeError("行程文件格式无效");
  }
  const allocateTripId = createUniqueIdAllocator(idFactory, "trip");
  const allocateDayId = createUniqueIdAllocator(idFactory, "day");
  const allocateEntryId = createUniqueIdAllocator(idFactory, "city-entry");
  const allocateItemId = createUniqueIdAllocator(idFactory, "item");
  const allocateVisitId = createUniqueIdAllocator(idFactory, "visit");
  const tripId = allocateTripId(data.id);
  const pace = VALID_TRIP_PACES.has(data.pace)
    ? data.pace
    : "standard";
  const transportMode = VALID_TRANSPORT_MODES.has(data.transportMode)
    ? data.transportMode
    : "highspeed";
  const name = typeof data.name === "string" ? data.name.slice(0, 60) : "我的旅行";
  let hasPreviousEntry = false;
  let previousPlaceId = null;
  let occurrenceVisitId = null;
  const days = data.days.map((candidate) => {
    const day = isRecord(candidate) ? candidate : {};
    const dayId = allocateDayId(day.id);
    const cityEntries = (Array.isArray(day.cityEntries) ? day.cityEntries : []).flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const placeId = identifierOrNull(entry.placeId);
      if (placeId === null) return [];
      if (!hasPreviousEntry || previousPlaceId !== placeId) {
        occurrenceVisitId = allocateVisitId(entry.visitId);
      }
      hasPreviousEntry = true;
      previousPlaceId = placeId;
      return [{
        id: allocateEntryId(entry.id),
        visitId: occurrenceVisitId,
        placeId,
        manuallyPlaced: Boolean(entry.manuallyPlaced)
      }];
    });
    const items = (Array.isArray(day.items) ? day.items : [])
      .map((item) => normalizeTripItem(item, allocateItemId))
      .filter(Boolean);
    return {
      id: dayId,
      cityEntries,
      overnightPlaceId: typeof day.overnightPlaceId === "string" ? day.overnightPlaceId : null,
      items,
      lodging: normalizeLodging(day.lodging),
      manuallyEdited: Boolean(day.manuallyEdited)
    };
  });
  return {
    version: TRIP_PLAN_VERSION,
    id: tripId,
    name,
    startDate: validStartDate(data.startDate),
    pace,
    transportMode,
    days,
    savedAt: normalizedSavedAt(data.savedAt)
  };
}

export function migrateTripState(data, options = {}) {
  const idFactory = options.idFactory ?? defaultIdFactory;
  if (isRecord(data) && Object.hasOwn(data, "version")) {
    if (data.version === TRIP_PLAN_VERSION) {
      return normalizeTripPlan(data, { idFactory });
    }
    if (data.version !== 1) throw new TypeError("不支持的行程版本");
  }

  const snapshot = isRecord(data) ? data : {};
  const placeIds = [];
  if (Array.isArray(snapshot.routes) && snapshot.routes.length) {
    const firstRoute = isRecord(snapshot.routes[0]) ? snapshot.routes[0] : {};
    const firstPlaceId = identifierOrNull(firstRoute.from);
    if (firstPlaceId !== null) placeIds.push(firstPlaceId);
    snapshot.routes.forEach((route) => {
      const placeId = identifierOrNull(isRecord(route) ? route.to : null);
      if (placeId !== null) placeIds.push(placeId);
    });
  } else {
    const selectedCityId = identifierOrNull(snapshot.selectedCityId);
    if (selectedCityId !== null) placeIds.push(selectedCityId);
  }

  const paceProfile = {
    dailyTravelLimitSeconds: 4 * 3600,
    maxDailyPlaces: 3,
    ...(isRecord(options.paceProfile) ? options.paceProfile : {})
  };
  return autoScheduleTrip({
    placeIds,
    paceProfile,
    idFactory,
    metadata: {
      pace: VALID_TRIP_PACES.has(snapshot.tripPace) ? snapshot.tripPace : "standard",
      transportMode: VALID_TRANSPORT_MODES.has(snapshot.transportMode) ? snapshot.transportMode : "highspeed",
      name: "我的旅行"
    }
  });
}

export function compactTripPlan(plan) {
  const compact = cloneTripPlan(plan);
  delete compact.savedAt;
  return compact;
}

export function shouldUseTripFile(url) {
  return typeof url === "string" && url.length > 12000;
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
  const dayIndex = targetDayIndex - 1;
  if (dayIndex < 0) return [];
  return plan.days[dayIndex].items.flatMap((item) =>
    item.type === "transport" &&
    item.toPlaceId === placeId &&
    Number(item.endDayOffset) === 1
      ? [{ dayIndex, item }]
      : []
  );
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
    const item = sourceDay.items[source.itemIndex];
    if (!canMoveTripItemToDay(next, item, targetDay.id)) {
      return {
        plan,
        requiresConfirmation: false,
        changed: false,
        blockedReason: "item-place-mismatch"
      };
    }
    if (sourceDay === targetDay) {
      const reordered = [...sourceDay.items];
      const [candidate] = reordered.splice(source.itemIndex, 1);
      const candidateIndex = safeInsertionIndex(command.targetIndex, reordered.length);
      reordered.splice(candidateIndex, 0, candidate);
      if (reordered.every((item, index) => item === sourceDay.items[index])) {
        return { plan, requiresConfirmation: false, changed: false };
      }
    }
    sourceDay.items.splice(source.itemIndex, 1);
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
    ["name", "startDate", "pace", "transportMode"].forEach((key) => {
      if (patch && Object.hasOwn(patch, key)) updates[key] = patch[key];
      else if (Object.hasOwn(command, key)) updates[key] = command[key];
    });
    if (Object.hasOwn(updates, "transportMode")) {
      updates.transportMode = VALID_TRANSPORT_MODES.has(updates.transportMode)
        ? updates.transportMode
        : "highspeed";
    }
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
    if (sourceDay === targetDay) {
      const reordered = [...sourceDay.cityEntries];
      const [entry] = reordered.splice(source.entryIndex, 1);
      const targetIndex = safeInsertionIndex(command.targetIndex, reordered.length);
      reordered.splice(targetIndex, 0, { ...entry, manuallyPlaced: true });
      const unchanged = reordered.every((candidate, index) =>
        candidate.id === sourceDay.cityEntries[index]?.id &&
        candidate.manuallyPlaced === sourceDay.cityEntries[index]?.manuallyPlaced
      );
      if (unchanged) return { plan, requiresConfirmation: false, changed: false };
      sourceDay.cityEntries = reordered;
      ensureValidOvernightPlace(sourceDay);
      sourceDay.manuallyEdited = true;
      return { plan: next, requiresConfirmation: false, changed: true };
    }

    const entry = sourceDay.cityEntries[source.entryIndex];
    const remainingEntries = sourceDay.cityEntries.filter((candidate) => candidate.id !== entry.id);
    const placeRemains = remainingEntries.some((candidate) => candidate.placeId === entry.placeId);
    const removedPlaceIds = new Set(placeRemains ? [] : [entry.placeId]);
    const previousArrivals = placeRemains
      ? []
      : previousArrivalReferences(next, source.dayIndex, entry.placeId);
    const removesWholeDayRoute = remainingEntries.length === 0;
    const affectsItems = removesWholeDayRoute
      ? sourceDay.items.length > 0
      : sourceDay.items.some((item) => itemReferencesPlace(item, removedPlaceIds));
    const affectsLodging = Boolean(sourceDay.lodging) && (
      removesWholeDayRoute || removedPlaceIds.has(sourceDay.lodging.placeId)
    );
    const affectedDayIndexes = new Set();
    if (affectsItems || affectsLodging) affectedDayIndexes.add(source.dayIndex);
    previousArrivals.forEach(({ dayIndex }) => {
      affectedDayIndexes.add(dayIndex);
      affectedDayIndexes.add(source.dayIndex);
    });
    if (affectedDayIndexes.size && !force) {
      return {
        plan,
        requiresConfirmation: true,
        changed: false,
        confirmationReason: "cleanup-associated-content",
        affectedDayIds: [...affectedDayIndexes]
          .sort((left, right) => left - right)
          .map((dayIndex) => next.days[dayIndex].id)
      };
    }

    const arrivalItemsByDay = new Map();
    previousArrivals.forEach(({ dayIndex, item }) => {
      const items = arrivalItemsByDay.get(dayIndex) || new Set();
      items.add(item);
      arrivalItemsByDay.set(dayIndex, items);
    });
    arrivalItemsByDay.forEach((items, dayIndex) => {
      const arrivalDay = next.days[dayIndex];
      arrivalDay.items = arrivalDay.items.filter((item) => !items.has(item));
      arrivalDay.manuallyEdited = true;
    });

    sourceDay.cityEntries.splice(source.entryIndex, 1);
    if (sourceDay.cityEntries.length === 0) {
      sourceDay.items = [];
      sourceDay.lodging = null;
    } else if (removedPlaceIds.size) {
      sourceDay.items = sourceDay.items.filter((item) => !itemReferencesPlace(item, removedPlaceIds));
      if (sourceDay.lodging && removedPlaceIds.has(sourceDay.lodging.placeId)) sourceDay.lodging = null;
    }
    ensureValidOvernightPlace(sourceDay);
    sourceDay.manuallyEdited = true;

    const targetIndex = safeInsertionIndex(command.targetIndex, targetDay.cityEntries.length);
    targetDay.cityEntries.splice(targetIndex, 0, { ...entry, manuallyPlaced: true });
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
