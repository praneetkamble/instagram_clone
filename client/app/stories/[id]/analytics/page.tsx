"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageShell, { Card, StatCard, Skeleton, EmptyState } from "@/components/insta/PageShell";
import { AreaChart, Donut, HBars } from "@/components/insta/Charts";
import { Eye, Users, Heart, MessageCircle, CheckCircle2 } from "lucide-react";
import axiosInstance from "@/lib/axios";
import { rtOn, usePoll, USE_SOCKETS } from "@/lib/realtime";
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
    return rtOn("story:analytics", h);
  }, [id, load]);
  // Polling fallback: refresh every 4s while visible; flash the KPI cards when totals change.
  usePoll(async () => {
    const r = await axiosInstance.get(`/api/stories/${id}/analytics?page=${page}`);
    setData((d: any) => {
      if (d && JSON.stringify(d.totals) !== JSON.stringify(r.data.totals)) { setFlash(true); setTimeout(() => setFlash(false), 800); }
      return r.data;
    });
  }, 4000, !USE_SOCKETS);
  if (err) return <PageShell><p className="text-[#ed4956]">{err}</p></PageShell>;
  if (!data) return <PageShell wide><Skeleton className="h-8 w-48 mb-6" /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 ig-stagger">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-48" /></PageShell>;
  const { totals, story, viewers, reactions, replies, timeline } = data;
  const max = Math.max(1, ...timeline.map((x: any) => x.totalViews));
  const stat = (label: string, value: any, testid: string, icon?: any) => (
    <StatCard label={label} value={value} testid={testid} icon={icon} accent highlight={flash} />
  );
  return (
    <PageShell title={t("analytics.title")} wide>
      <div className="flex gap-4 items-start mb-4">
        {story.media[0]?.type === "video" ? <video src={story.media[0].url} className="w-24 h-40 object-cover rounded" muted /> : <div className="story-gradient story-ring-glow p-[3px] rounded-2xl shrink-0"><img src={story.media[0]?.url} className="w-24 h-40 object-cover rounded-[13px] border-2 border-ig-surface" alt="" /></div>}
        <div className="text-sm text-ig-text space-y-1">
          <p>{fmtDate(story.createdAt)} · {story.media.length} media · {story.privacy === "close_friends" ? t("story.closeFriends") : story.privacy === "followers" ? t("story.followers") : t("story.public")}</p>
          <p className={story.isArchived ? "text-ig-muted" : "text-green-600"}>{story.isArchived ? t("story.archived") : t("story.active")}</p>
          <p className="text-xs text-green-600 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" /> {t("analytics.live")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 ig-stagger">
        {stat(t("analytics.totalViews"), totals.viewsCount, "total-views", <Eye size={16} />)}
        {stat(t("analytics.uniqueViewers"), totals.uniqueViewers, "unique-viewers", <Users size={16} />)}
        {stat(t("analytics.reactions"), totals.reactionsCount, "reactions", <Heart size={16} />)}
        {stat(t("analytics.replies"), totals.repliesCount, "replies", <MessageCircle size={16} />)}
        {stat(t("analytics.completion"), `${totals.completionRate}%`, "completion", <CheckCircle2 size={16} />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold text-ig-text mb-3">{t("analytics.timeline")}</h2>
          {timeline.length === 0 ? <EmptyState icon={<Eye size={24} />} title={t("common.none")} /> : <AreaChart data={timeline.map((p: any) => ({ label: p.time.slice(11), value: p.totalViews }))} />}
        </Card>
        <Card className="flex flex-col">
          <h2 className="font-semibold text-ig-text mb-3">{t("analytics.engagement")}</h2>
          <Donut value={totals.completionRate} label={t("analytics.completionDonut")} />
          <div className="mt-5"><HBars items={[{ label: t("analytics.uniqueViewers"), value: totals.uniqueViewers }, { label: t("analytics.reactions"), value: totals.reactionsCount }, { label: t("analytics.replies"), value: totals.repliesCount }]} /></div>
        </Card>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.viewers")} ({totals.uniqueViewers})</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">
            {viewers.map((v: any) => (
              <li key={v._id} className="flex items-center gap-2 text-sm text-ig-text p-1.5 -mx-1.5 rounded-lg hover:bg-ig-hover transition-colors">
                <img src={v.viewer?.profilePicture || "/globe.svg"} className="w-8 h-8 rounded-full object-cover ring-2 ring-[#d62976]/30" alt="" />
                <span className="font-medium truncate">{v.viewer?.username}</span>
                <span className="text-xs text-ig-muted ml-auto">{fmtDate(v.firstViewedAt, { timeStyle: "short" })}{v.completed ? ` · ✓ ${t("analytics.completed")}` : ""}</span>
              </li>
            ))}
          </ul>
          {data.viewersPages > 1 && <div className="flex justify-between mt-2 text-xs"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.prev")}</button><span>{t("common.page", { page, pages: data.viewersPages })}</span><button disabled={page >= data.viewersPages} onClick={() => setPage(page + 1)}>{t("common.next")}</button></div>}
        </Card>
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.reactions")}</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">{reactions.map((r: any) => <li key={r._id} className="text-sm text-ig-text flex items-center gap-2 p-1.5 -mx-1.5 rounded-lg hover:bg-ig-hover"><span className="text-xl w-9 h-9 rounded-full bg-ig-hover flex items-center justify-center">{r.emoji}</span>{r.user?.username}</li>)}</ul>
        </Card>
        <Card>
          <h2 className="font-semibold text-ig-text mb-2">{t("analytics.replies")}</h2>
          <ul className="space-y-2 max-h-96 overflow-auto">{replies.map((r: any) => <li key={r._id} className="text-sm text-ig-text bg-ig-hover rounded-2xl rounded-tl-sm px-3 py-2"><b>{r.user?.username}</b> {r.text} {r.sentToDM && <span className="text-[10px] text-ig-muted">({t("analytics.dm")})</span>}</li>)}</ul>
        </Card>
      </div>
    </PageShell>
  );
}
