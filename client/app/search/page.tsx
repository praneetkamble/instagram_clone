"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X, BadgeCheck } from "lucide-react";
import PageShell, { Card } from "@/components/insta/PageShell";
import ExploreGrid, { useAllPosts } from "@/components/insta/ExploreGrid";
import axiosInstance from "@/lib/axios";
import { useI18n } from "@/lib/i18n";

export default function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const posts = useAllPosts(45);
  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      axiosInstance.get("/api/auth/search/users", { params: { q } }).then((r) => setUsers(r.data.users || [])).catch(() => setUsers([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);
  const ql = q.trim().toLowerCase();
  const matched = ql && posts ? posts.filter((p) => `${p.caption} ${p.location} ${p.user?.username}`.toLowerCase().includes(ql)) : posts;
  return (
    <PageShell title={t("nav.search")} wide>
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ig-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.placeholder")} className="ig-input !pl-11 !pr-10 !py-3 !rounded-2xl w-full" />
        {q && <button aria-label="clear" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ig-muted"><X size={18} /></button>}
      </div>
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-ig-text mb-3">{ql ? t("search.people") : t("search.suggestedPeople")}</h2>
        {loading && !users.length && <p className="text-sm text-ig-muted">{t("search.searching")}</p>}
        {!loading && !users.length && <p className="text-sm text-ig-muted">{t("search.noAccounts", { q })}</p>}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible -mx-1 px-1 pb-1">
          {users.map((u) => (
            <Link key={u._id} href={`/profile/${u.username}`} className="shrink-0 w-[150px] md:w-auto flex flex-col md:flex-row items-center gap-3 p-3 rounded-xl hover:bg-ig-hover transition-colors text-center md:text-left">
              <span className="story-gradient p-[2px] rounded-full"><img src={u.profilePicture || `https://i.pravatar.cc/150?u=${u._id}`} alt={u.username} className="w-14 h-14 md:w-11 md:h-11 rounded-full object-cover border-2 border-ig-surface" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 justify-center md:justify-start text-sm font-semibold text-ig-text truncate">{u.username}{u.isVerified && <BadgeCheck size={14} className="text-[#0095f6]" />}</span>
                <span className="block text-xs text-ig-muted truncate">{u.fullName}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
      <h2 className="text-sm font-semibold text-ig-text mb-3">{ql ? t("search.postsMatching", { q }) : t("nav.explore")}</h2>
      {matched && !matched.length ? <p className="text-sm text-ig-muted">{t("search.noPosts")}</p> : <ExploreGrid posts={matched} />}
    </PageShell>
  );
}
