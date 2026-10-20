"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageShell, { Card, EmptyState, inputCls, btnCls, btn2Cls } from "@/components/insta/PageShell";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

export default function ArchivePage() {
  const { t, fmtDate } = useI18n();
  const me = useAuthStore((s: any) => s.user);
  const [stories, setStories] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const load = async () => {
    if (!me) return;
    const [a, h] = await Promise.all([axiosInstance.get("/api/stories/mine?scope=all"), axiosInstance.get(`/api/stories/highlights/${me._id}`)]);
    setStories(a.data.items); setHighlights(h.data.items);
  };
  useEffect(() => { load(); }, [me?._id]);
  const create = async () => {
    try { await axiosInstance.post("/api/stories/highlights", { title, storyIds: sel }); setTitle(""); setSel([]); load(); toast.add({ type: "success", title: t("common.success") }); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const delH = async (id: string) => { await axiosInstance.delete(`/api/stories/highlights/${id}`); load(); };
  const isArchived = (s: any) => s.isArchived || new Date(s.expiresAt) <= new Date();
  return (
    <PageShell title={t("nav.archive")} wide>
      <Card className="mb-6">
        <h2 className="font-semibold text-ig-text mb-2">{t("story.highlights")}</h2>
        <div className="flex gap-4 flex-wrap mb-4">
          {highlights.map((h) => (
            <div key={h._id} className="flex flex-col items-center gap-1">
              <img src={h.cover} className="w-16 h-16 rounded-full object-cover border border-ig-border" alt="" />
              <span className="text-xs text-ig-text">{h.title} ({h.stories.length})</span>
              <button onClick={() => delH(h._id)} className="text-[10px] text-[#ed4956]">{t("common.delete")}</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input className={inputCls + " max-w-xs"} placeholder={t("story.highlightTitle")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className={btnCls} disabled={!title || !sel.length} onClick={create}>{t("story.newHighlight")} ({sel.length})</button>
          <span className="text-xs text-ig-muted">{t("story.selectStories")}</span>
        </div>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {stories.map((s) => (
          <div key={s._id} className={`relative rounded overflow-hidden border-2 ${sel.includes(s._id) ? "border-[#0095f6]" : "border-transparent"}`}>
            <button onClick={() => setSel(sel.includes(s._id) ? sel.filter((x) => x !== s._id) : [...sel, s._id])} className="block w-full">
              {s.media[0]?.type === "video" ? <video src={s.media[0].url} className="w-full aspect-[9/16] object-cover" muted /> : <img src={s.media[0]?.url} className="w-full aspect-[9/16] object-cover" alt="" />}
            </button>
            <div className="absolute top-1 left-1 text-[10px] ig-backdrop text-white px-1 rounded">{isArchived(s) ? t("story.archived") : t("story.active")}</div>
            <div className="p-1 text-[11px] text-ig-text bg-ig-surface">
              <div>{fmtDate(s.createdAt)}</div>
              <div className="flex justify-between"><span>👁 {s.viewsCount} · 👤 {s.uniqueViewers}</span><Link className="text-[#0095f6]" href={`/stories/${s._id}/analytics`}>{t("story.insights")}</Link></div>
            </div>
          </div>
        ))}
      </div>
      {!stories.length && <EmptyState icon="📚" title={t("common.none")} />}
    </PageShell>
  );
}
