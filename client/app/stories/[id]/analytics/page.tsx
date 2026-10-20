"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageShell, { Card } from "@/components/insta/PageShell";
import axiosInstance from "@/lib/axios";
import { socket } from "@/lib/socket";
import { useI18n, errorText } from "@/lib/i18n";

export default function StoryAnalyticsPage() {
  const { id } = useParams() as { id: string };
  const { t, fmtDate } = useI18n();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState(false);
  const load = useCallback(async () => {
    try { const r = await axiosInstance.get(`/api/stories/${id}/analytics?page=${page}`); setData(r.data); }
    catch (e) { setErr(errorText(t, e)); }
  }, [id, page, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e: any) => { if (e.storyId === id) { setData((d: any) => (d ? { ...d, totals: e.totals || d.totals } : d)); setFlash(true); setTimeout(() => setFlash(false), 800); load(); } };
    socket.on("story:analytics", h);
    return () => { socket.off("story:analytics", h); };
  }, [id, load]);
  if (err) return <PageShell><p className="text-[#ed4956]">{err}</p></PageShell>;
  if (!data) return <PageShell><p className="text-ig-muted">{t("common.loading")}</p></PageShell>;
  const { totals, story, viewers, reactions, replies, timeline } = data;
  const max = Math.max(1, ...timeline.map((x: any) => x.totalViews));
  const stat = (label: string, value: any, testid: string) => (
    <Card className={`text-center transition-colors ${flash ? "ring-2 ring-[#0095f6]" : ""}`}><div data-testid={testid} className="text-2xl font-bold text-ig-text">{value}</div><div className="text-xs text-ig-muted">{label}</div></Card>
  );
  return (
    <PageShell title={t("analytics.title")} wide>
      <div className="flex gap-4 items-start mb-4">
        {story.media[0]?.type === "video" ? <video src={story.media[0].url} className="w-24 h-40 object-cover rounded" muted /> : <img src={story.media[0]?.url} className="w-24 h-40 object-cover rounded" alt="" />}
        <div className="text-sm text-ig-text space-y-1">
          <p>{fmtDate(story.createdAt)} · {story.media.length} media · {story.privacy === "close_friends" ? t("story.closeFriends") : story.privacy === "followers" ? t("story.followers") : t("story.public")}</p>
          <p className={story.isArchived ? "text-ig-muted" : "text-green-600"}>{story.isArchived ? t("story.archived") : t("story.active")}</p>
          <p className="text-xs text-green-600">● {t("analytics.live")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stat(t("analytics.totalViews"), totals.viewsCount, "total-views")}
        {stat(t("analytics.uniqueViewers"), totals.uniqueViewers, "unique-viewers")}
        {stat(t("analytics.reactions"), totals.reactionsCount, "reactions")}
        {stat(t("analytics.replies"), totals.repliesCount, "replies")}
        {stat(t("analytics.completion"), `${totals.completionRate}%`, "completion")}
      </div>
      <Card className="mb-6">
        <h2 className="font-semibold text-ig-text mb-3">{t("analytics.timeline")}</h2>
        {timeline.length === 0 ? <p className="text-sm text-ig-muted">{t("common.none")}</p> : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {timeline.map((p: any) => (
              <div key={p.time} className="flex flex-col items-center justify-end min-w-[38px] h-full" title={`${p.time}: ${p.totalViews}`}>
                <span className="text-[10px] text-ig-muted">{p.totalViews}</span>
                <div className="w-6 bg-[#0095f6] rounded-t" style={{ height: `${(p.totalViews / max) * 100}%` }} />
                <span className="text-[10px] text-ig-muted mt-1">{p.time.slice(11)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.viewers")} ({totals.uniqueViewers})</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">
            {viewers.map((v: any) => (
              <li key={v._id} className="flex items-center gap-2 text-sm text-ig-text">
                <img src={v.viewer?.profilePicture || "/globe.svg"} className="w-7 h-7 rounded-full object-cover" alt="" />
                <span className="font-medium">{v.viewer?.username}</span>
                <span className="text-xs text-ig-muted ml-auto">{fmtDate(v.firstViewedAt, { timeStyle: "short" })}{v.completed ? ` · ✓ ${t("analytics.completed")}` : ""}</span>
              </li>
            ))}
          </ul>
          {data.viewersPages > 1 && <div className="flex justify-between mt-2 text-xs"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.prev")}</button><span>{t("common.page", { page, pages: data.viewersPages })}</span><button disabled={page >= data.viewersPages} onClick={() => setPage(page + 1)}>{t("common.next")}</button></div>}
        </Card>
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.reactions")}</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">{reactions.map((r: any) => <li key={r._id} className="text-sm text-ig-text flex gap-2"><span className="text-lg">{r.emoji}</span>{r.user?.username}</li>)}</ul>
        </Card>
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.replies")}</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">{replies.map((r: any) => <li key={r._id} className="text-sm text-ig-text"><b>{r.user?.username}</b> {r.text} {r.sentToDM && <span className="text-[10px] text-ig-muted">({t("analytics.dm")})</span>}</li>)}</ul>
        </Card>
      </div>
    </PageShell>
  );
}
