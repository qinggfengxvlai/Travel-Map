import { dayDate, timeToMinutes } from "./trip-plan.js?v=progressive-2";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const WARNING_LABELS = {
  "missing-time": "时间信息缺失",
  "time-overlap": "时间安排重叠",
  "activity-before-arrival": "活动早于抵达时间",
  "lodging-city-mismatch": "住宿城市与过夜城市不一致",
  "overnight-city-missing": "过夜城市不在当天城市中",
  "travel-over-limit": "跨城交通超过当日强度上限",
  "play-time-short": "可游览时间不足 2 小时",
  "lodging-missing": "住宿信息缺失"
};

const PACE_LABELS = {
  relaxed: "轻松",
  standard: "标准",
  compact: "紧凑"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\r\n?|\n/g, "；")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_{}[\]()#+!|])/g, "\\$1");
}

function cloneValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());

  if (value instanceof Map) {
    const clone = new Map();
    seen.set(value, clone);
    value.forEach((entryValue, key) => clone.set(cloneValue(key, seen), cloneValue(entryValue, seen)));
    return clone;
  }

  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    value.forEach((entryValue) => clone.add(cloneValue(entryValue, seen)));
    return clone;
  }

  const clone = Array.isArray(value) ? [] : {};
  seen.set(value, clone);
  Object.keys(value).forEach((key) => {
    try {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: cloneValue(value[key], seen)
      });
    } catch {
      // Ignore unreadable external fields while preserving the rest of the export.
    }
  });
  return clone;
}

function scalarText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return null;
}

function displayText(value, fallback = "") {
  const text = scalarText(value);
  return text === null || text === "" ? fallback : text;
}

function firstText(values) {
  for (const value of values) {
    const text = scalarText(value);
    if (text !== null && text !== "") return text;
  }
  return null;
}

function weekdayFor(dateValue) {
  if (typeof dateValue !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return WEEKDAYS[date.getUTCDay()] ?? null;
}

function dateForDay(plan, dayIndex) {
  try {
    return dayDate(plan, dayIndex);
  } catch {
    return null;
  }
}

function fallbackPlace(placeId) {
  return { id: placeId, name: placeId };
}

function buildPlaceResolver(placeSnapshots) {
  return (placeId) => {
    if (!(placeSnapshots instanceof Map)) return fallbackPlace(placeId);
    try {
      const snapshot = placeSnapshots.get(placeId);
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        return fallbackPlace(placeId);
      }
      const clone = cloneValue(snapshot);
      return {
        ...clone,
        id: clone.id ?? placeId,
        name: clone.name ?? placeId
      };
    } catch {
      return fallbackPlace(placeId);
    }
  };
}

function sortedItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      index,
      item: cloneValue(item),
      minutes: timeToMinutes(item?.startTime)
    }))
    .sort((left, right) => {
      if (left.minutes === null && right.minutes === null) return left.index - right.index;
      if (left.minutes === null) return 1;
      if (right.minutes === null) return -1;
      return left.minutes - right.minutes || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function buildGuideModel({
  plan,
  placeSnapshots,
  warnings = [],
  routeSegments = [],
  totals = null
} = {}) {
  const sourcePlan = plan && typeof plan === "object" ? plan : { days: [] };
  const sourceDays = Array.isArray(sourcePlan.days) ? sourcePlan.days : [];
  const sourceWarnings = Array.isArray(warnings) ? warnings : [];
  const placeFor = buildPlaceResolver(placeSnapshots);

  return {
    id: cloneValue(sourcePlan.id ?? null),
    version: cloneValue(sourcePlan.version ?? null),
    title: cloneValue(sourcePlan.name || "我的旅行"),
    startDate: cloneValue(sourcePlan.startDate ?? null),
    pace: cloneValue(sourcePlan.pace ?? null),
    routeSegments: Array.isArray(routeSegments) ? cloneValue(routeSegments) : [],
    totals: totals === null || totals === undefined ? null : cloneValue(totals),
    days: sourceDays.map((sourceDay, index) => {
      const day = sourceDay && typeof sourceDay === "object" ? sourceDay : {};
      const clone = cloneValue(day);
      const date = dateForDay(sourcePlan, index);
      const cityEntries = Array.isArray(day.cityEntries) ? day.cityEntries : [];
      const dayWarnings = sourceWarnings
        .filter((warning) => warning?.dayId === day.id)
        .map((warning) => cloneValue(warning));

      return {
        ...clone,
        dayNumber: index + 1,
        date,
        weekday: weekdayFor(date),
        places: cityEntries.map((entry) => placeFor(entry?.placeId)),
        overnightPlace: day.overnightPlaceId === null || day.overnightPlaceId === undefined
          ? null
          : placeFor(day.overnightPlaceId),
        items: sortedItems(day.items),
        lodging: day.lodging === null || day.lodging === undefined ? null : cloneValue(day.lodging),
        warnings: dayWarnings
      };
    })
  };
}

function placeName(place, fallbackId = null) {
  return firstText([place?.name, place?.id, fallbackId]) ?? "待定";
}

function buildPlaceNameIndex(model) {
  const index = new Map();
  const add = (place) => {
    const id = scalarText(place?.id);
    if (id !== null && !index.has(id)) index.set(id, placeName(place));
  };
  (Array.isArray(model?.days) ? model.days : []).forEach((day) => {
    (Array.isArray(day?.places) ? day.places : []).forEach(add);
    if (day?.overnightPlace) add(day.overnightPlace);
  });
  return index;
}

function indexedPlaceName(placeIndex, placeId) {
  const id = scalarText(placeId);
  if (id === null || id === "") return "待定";
  return placeIndex.get(id) ?? id;
}

function nestedName(value) {
  if (!value || typeof value !== "object") return scalarText(value);
  return firstText([value.name, value.label, value.id]);
}

function segmentEndpoint(segment, side, placeIndex) {
  const endpoint = segment?.[side];
  const endpointPlace = segment?.[`${side}Place`];
  const direct = firstText([
    segment?.[`${side}Name`],
    segment?.[`${side}PlaceName`],
    endpoint && typeof endpoint === "object" ? firstText([endpoint.name, endpoint.label]) : null,
    endpointPlace && typeof endpointPlace === "object"
      ? firstText([endpointPlace.name, endpointPlace.label])
      : null
  ]);
  if (direct) return direct;
  const id = firstText([
    segment?.[`${side}PlaceId`],
    segment?.[`${side}Id`],
    endpoint && typeof endpoint === "object" ? endpoint.id : endpoint,
    endpointPlace && typeof endpointPlace === "object" ? endpointPlace.id : endpointPlace
  ]);
  return indexedPlaceName(placeIndex, id);
}

function formatDistanceMeters(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return scalarText(value);
  if (value < 1000) return `${Math.round(value)} 米`;
  const kilometres = Math.round(value / 100) / 10;
  return `${kilometres} 公里`;
}

function formatDurationSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return scalarText(value);
  const totalMinutes = Math.max(0, Math.round(value / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return minutes ? `${minutes} 分钟` : "不足 1 分钟";
  return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
}

function segmentDistance(segment) {
  const text = firstText([segment?.distanceText]);
  if (text) return text;
  if (segment?.distanceMeters !== undefined) return formatDistanceMeters(segment.distanceMeters);
  if (segment?.distance !== undefined) {
    return typeof segment.distance === "number"
      ? formatDistanceMeters(segment.distance)
      : scalarText(segment.distance);
  }
  return null;
}

function segmentDuration(segment) {
  const text = firstText([segment?.durationText]);
  if (text) return text;
  if (segment?.durationSeconds !== undefined) return formatDurationSeconds(segment.durationSeconds);
  if (segment?.duration !== undefined) {
    return typeof segment.duration === "number"
      ? formatDurationSeconds(segment.duration)
      : scalarText(segment.duration);
  }
  return null;
}

function segmentPresentation(segment, placeIndex, index) {
  if (!segment || typeof segment !== "object") {
    return {
      headline: displayText(segment, `第 ${index + 1} 段`),
      facts: []
    };
  }

  const from = segmentEndpoint(segment, "from", placeIndex);
  const to = segmentEndpoint(segment, "to", placeIndex);
  const label = firstText([segment.label, segment.name]);
  const headline = from === "待定" && to === "待定" && label
    ? label
    : `${from} → ${to}`;
  const facts = [];
  const transport = firstText([
    segment.transportLabel,
    segment.modeLabel,
    segment.transport,
    segment.mode
  ]);
  const serviceNo = firstText([segment.serviceNo, segment.trainNo, segment.flightNo]);
  const distance = segmentDistance(segment);
  const duration = segmentDuration(segment);
  const note = firstText([segment.note]);
  const error = firstText([segment.error]);
  const status = firstText([segment.status]);

  if (label && headline !== label) facts.push({ label: "路段", value: label });
  if (transport) facts.push({ label: "方式", value: transport });
  if (serviceNo) facts.push({ label: "车次/班次", value: serviceNo });
  if (distance) facts.push({ label: "距离", value: distance });
  if (duration) facts.push({ label: "时长", value: duration });
  if (segment.fallback === true) facts.push({ label: "测算", value: "估算" });
  if (status && status !== "ready") facts.push({ label: "状态", value: status });
  if (note) facts.push({ label: "备注", value: note });
  if (error) facts.push({ label: "说明", value: error });
  return { headline, facts };
}

function fallbackRoutePlaces(model) {
  const flattened = (Array.isArray(model?.days) ? model.days : [])
    .flatMap((day) => Array.isArray(day?.places) ? day.places : []);
  const route = [];
  flattened.forEach((place) => {
    const key = firstText([place?.id, place?.name]);
    const previous = route.at(-1);
    if (key !== null && key === previous?.key) return;
    route.push({ key, name: placeName(place) });
  });
  return route.map(({ name }) => name);
}

function routePresentation(model) {
  const placeIndex = buildPlaceNameIndex(model);
  const routeSegments = Array.isArray(model?.routeSegments) ? model.routeSegments : [];
  if (routeSegments.length) {
    return {
      type: "segments",
      segments: routeSegments.map((segment, index) => segmentPresentation(segment, placeIndex, index))
    };
  }
  return { type: "path", places: fallbackRoutePlaces(model) };
}

function safeProperty(object, key) {
  try {
    return object?.[key];
  } catch {
    return undefined;
  }
}

function totalMetric(totals, keys, formatter) {
  for (const key of keys) {
    const value = safeProperty(totals, key);
    if (value === null || value === undefined || value === "") continue;
    const formatted = formatter(value, key);
    if (formatted !== null && formatted !== "") return formatted;
  }
  return null;
}

function totalEntries(totals) {
  if (totals === null || totals === undefined) return [];
  if (typeof totals !== "object") {
    const value = scalarText(totals);
    return value === null ? [] : [{ label: "汇总", value }];
  }

  const entries = [];
  const distance = totalMetric(
    totals,
    ["distanceText", "distance", "distanceMeters"],
    (value, key) => key === "distanceText" || typeof value !== "number"
      ? scalarText(value)
      : formatDistanceMeters(value)
  );
  const duration = totalMetric(
    totals,
    ["durationText", "duration", "durationSeconds"],
    (value, key) => key === "durationText" || typeof value !== "number"
      ? scalarText(value)
      : formatDurationSeconds(value)
  );
  if (distance) entries.push({ label: "总距离", value: distance });
  if (duration) entries.push({ label: "总时长", value: duration });

  const knownKeys = new Set([
    "distanceText", "distance", "distanceMeters",
    "durationText", "duration", "durationSeconds"
  ]);
  const labels = {
    measuredSegmentCount: "已测路段",
    segmentCount: "路段数",
    dayCount: "行程天数",
    cost: "预计费用",
    budget: "预算"
  };
  Object.keys(totals).forEach((key) => {
    if (knownKeys.has(key)) return;
    const value = scalarText(safeProperty(totals, key));
    if (value === null || value === "") return;
    entries.push({ label: labels[key] ?? key, value });
  });
  return entries;
}

function paceText(pace) {
  const direct = scalarText(pace);
  if (direct !== null && direct !== "") {
    return PACE_LABELS[direct] ? `${PACE_LABELS[direct]}（${direct}）` : direct;
  }
  if (pace && typeof pace === "object") {
    return firstText([pace.label, pace.name, pace.code, pace.id]) ?? "未设置";
  }
  return "未设置";
}

function timeRange(item) {
  const start = displayText(item?.startTime, "待定");
  const end = displayText(item?.endTime, "待定");
  if (start === "待定" && end === "待定") return "时间待定";
  return `${start}-${end}${Number(item?.endDayOffset) === 1 ? "（次日）" : ""}`;
}

function itemPlaceName(item, prefix, placeIndex) {
  const direct = firstText([
    item?.[`${prefix}PlaceName`],
    item?.[`${prefix}Name`],
    nestedName(item?.[`${prefix}Place`])
  ]);
  if (direct) return direct;
  return indexedPlaceName(placeIndex, firstText([
    item?.[`${prefix}PlaceId`],
    item?.[`${prefix}Id`],
    item?.[`${prefix}Place`]?.id
  ]));
}

function itemPresentation(item, placeIndex) {
  const type = scalarText(item?.type);
  if (type === "transport") {
    const from = itemPlaceName(item, "from", placeIndex);
    const to = itemPlaceName(item, "to", placeIndex);
    const facts = [];
    const serviceNo = firstText([item.serviceNo, item.trainNo, item.flightNo, item.number]);
    const title = firstText([item.title]);
    const note = firstText([item.note]);
    if (serviceNo) facts.push({ label: "车次/班次", value: serviceNo });
    if (title) facts.push({ label: "事项", value: title });
    if (note) facts.push({ label: "备注", value: note });
    return { time: timeRange(item), kind: "交通", headline: `${from} → ${to}`, facts };
  }

  if (type === "activity") {
    const facts = [];
    const location = indexedPlaceName(placeIndex, item.placeId);
    const note = firstText([item.note]);
    if (location !== "待定") facts.push({ label: "地点", value: location });
    if (note) facts.push({ label: "备注", value: note });
    return {
      time: timeRange(item),
      kind: "活动",
      headline: firstText([item.title, item.name]) ?? "未命名活动",
      facts
    };
  }

  const facts = [];
  const location = indexedPlaceName(placeIndex, item?.placeId);
  const note = firstText([item?.note]);
  if (location !== "待定") facts.push({ label: "地点", value: location });
  if (note) facts.push({ label: "备注", value: note });
  return {
    time: timeRange(item),
    kind: displayText(type, "行程"),
    headline: firstText([item?.title, item?.name]) ?? "未命名项目",
    facts
  };
}

function lodgingPresentation(lodging, placeIndex) {
  if (!lodging || typeof lodging !== "object") return null;
  const facts = [];
  const location = indexedPlaceName(placeIndex, lodging.placeId);
  const address = firstText([lodging.address]);
  const checkIn = firstText([lodging.checkInTime]);
  const checkOut = firstText([lodging.checkOutTime]);
  const note = firstText([lodging.note]);
  if (location !== "待定") facts.push({ label: "地点", value: location });
  if (address) facts.push({ label: "地址", value: address });
  if (checkIn) facts.push({ label: "入住", value: checkIn });
  if (checkOut) facts.push({ label: "退房", value: checkOut });
  if (note) facts.push({ label: "备注", value: note });
  return { name: firstText([lodging.name]) ?? "住宿待定", facts };
}

function warningText(warning) {
  const code = scalarText(warning?.code);
  const label = code ? (WARNING_LABELS[code] ?? code) : "未知提醒";
  const detail = firstText([warning?.message, warning?.note]);
  return detail ? `${label}：${detail}` : label;
}

function dayHeading(day) {
  const parts = [`第 ${displayText(day?.dayNumber, "?")} 天`];
  const date = scalarText(day?.date);
  const weekday = scalarText(day?.weekday);
  if (date) parts.push(date);
  if (weekday) parts.push(weekday);
  return parts;
}

function markdownFacts(facts) {
  return facts.map((fact) => `｜${escapeMarkdown(fact.label)}：${escapeMarkdown(fact.value)}`).join("");
}

export function buildMarkdownGuide(model) {
  const days = Array.isArray(model?.days) ? model.days : [];
  const route = routePresentation(model);
  const totals = totalEntries(model?.totals);
  const placeIndex = buildPlaceNameIndex(model);
  const lines = [
    `# ${escapeMarkdown(displayText(model?.title, "我的旅行"))}`,
    "",
    "旅行指南",
    "",
    `- 出发日期：${escapeMarkdown(displayText(model?.startDate, "待定"))}`,
    `- 行程天数：${days.length} 天`,
    `- 行程节奏：${escapeMarkdown(paceText(model?.pace))}`,
    "",
    "## 路线概览",
    ""
  ];

  if (route.type === "segments") {
    route.segments.forEach((segment) => {
      lines.push(`- ${escapeMarkdown(segment.headline)}${markdownFacts(segment.facts)}`);
    });
  } else {
    lines.push(`- 路线：${route.places.length ? route.places.map(escapeMarkdown).join(" → ") : "待定"}`);
  }
  totals.forEach((entry) => {
    lines.push(`- ${escapeMarkdown(entry.label)}：${escapeMarkdown(entry.value)}`);
  });
  if (!totals.length) lines.push("- 暂无可用的里程与时长汇总");

  lines.push("", "## 每日时间轴", "");
  days.forEach((day) => {
    const heading = dayHeading(day).map(escapeMarkdown).join("｜");
    const cities = (Array.isArray(day?.places) ? day.places : []).map((place) => placeName(place));
    const overnight = day?.overnightPlace ? placeName(day.overnightPlace) : "待定";
    lines.push(`### ${heading}`);
    lines.push("");
    lines.push(`- 城市顺序：${cities.length ? cities.map(escapeMarkdown).join(" → ") : "待定"}`);
    lines.push(`- 过夜城市：${escapeMarkdown(overnight)}`);
    const dayItems = Array.isArray(day?.items) ? day.items : [];
    dayItems.forEach((item) => {
      const presentation = itemPresentation(item, placeIndex);
      lines.push(`- ${escapeMarkdown(presentation.time)}｜${escapeMarkdown(presentation.kind)}｜${escapeMarkdown(presentation.headline)}${markdownFacts(presentation.facts)}`);
    });
    if (!dayItems.length) lines.push("- 当天暂无时间轴安排");
    const lodging = lodgingPresentation(day?.lodging, placeIndex);
    if (lodging) {
      lines.push(`- 住宿｜${escapeMarkdown(lodging.name)}${markdownFacts(lodging.facts)}`);
    } else {
      lines.push("- 住宿：待定");
    }
    const warningLines = (Array.isArray(day?.warnings) ? day.warnings : []).map(warningText);
    if (warningLines.length) {
      lines.push(`- 当日提醒：${warningLines.map(escapeMarkdown).join("；")}`);
    }
    lines.push("");
  });

  lines.push(
    "## 行前检查",
    "",
    "- [ ] 核对交通车次、票务与出发站",
    "- [ ] 确认景点预约和开放时间",
    "- [ ] 确认住宿地址与入住规则",
    "- [ ] 检查证件、天气和随身物品",
    "",
    "## 数据说明",
    "",
    "- 每日日期按行程起始日期顺延生成；未设置起始日期时仅显示天数。",
    "- 路线距离与时长为规划参考，出发前请以实际交通信息为准。",
    "- 未填写或无效的开始时间会排在当天时间轴末尾。",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function htmlFacts(facts) {
  if (!facts.length) return "";
  return `<p class="facts">${facts.map((fact) => `<span><b>${escapeHtml(fact.label)}：</b>${escapeHtml(fact.value)}</span>`).join("")}</p>`;
}

function buildRouteHtml(route) {
  if (route.type === "segments") {
    return `<ol class="route-list">${route.segments.map((segment, index) => `
        <li class="route-item">
          <span class="route-index">${index + 1}</span>
          <div><p class="route-title">${escapeHtml(segment.headline)}</p>${htmlFacts(segment.facts)}</div>
        </li>`).join("")}
      </ol>`;
  }
  if (!route.places.length) return `<p class="empty-state">路线待定</p>`;
  return `<p class="route-path">${route.places.map(escapeHtml).join('<span aria-hidden="true"> → </span>')}</p>`;
}

function buildTotalsHtml(totals) {
  if (!totals.length) return `<p class="total-empty">暂无可用的里程与时长汇总</p>`;
  return `<dl class="totals">${totals.map((entry) => `
        <div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`).join("")}
      </dl>`;
}

function buildDayHtml(day, placeIndex) {
  const heading = dayHeading(day).map(escapeHtml).join("｜");
  const cities = (Array.isArray(day?.places) ? day.places : []).map((place) => placeName(place));
  const overnight = day?.overnightPlace ? placeName(day.overnightPlace) : "待定";
  const items = (Array.isArray(day?.items) ? day.items : []).map((item) => itemPresentation(item, placeIndex));
  const lodging = lodgingPresentation(day?.lodging, placeIndex);
  const warnings = (Array.isArray(day?.warnings) ? day.warnings : []).map(warningText);
  const timeline = items.length
    ? `<ol class="timeline-list">${items.map((item) => `
          <li class="timeline-item">
            <div class="event-time">${escapeHtml(item.time)}</div>
            <div class="event-copy">
              <p class="event-title"><span class="event-kind">${escapeHtml(item.kind)}</span>${escapeHtml(item.headline)}</p>
              ${htmlFacts(item.facts)}
            </div>
          </li>`).join("")}
        </ol>`
    : `<p class="empty-state">当天暂无时间轴安排</p>`;
  const lodgingHtml = lodging
    ? `<div class="lodging-block"><h4>住宿</h4><p class="lodging-name">${escapeHtml(lodging.name)}</p>${htmlFacts(lodging.facts)}</div>`
    : `<div class="lodging-block"><h4>住宿</h4><p class="empty-state">待定</p></div>`;
  const warningsHtml = warnings.length
    ? `<aside class="warning-block"><h4>当日提醒</h4><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></aside>`
    : "";

  return `<article class="day-block">
      <header class="day-heading"><h3>${heading}</h3></header>
      <div class="day-meta">
        <p><span>城市顺序</span><strong>${cities.length ? cities.map(escapeHtml).join(" → ") : "待定"}</strong></p>
        <p><span>过夜城市</span><strong>${escapeHtml(overnight)}</strong></p>
      </div>
      ${timeline}
      ${lodgingHtml}
      ${warningsHtml}
    </article>`;
}

export function buildPrintableHtml(model) {
  const days = Array.isArray(model?.days) ? model.days : [];
  const route = routePresentation(model);
  const totals = totalEntries(model?.totals);
  const placeIndex = buildPlaceNameIndex(model);
  const title = displayText(model?.title, "我的旅行");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}｜旅行指南</title>
  <style>
    @page { size: A4; margin: 15mm 14mm 17mm; }
    :root {
      color-scheme: light;
      --ink: #20272d;
      --muted: #657078;
      --line: #cfd6d3;
      --paper: #ffffff;
      --screen: #edf0ee;
      --accent: #24666b;
      --accent-soft: #e8f1ef;
      --warning: #8a5717;
      --warning-soft: #fff4df;
    }
    * { box-sizing: border-box; }
    html { background: var(--screen); }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--screen);
      font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.65;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .guide {
      width: min(100% - 32px, 900px);
      margin: 28px auto;
      padding: 42px 48px 52px;
      background: var(--paper);
      border: 1px solid #dde2df;
      box-shadow: 0 8px 24px rgba(23, 37, 34, 0.08);
    }
    .cover {
      padding: 0 0 28px;
      border-bottom: 2px solid var(--ink);
    }
    .cover-label {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
    }
    h1, h2, h3, h4, p, dl, ol, ul { margin-top: 0; }
    h1 { margin-bottom: 24px; font-size: 32px; line-height: 1.25; font-weight: 750; }
    h2 { margin: 0 0 20px; font-size: 21px; line-height: 1.35; }
    h3 { margin: 0; font-size: 18px; line-height: 1.4; }
    h4 { margin-bottom: 8px; font-size: 14px; }
    .cover-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px 24px;
      margin: 0;
    }
    .cover-summary div, .totals div { min-width: 0; }
    dt { color: var(--muted); font-size: 12px; }
    dd { margin: 2px 0 0; font-weight: 650; }
    .guide-section { padding: 30px 0; border-bottom: 1px solid var(--line); }
    .route-list, .timeline-list { margin: 0; padding: 0; list-style: none; }
    .route-item {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--line);
    }
    .route-item:first-child { border-top: 0; padding-top: 0; }
    .route-index {
      display: grid;
      width: 26px;
      height: 26px;
      place-items: center;
      color: #ffffff;
      background: var(--accent);
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
    }
    .route-title, .event-title, .lodging-name { margin-bottom: 4px; font-weight: 700; }
    .route-path { margin: 0; font-size: 17px; font-weight: 700; }
    .route-path span { padding: 0 7px; color: var(--accent); }
    .facts { display: flex; flex-wrap: wrap; gap: 2px 16px; margin: 0; color: var(--muted); font-size: 12.5px; }
    .facts span { min-width: 0; }
    .facts b { color: var(--ink); font-weight: 600; }
    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
      gap: 12px;
      margin: 22px 0 0;
      padding-top: 18px;
      border-top: 1px solid var(--line);
    }
    .total-empty { margin: 20px 0 0; color: var(--muted); }
    .day-block {
      padding: 22px 0 26px;
      border-top: 2px solid var(--ink);
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .day-block:first-of-type { padding-top: 0; border-top: 0; }
    .day-heading { margin-bottom: 14px; }
    .day-meta {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(120px, 1fr);
      gap: 10px 24px;
      margin-bottom: 18px;
      padding: 10px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .day-meta p { display: grid; gap: 2px; margin: 0; }
    .day-meta span { color: var(--muted); font-size: 12px; }
    .timeline-item {
      display: grid;
      grid-template-columns: 126px minmax(0, 1fr);
      gap: 16px;
      position: relative;
      padding: 10px 0 13px;
    }
    .timeline-item::before {
      content: "";
      position: absolute;
      left: 133px;
      top: 17px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent);
    }
    .event-time { color: var(--accent); font-variant-numeric: tabular-nums; font-weight: 700; }
    .event-copy { padding-left: 14px; border-left: 1px solid var(--line); }
    .event-kind {
      display: inline-block;
      margin-right: 8px;
      padding: 1px 6px;
      color: var(--accent);
      background: var(--accent-soft);
      border-radius: 4px;
      font-size: 11px;
      vertical-align: 1px;
    }
    .lodging-block { margin-top: 12px; padding: 14px 0 0; border-top: 1px solid var(--line); }
    .warning-block {
      margin-top: 16px;
      padding: 11px 14px;
      color: var(--warning);
      background: var(--warning-soft);
      border-left: 3px solid var(--warning);
    }
    .warning-block h4 { color: var(--warning); }
    .warning-block ul { margin: 0; padding-left: 20px; }
    .empty-state { margin: 0; color: var(--muted); }
    .checklist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 22px; margin: 0; padding: 0; list-style: none; }
    .checklist li { position: relative; padding-left: 24px; }
    .checklist li::before { content: ""; position: absolute; left: 0; top: 5px; width: 13px; height: 13px; border: 1px solid var(--muted); }
    .data-notes { margin: 0; padding-left: 20px; color: var(--muted); }
    .guide-footer { padding-top: 18px; color: var(--muted); font-size: 12px; }
    @media screen and (max-width: 680px) {
      .guide { width: 100%; margin: 0; padding: 28px 20px 36px; border: 0; box-shadow: none; }
      h1 { font-size: 27px; }
      .cover-summary, .checklist { grid-template-columns: 1fr; }
      .day-meta { grid-template-columns: 1fr; }
      .timeline-item { grid-template-columns: 1fr; gap: 4px; }
      .timeline-item::before { display: none; }
      .event-copy { padding-left: 10px; }
    }
    @media print {
      html, body { background: #ffffff; }
      body { font-size: 10.5pt; line-height: 1.55; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .guide { width: auto; margin: 0; padding: 0; border: 0; box-shadow: none; }
      .cover { padding-bottom: 20px; }
      .guide-section { padding: 22px 0; }
      .day-block, .route-item, .timeline-item, .lodging-block, .warning-block { break-inside: avoid-page; page-break-inside: avoid; }
      h1, h2, h3, h4 { break-after: avoid-page; page-break-after: avoid; }
      .guide-footer { padding-top: 12px; }
    }
  </style>
</head>
<body>
  <main class="guide">
    <header class="cover">
      <p class="cover-label">可打印旅行指南</p>
      <h1>${escapeHtml(title)}</h1>
      <dl class="cover-summary">
        <div><dt>出发日期</dt><dd>${escapeHtml(displayText(model?.startDate, "待定"))}</dd></div>
        <div><dt>行程天数</dt><dd>${days.length} 天</dd></div>
        <div><dt>行程节奏</dt><dd>${escapeHtml(paceText(model?.pace))}</dd></div>
      </dl>
    </header>

    <section class="guide-section" aria-labelledby="route-title">
      <h2 id="route-title">路线概览</h2>
      ${buildRouteHtml(route)}
      ${buildTotalsHtml(totals)}
    </section>

    <section class="guide-section" aria-labelledby="timeline-title">
      <h2 id="timeline-title">每日时间轴</h2>
      ${days.length ? days.map((day) => buildDayHtml(day, placeIndex)).join("\n") : '<p class="empty-state">尚未安排每日行程</p>'}
    </section>

    <section class="guide-section" aria-labelledby="checklist-title">
      <h2 id="checklist-title">行前检查</h2>
      <ul class="checklist">
        <li>核对交通车次、票务与出发站</li>
        <li>确认景点预约和开放时间</li>
        <li>确认住宿地址与入住规则</li>
        <li>检查证件、天气和随身物品</li>
      </ul>
    </section>

    <section class="guide-section" aria-labelledby="notes-title">
      <h2 id="notes-title">数据说明</h2>
      <ul class="data-notes">
        <li>每日日期按行程起始日期顺延生成；未设置起始日期时仅显示天数。</li>
        <li>路线距离与时长为规划参考，出发前请以实际交通信息为准。</li>
        <li>未填写或无效的开始时间会排在当天时间轴末尾。</li>
      </ul>
    </section>

    <footer class="guide-footer">请在出发前再次核对票务、天气、开放时间和住宿信息。</footer>
  </main>
</body>
</html>`;
}
