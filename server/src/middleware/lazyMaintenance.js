import { lazy } from "../services/maintenance.js";
// Runs due-post publishing / story archiving / subscription expiry on relevant reads (throttled per instance).
const MAP = [[/^\/api\/(posts|scheduled)/, ["posts", "stories"]], [/^\/api\/stories/, ["stories", "posts"]], [/^\/api\/(notifications|admin)/, ["posts", "stories", "subs"]], [/^\/api\/subscriptions/, ["subs"]], [/^\/api\/auth\/me/, ["subs"]]];
export default async function lazyMaintenance(req, _res, next) {
  if (req.method !== "GET" || process.env.DISABLE_LAZY_MAINTENANCE === "true") return next();
  const hit = MAP.find(([re]) => re.test(req.path));
  if (hit) await lazy(hit[1]).catch(() => {});
  next();
}
