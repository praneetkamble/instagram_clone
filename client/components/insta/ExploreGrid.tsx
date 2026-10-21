"use client";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Film, Layers, X } from "lucide-react";
import axiosInstance from "@/lib/axios";
import Postcard from "./Postcard";
import { Skeleton } from "./PageShell";

export function useAllPosts(limit = 50) {
  const [posts, setPosts] = useState<any[] | null>(null);
  useEffect(() => { axiosInstance.get(`/api/posts?limit=${limit}`).then((r) => setPosts(r.data.posts || [])).catch(() => setPosts([])); }, [limit]);
  return posts;
}

export default function ExploreGrid({ posts }: { posts: any[] | null }) {
  const [open, setOpen] = useState<any>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  if (!posts) return <div className="grid grid-cols-3 gap-1 md:gap-2">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}</div>;
  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map((p, i) => {
          const m = p.media?.[0];
          const tall = i % 10 === 2 || i % 10 === 5;
          return (
            <button key={p._id} onClick={() => setOpen(p)} className={`group relative overflow-hidden rounded-md bg-ig-hover ${tall ? "row-span-2" : "aspect-square"}`}>
              {m?.type === "video"
                ? <video src={m.url} poster={`https://picsum.photos/seed/poster-${p._id}/720/1280`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                : <img src={m?.url} alt={p.caption || "post"} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <span className="absolute top-2 right-2 text-white drop-shadow">{m?.type === "video" ? <Film size={16} /> : p.media?.length > 1 ? <Layers size={16} /> : null}</span>
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5 text-white font-semibold text-sm">
                <span className="flex items-center gap-1"><Heart size={18} className="fill-white" />{p.likes?.length || 0}</span>
                <span className="flex items-center gap-1"><MessageCircle size={18} className="fill-white" />{p.commentsCount ?? p.comments?.length ?? 0}</span>
              </span>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start md:items-center justify-center overflow-y-auto p-3 md:p-8 ig-fade-in" onClick={() => setOpen(null)}>
          <button aria-label="close" className="fixed top-4 right-4 text-white z-[71]" onClick={() => setOpen(null)}><X size={28} /></button>
          <div className="w-full max-w-[470px] bg-ig-surface rounded-2xl overflow-hidden my-10" onClick={(e) => e.stopPropagation()}><Postcard post={open} /></div>
        </div>
      )}
    </>
  );
}
