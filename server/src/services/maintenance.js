// Background work that used to run in node-cron. Called by /api/cron/tick (external scheduler),
// lazily on relevant reads (so correctness never depends on the scheduler) and by node-cron locally.
import { publishDuePosts } from "../jobs/scheduler.js";
import { archiveExpiredStories } from "../controllers/story.controller.js";
import { runSubscriptionMaintenance } from "../controllers/subscription.controller.js";

const g = globalThis;
g.__maint ||= { last: { posts: 0, stories: 0, subs: 0 }, log: [] };
const S = g.__maint;
const remember = (entry) => { S.log.unshift({ at: new Date().toISOString(), ...entry }); S.log.length = Math.min(S.log.length, 50); };

async function step(name, fn) {
  const t = Date.now();
  try { const result = await fn(); S.last[name] = Date.now(); return { ok: true, result, ms: Date.now() - t }; }
  catch (e) { console.error(`maintenance:${name}`, e); remember({ step: name, error: e.message }); return { ok: false, error: e.message, ms: Date.now() - t }; }
}

export async function runAll() {
  const out = {
    stories: await step("stories", archiveExpiredStories),
    posts: await step("posts", publishDuePosts),
    subs: await step("subs", runSubscriptionMaintenance),
  };
  remember({ step: "tick", ok: Object.values(out).every((x) => x.ok) });
  return out;
}

// Throttled, time-boxed variants for the request path.
const LAZY_MS = Number(process.env.LAZY_MAINTENANCE_MS || 15000);
const race = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
export async function lazy(kinds = ["posts", "stories"]) {
  const due = kinds.filter((k) => Date.now() - S.last[k] > (k === "subs" ? 10 * LAZY_MS : LAZY_MS));
  if (!due.length) return;
  due.forEach((k) => (S.last[k] = Date.now())); // claim the slot first so concurrent requests don't pile up
  const fns = { posts: publishDuePosts, stories: archiveExpiredStories, subs: runSubscriptionMaintenance };
  await race(Promise.all(due.map((k) => fns[k]().catch((e) => remember({ step: `lazy:${k}`, error: e.message })))), 4000);
}
export const maintenanceLog = () => S.log;
