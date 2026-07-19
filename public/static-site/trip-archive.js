import {
  LEGACY_TRIP_STORAGE_KEY,
  TRIP_STORAGE_KEY,
  compactTripPlan
} from "./trip-plan.js?v=progressive-1";

export const LEGACY_TRIP_BACKUP_KEY = "route-studio-trip-v1-backup";

const ARCHIVE_STORAGE_KEYS = [
  TRIP_STORAGE_KEY,
  LEGACY_TRIP_STORAGE_KEY,
  LEGACY_TRIP_BACKUP_KEY
];
const IMPORT_SNAPSHOT_KEYS = [TRIP_STORAGE_KEY, LEGACY_TRIP_BACKUP_KEY];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createLazyStorageAdapter(resolveStorage) {
  if (typeof resolveStorage !== "function") {
    throw new TypeError("Storage resolver must be a function");
  }

  const callStorage = (method, args) => {
    const storage = resolveStorage();
    const operation = storage?.[method];
    if (typeof operation !== "function") throw new TypeError(`Storage.${method} is unavailable`);
    return Reflect.apply(operation, storage, args);
  };

  return Object.freeze({
    getItem(key) {
      return callStorage("getItem", [key]);
    },
    setItem(key, value) {
      return callStorage("setItem", [key, value]);
    },
    removeItem(key) {
      return callStorage("removeItem", [key]);
    }
  });
}

function storageCandidate(storage, key, source, label, options = {}) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : { source, label, raw, ...options };
  } catch (error) {
    return { source, label, error, ...options };
  }
}

function tripHashState(currentUrl) {
  const url = new URL(currentUrl);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  return { url, params, hasTrip: params.has("trip") };
}

function retireTripHash({ currentUrl, replaceUrl }) {
  let hashState;
  try {
    hashState = tripHashState(currentUrl);
  } catch (error) {
    return { ok: false, changed: false, error };
  }
  if (!hashState.hasTrip) {
    return { ok: true, changed: false, url: hashState.url.toString() };
  }

  hashState.params.delete("trip");
  hashState.url.hash = hashState.params.toString();
  const nextUrl = hashState.url.toString();
  try {
    replaceUrl(nextUrl);
    return { ok: true, changed: true, url: nextUrl };
  } catch (error) {
    return { ok: false, changed: false, url: currentUrl, error };
  }
}

function removeStorageKeys(storage, keys) {
  const failedKeys = [];
  const errors = [];
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch (error) {
      failedKeys.push(key);
      errors.push({ key, error });
    }
  });
  return { ok: failedKeys.length === 0, failedKeys, errors };
}

export function isLegacyTripPayload(value) {
  if (!isRecord(value)) return false;
  if (Object.hasOwn(value, "version") && value.version !== 1) return false;
  return Array.isArray(value.routes) || (
    typeof value.selectedCityId === "string" && value.selectedCityId.trim().length > 0
  );
}

function tripReference(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function prepareLegacyRecoveryData(value) {
  if (!isLegacyTripPayload(value)) throw new TypeError("Invalid legacy trip payload");
  const routes = (Array.isArray(value.routes) ? value.routes : []).flatMap((route) => {
    if (!isRecord(route)) return [];
    const from = tripReference(route.from);
    const to = tripReference(route.to);
    return from && to ? [{ ...route, from, to }] : [];
  });
  return {
    ...value,
    routes,
    selectedCityId: tripReference(value.selectedCityId)
  };
}

export class MissingTripPlacesError extends Error {
  constructor(missingPlaceIds) {
    const uniqueIds = [...new Set(Array.isArray(missingPlaceIds) ? missingPlaceIds : [])];
    super(`Trip recovery is waiting for ${uniqueIds.length} place record(s)`);
    this.name = "MissingTripPlacesError";
    this.code = "TRIP_RECOVERY_MISSING_PLACES";
    this.missingPlaceIds = uniqueIds;
  }
}

export function selectTripRecoveryCandidate(candidates, evaluateCandidate) {
  if (!Array.isArray(candidates) || typeof evaluateCandidate !== "function") {
    throw new TypeError("Recovery candidates and evaluator are required");
  }
  const failures = [];
  for (const candidate of candidates) {
    if (candidate.error) {
      failures.push({ candidate, error: candidate.error });
      continue;
    }
    try {
      return {
        status: "ready",
        candidate,
        value: evaluateCandidate(candidate),
        failures
      };
    } catch (error) {
      if (error instanceof MissingTripPlacesError) {
        return { status: "deferred", candidate, error, failures };
      }
      failures.push({ candidate, error });
    }
  }
  return { status: "unavailable", failures };
}

export function readTripRecoveryCandidates({ storage, currentUrl }) {
  const candidates = [];
  try {
    const { params, hasTrip } = tripHashState(currentUrl);
    if (hasTrip) {
      candidates.push({
        source: "hash",
        label: "分享链接",
        raw: params.get("trip") || "",
        allowLegacy: false,
        requireLegacy: false
      });
    }
  } catch (error) {
    candidates.push({ source: "hash", label: "分享链接", error, allowLegacy: false, requireLegacy: false });
  }

  const v2 = storageCandidate(storage, TRIP_STORAGE_KEY, "storage", "本机 v2 存档", {
    allowLegacy: false,
    requireLegacy: false
  });
  if (v2) candidates.push(v2);
  const legacy = storageCandidate(storage, LEGACY_TRIP_STORAGE_KEY, "legacy", "旧版存档", {
    allowLegacy: true,
    requireLegacy: true
  });
  if (legacy) candidates.push(legacy);
  return candidates;
}

export function writeTripPlanV2({ storage, plan, currentUrl, replaceUrl }) {
  let serialized;
  try {
    serialized = JSON.stringify(plan);
    storage.setItem(TRIP_STORAGE_KEY, serialized);
  } catch (error) {
    return { stored: false, hashCleared: false, hashChanged: false, error };
  }

  const hashResult = retireTripHash({ currentUrl, replaceUrl });
  return {
    stored: true,
    hashCleared: hashResult.ok,
    hashChanged: hashResult.changed,
    url: hashResult.url,
    ...(hashResult.error ? { error: hashResult.error } : {})
  };
}

export function backupLegacyTripRaw({ storage, raw }) {
  try {
    if (typeof raw !== "string") throw new TypeError("Legacy trip source must be text");
    storage.setItem(LEGACY_TRIP_BACKUP_KEY, raw);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function finalizeLegacyMigration({ storage }) {
  for (const key of [LEGACY_TRIP_STORAGE_KEY, LEGACY_TRIP_BACKUP_KEY]) {
    try {
      storage.removeItem(key);
    } catch (error) {
      return { ok: false, failedKeys: [key], errors: [{ key, error }] };
    }
  }
  return { ok: true, failedKeys: [], errors: [] };
}

export function legacyMigrationPending({ storage }) {
  return storage.getItem(LEGACY_TRIP_BACKUP_KEY) !== null;
}

export function clearTripArchive({ storage, currentUrl, replaceUrl }) {
  const storageResult = removeStorageKeys(storage, ARCHIVE_STORAGE_KEYS);
  const hashResult = retireTripHash({ currentUrl, replaceUrl });
  return {
    ok: storageResult.ok && hashResult.ok,
    storageCleared: storageResult.ok,
    hashCleared: hashResult.ok,
    hashChanged: hashResult.changed,
    failedKeys: storageResult.failedKeys,
    errors: [
      ...storageResult.errors,
      ...(hashResult.error ? [{ key: "trip-hash", error: hashResult.error }] : [])
    ]
  };
}

export function captureTripArchiveSnapshot({ storage, keys = IMPORT_SNAPSHOT_KEYS }) {
  const snapshot = {};
  keys.forEach((key) => {
    snapshot[key] = storage.getItem(key);
  });
  return snapshot;
}

export function restoreTripArchiveSnapshot({ storage, snapshot, keys = Object.keys(snapshot) }) {
  const failedKeys = [];
  const errors = [];
  keys.forEach((key) => {
    try {
      const previousValue = snapshot[key] ?? null;
      if (storage.getItem(key) === previousValue) return;
      if (previousValue === null) storage.removeItem(key);
      else storage.setItem(key, previousValue);
    } catch (error) {
      failedKeys.push(key);
      errors.push({ key, error });
    }
  });
  return { ok: failedKeys.length === 0, failedKeys, errors };
}

export function shareUrlForTrip(plan, currentUrl) {
  const url = new URL(currentUrl);
  url.hash = `trip=${encodeURIComponent(JSON.stringify(compactTripPlan(plan)))}`;
  return url.toString();
}

export function safeTripNameForFile(name, maxCodePoints = 60) {
  const normalized = typeof name === "string" ? name.normalize("NFKC") : "";
  const filtered = normalized
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const safeName = Array.from(filtered)
    .slice(0, Math.max(0, Math.trunc(maxCodePoints)))
    .join("")
    .replace(/[.-]+$/g, "");
  if (!safeName || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)) return "trip";
  return safeName;
}

export function tripFileName(plan, timestamp = new Date()) {
  const readableTimestamp = new Date(timestamp).toISOString().replace(/[:.]/g, "-");
  return `${safeTripNameForFile(plan?.name)}-${readableTimestamp}.trip.json`;
}

export function tripFileText(plan) {
  return `${JSON.stringify(compactTripPlan(plan), null, 2)}\n`;
}

function emergencyLegacyTripData(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const data = JSON.parse(raw);
    return isLegacyTripPayload(data) ? data : null;
  } catch {
    return null;
  }
}

export function canExportTripFile({ plan = null, emergencyLegacyRaw = null } = {}) {
  return Boolean(plan) || Boolean(emergencyLegacyTripData(emergencyLegacyRaw));
}

export function tripFileExportPayload({
  plan = null,
  emergencyLegacyRaw = null,
  timestamp = new Date()
} = {}) {
  const legacyData = emergencyLegacyTripData(emergencyLegacyRaw);
  if (legacyData) {
    return {
      kind: "legacy-emergency",
      filename: tripFileName(legacyData, timestamp),
      text: emergencyLegacyRaw
    };
  }
  if (!plan) return null;
  return {
    kind: "trip-plan",
    filename: tripFileName(plan, timestamp),
    text: tripFileText(plan)
  };
}
