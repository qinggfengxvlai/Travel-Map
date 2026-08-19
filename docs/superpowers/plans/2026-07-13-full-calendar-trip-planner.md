# 完整日历行程规划器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有只读自动日程升级为可编辑的完整日历规划器，并让地图、保存、分享和 Markdown/HTML 旅游指南统一读取 `TripPlan v2`。

**Architecture:** 以 `public/static-site/trip-plan.js` 作为无 DOM 的行程领域模块，以 `trip-editor.js` 负责可测试的编辑器标记和浏览器事件，以 `guide-export.js` 负责两种指南输出。现有 `app.js` 只协调地图地点、路线估算、编辑命令和持久化；根目录静态文件在每个可运行阶段从发布入口同步。

**Tech Stack:** 原生 ES Modules、Leaflet、HTML/CSS、浏览器 LocalStorage/File/Drag and Drop API、Node.js 22 内置测试运行器、vinext 构建。

---

## 文件职责

- Create: `public/static-site/trip-plan.js` — `TripPlan v2` 创建、日期推导、命令更新、路线合并、校验、迁移和精简序列化。
- Create: `public/static-site/trip-editor.js` — 编辑器 HTML、动作解析、拖拽和移动菜单事件、编辑抽屉控制。
- Create: `public/static-site/guide-export.js` — 规范化指南模型、Markdown 和独立 HTML 生成。
- Create: `tests/trip-plan.test.mjs` — 行程模型、编辑、合并、校验和迁移测试。
- Create: `tests/trip-editor.test.mjs` — 编辑器标记和动作命令测试。
- Create: `tests/guide-export.test.mjs` — 两种导出格式的一致性与转义测试。
- Create: `tests/rendered-html.test.mjs` — 页面控件、模块入口和静态资源测试。
- Modify: `public/static-site/app.js` — 将地图路线与 `TripPlan v2` 集成，替换旧日程、存档、分享和导出流程。
- Modify: `public/static-site/index.html` — 行程设置、编辑器、编辑抽屉、导入和双格式导出入口。
- Modify: `public/static-site/styles.css` — 日历、时间轴、拖拽、移动菜单、抽屉和打印相关界面样式。
- Modify: `package.json` — 增加稳定的测试命令。
- Mirror: `trip-plan.js`, `trip-editor.js`, `guide-export.js`, `app.js`, `index.html`, `styles.css` — 与 `public/static-site/` 保持字节一致。

## 实施约束

- 每个任务遵循 RED → GREEN → REFACTOR；必须先看到目标测试因缺少行为而失败。
- 只暂存任务列出的文件，保留工作区中已有的无关修改和未跟踪内容。
- 领域模块不得访问 `document`、`window`、Leaflet 或 LocalStorage。
- `dayNumber`、具体日期、提醒、路线汇总和推荐文案均为派生数据，不写入 `TripPlan v2`。
- 浏览器中的所有计划更新都经过一个 `commitTripPlan(nextPlan, options)` 入口，避免地图、编辑器和存档各自修改状态。

### Task 1: 建立 TripPlan v2 与日期推导

**Files:**
- Create: `public/static-site/trip-plan.js`
- Create: `tests/trip-plan.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写创建行程和日期推导的失败测试**

```js
// tests/trip-plan.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
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
  assert.equal(plan.startDate, null);
  assert.equal(plan.days.length, 1);
  assert.deepEqual(routePlaceIds(plan), ["beijing"]);
  assert.equal(dayDate(plan, 0), null);
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
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node --test tests/trip-plan.test.mjs`

Expected: FAIL，错误指出 `public/static-site/trip-plan.js` 不存在或缺少导出。

- [ ] **Step 3: 实现最小模型、稳定 ID 和 UTC 安全日期计算**

```js
// public/static-site/trip-plan.js
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
```

Update `package.json`:

```json
{
  "scripts": {
    "test": "node --test tests/trip-plan.test.mjs tests/trip-editor.test.mjs tests/guide-export.test.mjs tests/rendered-html.test.mjs",
    "test:build": "npm run test && npm run build"
  }
}
```

保留现有 `dev`、`build`、`start`、`lint` 和 `db:generate` 脚本。

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/trip-plan.test.mjs`

Expected: 2 tests PASS。

- [ ] **Step 5: 提交基础模型**

```powershell
git add -- package.json public/static-site/trip-plan.js tests/trip-plan.test.mjs
git commit -m "feat: add trip plan v2 model"
```

### Task 2: 自动排期、停留天数与编辑命令

**Files:**
- Modify: `public/static-site/trip-plan.js`
- Modify: `tests/trip-plan.test.mjs`

- [ ] **Step 1: 写自动拆日、增加停留和跨日移动的失败测试**

```js
import { applyTripCommand, autoScheduleTrip } from "../public/static-site/trip-plan.js";

test("auto schedule splits a route at the pace limit", () => {
  const plan = autoScheduleTrip({
    placeIds: ["beijing", "zhengzhou", "wuhan"],
    durations: { "beijing>zhengzhou": 3 * 3600, "zhengzhou>wuhan": 3 * 3600 },
    paceProfile: { dailyTravelLimitSeconds: 4 * 3600, maxDailyPlaces: 3 },
    idFactory: ids()
  });
  assert.equal(plan.days.length, 2);
  assert.deepEqual(routePlaceIds(plan), ["beijing", "zhengzhou", "wuhan"]);
});

test("sets one visit to three consecutive days", () => {
  const plan = createTripPlan({ placeIds: ["chengdu"], idFactory: ids() });
  const visitId = plan.days[0].cityEntries[0].visitId;
  const result = applyTripCommand(plan, { type: "set-visit-duration", visitId, duration: 3 }, { idFactory: ids() });
  assert.equal(result.requiresConfirmation, false);
  assert.equal(result.plan.days.length, 3);
  assert.equal(result.plan.days.every((day) => day.cityEntries[0].visitId === visitId), true);
});

test("moves a city entry to another day without changing its visit", () => {
  const plan = createTripPlan({ placeIds: ["beijing"], idFactory: ids() });
  plan.days.push({ id: "day-2", cityEntries: [], overnightPlaceId: null, items: [], lodging: null, manuallyEdited: false });
  const entry = plan.days[0].cityEntries[0];
  const result = applyTripCommand(plan, { type: "move-city", entryId: entry.id, targetDayId: "day-2", targetIndex: 0 });
  assert.equal(result.plan.days[0].cityEntries.length, 0);
  assert.equal(result.plan.days[1].cityEntries[0].visitId, entry.visitId);
  assert.equal(result.plan.days[1].manuallyEdited, true);
});
```

- [ ] **Step 2: 运行新增测试并确认缺少函数导致失败**

Run: `node --test tests/trip-plan.test.mjs`

Expected: FAIL，指出 `autoScheduleTrip` 或 `applyTripCommand` 未导出。

- [ ] **Step 3: 实现自动排期和不可变命令更新**

在 `trip-plan.js` 增加：

```js
export function cloneTripPlan(plan) {
  return structuredClone(plan);
}

export function autoScheduleTrip({ placeIds, durations = {}, paceProfile, idFactory = defaultIdFactory, metadata = {} }) {
  const plan = createTripPlan({ ...metadata, placeIds: [], idFactory });
  if (!placeIds.length) return plan;
  let day = blankDay(idFactory);
  let travelSeconds = 0;
  const visitIds = new Map();
  const addPlace = (placeId) => {
    const visitId = visitIds.get(placeId) || idFactory("visit");
    visitIds.set(placeId, visitId);
    if (day.cityEntries.at(-1)?.placeId !== placeId) {
      day.cityEntries.push({ id: idFactory("city-entry"), visitId, placeId, manuallyPlaced: false });
    }
    day.overnightPlaceId = placeId;
  };
  addPlace(placeIds[0]);
  for (let index = 1; index < placeIds.length; index += 1) {
    const from = placeIds[index - 1];
    const to = placeIds[index];
    const duration = durations[`${from}>${to}`] ?? 2 * 3600;
    const mustSplit = day.cityEntries.length > 1 && (
      travelSeconds + duration > paceProfile.dailyTravelLimitSeconds ||
      day.cityEntries.length >= paceProfile.maxDailyPlaces
    );
    if (mustSplit) {
      plan.days.push(day);
      day = blankDay(idFactory);
      travelSeconds = 0;
      addPlace(from);
    }
    travelSeconds += duration;
    addPlace(to);
  }
  plan.days.push(day);
  return plan;
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
    const [entry] = next.days[source.dayIndex].cityEntries.splice(source.entryIndex, 1);
    targetDay.cityEntries.splice(command.targetIndex ?? targetDay.cityEntries.length, 0, { ...entry, manuallyPlaced: true });
    next.days[source.dayIndex].manuallyEdited = true;
    targetDay.manuallyEdited = true;
    targetDay.overnightPlaceId ||= entry.placeId;
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  if (command.type === "set-visit-duration") {
    const locations = [];
    next.days.forEach((day, dayIndex) => day.cityEntries.forEach((entry) => {
      if (entry.visitId === command.visitId) locations.push({ dayIndex, entry });
    }));
    if (!locations.length) return { plan, requiresConfirmation: false, changed: false };
    const duration = Math.max(1, Math.min(7, Number(command.duration)));
    const placeId = locations[0].entry.placeId;
    while (locations.length < duration) {
      const insertAt = locations.at(-1).dayIndex + 1;
      const newDay = blankDay(idFactory);
      newDay.cityEntries.push({ id: idFactory("city-entry"), visitId: command.visitId, placeId, manuallyPlaced: true });
      newDay.overnightPlaceId = placeId;
      newDay.manuallyEdited = true;
      next.days.splice(insertAt, 0, newDay);
      locations.push({ dayIndex: insertAt, entry: newDay.cityEntries[0] });
    }
    while (locations.length > duration) {
      const location = locations.pop();
      const day = next.days[location.dayIndex];
      const hasManualContent = day.items.length > 0 || day.lodging;
      if (hasManualContent && !force) return { plan, requiresConfirmation: true, changed: false, affectedDayIds: [day.id] };
      day.cityEntries = day.cityEntries.filter((entry) => entry.id !== location.entry.id);
      if (!day.cityEntries.length && !day.items.length && !day.lodging) next.days.splice(location.dayIndex, 1);
    }
    return { plan: next, requiresConfirmation: false, changed: true };
  }
  return { plan, requiresConfirmation: false, changed: false };
}
```

- [ ] **Step 4: 运行测试并整理重复的 day 创建逻辑**

Run: `node --test tests/trip-plan.test.mjs`

Expected: 5 tests PASS。重构后再次运行，仍为 PASS。

- [ ] **Step 5: 提交排期和编辑命令**

```powershell
git add -- public/static-site/trip-plan.js tests/trip-plan.test.mjs
git commit -m "feat: add editable calendar scheduling"
```

### Task 3: 时间轴项目、住宿和可行性校验

**Files:**
- Modify: `public/static-site/trip-plan.js`
- Modify: `tests/trip-plan.test.mjs`

- [ ] **Step 1: 写项目编辑、跨夜交通和冲突校验的失败测试**

```js
import { validateTripPlan } from "../public/static-site/trip-plan.js";

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
```

- [ ] **Step 2: 运行测试并确认新命令和校验函数缺失**

Run: `node --test tests/trip-plan.test.mjs`

Expected: FAIL，失败原因是 `upsert-item`、`set-lodging` 或 `validateTripPlan` 尚未实现。

- [ ] **Step 3: 实现时间解析、项目命令和结构化提醒**

在 `applyTripCommand` 增加 `upsert-item`、`copy-item`、`remove-item`、`move-item`、`remove-city`、`set-lodging`、`set-overnight` 和 `update-metadata` 分支。所有新项目通过 `idFactory("item")` 获得 ID；删除城市时复用停留缩短规则，有关联内容且未传 `force` 时返回 `requiresConfirmation`。`HH:mm` 使用以下解析函数：

```js
export function timeToMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function absoluteInterval(item, dayIndex) {
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);
  if (start === null || end === null) return null;
  return {
    start: dayIndex * 1440 + start,
    end: dayIndex * 1440 + end + Number(item.endDayOffset || 0) * 1440
  };
}

export function validateTripPlan(plan, { paceProfile } = {}) {
  const warnings = [];
  const locatedItems = plan.days.flatMap((day, dayIndex) => day.items.map((item) => ({ day, dayIndex, item, interval: absoluteInterval(item, dayIndex) })));
  locatedItems.forEach((current, index) => {
    if (!current.interval) warnings.push({ code: "missing-time", dayId: current.day.id, itemIds: [current.item.id], severity: "warning" });
    locatedItems.slice(index + 1).forEach((other) => {
      if (!current.interval || !other.interval) return;
      if (current.interval.start < other.interval.end && other.interval.start < current.interval.end) {
        warnings.push({ code: "time-overlap", dayId: current.day.id, itemIds: [current.item.id, other.item.id], severity: "warning" });
      }
    });
  });
  locatedItems.filter(({ item }) => item.type === "activity").forEach(({ day, dayIndex, item, interval }) => {
    const arrival = locatedItems.find((candidate) => candidate.item.type === "transport" && candidate.item.toPlaceId === item.placeId && candidate.dayIndex <= dayIndex);
    if (arrival?.interval && interval && interval.start < arrival.interval.end) {
      warnings.push({ code: "activity-before-arrival", dayId: day.id, itemIds: [item.id, arrival.item.id], severity: "warning" });
    }
  });
  plan.days.forEach((day) => {
    if (day.lodging && day.overnightPlaceId && day.lodging.placeId !== day.overnightPlaceId) {
      warnings.push({ code: "lodging-city-mismatch", dayId: day.id, itemIds: [], severity: "warning" });
    }
    if (day.overnightPlaceId && !day.cityEntries.some((entry) => entry.placeId === day.overnightPlaceId)) {
      warnings.push({ code: "overnight-city-missing", dayId: day.id, itemIds: [], severity: "warning" });
    }
  });
  return warnings;
}
```

扩展校验函数，按规格补齐跨城超限、剩余时间不足和缺少住宿提醒；提醒对象始终包含 `code`、`dayId`、`itemIds`、`severity`。

- [ ] **Step 4: 运行全部领域测试**

Run: `node --test tests/trip-plan.test.mjs`

Expected: 所有测试 PASS，无未处理异常。

- [ ] **Step 5: 提交时间轴与校验**

```powershell
git add -- public/static-site/trip-plan.js tests/trip-plan.test.mjs
git commit -m "feat: add trip timeline validation"
```

### Task 4: 路线增量合并、旧存档迁移和精简分享数据

**Files:**
- Modify: `public/static-site/trip-plan.js`
- Modify: `tests/trip-plan.test.mjs`

- [ ] **Step 1: 写保留手动日期、迁移 v1 和长分享判断的失败测试**

```js
import {
  compactTripPlan,
  migrateTripState,
  reconcileRoutePlaces,
  shouldUseTripFile
} from "../public/static-site/trip-plan.js";

test("inserts a new route place without moving manually edited days", () => {
  const plan = createTripPlan({ placeIds: ["beijing", "wuhan"], idFactory: ids() });
  plan.days[0].manuallyEdited = true;
  const result = reconcileRoutePlaces(plan, ["beijing", "zhengzhou", "wuhan"], { idFactory: ids() });
  assert.deepEqual(routePlaceIds(result.plan), ["beijing", "zhengzhou", "wuhan"]);
  assert.equal(result.plan.days[0].id, plan.days[0].id);
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
```

- [ ] **Step 2: 运行测试并确认合并、迁移和分享 API 缺失**

Run: `node --test tests/trip-plan.test.mjs`

Expected: FAIL，指出四个新导出不存在。

- [ ] **Step 3: 实现增量合并、阻塞删除和版本迁移**

实现以下完整的合并和规范化流程：

```js
function itemReferencesPlace(item, placeId) {
  return item.placeId === placeId || item.fromPlaceId === placeId || item.toPlaceId === placeId;
}

function manualContentForPlace(plan, placeId) {
  return plan.days.filter((day) => (
    day.cityEntries.some((entry) => entry.placeId === placeId) && day.manuallyEdited
  ) || day.lodging?.placeId === placeId || day.items.some((item) => itemReferencesPlace(item, placeId)));
}

function findPlaceLocation(plan, placeId, fromEnd = false) {
  const dayIndexes = [...plan.days.keys()];
  if (fromEnd) dayIndexes.reverse();
  for (const dayIndex of dayIndexes) {
    const entries = plan.days[dayIndex].cityEntries;
    const entryIndex = fromEnd
      ? entries.map((entry) => entry.placeId).lastIndexOf(placeId)
      : entries.findIndex((entry) => entry.placeId === placeId);
    if (entryIndex >= 0) return { dayIndex, entryIndex };
  }
  return null;
}

export function reconcileRoutePlaces(plan, nextPlaceIds, { idFactory = defaultIdFactory, allowRemovalIds = new Set() } = {}) {
  const next = cloneTripPlan(plan);
  const requested = nextPlaceIds.filter((placeId, index) => index === 0 || nextPlaceIds[index - 1] !== placeId);
  const requestedSet = new Set(requested);
  const blockedRemovals = [];

  for (const placeId of new Set(routePlaceIds(next))) {
    if (requestedSet.has(placeId)) continue;
    const affectedDays = manualContentForPlace(next, placeId);
    if (affectedDays.length && !allowRemovalIds.has(placeId)) {
      blockedRemovals.push({ placeId, dayIds: affectedDays.map((day) => day.id) });
      continue;
    }
    next.days.forEach((day) => {
      day.cityEntries = day.cityEntries.filter((entry) => entry.placeId !== placeId);
      day.items = day.items.filter((item) => !itemReferencesPlace(item, placeId));
      if (day.lodging?.placeId === placeId) day.lodging = null;
      if (day.overnightPlaceId === placeId) day.overnightPlaceId = day.cityEntries.at(-1)?.placeId || null;
    });
    next.days = next.days.filter((day) => day.cityEntries.length || day.items.length || day.lodging);
  }

  requested.forEach((placeId, requestedIndex) => {
    if (routePlaceIds(next).includes(placeId)) return;
    const before = requested.slice(0, requestedIndex).reverse().find((candidate) => routePlaceIds(next).includes(candidate));
    const after = requested.slice(requestedIndex + 1).find((candidate) => routePlaceIds(next).includes(candidate));
    const beforeLocation = before ? findPlaceLocation(next, before, true) : null;
    const afterLocation = after ? findPlaceLocation(next, after, false) : null;
    let targetDay;
    let targetIndex;
    if (beforeLocation) {
      targetDay = next.days[beforeLocation.dayIndex];
      targetIndex = beforeLocation.entryIndex + 1;
    } else if (afterLocation) {
      targetDay = next.days[afterLocation.dayIndex];
      targetIndex = afterLocation.entryIndex;
    } else {
      targetDay = blankDay(idFactory);
      next.days.push(targetDay);
      targetIndex = 0;
    }
    targetDay.cityEntries.splice(targetIndex, 0, {
      id: idFactory("city-entry"),
      visitId: idFactory("visit"),
      placeId,
      manuallyPlaced: false
    });
    targetDay.overnightPlaceId = targetDay.cityEntries.at(-1)?.placeId || null;
  });

  return { plan: next, blockedRemovals };
}

function normalizeItem(item, idFactory) {
  if (!item || !["transport", "activity"].includes(item.type)) return null;
  const common = {
    id: typeof item.id === "string" ? item.id : idFactory("item"),
    type: item.type,
    startTime: typeof item.startTime === "string" ? item.startTime : "",
    endTime: typeof item.endTime === "string" ? item.endTime : "",
    note: typeof item.note === "string" ? item.note : "",
    manuallyEdited: Boolean(item.manuallyEdited)
  };
  if (item.type === "transport") return {
    ...common,
    fromPlaceId: String(item.fromPlaceId || ""),
    toPlaceId: String(item.toPlaceId || ""),
    serviceNo: String(item.serviceNo || ""),
    endDayOffset: item.endDayOffset === 1 ? 1 : 0
  };
  return {
    ...common,
    sourceType: ["landmark", "food", "custom", "free"].includes(item.sourceType) ? item.sourceType : "custom",
    sourceId: typeof item.sourceId === "string" ? item.sourceId : null,
    placeId: String(item.placeId || ""),
    title: String(item.title || "未命名活动")
  };
}

export function normalizeTripPlan(data, { idFactory = defaultIdFactory } = {}) {
  if (!data || typeof data !== "object" || !Array.isArray(data.days)) throw new TypeError("行程文件格式无效");
  return {
    version: TRIP_PLAN_VERSION,
    id: typeof data.id === "string" ? data.id : idFactory("trip"),
    name: typeof data.name === "string" ? data.name.slice(0, 60) : "我的旅行",
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(data.startDate || "") ? data.startDate : null,
    pace: ["relaxed", "standard", "compact"].includes(data.pace) ? data.pace : "standard",
    days: data.days.map((day) => ({
      id: typeof day?.id === "string" ? day.id : idFactory("day"),
      cityEntries: Array.isArray(day?.cityEntries) ? day.cityEntries.filter((entry) => entry?.placeId).map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : idFactory("city-entry"),
        visitId: typeof entry.visitId === "string" ? entry.visitId : idFactory("visit"),
        placeId: String(entry.placeId),
        manuallyPlaced: Boolean(entry.manuallyPlaced)
      })) : [],
      overnightPlaceId: typeof day?.overnightPlaceId === "string" ? day.overnightPlaceId : null,
      items: Array.isArray(day?.items) ? day.items.map((item) => normalizeItem(item, idFactory)).filter(Boolean) : [],
      lodging: day?.lodging ? {
        placeId: String(day.lodging.placeId || ""),
        name: String(day.lodging.name || ""),
        address: String(day.lodging.address || ""),
        checkInTime: String(day.lodging.checkInTime || ""),
        checkOutTime: String(day.lodging.checkOutTime || ""),
        note: String(day.lodging.note || "")
      } : null,
      manuallyEdited: Boolean(day?.manuallyEdited)
    })),
    savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date().toISOString()
  };
}

export function migrateTripState(data, options = {}) {
  if (data?.version === TRIP_PLAN_VERSION && Array.isArray(data.days)) return normalizeTripPlan(data, options);
  const placeIds = data?.routes?.length
    ? [data.routes[0].from, ...data.routes.map((route) => route.to)]
    : data?.selectedCityId ? [data.selectedCityId] : [];
  return autoScheduleTrip({
    placeIds,
    durations: {},
    paceProfile: options.paceProfile || { dailyTravelLimitSeconds: 4 * 3600, maxDailyPlaces: 3 },
    idFactory: options.idFactory || defaultIdFactory,
    metadata: { pace: data?.tripPace || "standard", name: "我的旅行" }
  });
}

export function compactTripPlan(plan) {
  const compact = structuredClone(plan);
  delete compact.savedAt;
  return compact;
}

export function shouldUseTripFile(url) {
  return url.length > 12000;
}
```

- [ ] **Step 4: 运行测试并扫描模型中的 DOM/浏览器依赖**

Run: `node --test tests/trip-plan.test.mjs`

Expected: 全部 PASS。

Run: `rg -n "document|window|localStorage|L\." public/static-site/trip-plan.js`

Expected: 无输出。

- [ ] **Step 5: 提交合并和迁移**

```powershell
git add -- public/static-site/trip-plan.js tests/trip-plan.test.mjs
git commit -m "feat: migrate and reconcile trip plans"
```

### Task 5: Markdown 与可打印 HTML 旅游指南

**Files:**
- Create: `public/static-site/guide-export.js`
- Create: `tests/guide-export.test.mjs`

- [ ] **Step 1: 写两种格式内容一致和 HTML 转义的失败测试**

```js
// tests/guide-export.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildGuideModel, buildMarkdownGuide, buildPrintableHtml } from "../public/static-site/guide-export.js";

const plan = {
  version: 2,
  id: "trip-1",
  name: "华中 <五日行>",
  startDate: "2026-10-01",
  pace: "standard",
  days: [{
    id: "day-1",
    cityEntries: [{ id: "ce-1", visitId: "v-1", placeId: "zhengzhou", manuallyPlaced: true }],
    overnightPlaceId: "zhengzhou",
    items: [{ id: "a-1", type: "activity", placeId: "zhengzhou", title: "河南博物院", startTime: "14:00", endTime: "16:30", note: "提前预约" }],
    lodging: { placeId: "zhengzhou", name: "站前酒店", address: "", checkInTime: "18:00", checkOutTime: "09:00", note: "" }
  }]
};

test("exports the same dated activity to markdown and html", () => {
  const model = buildGuideModel({
    plan,
    placeSnapshots: new Map([["zhengzhou", { id: "zhengzhou", name: "郑州" }]]),
    warnings: []
  });
  const markdown = buildMarkdownGuide(model);
  const html = buildPrintableHtml(model);
  assert.match(markdown, /2026-10-01/);
  assert.match(markdown, /河南博物院/);
  assert.match(html, /2026-10-01/);
  assert.match(html, /河南博物院/);
  assert.doesNotMatch(html, /华中 <五日行>/);
  assert.match(html, /华中 &lt;五日行&gt;/);
});
```

- [ ] **Step 2: 运行测试并确认导出模块不存在**

Run: `node --test tests/guide-export.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现规范化指南模型和两个渲染器**

`buildGuideModel` 将 ID 转为地点快照，给每一天补充 `dayNumber`、日期、星期、排序后的项目和对应提醒。`buildMarkdownGuide` 与 `buildPrintableHtml` 只读取该模型。HTML 必须使用以下转义函数，并将完整打印样式内嵌到文件：

```js
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildGuideModel({ plan, placeSnapshots, warnings = [], routeSegments = [], totals = null }) {
  return {
    title: plan.name || "我的旅行",
    startDate: plan.startDate,
    pace: plan.pace,
    routeSegments,
    totals,
    days: plan.days.map((day, index) => ({
      ...structuredClone(day),
      dayNumber: index + 1,
      date: dayDate(plan, index),
      places: day.cityEntries.map((entry) => placeSnapshots.get(entry.placeId) || { id: entry.placeId, name: entry.placeId }),
      warnings: warnings.filter((warning) => warning.dayId === day.id)
    }))
  };
}
```

Markdown/HTML 均按“封面摘要 → 路线概览 → 每日时间轴 → 行前检查 → 数据说明”输出。HTML 不引用应用 CSS、脚本或在线图片。

- [ ] **Step 4: 运行导出测试和语法检查**

Run: `node --test tests/guide-export.test.mjs`

Expected: PASS。

Run: `node --check public/static-site/guide-export.js`

Expected: exit 0。

- [ ] **Step 5: 提交指南导出模块**

```powershell
git add -- public/static-site/guide-export.js tests/guide-export.test.mjs
git commit -m "feat: export printable travel guides"
```

### Task 6: 日历编辑器标记、移动菜单和桌面拖拽命令

**Files:**
- Create: `public/static-site/trip-editor.js`
- Create: `tests/trip-editor.test.mjs`

- [ ] **Step 1: 写日期卡片、停留步进器和动作解析的失败测试**

```js
// tests/trip-editor.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { commandForAction, renderTripEditorMarkup } from "../public/static-site/trip-editor.js";

const plan = {
  startDate: "2026-10-01",
  days: [{
    id: "day-1",
    cityEntries: [{ id: "ce-1", visitId: "visit-1", placeId: "chengdu" }],
    overnightPlaceId: "chengdu",
    items: [],
    lodging: null
  }]
};

test("renders dated day controls and visit duration", () => {
  const html = renderTripEditorMarkup({
    plan,
    warnings: [],
    placeName: () => "成都"
  });
  assert.match(html, /第 1 天/);
  assert.match(html, /2026-10-01/);
  assert.match(html, /data-action="increase-stay"/);
  assert.match(html, /data-action="add-activity"/);
});

test("maps a mobile move selection to a domain command", () => {
  assert.deepEqual(commandForAction({
    action: "move-city",
    entryId: "ce-1",
    targetDayId: "day-2",
    targetIndex: "0"
  }), { type: "move-city", entryId: "ce-1", targetDayId: "day-2", targetIndex: 0 });
});
```

- [ ] **Step 2: 运行测试并确认编辑器模块不存在**

Run: `node --test tests/trip-editor.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯标记函数和事件适配器**

按下面的完整事件边界实现模块；表单字段到项目对象的转换在 Task 8 增加：

```js
// public/static-site/trip-editor.js
import { dayDate } from "./trip-plan.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const warningLabels = {
  "time-overlap": "时间安排存在重叠",
  "activity-before-arrival": "活动早于抵达时间",
  "lodging-city-mismatch": "住宿城市与过夜城市不一致",
  "overnight-city-missing": "过夜城市不在当天路线中",
  "missing-time": "仍有项目未填写完整时间",
  "travel-over-limit": "跨城时间超过当前节奏上限",
  "play-time-short": "当天剩余游玩时间不足两小时",
  "lodging-missing": "过夜行程尚未填写住宿"
};

function visitOccurrences(plan) {
  const result = new Map();
  plan.days.forEach((day, dayIndex) => day.cityEntries.forEach((entry) => {
    const list = result.get(entry.visitId) || [];
    list.push({ dayIndex, entryId: entry.id });
    result.set(entry.visitId, list);
  }));
  return result;
}

function dateHeading(plan, dayIndex) {
  const date = dayDate(plan, dayIndex);
  if (!date) return `第 ${dayIndex + 1} 天`;
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("zh-CN", { weekday: "short", timeZone: "UTC" });
  return `第 ${dayIndex + 1} 天 · ${date} · ${weekday}`;
}

function moveOptions(plan, currentDayId) {
  return plan.days.map((day, index) => `<option value="${escapeHtml(day.id)}"${day.id === currentDayId ? " selected" : ""}>第 ${index + 1} 天</option>`).join("");
}

function renderItem(item, day, plan, placeName) {
  const title = item.type === "transport"
    ? `${placeName(item.fromPlaceId)} → ${placeName(item.toPlaceId)}${item.serviceNo ? ` · ${item.serviceNo}` : ""}`
    : item.title;
  const time = item.startTime && item.endTime
    ? `${item.startTime}–${item.endTime}${item.endDayOffset === 1 ? " 次日" : ""}`
    : "时间待补充";
  return `<li class="timeline-item" draggable="true" data-drag-kind="item" data-drag-id="${escapeHtml(item.id)}">
    <span class="drag-handle" aria-hidden="true">⋮⋮</span>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(time)}</span></div>
    <button type="button" data-action="edit-item" data-day-id="${escapeHtml(day.id)}" data-item-id="${escapeHtml(item.id)}" title="编辑">编辑</button>
    <button type="button" data-action="copy-item" data-item-id="${escapeHtml(item.id)}" title="复制">复制</button>
    <select data-action="move-item" data-item-id="${escapeHtml(item.id)}" aria-label="移动项目到指定日期">${moveOptions(plan, day.id)}</select>
    <button type="button" data-action="remove-item" data-item-id="${escapeHtml(item.id)}" title="删除">×</button>
  </li>`;
}

export function renderTripEditorMarkup({ plan, warnings = [], placeName }) {
  if (!plan?.days?.length) return "";
  const occurrences = visitOccurrences(plan);
  return `<ol class="itinerary-list">${plan.days.map((day, dayIndex) => {
    const dayWarnings = warnings.filter((warning) => warning.dayId === day.id);
    const cityRows = day.cityEntries.map((entry) => {
      const visit = occurrences.get(entry.visitId);
      const occurrenceIndex = visit.findIndex((item) => item.entryId === entry.id);
      const stayControl = occurrenceIndex === 0
        ? `<div class="stay-stepper" aria-label="停留天数"><button type="button" data-action="decrease-stay" data-visit-id="${escapeHtml(entry.visitId)}" data-duration="${visit.length}"${visit.length <= 1 ? " disabled" : ""}>−</button><span>${visit.length} 天</span><button type="button" data-action="increase-stay" data-visit-id="${escapeHtml(entry.visitId)}" data-duration="${visit.length}"${visit.length >= 7 ? " disabled" : ""}>+</button></div>`
        : `<span class="stay-progress">停留第 ${occurrenceIndex + 1}/${visit.length} 天</span>`;
      return `<li class="city-entry" draggable="true" data-drag-kind="city" data-drag-id="${escapeHtml(entry.id)}">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <strong>${escapeHtml(placeName(entry.placeId))}</strong>
        ${stayControl}
        <select data-action="move-city" data-entry-id="${escapeHtml(entry.id)}" aria-label="移动城市到指定日期">${moveOptions(plan, day.id)}</select>
        <button type="button" data-action="remove-city" data-entry-id="${escapeHtml(entry.id)}" title="删除城市">×</button>
      </li>`;
    }).join("");
    const overnightOptions = day.cityEntries.map((entry) => `<option value="${escapeHtml(entry.placeId)}"${entry.placeId === day.overnightPlaceId ? " selected" : ""}>${escapeHtml(placeName(entry.placeId))}</option>`).join("");
    return `<li class="day-card" data-day-id="${escapeHtml(day.id)}" data-drop-day="${escapeHtml(day.id)}">
      <header><p class="day-meta">${escapeHtml(dateHeading(plan, dayIndex))}</p><h3>${day.cityEntries.map((entry) => escapeHtml(placeName(entry.placeId))).join(" → ") || "待安排城市"}</h3></header>
      <ul class="day-cities">${cityRows}</ul>
      <label class="overnight-field">过夜城市<select data-action="set-overnight" data-day-id="${escapeHtml(day.id)}"><option value="">待定</option>${overnightOptions}</select></label>
      <ol class="day-timeline">${day.items.map((item) => renderItem(item, day, plan, placeName)).join("")}</ol>
      <div class="day-actions"><button type="button" data-action="add-transport" data-day-id="${escapeHtml(day.id)}">交通</button><button type="button" data-action="add-activity" data-day-id="${escapeHtml(day.id)}">活动</button><button type="button" data-action="edit-lodging" data-day-id="${escapeHtml(day.id)}">住宿</button></div>
      ${day.lodging ? `<p class="lodging-summary">住宿：${escapeHtml(day.lodging.name || "已填写")}</p>` : ""}
      ${dayWarnings.length ? `<ul class="day-warnings">${dayWarnings.map((warning) => `<li>${escapeHtml(warningLabels[warning.code] || "请检查当天安排")}</li>`).join("")}</ul>` : ""}
    </li>`;
  }).join("")}</ol>`;
}

export function commandForAction(data) {
  if (data.action === "move-city") return { type: "move-city", entryId: data.entryId, targetDayId: data.targetDayId, targetIndex: Number(data.targetIndex || 0) };
  if (data.action === "move-item") return { type: "move-item", itemId: data.itemId, targetDayId: data.targetDayId, targetIndex: Number(data.targetIndex || 0) };
  if (data.action === "set-overnight") return { type: "set-overnight", dayId: data.dayId, placeId: data.placeId || null };
  if (data.action === "remove-city") return { type: "remove-city", entryId: data.entryId };
  if (data.action === "copy-item") return { type: "copy-item", itemId: data.itemId };
  if (data.action === "remove-item") return { type: "remove-item", itemId: data.itemId };
  if (["increase-stay", "decrease-stay"].includes(data.action)) {
    const delta = data.action === "increase-stay" ? 1 : -1;
    return { type: "set-visit-duration", visitId: data.visitId, duration: Number(data.duration) + delta };
  }
  return null;
}

export function mountTripEditor({ root, onCommand, onEditRequest }) {
  const click = (event) => {
    const control = event.target.closest("[data-action]");
    if (!control || !root.contains(control)) return;
    if (["add-transport", "add-activity", "edit-item", "edit-lodging"].includes(control.dataset.action)) {
      onEditRequest({ ...control.dataset });
      return;
    }
    const command = commandForAction({ ...control.dataset });
    if (command) onCommand(command);
  };
  const change = (event) => {
    const control = event.target.closest("select[data-action]");
    if (!control) return;
    const data = { ...control.dataset };
    if (data.action === "move-city" || data.action === "move-item") data.targetDayId = control.value;
    if (data.action === "set-overnight") data.placeId = control.value;
    const command = commandForAction(data);
    if (command) onCommand(command);
  };
  const dragstart = (event) => {
    const draggable = event.target.closest("[data-drag-kind]");
    if (!draggable) return;
    event.dataTransfer.setData("application/x-trip-entry", JSON.stringify({ kind: draggable.dataset.dragKind, id: draggable.dataset.dragId }));
  };
  const dragover = (event) => {
    if (event.target.closest("[data-drop-day]")) event.preventDefault();
  };
  const drop = (event) => {
    const target = event.target.closest("[data-drop-day]");
    if (!target) return;
    event.preventDefault();
    const payload = JSON.parse(event.dataTransfer.getData("application/x-trip-entry") || "null");
    if (!payload) return;
    onCommand(payload.kind === "city"
      ? { type: "move-city", entryId: payload.id, targetDayId: target.dataset.dropDay, targetIndex: 0 }
      : { type: "move-item", itemId: payload.id, targetDayId: target.dataset.dropDay, targetIndex: 0 });
  };
  root.addEventListener("click", click);
  root.addEventListener("change", change);
  root.addEventListener("dragstart", dragstart);
  root.addEventListener("dragover", dragover);
  root.addEventListener("drop", drop);
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("change", change);
    root.removeEventListener("dragstart", dragstart);
    root.removeEventListener("dragover", dragover);
    root.removeEventListener("drop", drop);
  };
}
```

`renderTripEditorMarkup` 必须：

- 为每个 day 输出稳定的 `data-day-id`。
- 仅在同一 `visitId` 第一次出现时显示 `1-7` 天步进器，后续日期显示“停留第 N/M 天”。
- 为城市提供指定日期 `<select>`，所有屏幕均可使用。
- 为活动提供编辑、移动、复制、删除命令。
- 为日期提供添加交通、活动和住宿命令。
- 将结构化 warning code 映射为中文短句，不直接拼入未转义用户文本。

`mountTripEditor` 使用事件代理；HTML5 Drag and Drop 只把 `{ kind, id }` 写入 `dataTransfer`，drop 后转换为与移动菜单相同的领域命令。不得在模块内直接修改 plan。

- [ ] **Step 4: 运行编辑器测试和语法检查**

Run: `node --test tests/trip-editor.test.mjs`

Expected: PASS。

Run: `node --check public/static-site/trip-editor.js`

Expected: exit 0。

- [ ] **Step 5: 提交编辑器模块**

```powershell
git add -- public/static-site/trip-editor.js tests/trip-editor.test.mjs
git commit -m "feat: add calendar editor module"
```

### Task 7: 把 TripPlan v2 接入地图和现有路线状态

**Files:**
- Modify: `public/static-site/app.js`
- Modify: `public/static-site/index.html`
- Create: `tests/rendered-html.test.mjs`

- [ ] **Step 1: 写页面模块入口和规划控件的失败测试**

```js
// tests/rendered-html.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("static page exposes the calendar planner controls", async () => {
  const html = await readFile(new URL("../public/static-site/index.html", import.meta.url), "utf8");
  assert.match(html, /id="tripNameInput"/);
  assert.match(html, /id="tripStartDateInput"/);
  assert.match(html, /id="autoScheduleBtn"/);
  assert.match(html, /id="undoTripEditBtn"/);
  assert.match(html, /id="tripEditorRoot"/);
  assert.match(html, /type="module" src="\.\/app\.js/);
});
```

- [ ] **Step 2: 运行测试并确认新控件不存在**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL，第一处缺少 `tripNameInput`。

- [ ] **Step 3: 增加静态骨架并将 app.js 转为模块协调器**

在 `index.html` 的时间规划区加入：

```html
<div class="trip-settings">
  <label>行程名称<input id="tripNameInput" maxlength="60" autocomplete="off" /></label>
  <label>出发日期<input id="tripStartDateInput" type="date" /></label>
  <div class="trip-setting-actions">
    <button id="autoScheduleBtn" class="icon-button" type="button">自动排期</button>
    <button id="undoTripEditBtn" class="icon-button" type="button" disabled>撤销编辑</button>
  </div>
</div>
<div id="tripHealth" class="trip-health" hidden></div>
<div id="tripEditorRoot"></div>
<p id="itineraryEmptyState" class="empty-state">选择起点后会生成第一天行程。</p>
```

将最后的应用脚本改为 `<script type="module" src="./app.js?v=calendar-planner-1"></script>`。

在 `app.js` 顶部导入领域和编辑器模块，在 `state` 增加 `tripPlan`、`tripHistory`、`tripEditorDestroy`。新增统一入口：

```js
function commitTripPlan(nextPlan, { recordHistory = true, message = "已自动保存到本机。" } = {}) {
  if (recordHistory && state.tripPlan) state.tripHistory.push(structuredClone(state.tripPlan));
  state.tripHistory = state.tripHistory.slice(-20);
  state.tripPlan = nextPlan;
  syncRoutesFromTripPlan();
  renderRoutes();
  renderPanel();
  persistTripState(message);
}
```

`syncRoutesFromTripPlan` 从 `routePlaceIds(state.tripPlan)` 重建相邻路线段，优先复用相同 `from/to/transportMode` 的已有估算；日历顺序因此成为地图路线顺序。`handlePlaceClick` 首次创建计划，后续通过 `reconcileRoutePlaces` 增量加入地点。原 `buildItineraryDays` 和 `renderItineraryPanel` 不再作为渲染入口。

- [ ] **Step 4: 运行页面测试、领域测试和语法检查**

Run: `node --test tests/rendered-html.test.mjs tests/trip-plan.test.mjs tests/trip-editor.test.mjs`

Expected: 全部 PASS。

Run: `node --check public/static-site/app.js`

Expected: exit 0。

- [ ] **Step 5: 提交应用基础集成**

```powershell
git add -- public/static-site/app.js public/static-site/index.html tests/rendered-html.test.mjs
git commit -m "feat: connect calendar plan to map routes"
```

### Task 8: 完成编辑表单、住宿、移动端菜单和撤销

**Files:**
- Modify: `public/static-site/app.js`
- Modify: `public/static-site/index.html`
- Modify: `public/static-site/trip-editor.js`
- Modify: `public/static-site/styles.css`
- Modify: `tests/trip-editor.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: 写编辑抽屉、导入控件和表单命令的失败测试**

```js
test("static page contains the item editor dialog", async () => {
  const html = await readFile(new URL("../public/static-site/index.html", import.meta.url), "utf8");
  assert.match(html, /id="tripItemDialog"/);
  assert.match(html, /id="tripItemForm"/);
  assert.match(html, /name="startTime"/);
  assert.match(html, /name="endDayOffset"/);
  assert.match(html, /id="tripImportInput"/);
});
```

在 `trip-editor.test.mjs` 增加活动和住宿表单到领域命令的断言，确保空字符串被规范化而不是写入 `undefined`。

- [ ] **Step 2: 运行测试并确认编辑抽屉不存在**

Run: `node --test tests/trip-editor.test.mjs tests/rendered-html.test.mjs`

Expected: FAIL，指出 `tripItemDialog` 或表单命令缺失。

- [ ] **Step 3: 实现编辑抽屉和所有 UI 命令**

在 `index.html` 加入一个原生 `<dialog>`，表单包含：类型、地点、标题/车次、出发地、目的地、开始时间、结束时间、次日到达、地址和备注。`trip-editor.js` 根据交通、活动、住宿三种模式切换字段；提交后生成 `upsert-item` 或 `set-lodging` 命令。

在 `app.js` 完成：

- `onCommand` 调用 `applyTripCommand`；遇到 `requiresConfirmation` 时展示受影响日期并仅在确认后以 `force: true` 重试。
- `update-metadata` 处理名称和可清空的开始日期。
- `undoTripEditBtn` 恢复 `tripHistory` 最后一项，并通过统一入口保存。
- `autoScheduleBtn` 在有手动日期时确认，再调用 `autoScheduleTrip`。
- 景点候选使用当前地点的现有地标名称，保存为 `sourceType: "landmark"`；用户自填则为 `sourceType: "custom"`。
- 过夜城市只能从当天 `cityEntries` 中选择。

在 CSS 中提供稳定的日卡尺寸、时间轴行、拖拽目标、步进器、移动菜单和桌面 dialog 样式。`max-width: 880px` 下将 dialog 固定为底部抽屉，隐藏拖拽手柄但保留移动菜单；所有触控按钮最小高度 `40px`。

- [ ] **Step 4: 运行全部前端单元测试和语法检查**

Run: `node --test tests/trip-plan.test.mjs tests/trip-editor.test.mjs tests/rendered-html.test.mjs`

Expected: 全部 PASS。

Run: `node --check public/static-site/app.js`

Expected: exit 0。

- [ ] **Step 5: 提交完整编辑交互**

```powershell
git add -- public/static-site/app.js public/static-site/index.html public/static-site/trip-editor.js public/static-site/styles.css tests/trip-editor.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: add trip calendar editing controls"
```

### Task 9: v2 保存恢复、分享链接和行程文件导入导出

**Files:**
- Modify: `public/static-site/app.js`
- Modify: `public/static-site/index.html`
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: 写 v2 存储键和行程文件入口的静态失败测试**

```js
test("app includes v2 persistence and trip file fallback", async () => {
  const app = await readFile(new URL("../public/static-site/app.js", import.meta.url), "utf8");
  assert.match(app, /TRIP_STORAGE_KEY/);
  assert.match(app, /LEGACY_TRIP_STORAGE_KEY/);
  assert.match(app, /shouldUseTripFile/);
  assert.match(app, /\.trip\.json/);
});
```

- [ ] **Step 2: 运行测试并确认旧存储流程仍未替换**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL，缺少 v2/旧键双读或 `.trip.json` 兜底。

- [ ] **Step 3: 替换旧持久化与分享流程**

实现顺序：hash v2 → LocalStorage v2 → LocalStorage v1。迁移 v1 前写入 `route-studio-trip-v1-backup`；首次新的有效编辑后删除备份。保存失败时保留内存计划并提示导出文件。

分享函数使用：

```js
function shareUrlForTrip(plan) {
  const url = new URL(window.location.href);
  url.hash = `trip=${encodeURIComponent(JSON.stringify(compactTripPlan(plan)))}`;
  return url.toString();
}
```

若 `shouldUseTripFile(url)` 为真，下载 `<safe-trip-name>-<timestamp>.trip.json`，不把长 URL 写入地址栏。`tripImportInput` 读取文本、解析 JSON、调用 `migrateTripState`/`normalizeTripPlan` 校验，成功后通过 `commitTripPlan` 替换；失败时不覆盖当前计划。

清空操作移除 v2、v1、备份和 hash。分享、导入和迁移均通过 `tripArchiveStatus` 返回明确结果。

- [ ] **Step 4: 运行测试并人工验证非法文件不会覆盖状态**

Run: `node --test tests/trip-plan.test.mjs tests/rendered-html.test.mjs`

Expected: 全部 PASS。

Run: `node --check public/static-site/app.js`

Expected: exit 0。

- [ ] **Step 5: 提交持久化与分享**

```powershell
git add -- public/static-site/app.js public/static-site/index.html tests/rendered-html.test.mjs
git commit -m "feat: persist and share editable trips"
```

### Task 10: 接入双格式指南导出

**Files:**
- Modify: `public/static-site/app.js`
- Modify: `public/static-site/index.html`
- Modify: `public/static-site/styles.css`
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: 写 Markdown、HTML 两个导出入口的失败测试**

```js
test("page exposes both guide exports", async () => {
  const html = await readFile(new URL("../public/static-site/index.html", import.meta.url), "utf8");
  assert.match(html, /id="exportMarkdownBtn"/);
  assert.match(html, /id="exportHtmlBtn"/);
});
```

- [ ] **Step 2: 运行测试并确认 HTML 导出入口缺失**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL，缺少 `exportMarkdownBtn`。

- [ ] **Step 3: 使用统一 GuideModel 替换旧导出函数**

新增两个明确命令按钮。`app.js` 构建地点快照 Map、路线段、汇总和 `validateTripPlan` 结果，调用一次 `buildGuideModel`；Markdown 和 HTML 分别调用对应渲染器并用现有 Blob 下载工具下载。导出文件名使用经过清理的行程名称；没有日历时两个按钮均禁用。

删除或停止调用旧 `buildGuideData`、`buildTravelGuideMarkdown` 和只读 `buildItineraryDays`，避免导出继续读取旧路线日程。

- [ ] **Step 4: 运行导出、页面和模型测试**

Run: `node --test tests/guide-export.test.mjs tests/rendered-html.test.mjs tests/trip-plan.test.mjs`

Expected: 全部 PASS。

- [ ] **Step 5: 提交导出集成**

```powershell
git add -- public/static-site/app.js public/static-site/index.html public/static-site/styles.css tests/rendered-html.test.mjs
git commit -m "feat: export calendar travel guides"
```

### Task 11: 同步本地入口、构建并完成桌面/手机验收

**Files:**
- Create: `trip-plan.js`
- Create: `trip-editor.js`
- Create: `guide-export.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [ ] **Step 1: 先让根目录同步检查失败**

Run:

```powershell
Get-FileHash app.js,public/static-site/app.js,index.html,public/static-site/index.html,styles.css,public/static-site/styles.css
```

Expected: 至少 `app.js`、`index.html` 或 `styles.css` 哈希不同，且根目录尚无三个新模块。

- [ ] **Step 2: 机械同步发布入口到根目录**

Run each `Copy-Item` separately:

```powershell
Copy-Item -LiteralPath public/static-site/app.js -Destination app.js
Copy-Item -LiteralPath public/static-site/index.html -Destination index.html
Copy-Item -LiteralPath public/static-site/styles.css -Destination styles.css
Copy-Item -LiteralPath public/static-site/trip-plan.js -Destination trip-plan.js
Copy-Item -LiteralPath public/static-site/trip-editor.js -Destination trip-editor.js
Copy-Item -LiteralPath public/static-site/guide-export.js -Destination guide-export.js
```

- [ ] **Step 3: 运行完整自动化验证**

Run: `npm test`

Expected: 所有 Node tests PASS。

Run: `npm run build`

Expected: vinext build exit 0，`dist/client/static-site/` 包含三个新模块。

Run: `node --check app.js`

Expected: exit 0。

- [ ] **Step 4: 启动静态服务器并执行浏览器验收**

Run: `python -m http.server 4177`

Open: `http://127.0.0.1:4177/?v=calendar-planner-1`

桌面 `1440x900` 验收：

- 创建北京 → 郑州 → 武汉路线。
- 设置开始日期，给郑州增加到三天。
- 拖拽城市和活动，检查地图路线同步。
- 添加 `G123` 跨夜交通、河南博物院活动和住宿。
- 制造时间冲突并看到对应日期提醒。
- 撤销一次、刷新并确认恢复。
- 下载 Markdown、HTML，并打开 HTML 检查打印预览。

手机 `390x844` 验收：

- 地图/行程切换可用。
- 不依赖拖拽，通过指定日期菜单移动城市和活动。
- 编辑抽屉不遮挡提交/取消按钮，文本不溢出。
- 刷新后日期、交通、活动和住宿仍存在。

- [ ] **Step 5: 检查哈希、工作区和提交最终同步**

Run:

```powershell
Get-FileHash app.js,public/static-site/app.js,index.html,public/static-site/index.html,styles.css,public/static-site/styles.css,trip-plan.js,public/static-site/trip-plan.js,trip-editor.js,public/static-site/trip-editor.js,guide-export.js,public/static-site/guide-export.js
```

Expected: 每一对文件哈希一致。

Run: `git diff --check`

Expected: exit 0。

```powershell
git add -- app.js index.html styles.css trip-plan.js trip-editor.js guide-export.js
git commit -m "docs: finish calendar planner rollout"
```

## 最终完成条件

- `npm test` 和 `npm run build` 均成功。
- 三个领域/编辑/导出模块在根目录与 `public/static-site/` 成对一致。
- 旧 v1 存档能够恢复并迁移；非法导入不会覆盖当前行程。
- 桌面拖拽和手机移动菜单都能完成同一项跨日编辑。
- 地图、汇总、保存、分享、Markdown 和 HTML 均读取 `TripPlan v2`。
- 浏览器控制台无未处理错误，桌面和手机截图无重叠、溢出或空白区域。
