import test from "node:test";
import assert from "node:assert/strict";
import {
  commandForAction,
  mountTripEditor,
  renderTripEditorMarkup
} from "../public/static-site/trip-editor.js";

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

const placeNames = {
  chengdu: "成都",
  chongqing: "重庆",
  xian: "西安"
};

const richPlan = {
  startDate: "2026-10-01",
  days: [{
    id: "day-1",
    cityEntries: [
      { id: "ce-1", visitId: "visit-shared", placeId: "chengdu" },
      { id: "ce-3", visitId: "visit-solo", placeId: "chongqing" }
    ],
    overnightPlaceId: "chongqing",
    items: [{
      id: "transport-1",
      type: "transport",
      fromPlaceId: "chengdu",
      toPlaceId: "chongqing",
      serviceNo: "G123",
      startTime: "22:30",
      endTime: "01:10",
      endDayOffset: 1
    }, {
      id: "activity-1",
      type: "activity",
      placeId: "chongqing",
      title: "洪崖洞夜景",
      startTime: "",
      endTime: ""
    }],
    lodging: {
      placeId: "chongqing",
      name: "江景酒店",
      address: "渝中区嘉陵江畔",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      note: "高层安静房"
    }
  }, {
    id: "day-2",
    cityEntries: [
      { id: "ce-2", visitId: "visit-shared", placeId: "chengdu" },
      { id: "ce-4", visitId: "visit-xian", placeId: "xian" }
    ],
    overnightPlaceId: "xian",
    items: [],
    lodging: null
  }]
};

const warningLabels = new Map([
  ["time-overlap", "时间安排存在重叠"],
  ["activity-before-arrival", "活动早于抵达时间"],
  ["lodging-city-mismatch", "住宿城市与过夜城市不一致"],
  ["overnight-city-missing", "过夜城市不在当天路线中"],
  ["missing-time", "仍有项目未填写完整时间"],
  ["travel-over-limit", "跨城时间超过当前节奏上限"],
  ["play-time-short", "当天剩余游玩时间不足两小时"],
  ["lodging-missing", "过夜行程尚未填写住宿"]
]);

function openingTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "g")) ?? [];
}

function openingTagWith(html, tagName, ...needles) {
  return openingTags(html, tagName).find((tag) => needles.every((needle) => tag.includes(needle)));
}

function elementWith(html, tagName, ...needles) {
  const elements = html.match(new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, "g")) ?? [];
  return elements.find((element) => needles.every((needle) => element.includes(needle)));
}

function namedPlace(placeId) {
  return placeNames[placeId] ?? placeId;
}

function datasetKey(attributeName) {
  return attributeName.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function fakeElement(dataset = {}, { parent = null, value = "" } = {}) {
  return {
    dataset,
    parentElement: parent,
    value,
    closest(selector) {
      const keys = [...selector.matchAll(/\[data-([a-z-]+)\]/g)]
        .map((match) => datasetKey(match[1]));
      let candidate = this;
      while (candidate) {
        if (keys.every((key) => Object.hasOwn(candidate.dataset ?? {}, key))) return candidate;
        candidate = candidate.parentElement;
      }
      return null;
    }
  };
}

class FakeRoot {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  contains() {
    return true;
  }

  emit(type, event) {
    [...(this.listeners.get(type) ?? [])].forEach((listener) => listener(event));
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeDataTransfer {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writes = [];
  }

  setData(type, value) {
    this.writes.push({ type, value });
    this.values.set(type, value);
  }

  getData(type) {
    return this.values.get(type) ?? "";
  }
}

test("renders dated day controls and visit duration", () => {
  const html = renderTripEditorMarkup({ plan, warnings: [], placeName: () => "成都" });
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

test("renders one visit stepper and later visit progress with duration boundaries", () => {
  const html = renderTripEditorMarkup({ plan: richPlan, placeName: namedPlace });
  const sharedIncreaseButtons = openingTags(html, "button").filter((tag) =>
    tag.includes('data-action="increase-stay"') && tag.includes('data-visit-id="visit-shared"')
  );
  assert.equal(sharedIncreaseButtons.length, 1);
  assert.match(html, /停留 2 天/);
  assert.match(html, /停留第 2\/2 天/);

  const oneDayHtml = renderTripEditorMarkup({ plan, placeName: namedPlace });
  const decreaseAtOne = openingTagWith(
    oneDayHtml,
    "button",
    'data-action="decrease-stay"',
    'data-visit-id="visit-1"'
  );
  assert.ok(decreaseAtOne?.includes("disabled"));

  const sevenDayPlan = {
    startDate: null,
    days: Array.from({ length: 7 }, (_, index) => ({
      id: `day-${index + 1}`,
      cityEntries: [{
        id: `ce-${index + 1}`,
        visitId: "visit-seven",
        placeId: "chengdu"
      }],
      overnightPlaceId: "chengdu",
      items: [],
      lodging: null
    }))
  };
  const sevenDayHtml = renderTripEditorMarkup({ plan: sevenDayPlan, placeName: namedPlace });
  const increaseAtSeven = openingTagWith(
    sevenDayHtml,
    "button",
    'data-action="increase-stay"',
    'data-visit-id="visit-seven"'
  );
  assert.ok(increaseAtSeven?.includes("disabled"));
  assert.match(sevenDayHtml, /停留第 7\/7 天/);
});

test("renders city drag rows, move menus, deletion, and overnight choices", () => {
  const html = renderTripEditorMarkup({ plan: richPlan, placeName: namedPlace });
  const cityRow = openingTagWith(
    html,
    "div",
    'class="city-row',
    'draggable="true"',
    'data-drag-kind="city"',
    'data-drag-id="ce-1"'
  );
  assert.ok(cityRow);
  assert.match(html, /class="drag-handle"/);
  assert.match(html, /成都 → 重庆/);

  const moveCity = elementWith(
    html,
    "select",
    'data-action="move-city"',
    'data-entry-id="ce-1"'
  );
  assert.match(moveCity, /^<select\b[^>]*>\s*<option value="" selected disabled>移动到…<\/option>/);
  const currentCityDay = openingTagWith(moveCity, "option", 'value="day-1"');
  assert.ok(currentCityDay);
  assert.ok(!currentCityDay.includes("selected"));
  assert.ok(moveCity?.includes('value="day-2"'));
  assert.ok(openingTagWith(html, "button", 'data-action="remove-city"', 'data-entry-id="ce-1"'));

  const overnight = elementWith(
    html,
    "select",
    'data-action="set-overnight"',
    'data-day-id="day-1"'
  );
  assert.ok(overnight?.includes('value=""'));
  assert.ok(overnight?.includes("待定"));
  assert.ok(overnight?.includes('value="chengdu"'));
  assert.ok(overnight?.includes('value="chongqing" selected'));
  assert.ok(!overnight?.includes('value="xian"'));
});

test("renders timeline details, item commands, day actions, and lodging summary", () => {
  const html = renderTripEditorMarkup({ plan: richPlan, placeName: namedPlace });
  assert.ok(openingTagWith(
    html,
    "li",
    'draggable="true"',
    'data-drag-kind="item"',
    'data-drag-id="transport-1"'
  ));
  assert.match(html, /成都 → 重庆/);
  assert.match(html, /G123/);
  assert.match(html, /22:30/);
  assert.match(html, /次日 01:10/);
  assert.match(html, /洪崖洞夜景/);
  assert.match(html, /待补充/);

  for (const action of ["edit-item", "copy-item", "remove-item"]) {
    const control = openingTagWith(
      html,
      "button",
      `data-action="${action}"`,
      'data-item-id="transport-1"'
    );
    assert.ok(control?.includes('type="button"'), `${action} should be a button`);
    assert.ok(control?.includes("title="), `${action} should have a title`);
    assert.ok(control?.includes("aria-label="), `${action} should have an aria-label`);
  }
  const moveItem = elementWith(
    html,
    "select",
    'data-action="move-item"',
    'data-item-id="transport-1"'
  );
  assert.match(moveItem, /^<select\b[^>]*>\s*<option value="" selected disabled>移动到…<\/option>/);
  const currentItemDay = openingTagWith(moveItem, "option", 'value="day-1"');
  assert.ok(currentItemDay);
  assert.ok(!currentItemDay.includes("selected"));
  assert.ok(moveItem?.includes('value="day-2"'));
  assert.match(moveItem, /title=/);
  assert.match(moveItem, /aria-label=/);

  for (const action of ["add-transport", "add-activity", "edit-lodging"]) {
    assert.ok(openingTagWith(
      html,
      "button",
      `data-action="${action}"`,
      'data-day-id="day-1"',
      'type="button"'
    ));
  }
  assert.match(html, /江景酒店/);
  assert.match(html, /渝中区嘉陵江畔/);
  assert.match(html, /14:00/);
  assert.match(html, /12:00/);
  assert.match(html, /高层安静房/);

  const buttons = openingTags(html, "button");
  assert.ok(buttons.length > 0);
  buttons.forEach((button) => assert.ok(button.includes('type="button"')));
});

test("maps every warning code to a day-scoped Chinese label", () => {
  const warnings = [...warningLabels.keys()].map((code) => ({ code, dayId: "day-1" }));
  const html = renderTripEditorMarkup({ plan: richPlan, warnings, placeName: namedPlace });
  warningLabels.forEach((label) => assert.match(html, new RegExp(label)));

  const secondDay = elementWith(html, "li", 'data-day-id="day-2"');
  warningLabels.forEach((label) => assert.doesNotMatch(secondDay, new RegExp(label)));
});

test("renders undated and low-year UTC weekday headings without century remapping", () => {
  const undated = renderTripEditorMarkup({
    plan: { ...plan, startDate: null },
    placeName: namedPlace
  });
  assert.match(undated, /第 1 天/);
  assert.doesNotMatch(undated, /星期/);
  assert.doesNotMatch(undated, / · /);

  const lowYear = renderTripEditorMarkup({
    plan: { ...plan, startDate: "0099-01-01" },
    placeName: namedPlace
  });
  assert.match(lowYear, /第 1 天 · 0099-01-01 · 星期四/);
  assert.doesNotMatch(lowYear, /1999/);
});

test("escapes all external markup and leaves the plan unchanged", () => {
  const unsafe = `<script>alert("x")</script>&"'`;
  const unsafePlan = {
    startDate: null,
    days: [{
      id: `day-${unsafe}`,
      cityEntries: [{
        id: `entry-${unsafe}`,
        visitId: `visit-${unsafe}`,
        placeId: `place-${unsafe}`
      }],
      overnightPlaceId: `place-${unsafe}`,
      items: [{
        id: `item-${unsafe}`,
        type: "activity",
        placeId: `place-${unsafe}`,
        title: `activity-${unsafe}`,
        startTime: `09:00-${unsafe}`,
        endTime: ""
      }],
      lodging: {
        placeId: `place-${unsafe}`,
        name: `lodging-${unsafe}`,
        address: `address-${unsafe}`,
        checkInTime: "",
        checkOutTime: "",
        note: `note-${unsafe}`
      }
    }]
  };
  const before = structuredClone(unsafePlan);
  const html = renderTripEditorMarkup({
    plan: unsafePlan,
    warnings: [{
      dayId: unsafePlan.days[0].id,
      code: `warning-${unsafe}`,
      message: "UNSAFE-MESSAGE-SHOULD-NOT-RENDER"
    }],
    placeName: () => `place-name-${unsafe}`
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /UNSAFE-MESSAGE-SHOULD-NOT-RENDER/);
  assert.match(html, /data-day-id="day-&lt;script&gt;/);
  assert.match(html, /data-drag-id="entry-&lt;script&gt;/);
  assert.match(html, /data-drag-id="item-&lt;script&gt;/);
  assert.match(html, /value="place-&lt;script&gt;/);
  assert.match(html, /place-name-&lt;script&gt;/);
  assert.match(html, /activity-&lt;script&gt;/);
  assert.match(html, /lodging-&lt;script&gt;/);
  assert.match(html, /warning-&lt;script&gt;/);
  assert.match(html, /&quot;/);
  assert.match(html, /&#39;/);
  assert.deepEqual(unsafePlan, before);
});

test("returns empty markup without days and tolerates malformed child arrays", () => {
  assert.equal(renderTripEditorMarkup({ plan: null, warnings: null, placeName: null }), "");
  assert.equal(renderTripEditorMarkup({ plan: { days: [] }, warnings: {}, placeName: null }), "");
  assert.equal(renderTripEditorMarkup({ plan: { days: "bad" }, warnings: [], placeName: null }), "");

  const malformedPlan = {
    startDate: null,
    days: [{
      id: "day-safe",
      cityEntries: {},
      overnightPlaceId: null,
      items: "bad",
      lodging: null
    }]
  };
  assert.doesNotThrow(() => renderTripEditorMarkup({
    plan: malformedPlan,
    warnings: "bad",
    placeName: null
  }));
  assert.match(renderTripEditorMarkup({ plan: malformedPlan, placeName: null }), /路线待定/);
});

test("maps every supported action to its domain command", () => {
  assert.deepEqual(commandForAction({
    action: "move-item",
    itemId: "item-1",
    targetDayId: "day-2",
    targetIndex: "3"
  }), { type: "move-item", itemId: "item-1", targetDayId: "day-2", targetIndex: 3 });
  assert.deepEqual(commandForAction({
    action: "set-overnight",
    dayId: "day-1",
    placeId: "chengdu"
  }), { type: "set-overnight", dayId: "day-1", placeId: "chengdu" });
  assert.deepEqual(commandForAction({
    action: "set-overnight",
    dayId: "day-1",
    placeId: ""
  }), { type: "set-overnight", dayId: "day-1", placeId: null });
  assert.deepEqual(commandForAction({
    action: "remove-city",
    entryId: "ce-1"
  }), { type: "remove-city", entryId: "ce-1" });
  assert.deepEqual(commandForAction({
    action: "copy-item",
    itemId: "item-1"
  }), { type: "copy-item", itemId: "item-1" });
  assert.deepEqual(commandForAction({
    action: "remove-item",
    itemId: "item-1"
  }), { type: "remove-item", itemId: "item-1" });
  assert.deepEqual(commandForAction({
    action: "increase-stay",
    visitId: "visit-1",
    duration: "2"
  }), { type: "set-visit-duration", visitId: "visit-1", duration: 3 });
  assert.deepEqual(commandForAction({
    action: "decrease-stay",
    visitId: "visit-1",
    duration: "2"
  }), { type: "set-visit-duration", visitId: "visit-1", duration: 1 });
});

test("rejects decreasing a one-day visit below the duration minimum", () => {
  assert.equal(commandForAction({
    action: "decrease-stay",
    visitId: "visit-1",
    duration: "1"
  }), null);
});

test("rejects increasing a seven-day visit above the duration maximum", () => {
  assert.equal(commandForAction({
    action: "increase-stay",
    visitId: "visit-1",
    duration: "7"
  }), null);
});

test("allows decreasing a two-day visit to one day", () => {
  assert.deepEqual(commandForAction({
    action: "decrease-stay",
    visitId: "visit-1",
    duration: "2"
  }), { type: "set-visit-duration", visitId: "visit-1", duration: 1 });
});

test("allows increasing a six-day visit to seven days", () => {
  assert.deepEqual(commandForAction({
    action: "increase-stay",
    visitId: "visit-1",
    duration: "6"
  }), { type: "set-visit-duration", visitId: "visit-1", duration: 7 });
});

test("rejects unknown, incomplete, and numerically unsafe actions", () => {
  const invalidActions = [
    null,
    undefined,
    "move-city",
    {},
    { action: "unknown" },
    { action: "move-city", entryId: "ce-1", targetDayId: "day-2", targetIndex: "" },
    { action: "move-city", entryId: "ce-1", targetDayId: "day-2", targetIndex: "-1" },
    { action: "move-city", entryId: "ce-1", targetDayId: "day-2", targetIndex: "1.5" },
    { action: "move-city", entryId: "", targetDayId: "day-2", targetIndex: "0" },
    { action: "move-item", itemId: "item-1", targetDayId: "", targetIndex: "0" },
    { action: "set-overnight", dayId: "day-1" },
    { action: "set-overnight", dayId: "", placeId: "" },
    { action: "remove-city", entryId: "" },
    { action: "copy-item", itemId: 7 },
    { action: "remove-item" },
    { action: "increase-stay", visitId: "visit-1", duration: "NaN" },
    { action: "decrease-stay", visitId: "", duration: "2" },
    { action: "decrease-stay", visitId: "visit-1", duration: "1.5" }
  ];
  invalidActions.forEach((data) => assert.equal(commandForAction(data), null));
});

test("accepts only canonical unsigned decimal move indexes", () => {
  const invalidIndexes = [
    "1e2",
    "0x10",
    "+1",
    "-0",
    " 1 ",
    "1.0",
    "01",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1
  ];
  const invalidCommands = invalidIndexes.map((targetIndex) => commandForAction({
    action: "move-city",
    entryId: "ce-1",
    targetDayId: "day-2",
    targetIndex
  }));
  assert.deepEqual(invalidCommands, invalidIndexes.map(() => null));

  const validIndexes = [0, "0", "12", Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)];
  assert.deepEqual(validIndexes.map((targetIndex) => commandForAction({
    action: "move-item",
    itemId: "item-1",
    targetDayId: "day-2",
    targetIndex
  })?.targetIndex), [0, 0, 12, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
});

test("mount validates collaborators and returns an idempotent full cleanup", () => {
  const callback = () => {};
  assert.throws(
    () => mountTripEditor({ root: null, onCommand: callback, onEditRequest: callback }),
    { name: "TypeError", message: /root/i }
  );
  assert.throws(
    () => mountTripEditor({ root: new FakeRoot(), onCommand: null, onEditRequest: callback }),
    { name: "TypeError", message: /onCommand/ }
  );
  assert.throws(
    () => mountTripEditor({ root: new FakeRoot(), onCommand: callback, onEditRequest: null }),
    { name: "TypeError", message: /onEditRequest/ }
  );

  const root = new FakeRoot();
  const cleanup = mountTripEditor({ root, onCommand: callback, onEditRequest: callback });
  for (const type of ["click", "change", "dragstart", "dragover", "drop"]) {
    assert.equal(root.listenerCount(type), 1);
  }
  cleanup();
  cleanup();
  for (const type of ["click", "change", "dragstart", "dragover", "drop"]) {
    assert.equal(root.listenerCount(type), 0);
  }
});

test("mounting the same root replaces old listeners without giving old cleanup ownership", () => {
  const root = new FakeRoot();
  const oldCommands = [];
  const newCommands = [];
  const oldCleanup = mountTripEditor({
    root,
    onCommand: (command) => oldCommands.push(command),
    onEditRequest: () => {}
  });
  const newCleanup = mountTripEditor({
    root,
    onCommand: (command) => newCommands.push(command),
    onEditRequest: () => {}
  });
  assert.equal(root.listenerCount("click"), 1);

  const event = {
    target: fakeElement({ action: "remove-city", entryId: "ce-1" })
  };
  root.emit("click", event);
  assert.deepEqual(oldCommands, []);
  assert.equal(newCommands.length, 1);

  oldCleanup();
  assert.equal(root.listenerCount("click"), 1);
  root.emit("click", event);
  assert.equal(newCommands.length, 2);

  newCleanup();
  assert.equal(root.listenerCount("click"), 0);
  root.emit("click", event);
  assert.equal(newCommands.length, 2);
});

test("click delegation separates edit requests from domain commands", () => {
  const root = new FakeRoot();
  const commands = [];
  const editRequests = [];
  const cleanup = mountTripEditor({
    root,
    onCommand: (command) => commands.push(command),
    onEditRequest: (dataset) => editRequests.push({ ...dataset })
  });

  const editDatasets = [
    { action: "add-transport", dayId: "day-1" },
    { action: "add-activity", dayId: "day-1" },
    { action: "edit-item", dayId: "day-1", itemId: "item-1" },
    { action: "edit-lodging", dayId: "day-1" }
  ];
  editDatasets.forEach((dataset) => {
    const action = fakeElement(dataset);
    root.emit("click", { target: fakeElement({}, { parent: action }) });
  });
  assert.deepEqual(editRequests, editDatasets);

  root.emit("click", {
    target: fakeElement({ action: "remove-city", entryId: "ce-1" })
  });
  root.emit("click", {
    target: fakeElement({
      action: "increase-stay",
      visitId: "visit-1",
      duration: "2"
    })
  });
  root.emit("click", { target: fakeElement({ action: "not-supported" }) });
  assert.deepEqual(commands, [
    { type: "remove-city", entryId: "ce-1" },
    { type: "set-visit-duration", visitId: "visit-1", duration: 3 }
  ]);

  cleanup();
  root.emit("click", {
    target: fakeElement({ action: "remove-city", entryId: "ce-after-cleanup" })
  });
  assert.equal(commands.length, 2);
});

test("edit requests receive a detached dataset snapshot", () => {
  const root = new FakeRoot();
  const dataset = { action: "edit-item", dayId: "day-1", itemId: "item-1" };
  let captured;
  mountTripEditor({
    root,
    onCommand: () => {},
    onEditRequest: (request) => { captured = request; }
  });

  root.emit("click", { target: fakeElement(dataset) });
  assert.notStrictEqual(captured, dataset);
  assert.deepEqual(captured, dataset);

  captured.dayId = "changed-in-callback";
  assert.equal(dataset.dayId, "day-1");
  dataset.itemId = "changed-after-event";
  assert.equal(captured.itemId, "item-1");
});

test("change delegation handles the current day without mutating datasets or plans", () => {
  const root = new FakeRoot();
  const commands = [];
  const originalPlan = structuredClone(richPlan);
  mountTripEditor({
    root,
    onCommand: (command) => commands.push(command),
    onEditRequest: () => {}
  });

  const cityDataset = {
    action: "move-city",
    entryId: "ce-1",
    targetIndex: "0"
  };
  const itemDataset = {
    action: "move-item",
    itemId: "item-1",
    targetIndex: "2"
  };
  const overnightDataset = {
    action: "set-overnight",
    dayId: "day-2"
  };
  const cityBefore = { ...cityDataset };
  const itemBefore = { ...itemDataset };
  const overnightBefore = { ...overnightDataset };

  root.emit("change", { target: fakeElement(cityDataset, { value: "day-1" }) });
  root.emit("change", { target: fakeElement(itemDataset, { value: "day-3" }) });
  root.emit("change", { target: fakeElement(overnightDataset, { value: "" }) });
  root.emit("change", {
    target: fakeElement({ action: "unknown-select" }, { value: "ignored" })
  });

  assert.deepEqual(commands, [{
    type: "move-city",
    entryId: "ce-1",
    targetDayId: "day-1",
    targetIndex: 0
  }, {
    type: "move-item",
    itemId: "item-1",
    targetDayId: "day-3",
    targetIndex: 2
  }, {
    type: "set-overnight",
    dayId: "day-2",
    placeId: null
  }]);
  assert.deepEqual(cityDataset, cityBefore);
  assert.deepEqual(itemDataset, itemBefore);
  assert.deepEqual(overnightDataset, overnightBefore);
  assert.deepEqual(richPlan, originalPlan);
});

test("dragstart writes only the private trip payload for valid city and item rows", () => {
  const root = new FakeRoot();
  mountTripEditor({ root, onCommand: () => {}, onEditRequest: () => {} });

  const cityTransfer = new FakeDataTransfer();
  const cityRow = fakeElement({ dragKind: "city", dragId: "ce-1" });
  root.emit("dragstart", {
    target: fakeElement({}, { parent: cityRow }),
    dataTransfer: cityTransfer
  });
  assert.deepEqual(cityTransfer.writes, [{
    type: "application/x-trip-entry",
    value: '{"kind":"city","id":"ce-1"}'
  }]);
  assert.deepEqual(JSON.parse(cityTransfer.writes[0].value), { kind: "city", id: "ce-1" });

  const itemTransfer = new FakeDataTransfer();
  root.emit("dragstart", {
    target: fakeElement({ dragKind: "item", dragId: "item-1" }),
    dataTransfer: itemTransfer
  });
  assert.deepEqual(itemTransfer.writes, [{
    type: "application/x-trip-entry",
    value: '{"kind":"item","id":"item-1"}'
  }]);

  const invalidTransfer = new FakeDataTransfer();
  assert.doesNotThrow(() => root.emit("dragstart", {
    target: fakeElement({ dragKind: "lodging", dragId: "lodging-1" }),
    dataTransfer: invalidTransfer
  }));
  assert.doesNotThrow(() => root.emit("dragstart", {
    target: fakeElement({ dragKind: "city", dragId: "" }),
    dataTransfer: invalidTransfer
  }));
  assert.equal(invalidTransfer.writes.length, 0);
});

test("dragover and drop emit index-zero move commands and ignore hostile payloads", () => {
  const root = new FakeRoot();
  const commands = [];
  mountTripEditor({
    root,
    onCommand: (command) => commands.push(command),
    onEditRequest: () => {}
  });
  const dropZone = fakeElement({ dropDay: "day-2" });
  const nestedTarget = fakeElement({}, { parent: dropZone });
  let prevented = 0;
  root.emit("dragover", {
    target: nestedTarget,
    preventDefault: () => { prevented += 1; }
  });
  assert.equal(prevented, 1);

  for (const payload of [
    { kind: "city", id: "ce-1" },
    { kind: "item", id: "item-1" }
  ]) {
    root.emit("drop", {
      target: nestedTarget,
      preventDefault: () => { prevented += 1; },
      dataTransfer: new FakeDataTransfer({
        "application/x-trip-entry": JSON.stringify(payload)
      })
    });
  }
  assert.deepEqual(commands, [{
    type: "move-city",
    entryId: "ce-1",
    targetDayId: "day-2",
    targetIndex: 0
  }, {
    type: "move-item",
    itemId: "item-1",
    targetDayId: "day-2",
    targetIndex: 0
  }]);

  const hostilePayloads = [
    "",
    "{",
    "null",
    "[]",
    "{}",
    '{"kind":"lodging","id":"lodging-1"}',
    '{"kind":"city","id":""}',
    '{"kind":"city","id":"   "}',
    '{"kind":"item","id":7}'
  ];
  hostilePayloads.forEach((payload) => {
    assert.doesNotThrow(() => root.emit("drop", {
      target: nestedTarget,
      preventDefault: () => {},
      dataTransfer: new FakeDataTransfer({ "application/x-trip-entry": payload })
    }));
  });
  assert.doesNotThrow(() => root.emit("drop", {
    target: nestedTarget,
    preventDefault: () => {},
    dataTransfer: { getData: () => { throw new Error("hostile transfer"); } }
  }));
  assert.doesNotThrow(() => root.emit("drop", {
    target: fakeElement({ dropDay: "" }),
    preventDefault: () => {},
    dataTransfer: new FakeDataTransfer({
      "application/x-trip-entry": '{"kind":"city","id":"ce-2"}'
    })
  }));
  assert.equal(commands.length, 2);
});
