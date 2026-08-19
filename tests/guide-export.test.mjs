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

function buildDetailedPlan(overrides = {}) {
  return {
    version: 2,
    id: "trip-detailed",
    name: "京豫秋游",
    startDate: "2026-10-01",
    pace: "standard",
    days: [{
      id: "day-1",
      cityEntries: [
        { id: "ce-1", visitId: "v-1", placeId: "beijing", manuallyPlaced: true },
        { id: "ce-2", visitId: "v-2", placeId: "zhengzhou", manuallyPlaced: true }
      ],
      overnightPlaceId: "zhengzhou",
      items: [
        {
          id: "t-1",
          type: "transport",
          fromPlaceId: "beijing",
          toPlaceId: "zhengzhou",
          serviceNo: "G95",
          startTime: "22:30",
          endTime: "01:10",
          endDayOffset: 1,
          note: "请提前检票"
        },
        {
          id: "a-1",
          type: "activity",
          placeId: "zhengzhou",
          title: "河南博物院",
          startTime: "09:00",
          endTime: "11:30",
          note: "提前预约"
        }
      ],
      lodging: {
        placeId: "zhengzhou",
        name: "站前酒店",
        address: "二马路 8 号",
        checkInTime: "18:00",
        checkOutTime: "09:00",
        note: "含早餐"
      }
    }],
    ...overrides
  };
}

const detailedPlaces = new Map([
  ["beijing", { id: "beijing", name: "北京" }],
  ["zhengzhou", { id: "zhengzhou", name: "郑州" }]
]);

test("buildGuideModel keeps inputs independent and sorts valid times stably", () => {
  const sourcePlan = buildDetailedPlan({
    startDate: "0001-01-01",
    days: [{
      id: "day-early",
      cityEntries: [{ id: "ce-x", visitId: "v-x", placeId: "beijing", manuallyPlaced: true }],
      overnightPlaceId: "beijing",
      items: [
        { id: "invalid", type: "activity", title: "无效", startTime: "24:00", metadata: { rank: 1 } },
        { id: "nine-a", type: "activity", title: "九点甲", startTime: "09:00" },
        { id: "missing", type: "activity", title: "待定" },
        { id: "seven", type: "activity", title: "七点", startTime: "07:00" },
        { id: "nine-b", type: "activity", title: "九点乙", startTime: "09:00" }
      ],
      lodging: null
    }]
  });
  const warnings = [
    { code: "missing-time", dayId: "day-early", itemIds: ["missing"], details: { source: "validator" } },
    { code: "time-overlap", dayId: "another-day", itemIds: [] }
  ];
  const routeSegments = [{ fromName: "北京", toName: "郑州", details: { provider: "local" } }];
  const totals = { distance: "700 公里", duration: "3 小时", details: { measured: true } };
  const placeValue = { id: "beijing", name: "北京", metadata: { level: "city" } };
  const snapshots = new Map([["beijing", placeValue]]);
  const before = structuredClone({ sourcePlan, warnings, routeSegments, totals, placeValue });

  const model = buildGuideModel({ plan: sourcePlan, placeSnapshots: snapshots, warnings, routeSegments, totals });

  assert.deepEqual({ sourcePlan, warnings, routeSegments, totals, placeValue }, before);
  assert.equal(model.days[0].date, "0001-01-01");
  assert.equal(model.days[0].weekday, "星期一");
  assert.deepEqual(model.days[0].items.map((item) => item.id), ["seven", "nine-a", "nine-b", "invalid", "missing"]);
  assert.deepEqual(model.days[0].warnings.map((warning) => warning.code), ["missing-time"]);
  assert.notStrictEqual(model.days[0].items[3].metadata, sourcePlan.days[0].items[0].metadata);
  assert.notStrictEqual(model.days[0].places[0].metadata, placeValue.metadata);
  assert.notStrictEqual(model.routeSegments[0].details, routeSegments[0].details);
  assert.notStrictEqual(model.totals.details, totals.details);

  model.days[0].items[3].metadata.rank = 99;
  model.days[0].places[0].metadata.level = "changed";
  model.routeSegments[0].details.provider = "changed";
  model.totals.details.measured = false;
  assert.deepEqual({ sourcePlan, warnings, routeSegments, totals, placeValue }, before);
});

test("exports undated days without producing Invalid Date", () => {
  const undatedPlan = buildDetailedPlan({ startDate: null });
  const model = buildGuideModel({ plan: undatedPlan, placeSnapshots: detailedPlaces });
  const markdown = buildMarkdownGuide(model);
  const html = buildPrintableHtml(model);

  assert.equal(model.days[0].date, null);
  assert.equal(model.days[0].weekday, null);
  assert.match(markdown, /第 1 天/);
  assert.match(html, /第 1 天/);
  assert.doesNotMatch(`${markdown}${html}`, /Invalid Date/);
});

test("renders transport activity lodging warning route and totals in both formats", () => {
  const model = buildGuideModel({
    plan: buildDetailedPlan(),
    placeSnapshots: detailedPlaces,
    warnings: [{ code: "time-overlap", dayId: "day-1", itemIds: ["t-1", "a-1"] }],
    routeSegments: [{
      fromName: "武汉",
      toName: "长沙",
      transportLabel: "高铁",
      distanceText: "350 公里",
      durationText: "1 小时 30 分",
      note: "以实际班次为准"
    }],
    totals: { distance: "350 公里", duration: "1 小时 30 分", metadata: { source: "route-engine" } }
  });
  const outputs = [buildMarkdownGuide(model), buildPrintableHtml(model)];

  for (const output of outputs) {
    for (const text of [
      "22:30", "01:10", "次日", "北京", "郑州", "G95", "请提前检票",
      "河南博物院", "提前预约", "站前酒店", "二马路 8 号", "18:00", "09:00",
      "含早餐", "时间安排重叠", "武汉", "长沙", "高铁", "350 公里", "1 小时 30 分"
    ]) {
      assert.match(output, new RegExp(text));
    }
    assert.doesNotMatch(output, /\[object Object\]/);
  }
});

test("escapes every user-facing HTML field and emits no raw user script", () => {
  const unsafePlan = buildDetailedPlan({
    name: "华中 <script>alert(\"标题\")</script> & '行'",
    days: [{
      id: "unsafe-day",
      cityEntries: [{ id: "ce-u", visitId: "v-u", placeId: "unsafe", manuallyPlaced: true }],
      overnightPlaceId: "unsafe",
      items: [{
        id: "unsafe-activity",
        type: "activity",
        placeId: "unsafe",
        title: "展览 <特别场>",
        startTime: "10:00",
        endTime: "11:00",
        note: "<script>alert('note')</script> & \"确认\""
      }],
      lodging: {
        placeId: "unsafe",
        name: "旅店 <b>甲</b> & \"乙\" '丙'",
        address: "东街 <1号>",
        checkInTime: "18:00",
        checkOutTime: "09:00",
        note: "门牌 > 前台"
      }
    }]
  });
  const model = buildGuideModel({
    plan: unsafePlan,
    placeSnapshots: new Map([["unsafe", { id: "unsafe", name: "城 <中> & \"外\" '侧'" }]]),
    warnings: [{ code: "custom <warning>", dayId: "unsafe-day", note: "<script>warning()</script>" }],
    routeSegments: [{ fromName: "甲 <站>", toName: "乙 & 站", note: "<script>route()</script>" }],
    totals: { distance: "<500 & 600> 公里" }
  });
  const html = buildPrintableHtml(model);

  for (const escaped of [
    "&lt;script&gt;alert(&quot;",
    "城 &lt;中&gt; &amp; &quot;",
    "展览 &lt;特别场&gt;",
    "&lt;script&gt;alert(&#39;note&#39;)&lt;/script&gt; &amp; &quot;",
    "旅店 &lt;b&gt;甲&lt;/b&gt; &amp; &quot;",
    "东街 &lt;1号&gt;",
    "甲 &lt;站&gt;",
    "乙 &amp; 站",
    "&lt;500 &amp; 600&gt; 公里"
  ]) {
    assert.ok(html.includes(escaped), `expected escaped HTML to include ${escaped}`);
  }
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<b>甲<\/b>/i);
});

test("escapes Markdown HTML and structural control characters", () => {
  const unsafePlan = buildDetailedPlan({
    name: "# 行程 <script>title()</script>",
    days: [{
      id: "md-day",
      cityEntries: [{ id: "ce-m", visitId: "v-m", placeId: "md-place", manuallyPlaced: true }],
      overnightPlaceId: "md-place",
      items: [{
        id: "md-item",
        type: "activity",
        placeId: "md-place",
        title: "[伪链接](javascript:alert(1))",
        startTime: "10:00",
        endTime: "11:00",
        note: "第一行\n## 注入标题\n- 注入列表 <img src=x>"
      }],
      lodging: null
    }]
  });
  const markdown = buildMarkdownGuide(buildGuideModel({
    plan: unsafePlan,
    placeSnapshots: new Map([["md-place", { id: "md-place", name: "<em>地点</em>" }]])
  }));

  assert.doesNotMatch(markdown, /<script>|<img\s|<em>/i);
  assert.doesNotMatch(markdown, /^## 注入标题$/m);
  assert.doesNotMatch(markdown, /^- 注入列表/m);
  assert.doesNotMatch(markdown, /\[伪链接\]\(javascript:/);
  assert.match(markdown, /&lt;script&gt;/);
});

test("printable HTML is self-contained and print ready", () => {
  const html = buildPrintableHtml(buildGuideModel({ plan, placeSnapshots: detailedPlaces }));

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta charset="UTF-8">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<(?:link|script)\b/i);
  assert.doesNotMatch(html, /\b(?:href|src)\s*=/i);
  assert.doesNotMatch(html, /url\s*\(/i);
});

test("falls back safely for unknown places warnings and invalid snapshot stores", () => {
  const fallbackPlan = buildDetailedPlan({
    days: [{
      id: "fallback-day",
      cityEntries: [{ id: "ce-f", visitId: "v-f", placeId: "unknown-city", manuallyPlaced: true }],
      overnightPlaceId: "unknown-city",
      items: [],
      lodging: null
    }]
  });
  const model = buildGuideModel({
    plan: fallbackPlan,
    placeSnapshots: { get: "not-a-function" },
    warnings: [
      { code: "unknown-warning", dayId: "fallback-day", itemIds: [] },
      { code: "other-day-warning", dayId: "other-day", itemIds: [] }
    ]
  });

  assert.deepEqual(model.days[0].places[0], { id: "unknown-city", name: "unknown-city" });
  assert.deepEqual(model.days[0].overnightPlace, { id: "unknown-city", name: "unknown-city" });
  assert.deepEqual(model.days[0].warnings.map((warning) => warning.code), ["unknown-warning"]);
  assert.match(buildMarkdownGuide(model), /unknown-warning/);
  assert.match(buildPrintableHtml(model), /unknown-warning/);

  const defaultSnapshotsModel = buildGuideModel({ plan: fallbackPlan });
  assert.equal(defaultSnapshotsModel.days[0].places[0].name, "unknown-city");
});

test("uses continuous day places when route segments are absent", () => {
  const routePlan = buildDetailedPlan({
    days: [
      { id: "d1", cityEntries: [{ placeId: "a" }, { placeId: "a" }, { placeId: "b" }], overnightPlaceId: "b", items: [], lodging: null },
      { id: "d2", cityEntries: [{ placeId: "b" }, { placeId: "a" }], overnightPlaceId: "a", items: [], lodging: null }
    ]
  });
  const places = new Map([
    ["a", { id: "a", name: "甲地" }],
    ["b", { id: "b", name: "乙地" }]
  ]);
  const model = buildGuideModel({ plan: routePlan, placeSnapshots: places });

  assert.match(buildMarkdownGuide(model), /甲地 → 乙地 → 甲地/);
  assert.match(buildPrintableHtml(model), /甲地[\s\S]*→[\s\S]*乙地[\s\S]*→[\s\S]*甲地/);
});

test("keeps section order and daily core content aligned across formats", () => {
  const model = buildGuideModel({
    plan: buildDetailedPlan(),
    placeSnapshots: detailedPlaces,
    warnings: [{ code: "lodging-missing", dayId: "day-1", itemIds: [] }]
  });
  const markdown = buildMarkdownGuide(model);
  const html = buildPrintableHtml(model);
  const sectionNames = ["路线概览", "每日时间轴", "行前检查", "数据说明"];

  for (const output of [markdown, html]) {
    let previousIndex = -1;
    for (const sectionName of sectionNames) {
      const currentIndex = output.indexOf(sectionName);
      assert.ok(currentIndex > previousIndex, `${sectionName} should follow the previous section`);
      previousIndex = currentIndex;
    }
    for (const coreText of ["第 1 天", "2026-10-01", "星期四", "北京", "郑州", "G95", "河南博物院", "站前酒店", "住宿信息缺失"]) {
      assert.match(output, new RegExp(coreText));
    }
  }
});

test("resolves string route segment endpoints through place snapshots", () => {
  const model = buildGuideModel({
    plan: buildDetailedPlan(),
    placeSnapshots: detailedPlaces,
    routeSegments: [{
      from: "beijing",
      to: "zhengzhou",
      distance: 693000,
      duration: 9000
    }]
  });

  for (const output of [buildMarkdownGuide(model), buildPrintableHtml(model)]) {
    assert.match(output, /北京 → 郑州/);
    assert.doesNotMatch(output, /beijing → zhengzhou/);
  }
});

test("renders every supported pace with the matching Chinese label", () => {
  const cases = [
    ["relaxed", "轻松"],
    ["standard", "标准"],
    ["compact", "紧凑"]
  ];

  for (const [pace, label] of cases) {
    const model = buildGuideModel({
      plan: buildDetailedPlan({ pace }),
      placeSnapshots: detailedPlaces
    });
    for (const output of [buildMarkdownGuide(model), buildPrintableHtml(model)]) {
      assert.match(output, new RegExp(label));
    }
  }
});

test("keeps empty timeline and totals messages aligned across formats", () => {
  const emptyPlan = buildDetailedPlan({
    days: [{
      id: "empty-day",
      cityEntries: [{ id: "ce-e", visitId: "v-e", placeId: "beijing", manuallyPlaced: true }],
      overnightPlaceId: "beijing",
      items: [],
      lodging: null
    }]
  });
  const model = buildGuideModel({ plan: emptyPlan, placeSnapshots: detailedPlaces, totals: null });

  for (const output of [buildMarkdownGuide(model), buildPrintableHtml(model)]) {
    assert.match(output, /当天暂无时间轴安排/);
    assert.match(output, /暂无可用的里程与时长汇总/);
  }
});
