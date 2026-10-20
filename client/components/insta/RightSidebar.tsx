"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";

const Verified = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" className="text-[#0095f6] fill-current shrink-0">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.177 14.232l-3.536-3.536 1.414-1.414 2.122 2.121 4.596-4.596 1.414 1.414-5.01 5.011z" />
  </svg>
);

const RightSidebar = () => {
  const me: any = useAuthStore((s: any) => s.user);
  const [users, setUsers] = useState<any[] | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const load = () => { setUsers(null); axiosInstance.get("/api/follow/suggestions?limit=5").then((r) => setUsers(r.data.users || [])).catch(() => setUsers([])); };
  useEffect(() => { if (me?._id) load(); }, [me?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFollow = async (id: string) => {
    if (busy[id]) return;
    const next = !followed[id];
    setBusy((b) => ({ ...b, [id]: true })); setFollowed((f) => ({ ...f, [id]: next }));
    try { next ? await axiosInstance.post(`/api/follow/${id}`) : await axiosInstance.delete(`/api/follow/${id}`); }
    catch { setFollowed((f) => ({ ...f, [id]: !next })); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const avatar = (u: any) => u?.profilePicture || `https://i.pravatar.cc/150?u=${u?._id}`;
  return (
    <aside className="hidden xl:block w-[320px] shrink-0 pt-6">
      <div className="flex items-center gap-3 mb-5 px-1">
        <Link href="/profile">
          <div className="w-11 h-11 rounded-full overflow-hidden story-gradient p-[2px] shrink-0">
            <div className="w-full h-full rounded-full bg-ig-surface p-[1px]">
              <img src={avatar(me)} alt={me?.username || "me"} className="w-full h-full rounded-full object-cover" />
            </div>
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href="/profile" className="flex items-center gap-1 text-sm font-semibold text-ig-text hover:opacity-70 truncate">{me?.username}{me?.isVerified && <Verified />}</Link>
          <p className="text-sm text-ig-muted truncate">{me?.fullName}</p>
        </div>
        <Link href="/login" className="text-xs font-semibold text-[#0095f6] hover:text-[#1877f2] transition-colors shrink-0">Switch</Link>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-sm font-semibold text-ig-muted">Suggested for you</p>
        <div className="flex items-center gap-3">
          <button onClick={load} aria-label="refresh suggestions" className="text-ig-muted hover:text-ig-text transition-colors"><RefreshCw size={13} /></button>
          <Link href="/search" className="text-xs font-semibold text-ig-text hover:opacity-70">See All</Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {!users && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-1"><div className="ig-skeleton w-8 h-8 rounded-full" /><div className="flex-1 space-y-1.5"><div className="ig-skeleton h-2.5 w-24 rounded" /><div className="ig-skeleton h-2 w-32 rounded" /></div></div>
        ))}
        {users && !users.length && <p className="text-xs text-ig-muted px-1">You&apos;re following everyone — nice! 🎉</p>}
        {users?.map((u) => (
          <div key={u._id} className="flex items-center gap-3 px-1 ig-fade-in">
            <Link href={`/profile/${u.username}`}>
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"><img src={avatar(u)} alt={u.username} className="w-full h-full object-cover" /></div>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <Link href={`/profile/${u.username}`} className="text-xs font-semibold text-ig-text hover:opacity-70 truncate">{u.username}</Link>
                {u.isVerified && <Verified />}
              </div>
              <p className="text-xs text-ig-muted truncate">
                {u.mutualCount > 0
                  ? `Followed by ${u.mutualVia}${u.mutualCount > 1 ? ` + ${u.mutualCount - 1} more` : ""}`
                  : `${u.followersCount || 0} followers · Popular`}
              </p>
            </div>
            <button onClick={() => toggleFollow(u._id)} disabled={busy[u._id]}
              className={`text-xs font-semibold transition-colors shrink-0 disabled:opacity-50 ${followed[u._id] ? "text-ig-text hover:opacity-70" : "text-[#0095f6] hover:text-[#1877f2] dark:text-[#38b6ff] dark:hover:text-[#5cc8ff]"}`}>
              {followed[u._id] ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 px-1">
        <div className="flex flex-wrap gap-x-2 gap-y-1 mb-3">
          {["About","Help","Press","API","Jobs","Privacy","Terms","Locations","Language"].map((item) => (
            <a key={item} href="#" className="text-[11px] text-ig-muted hover:underline">{item}</a>
          ))}
        </div>
        <p className="text-[11px] text-ig-muted uppercase tracking-wide">&copy; 2026 Instagram from Meta</p>
      </div>
    </aside>
  );
};

export default RightSidebar;
