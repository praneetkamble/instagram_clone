import { AuditLog } from "../models/Security.model.js";
import { clientIp } from "./device.js";
export async function audit(req, action, { targetType, targetId, details, actor } = {}) {
  try {
    const u = actor || req?.user;
    await AuditLog.create({ actor: u?._id, actorRole: u?.role, action, targetType, targetId: targetId?.toString(), details, ip: req ? clientIp(req) : undefined });
  } catch (e) { console.error("audit failed", e.message); }
}
