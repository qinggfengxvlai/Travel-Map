import * as tripPlan from "./trip-plan.js";
import * as tripEditor from "./trip-editor.js";
import * as tripArchive from "./trip-archive.js";

export * from "./trip-plan.js";
export * from "./trip-editor.js";
export * from "./trip-archive.js";

let guideModulePromise;

export function loadGuideModule() {
  guideModulePromise ||= import("./guide-export.js");
  return guideModulePromise;
}

export function createTripController({ onReady } = {}) {
  let destroyed = false;
  return Object.freeze({
    async init() {
      if (destroyed) throw new Error("trip controller has been destroyed");
      if (typeof onReady === "function") await onReady();
      return this;
    },
    domain: Object.freeze({ ...tripPlan, ...tripEditor, ...tripArchive }),
    loadGuideModule,
    prefetchExports: loadGuideModule,
    destroy() {
      destroyed = true;
    }
  });
}
