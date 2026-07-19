import * as tripPlan from "./trip-plan.js?v=progressive-2";
import * as tripEditor from "./trip-editor.js?v=progressive-2";
import * as tripArchive from "./trip-archive.js?v=progressive-2";

export * from "./trip-plan.js?v=progressive-2";
export * from "./trip-editor.js?v=progressive-2";
export * from "./trip-archive.js?v=progressive-2";

let guideModulePromise;

export function loadGuideModule() {
  guideModulePromise ||= import("./guide-export.js?v=progressive-2");
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
