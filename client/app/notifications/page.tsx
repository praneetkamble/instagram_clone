"use client";
import { useEffect, useState } from "react";
import PageShell, { Card } from "@/components/insta/PageShell";
import axiosInstance from "@/lib/axios";
import { useI18n } from "@/lib/i18n";

export default function NotificationsPage() {
  const { t, fmtDate } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { axiosInstance.get("/api/notifications").then((r) => { setItems(r.data.items); axiosInstance.post("/api/notifications/read").catch(() => {}); }).catch(() => {}); }, []);
  return (
    <PageShell title={t("notif.title")}>
      <Card>
        {!items.length && <p className="text-sm text-ig-muted">{t("notif.empty")}</p>}
        <ul className="divide-y divide-ig-border">
          {items.map((n) => (
            <li key={n._id} className={`py-2 text-sm text-ig-text flex justify-between ${n.read ? "" : "font-semibold"}`}>
              <span>{t(n.key, n.params || {})}</span><span className="text-xs text-ig-muted">{fmtDate(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}
