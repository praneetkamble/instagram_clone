"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import StoryViewer, { StoryGroup } from "./StoryViewer";
import CreateStoryModal from "./CreateStoryModal";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useI18n } from "@/lib/i18n";

const FALLBACK = "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150";

function StoryRing({ pic, label, hasStory = true, viewed = false, isSelf = false, onClick, onAdd }: any) {
  return (
    <div className="flex flex-col items-center gap-[6px] shrink-0">
      <div className="relative">
        <button onClick={onClick} className="active:opacity-80" aria-label={label}>
          <div className={`w-[66px] h-[66px] rounded-full p-[2px] ${hasStory && !viewed ? "story-gradient story-ring-glow" : "bg-ig-border"}`}>
            <div className="w-full h-full rounded-full bg-ig-surface p-[2px]">
              <img src={pic || FALLBACK} alt={label} className="w-full h-full rounded-full object-cover" />
            </div>
          </div>
        </button>
        {isSelf && (
          <button onClick={onAdd} aria-label="add story" className="absolute bottom-0 right-0 w-5 h-5 bg-[#0095f6] rounded-full flex items-center justify-center border-2 border-ig-surface">
            <Plus size={10} strokeWidth={3} className="text-white" />
          </button>
        )}
      </div>
      <span className="text-xs text-ig-text truncate w-[66px] text-center">{label}</span>
    </div>
  );
}

export default function Stories() {
  const { t } = useI18n();
  const me = useAuthStore((s: any) => s.user);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const load = useCallback(async () => {
    try { const r = await axiosInstance.get("/api/stories/feed"); setGroups(r.data.groups || []); } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    setCanL(el.scrollLeft > 4); setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    update(); const el = scrollRef.current; if (!el) return;
    el.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [update, groups]);

  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  const ordered = [...(mine ? [mine] : []), ...others];

  return (
    <>
      <div className="bg-ig-surface border-b border-ig-border md:border md:rounded-2xl md:mb-6 md:shadow-[var(--ig-shadow-sm)] relative ig-fade-in">
        {canL && <button onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })} className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-ig-surface/90 backdrop-blur shadow-md border border-ig-border items-center justify-center hover:scale-110 transition-transform"><ChevronLeft size={16} className="text-ig-text" /></button>}
        {canR && <button onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })} className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-ig-surface/90 backdrop-blur shadow-md border border-ig-border items-center justify-center hover:scale-110 transition-transform"><ChevronRight size={16} className="text-ig-text" /></button>}
        <div ref={scrollRef} className="flex gap-4 px-4 py-4 overflow-x-auto scrollbar-hide scroll-smooth">
          <StoryRing pic={me?.profilePicture} label={t("story.yourStory")} isSelf hasStory={!!mine} viewed={false}
            onClick={() => (mine ? setViewerIndex(0) : setOpenCreate(true))} onAdd={() => setOpenCreate(true)} />
          {others.map((g, i) => (
            <StoryRing key={g.user._id} pic={g.user.profilePicture} label={g.user.username} viewed={g.allSeen} onClick={() => setViewerIndex(mine ? i + 1 : i)} />
          ))}
        </div>
      </div>
      {viewerIndex !== null && ordered.length > 0 && (
        <StoryViewer groups={ordered} initialGroupIndex={viewerIndex} onClose={() => { setViewerIndex(null); load(); }} onChanged={load} />
      )}
      {openCreate && <CreateStoryModal onClose={() => setOpenCreate(false)} onCreated={() => { setOpenCreate(false); load(); }} />}
    </>
  );
}
