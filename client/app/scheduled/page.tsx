"use client";
import { useEffect, useState } from "react";
import PageShell, { Card, inputCls, btnCls, btn2Cls } from "@/components/insta/PageShell";
import axiosInstance from "@/lib/axios";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

const toLocalInput = (d: string) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function ScheduledPage() {
  const { t, fmtDate } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [max, setMax] = useState(2);
  const [status, setStatus] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const load = async () => { const r = await axiosInstance.get(`/api/posts/scheduled${status ? `?status=${status}` : ""}`); setItems(r.data.items); setMax(r.data.max); };
  useEffect(() => { load().catch(() => {}); }, [status]);
  const save = async () => {
    const when = new Date(edit.scheduledAt);
    if (isNaN(when.getTime()) || when <= new Date()) return toast.add({ type: "error", title: t("validation.futureDate") });
    try {
      await axiosInstance.put(`/api/posts/scheduled/${edit._id}`, { caption: edit.caption, location: edit.location, hashtags: edit.hashtagsText.split(/[,\s]+/).filter(Boolean), taggedUsers: edit.taggedText.split(/[,\s]+/).filter(Boolean), scheduledAt: when.toISOString() });
      setEdit(null); toast.add({ type: "success", title: t("sched.updated") }); load();
    } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const cancel = async (id: string) => {
    if (!confirm(t("sched.cancelConfirm"))) return;
    try { await axiosInstance.post(`/api/posts/scheduled/${id}/cancel`); load(); } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  return (
    <PageShell title={t("sched.title")}>
      <p className="text-sm text-ig-muted mb-3">{t("sched.limitNote", { max })}</p>
      <div className="flex gap-2 mb-4">
        {["", "scheduled", "published", "cancelled", "failed"].map((s) => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1 rounded-full text-xs ${status === s ? "bg-[#0095f6] text-white" : "bg-ig-hover text-ig-text"}`}>{s ? t(`sched.status.${s}`) : t("common.all")}</button>)}
      </div>
      <div className="space-y-3">
        {items.map((p) => (
          <Card key={p._id} className="flex gap-4">
            <img src={p.media[0]?.url} className="w-24 h-24 object-cover rounded" alt="" />
            <div className="flex-1 text-sm text-ig-text space-y-1">
              <div className="flex items-center gap-2"><span className="text-xs px-2 py-0.5 rounded bg-ig-hover">{t(`sched.status.${p.status}`)}</span><span className="text-xs text-ig-muted">{t("sched.publishAt", { date: fmtDate(p.scheduledAt) })}</span></div>
              <p>{p.caption}</p>
              <p className="text-xs text-[#0095f6]">{p.hashtags?.map((h: string) => `#${h}`).join(" ")}</p>
              {p.taggedUsers?.length > 0 && <p className="text-xs text-ig-muted">@{p.taggedUsers.map((u: any) => u.username).join(", @")}</p>}
              {p.location && <p className="text-xs text-ig-muted">📍 {p.location}</p>}
              {p.publishErrors?.length > 0 && <details className="text-xs text-[#ed4956]"><summary>{t("sched.errors")} ({p.publishErrors.length})</summary>{p.publishErrors.map((e: any, i: number) => <div key={i}>{fmtDate(e.at)} — {e.message}</div>)}</details>}
              {p.status !== "published" && (
                <div className="flex gap-2 pt-1">
                  <button className={btn2Cls} onClick={() => setEdit({ ...p, scheduledAt: toLocalInput(p.scheduledAt), hashtagsText: (p.hashtags || []).join(", "), taggedText: (p.taggedUsers || []).map((u: any) => u.username).join(", ") })}>{p.status === "scheduled" ? t("common.edit") : t("sched.reschedule")}</button>
                  {p.status === "scheduled" && <button className={btn2Cls} onClick={() => cancel(p._id)}>{t("common.cancel")}</button>}
                </div>
              )}
            </div>
          </Card>
        ))}
        {!items.length && <p className="text-sm text-ig-muted">{t("common.none")}</p>}
      </div>
      {edit && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md space-y-2">
            <h3 className="font-semibold text-ig-text">{t("sched.reschedule")}</h3>
            <textarea className={inputCls} rows={3} value={edit.caption} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} placeholder={t("create.caption")} />
            <input className={inputCls} value={edit.hashtagsText} onChange={(e) => setEdit({ ...edit, hashtagsText: e.target.value })} placeholder={t("create.hashtags")} />
            <input className={inputCls} value={edit.taggedText} onChange={(e) => setEdit({ ...edit, taggedText: e.target.value })} placeholder={t("create.tagPeople")} />
            <input className={inputCls} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder={t("create.location")} />
            <input type="datetime-local" className={inputCls} value={edit.scheduledAt} onChange={(e) => setEdit({ ...edit, scheduledAt: e.target.value })} />
            <div className="flex gap-2 justify-end"><button className={btn2Cls} onClick={() => setEdit(null)}>{t("common.close")}</button><button className={btnCls} onClick={save}>{t("common.save")}</button></div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
