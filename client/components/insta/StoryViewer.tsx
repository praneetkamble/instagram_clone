"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Send, Trash2, BarChart3, Pause, Play } from "lucide-react";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "../ui/toast";

export type StoryMedia = { url: string; type: "image" | "video"; duration?: number };
export type Story = { _id: string; media: StoryMedia[]; caption?: string; privacy: string; createdAt: string; expiresAt: string; seen?: boolean; viewsCount?: number; uniqueViewers?: number };
export type StoryGroup = { user: { _id: string; username: string; profilePicture?: string }; stories: Story[]; allSeen?: boolean; isMine?: boolean };

const EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export default function StoryViewer({ groups, initialGroupIndex = 0, onClose, onChanged, readOnly = false }: {
  groups: StoryGroup[]; initialGroupIndex?: number; onClose: () => void; onChanged?: () => void; readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [gi, setGi] = useState(initialGroupIndex);
  const [si, setSi] = useState(0);   // story index within group
  const [mi, setMi] = useState(0);   // media index within story
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");
  const [toDM, setToDM] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const group = groups[gi];
  const story = group?.stories[si];
  const media = story?.media[mi];
  const isMine = !!group?.isMine;
  const duration = (media?.type === "video" ? media.duration || 15 : media?.duration || 5) * 1000;

  // record view (server de-duplicates per viewer)
  useEffect(() => {
    if (!story || isMine || readOnly) return;
    const completed = mi === story.media.length - 1;
    axiosInstance.post(`/api/stories/${story._id}/view`, { mediaIndex: mi, completed: false }).catch(() => {});
    return () => { void completed; };
  }, [story?._id, mi, isMine, readOnly]);

  const markCompleted = useCallback(() => {
    if (story && !isMine && !readOnly) axiosInstance.post(`/api/stories/${story._id}/view`, { mediaIndex: story.media.length - 1, completed: true }).catch(() => {});
  }, [story, isMine, readOnly]);

  const next = useCallback(() => {
    if (!group || !story) return;
    setProgress(0);
    if (mi < story.media.length - 1) return setMi(mi + 1);
    markCompleted();
    if (si < group.stories.length - 1) { setSi(si + 1); setMi(0); return; }
    if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); setMi(0); return; }
    onClose();
  }, [group, story, mi, si, gi, groups.length, onClose, markCompleted]);
  const prev = () => {
    setProgress(0);
    if (mi > 0) return setMi(mi - 1);
    if (si > 0) { setSi(si - 1); setMi(0); return; }
    if (gi > 0) { setGi(gi - 1); setSi(0); setMi(0); }
  };

  useEffect(() => {
    if (paused || !media) return;
    const start = Date.now() - progress * duration;
    const id = setInterval(() => {
      const p = (Date.now() - start) / duration;
      if (p >= 1) { clearInterval(id); next(); } else setProgress(p);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, mi, paused, duration]);

  useEffect(() => { if (videoRef.current) paused ? videoRef.current.pause() : videoRef.current.play().catch(() => {}); }, [paused, media?.url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  if (!group || !story || !media) return null;
  const hoursLeft = Math.max(0, Math.round((new Date(story.expiresAt).getTime() - Date.now()) / 3600000));

  const react = async (emoji: string) => {
    try { await axiosInstance.post(`/api/stories/${story._id}/react`, { emoji }); toast.add({ type: "success", title: t("story.reacted") + " " + emoji }); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    try { await axiosInstance.post(`/api/stories/${story._id}/reply`, { text: reply, toDM }); setReply(""); toast.add({ type: "success", title: t("story.replySent") }); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
    finally { setPaused(false); }
  };
  const del = async () => {
    if (!confirm(t("story.deleteConfirm"))) return;
    try { await axiosInstance.delete(`/api/stories/${story._id}`); toast.add({ type: "success", title: t("story.deleted") }); onChanged?.(); onClose(); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" data-testid="story-viewer">
      <button onClick={onClose} className="absolute top-4 right-4 text-white z-20" aria-label={t("common.close")}><X size={28} /></button>
      {gi > 0 || si > 0 || mi > 0 ? <button onClick={prev} className="hidden md:flex absolute left-[calc(50%-260px)] text-white bg-white/20 rounded-full p-1 z-20"><ChevronLeft /></button> : null}
      <button onClick={next} className="hidden md:flex absolute right-[calc(50%-260px)] text-white bg-white/20 rounded-full p-1 z-20"><ChevronRight /></button>
      <div className="relative w-full h-full md:w-[420px] md:h-[min(90vh,750px)] md:rounded-lg overflow-hidden bg-black">
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
          {story.media.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${i < mi ? 100 : i === mi ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-3 right-12 md:right-3 flex items-center gap-2 z-10 text-white min-w-0">
          <img src={group.user.profilePicture || "/globe.svg"} className="w-8 h-8 rounded-full object-cover" alt="" />
          <span className="text-sm font-semibold truncate">{group.user.username}</span>
          <span className="text-xs opacity-70 whitespace-nowrap">{t("story.expiresIn", { hours: hoursLeft })}</span>
          {story.privacy !== "public" && <span className={`text-[10px] px-1.5 py-0.5 rounded ${story.privacy === "close_friends" ? "bg-green-600" : "bg-white/30"}`}>{story.privacy === "close_friends" ? t("story.closeFriends") : t("story.followers")}</span>}
          <button className="ml-auto" onClick={() => setPaused(!paused)}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center" onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}>
          {media.type === "video"
            ? <video ref={videoRef} key={media.url} src={media.url} autoPlay playsInline muted={false} className="w-full h-full object-contain" />
            : <img key={media.url} src={media.url} alt="" className="w-full h-full object-contain" />}
        </div>
        <button className="absolute left-0 top-16 bottom-24 w-1/3 z-[5]" onClick={prev} aria-label="previous" />
        <button className="absolute right-0 top-16 bottom-24 w-1/3 z-[5]" onClick={next} aria-label="next" />
        {story.caption && <p className="absolute bottom-24 left-0 right-0 text-center text-white text-sm px-4 z-10 drop-shadow">{story.caption}</p>}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10 bg-gradient-to-t from-black/70">
          {isMine ? (
            <div className="flex items-center justify-between text-white">
              <Link href={`/stories/${story._id}/analytics`} className="flex items-center gap-2 text-sm"><BarChart3 size={18} />{t("story.insights")} · {t("analytics.views", { count: story.viewsCount ?? 0 })}</Link>
              <button onClick={del} className="flex items-center gap-1 text-sm"><Trash2 size={18} />{t("common.delete")}</button>
            </div>
          ) : readOnly ? null : (
            <>
              <div className="flex justify-center gap-2 sm:gap-3 mb-2">{EMOJIS.map((e) => <button key={e} onClick={() => react(e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>)}</div>
              <form onSubmit={sendReply} className="flex items-center gap-2">
                <input value={reply} onFocus={() => setPaused(true)} onBlur={() => !reply && setPaused(false)} onChange={(e) => setReply(e.target.value)}
                  placeholder={t("story.reply", { username: group.user.username })} className="flex-1 bg-transparent border border-white/60 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/70 focus:outline-none" />
                <button className="text-white" aria-label={t("common.send")}><Send size={22} /></button>
              </form>
              <label className="flex items-center gap-2 text-xs text-white/80 mt-1"><input type="checkbox" checked={toDM} onChange={(e) => setToDM(e.target.checked)} />{t("story.sendToDM")}</label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
