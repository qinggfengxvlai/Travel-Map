import { dayDate } from "./trip-plan.js";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const WARNING_LABELS = new Map([
  ["time-overlap", "时间安排存在重叠"],
  ["activity-before-arrival", "活动早于抵达时间"],
  ["lodging-city-mismatch", "住宿城市与过夜城市不一致"],
  ["overnight-city-missing", "过夜城市不在当天路线中"],
  ["missing-time", "仍有项目未填写完整时间"],
  ["travel-over-limit", "跨城时间超过当前节奏上限"],
  ["play-time-short", "当天剩余游玩时间不足两小时"],
  ["lodging-missing", "过夜行程尚未填写住宿"]
]);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identifier(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function childArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function placeLabel(placeId, placeName) {
  let value = placeId;
  if (typeof placeName === "function") {
    try {
      value = placeName(placeId);
    } catch {
      value = placeId;
    }
  }
  const label = value === null || value === undefined || value === "" ? "未命名地点" : value;
  return escapeHtml(label);
}

function safeDayDate(plan, dayIndex) {
  try {
    return dayDate(plan, dayIndex);
  } catch {
    return null;
  }
}

function utcWeekday(dateText) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText ?? "");
  if (!match) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : WEEKDAYS[date.getUTCDay()];
}

function dayHeading(plan, dayIndex) {
  const prefix = `第 ${dayIndex + 1} 天`;
  const date = safeDayDate(plan, dayIndex);
  if (!date) return prefix;
  const weekday = utcWeekday(date);
  return weekday ? `${prefix} · ${escapeHtml(date)} · 星期${weekday}` : `${prefix} · ${escapeHtml(date)}`;
}

function visitTotals(days) {
  const totals = new Map();
  days.forEach((day) => {
    childArray(day.cityEntries).forEach((entry) => {
      const visitId = identifier(entry.visitId);
      if (visitId) totals.set(visitId, (totals.get(visitId) ?? 0) + 1);
    });
  });
  return totals;
}

function dayOptions(plan, days) {
  return days.map((day, dayIndex) => {
    const date = safeDayDate(plan, dayIndex);
    const label = `第 ${dayIndex + 1} 天${date ? ` · ${date}` : ""}`;
    return `<option value="${escapeHtml(day.id)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function moveDayOptions(plan, days) {
  return `<option value="" selected disabled>移动到…</option>${dayOptions(plan, days)}`;
}

function visitMarkup(entry, totals, seenVisits) {
  const visitId = identifier(entry.visitId);
  if (!visitId) return '<span class="visit-progress">停留天数待定</span>';
  const duration = totals.get(visitId) ?? 1;
  const position = (seenVisits.get(visitId) ?? 0) + 1;
  seenVisits.set(visitId, position);
  if (position > 1) {
    return `<span class="visit-progress">停留第 ${position}/${duration} 天</span>`;
  }
  const escapedVisitId = escapeHtml(visitId);
  const decreaseDisabled = duration <= 1 ? " disabled" : "";
  const increaseDisabled = duration >= 7 ? " disabled" : "";
  return `<div class="visit-duration" aria-label="停留天数">
    <button type="button" data-action="decrease-stay" data-visit-id="${escapedVisitId}" data-duration="${duration}" title="减少停留天数" aria-label="减少停留天数"${decreaseDisabled}>−</button>
    <span>停留 ${duration} 天</span>
    <button type="button" data-action="increase-stay" data-visit-id="${escapedVisitId}" data-duration="${duration}" title="增加停留天数" aria-label="增加停留天数"${increaseDisabled}>+</button>
  </div>`;
}

function cityMarkup({ entry, dayIndex, plan, days, placeName, totals, seenVisits }) {
  const entryId = escapeHtml(entry.id);
  return `<div class="city-row" draggable="true" data-drag-kind="city" data-drag-id="${entryId}">
    <span class="drag-handle" title="拖拽移动城市" aria-label="拖拽移动城市">⋮⋮</span>
    <span class="city-name">${placeLabel(entry.placeId, placeName)}</span>
    ${visitMarkup(entry, totals, seenVisits)}
    <label class="move-control">
      <span>移动到</span>
      <select data-action="move-city" data-entry-id="${entryId}" data-target-index="0" title="移动城市" aria-label="移动城市到指定日期">
        ${moveDayOptions(plan, days)}
      </select>
    </label>
    <button type="button" data-action="remove-city" data-entry-id="${entryId}" title="删除城市" aria-label="删除城市">删除</button>
  </div>`;
}

function overnightMarkup(day, placeName) {
  const entries = childArray(day.cityEntries);
  const choices = [];
  const seenPlaceIds = new Set();
  entries.forEach((entry) => {
    const placeId = identifier(entry.placeId);
    if (!placeId || seenPlaceIds.has(placeId)) return;
    seenPlaceIds.add(placeId);
    choices.push(placeId);
  });
  const selectedPlaceId = identifier(day.overnightPlaceId);
  const hasSelectedPlace = selectedPlaceId !== null && seenPlaceIds.has(selectedPlaceId);
  const options = [
    `<option value=""${hasSelectedPlace ? "" : " selected"}>待定</option>`,
    ...choices.map((placeId) =>
      `<option value="${escapeHtml(placeId)}"${placeId === selectedPlaceId ? " selected" : ""}>${placeLabel(placeId, placeName)}</option>`
    )
  ].join("");
  return `<label class="overnight-control">
    <span>过夜城市</span>
    <select data-action="set-overnight" data-day-id="${escapeHtml(day.id)}" title="选择过夜城市" aria-label="选择过夜城市">${options}</select>
  </label>`;
}

function itemTime(item) {
  const startTime = identifier(item.startTime);
  const endTime = identifier(item.endTime);
  if (!startTime || !endTime) return "待补充";
  const nextDay = item.endDayOffset === 1 || item.endDayOffset === "1" ? "次日 " : "";
  return `${escapeHtml(startTime)} – ${nextDay}${escapeHtml(endTime)}`;
}

function itemTitle(item, placeName) {
  if (item.type === "transport") {
    const route = `${placeLabel(item.fromPlaceId, placeName)} → ${placeLabel(item.toPlaceId, placeName)}`;
    const service = identifier(item.serviceNo);
    return service ? `${route} · ${escapeHtml(service)}` : route;
  }
  const title = item.title === null || item.title === undefined || item.title === ""
    ? "未命名活动"
    : item.title;
  return escapeHtml(title);
}

function itemMarkup({ item, day, dayIndex, plan, days, placeName }) {
  const itemId = escapeHtml(item.id);
  const dayId = escapeHtml(day.id);
  return `<li class="timeline-item" draggable="true" data-drag-kind="item" data-drag-id="${itemId}">
    <span class="drag-handle" title="拖拽移动项目" aria-label="拖拽移动项目">⋮⋮</span>
    <div class="timeline-content">
      <strong>${itemTitle(item, placeName)}</strong>
      <time>${itemTime(item)}</time>
    </div>
    <div class="item-actions">
      <button type="button" data-action="edit-item" data-day-id="${dayId}" data-item-id="${itemId}" title="编辑项目" aria-label="编辑项目">编辑</button>
      <button type="button" data-action="copy-item" data-item-id="${itemId}" title="复制项目" aria-label="复制项目">复制</button>
      <label class="move-control">
        <span>移动到</span>
        <select data-action="move-item" data-item-id="${itemId}" data-target-index="0" title="移动项目" aria-label="移动项目到指定日期">
          ${moveDayOptions(plan, days)}
        </select>
      </label>
      <button type="button" data-action="remove-item" data-item-id="${itemId}" title="删除项目" aria-label="删除项目">删除</button>
    </div>
  </li>`;
}

function lodgingMarkup(lodging, placeName) {
  if (!isRecord(lodging)) {
    return '<div class="lodging-summary"><strong>住宿</strong><span>待补充</span></div>';
  }
  const details = [];
  if (identifier(lodging.placeId)) details.push(placeLabel(lodging.placeId, placeName));
  if (lodging.name !== null && lodging.name !== undefined && lodging.name !== "") {
    details.push(escapeHtml(lodging.name));
  }
  if (lodging.address !== null && lodging.address !== undefined && lodging.address !== "") {
    details.push(escapeHtml(lodging.address));
  }
  if (identifier(lodging.checkInTime)) details.push(`入住 ${escapeHtml(lodging.checkInTime)}`);
  if (identifier(lodging.checkOutTime)) details.push(`退房 ${escapeHtml(lodging.checkOutTime)}`);
  if (lodging.note !== null && lodging.note !== undefined && lodging.note !== "") {
    details.push(escapeHtml(lodging.note));
  }
  return `<div class="lodging-summary"><strong>住宿</strong><span>${details.join(" · ") || "信息待补充"}</span></div>`;
}

function warningMarkup(warnings) {
  if (!warnings.length) return "";
  return `<ul class="day-warnings">${warnings.map((warning) => {
    const code = typeof warning.code === "string" ? warning.code : "";
    const knownLabel = WARNING_LABELS.get(code);
    const label = knownLabel ?? (code
      ? `请检查当天安排（${escapeHtml(code)}）`
      : "请检查当天安排");
    return `<li>${label}</li>`;
  }).join("")}</ul>`;
}

export function renderTripEditorMarkup({ plan, warnings = [], placeName } = {}) {
  if (!Array.isArray(plan?.days) || plan.days.length === 0) return "";
  const days = plan.days.map((day) => isRecord(day) ? day : {});
  const safeWarnings = childArray(warnings);
  const totals = visitTotals(days);
  const seenVisits = new Map();

  return `<ol class="itinerary-list">${days.map((day, dayIndex) => {
    const entries = childArray(day.cityEntries);
    const items = childArray(day.items);
    const route = entries.length
      ? entries.map((entry) => placeLabel(entry.placeId, placeName)).join(" → ")
      : "路线待定";
    const dayWarnings = safeWarnings.filter((warning) => warning.dayId === day.id);
    return `<li class="day-card" data-day-id="${escapeHtml(day.id)}" data-drop-day="${escapeHtml(day.id)}">
      <header class="day-header">
        <p class="day-heading">${dayHeading(plan, dayIndex)}</p>
        <h3>${route}</h3>
        ${overnightMarkup(day, placeName)}
      </header>
      <div class="city-list">
        ${entries.map((entry) => cityMarkup({
          entry,
          dayIndex,
          plan,
          days,
          placeName,
          totals,
          seenVisits
        })).join("")}
      </div>
      <ol class="timeline-list">
        ${items.length ? items.map((item) => itemMarkup({ item, day, dayIndex, plan, days, placeName })).join("") : '<li class="timeline-empty">当天暂无项目</li>'}
      </ol>
      ${lodgingMarkup(day.lodging, placeName)}
      ${warningMarkup(dayWarnings)}
      <div class="day-actions">
        <button type="button" data-action="add-transport" data-day-id="${escapeHtml(day.id)}" title="添加交通" aria-label="添加交通">添加交通</button>
        <button type="button" data-action="add-activity" data-day-id="${escapeHtml(day.id)}" title="添加活动" aria-label="添加活动">添加活动</button>
        <button type="button" data-action="edit-lodging" data-day-id="${escapeHtml(day.id)}" title="编辑住宿" aria-label="编辑住宿">编辑住宿</button>
      </div>
    </li>`;
  }).join("")}</ol>`;
}

function safeInteger(value, minimum) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^(?:0|[1-9]\d*)$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) return null;
  return number;
}

export function commandForAction(data) {
  if (!isRecord(data) || !identifier(data.action)) return null;
  const action = data.action;
  if (action === "move-city" || action === "move-item") {
    const sourceKey = action === "move-city" ? "entryId" : "itemId";
    const sourceId = identifier(data[sourceKey]);
    const targetDayId = identifier(data.targetDayId);
    const targetIndex = safeInteger(data.targetIndex, 0);
    if (!sourceId || !targetDayId || targetIndex === null) return null;
    return { type: action, [sourceKey]: sourceId, targetDayId, targetIndex };
  }
  if (action === "set-overnight") {
    const dayId = identifier(data.dayId);
    if (!dayId || !Object.hasOwn(data, "placeId")) return null;
    if (data.placeId === null || (typeof data.placeId === "string" && !data.placeId.trim())) {
      return { type: action, dayId, placeId: null };
    }
    const placeId = identifier(data.placeId);
    return placeId ? { type: action, dayId, placeId } : null;
  }
  if (action === "remove-city") {
    const entryId = identifier(data.entryId);
    return entryId ? { type: action, entryId } : null;
  }
  if (action === "copy-item" || action === "remove-item") {
    const itemId = identifier(data.itemId);
    return itemId ? { type: action, itemId } : null;
  }
  if (action === "increase-stay" || action === "decrease-stay") {
    const visitId = identifier(data.visitId);
    const duration = safeInteger(data.duration, 1);
    if (!visitId || duration === null) return null;
    const targetDuration = duration + (action === "increase-stay" ? 1 : -1);
    if (targetDuration < 1 || targetDuration > 7) return null;
    return {
      type: "set-visit-duration",
      visitId,
      duration: targetDuration
    };
  }
  return null;
}

const TRIP_DRAG_TYPE = "application/x-trip-entry";
const EDIT_ACTIONS = new Set([
  "add-transport",
  "add-activity",
  "edit-item",
  "edit-lodging"
]);
const MOUNT_CLEANUPS = new WeakMap();

function delegatedTarget(root, event, selector) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return null;
  const matched = target.closest(selector);
  if (!matched) return null;
  if (typeof root.contains === "function" && !root.contains(matched)) return null;
  return matched;
}

export function mountTripEditor(options = {}) {
  const { root, onCommand, onEditRequest } = options ?? {};
  if (!root || typeof root.addEventListener !== "function" || typeof root.removeEventListener !== "function") {
    throw new TypeError("mountTripEditor root must support addEventListener and removeEventListener");
  }
  if (typeof onCommand !== "function") {
    throw new TypeError("mountTripEditor onCommand must be a function");
  }
  if (typeof onEditRequest !== "function") {
    throw new TypeError("mountTripEditor onEditRequest must be a function");
  }
  MOUNT_CLEANUPS.get(root)?.();

  const onClick = (event) => {
    const control = delegatedTarget(root, event, "[data-action]");
    if (!control) return;
    if (EDIT_ACTIONS.has(control.dataset?.action)) {
      onEditRequest({ ...control.dataset });
      return;
    }
    const command = commandForAction(control.dataset);
    if (command) onCommand(command);
  };

  const onChange = (event) => {
    const control = delegatedTarget(root, event, "[data-action]");
    if (!control) return;
    const data = { ...control.dataset };
    if (data.action === "move-city" || data.action === "move-item") {
      data.targetDayId = control.value;
    } else if (data.action === "set-overnight") {
      data.placeId = control.value;
    } else {
      return;
    }
    const command = commandForAction(data);
    if (command) onCommand(command);
  };

  const onDragStart = (event) => {
    const draggable = delegatedTarget(root, event, "[data-drag-kind][data-drag-id]");
    if (!draggable || typeof event?.dataTransfer?.setData !== "function") return;
    const kind = identifier(draggable.dataset?.dragKind);
    const id = identifier(draggable.dataset?.dragId);
    if ((kind !== "city" && kind !== "item") || !id) return;
    try {
      event.dataTransfer.setData(TRIP_DRAG_TYPE, JSON.stringify({ kind, id }));
    } catch {
      // Some browser integrations can reject custom drag types.
    }
  };

  const onDragOver = (event) => {
    if (!delegatedTarget(root, event, "[data-drop-day]")) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
  };

  const onDrop = (event) => {
    const dropTarget = delegatedTarget(root, event, "[data-drop-day]");
    if (!dropTarget) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    const targetDayId = identifier(dropTarget.dataset?.dropDay);
    if (!targetDayId || typeof event?.dataTransfer?.getData !== "function") return;

    let payload;
    try {
      payload = JSON.parse(event.dataTransfer.getData(TRIP_DRAG_TYPE));
    } catch {
      return;
    }
    if (!isRecord(payload) || (payload.kind !== "city" && payload.kind !== "item")) return;
    const id = identifier(payload.id);
    if (!id) return;
    const command = commandForAction(payload.kind === "city"
      ? { action: "move-city", entryId: id, targetDayId, targetIndex: 0 }
      : { action: "move-item", itemId: id, targetDayId, targetIndex: 0 });
    if (command) onCommand(command);
  };

  const listeners = [
    ["click", onClick],
    ["change", onChange],
    ["dragstart", onDragStart],
    ["dragover", onDragOver],
    ["drop", onDrop]
  ];
  listeners.forEach(([type, listener]) => root.addEventListener(type, listener));

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    listeners.forEach(([type, listener]) => root.removeEventListener(type, listener));
    if (MOUNT_CLEANUPS.get(root) === cleanup) MOUNT_CLEANUPS.delete(root);
  };
  MOUNT_CLEANUPS.set(root, cleanup);
  return cleanup;
}
