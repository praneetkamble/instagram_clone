"use client";
import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { useI18n } from "@/lib/i18n";
import { Card, btn2Cls } from "./PageShell";

export default function LoginHistory({ compact = false }: { compact?: boolean }) {
  const { t, fmtDate } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [sessions, setSessions] = useState<any[]>([]);
  const load = async () => {
    const r = await axiosInstance.get(`/api/auth/login-history?page=${page}&limit=${compact ? 5 : 15}`);
    setItems(r.data.items); setPages(r.data.pages || 1);
    if (!compact) { const s = await axiosInstance.get("/api/auth/sessions"); setSessions(s.data.items); }
  };
  useEffect(() => { load().catch(() => {}); }, [page]);
  const revoke = async (id: string) => { await axiosInstance.delete(`/api/auth/sessions/${id}`); load(); };
  const color: Record<string, string> = { success: "text-green-600", failed: "text-[#ed4956]", denied: "text-orange-500", locked: "text-[#ed4956]", otp_required: "text-[#0095f6]" };
  return (
    <div className="space-y-4" data-testid="login-history">
      {!compact && (
        <Card>
          <div className="flex flex-wrap gap-2 justify-between items-center mb-2"><h3 className="font-semibold text-ig-text">{t("settings.sessions")}</h3><button className={btn2Cls} onClick={() => revoke("all")}>{t("settings.revokeAll")}</button></div>
          <ul className="divide-y divide-ig-border">
            {sessions.map((s) => (
              <li key={s._id} className="py-2 flex flex-wrap items-center text-sm text-ig-text gap-x-2 gap-y-1">
                <span>{s.browser} · {s.os} · {s.deviceType} · {s.ip}</span>
                <span className="text-xs text-ig-muted">{fmtDate(s.lastSeenAt)}</span>
                {s.current ? <span className="ml-auto text-xs text-green-600">{t("settings.thisDevice")}</span> : <button className="ml-auto text-xs text-[#ed4956]" onClick={() => revoke(s._id)}>{t("settings.revoke")}</button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h3 className="font-semibold text-ig-text mb-2">{t("settings.loginHistory")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs text-ig-text">
            <thead className="text-ig-muted text-left"><tr><th className="py-1 pr-2">{t("common.date")}</th><th className="pr-2">{t("settings.browser")}</th><th className="pr-2">{t("settings.os")}</th><th className="pr-2">{t("settings.device")}</th><th className="pr-2">{t("settings.ip")}</th><th className="pr-2">{t("common.status")}</th>{!compact && <th>{t("settings.reason")}</th>}</tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i._id} className="border-t border-ig-border">
                  <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(i.createdAt)}</td><td className="pr-2">{i.browser} {i.browserVersion?.split(".")[0]}</td><td className="pr-2">{i.os}</td><td className="pr-2">{i.deviceType}</td><td className="pr-2">{i.ip}</td>
                  <td className={`pr-2 font-semibold ${color[i.status] || ""}`}>{t(`loginStatus.${i.status}`)}</td>{!compact && <td className="text-ig-muted">{i.reason}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && <div className="flex justify-between mt-2 text-xs text-ig-text"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.prev")}</button><span>{t("common.page", { page, pages })}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</button></div>}
      </Card>
    </div>
  );
}
