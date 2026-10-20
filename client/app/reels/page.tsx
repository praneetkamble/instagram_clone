"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Send, Volume2, VolumeX, Film } from "lucide-react";
import Sidebar from "@/components/insta/Sidebar";
import MobileNav from "@/components/insta/MobileNav";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useAllPosts } from "@/components/insta/ExploreGrid";

function Reel({ p, muted, setMuted }: any) {
  const me: any = useAuthStore((s: any) => s.user);
  const ref = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(p.likes?.some((l: any) => (l.user?._id || l.user) === me?._id));
  const [count, setCount] = useState(p.likes?.length || 0);
  const [burst, setBurst] = useState(false);
  const m = p.media?.[0];
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { const v = vid.current; if (!v) return; e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }, { threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const toggle = async (force?: boolean) => {
    const next = force ?? !liked; if (next === liked) return;
    setLiked(next); setCount((c: number) => c + (next ? 1 : -1));
    try { next ? await axiosInstance.post(`/api/likes/${p._id}`) : await axiosInstance.delete(`/api/likes/${p._id}`); } catch { setLiked(!next); setCount((c: number) => c + (next ? -1 : 1)); }
  };
  const share = () => { const url = `${location.origin}/profile/${p.user?.username}`; (navigator as any).share ? navigator.share({ url }).catch(() => {}) : navigator.clipboard?.writeText(url); };
  return (
    <section ref={ref} className="snap-start snap-always h-full flex items-center justify-center py-0 md:py-3">
      <div className="relative h-full w-full md:w-auto md:aspect-[9/16] md:rounded-2xl overflow-hidden bg-black shadow-2xl" onDoubleClick={() => { toggle(true); setBurst(true); setTimeout(() => setBurst(false), 700); }}>
        {m?.type === "video"
          ? <video ref={vid} src={m.url} loop muted={muted} playsInline className="absolute inset-0 w-full h-full object-cover" onClick={() => setMuted(!muted)} />
          : <img src={m?.url} alt={p.caption} className="absolute inset-0 w-full h-full object-cover ig-kenburns" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20 pointer-events-none" />
        {burst && <Heart size={96} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-white text-white ig-like-pop drop-shadow-xl" />}
        {m?.type === "video" && <button aria-label="mute" onClick={() => setMuted(!muted)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>}
        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white">
          <button onClick={() => toggle()} className="flex flex-col items-center text-xs font-semibold"><Heart size={28} className={liked ? "fill-[#ed4956] text-[#ed4956] ig-like-pop" : ""} />{count}</button>
          <Link href={`/profile/${p.user?.username}`} className="flex flex-col items-center text-xs font-semibold"><MessageCircle size={28} />{p.commentsCount ?? 0}</Link>
          <button onClick={share} aria-label="share"><Send size={26} /></button>
        </div>
        <div className="absolute left-4 right-16 bottom-5 text-white">
          <Link href={`/profile/${p.user?.username}`} className="flex items-center gap-2 mb-2">
            <img src={p.user?.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white/80" />
            <span className="font-semibold text-sm">{p.user?.username}</span>
            <span className="text-xs border border-white/70 rounded-lg px-2 py-0.5">View</span>
          </Link>
          <p className="text-sm leading-snug line-clamp-2">{p.caption}</p>
          {p.location && <p className="text-xs opacity-80 mt-1">📍 {p.location}</p>}
        </div>
      </div>
    </section>
  );
}

export default function ReelsPage() {
  const posts = useAllPosts(40);
  const [muted, setMuted] = useState(true);
  const reels = posts ? [...posts].sort((a, b) => (b.media?.[0]?.type === "video" ? 1 : 0) - (a.media?.[0]?.type === "video" ? 1 : 0)) : null;
  return (
    <div className="bg-ig-bg md:bg-ig-bg min-h-screen">
      <Sidebar />
      <div className="md:ml-[72px] xl:ml-[244px]">
        <div className="md:hidden fixed top-0 inset-x-0 z-40 h-[56px] flex items-center px-4 text-white font-bold text-lg bg-gradient-to-b from-black/60 to-transparent"><Film size={20} className="mr-2" />Reels</div>
        <main className="h-[calc(100dvh-50px)] md:h-[100dvh] overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black md:bg-transparent">
          {!reels && <div className="h-full flex items-center justify-center text-ig-muted">Loading reels…</div>}
          {reels && !reels.length && <div className="h-full flex items-center justify-center text-ig-muted">No reels yet</div>}
          {reels?.map((p) => <Reel key={p._id} p={p} muted={muted} setMuted={setMuted} />)}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
