"use client";
import { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, Image as ImageIcon, CalendarClock, CircleDashed, MessageCircle, Flag, Crown, IndianRupee, ShieldAlert, Heart, TrendingUp } from "lucide-react";
import { HBars, Donut } from "@/components/insta/Charts";
import PageShell, { Card, StatCard, Skeleton, inputCls, btnCls, btn2Cls } from "@/components/insta/PageShell";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

type Field = { key: string; type?: "text" | "select" | "bool" | "date" | "number"; options?: string[] };
type ResCfg = {
  label: string; columns: { key: string; render?: (r: any, fmt: any) => any }[];
  filters: { key: string; label: string; options: string[] }[];
  edit: Field[]; create?: Field[]; sorts: string[]; readOnly?: boolean; dateLabel?: string;
};
// translate raw enum values (status, plan, …) – falls back to the raw value
export const tv = (t: (k: string) => string, v: any) => { if (v == null || v === "") return ""; const k = `val.${v}`; const r = t(k); return r === k ? String(v) : r; };
const ENUM_COLS = new Set(["role", "status", "plan", "visibility", "privacy", "targetType", "state", "deviceType", "language"]);
const get = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const pic = (r: any) => r?.media?.[0]?.url ? <img src={r.media[0].url} className="w-10 h-10 object-cover rounded" alt="" /> : null;

const CFG: Record<string, ResCfg> = {
  users: {
    label: "admin.users",
    columns: [{ key: "username" }, { key: "email" }, { key: "phone" }, { key: "role" }, { key: "status" }, { key: "plan" }, { key: "isVerified", render: (r) => (r.isVerified ? "✓" : "—") }, { key: "lastActiveAt", render: (r, f) => f(r.lastActiveAt) }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "status", label: "admin.filter.status", options: ["active", "suspended", "banned"] }, { key: "plan", label: "admin.filter.plan", options: ["free", "bronze", "silver", "gold"] }, { key: "verified", label: "admin.filter.verified", options: ["true", "false"] }, { key: "activity", label: "admin.filter.activity", options: ["active", "inactive"] }, { key: "role", label: "admin.filter.role", options: ["user", "admin"] }],
    edit: [{ key: "fullName" }, { key: "email" }, { key: "phone" }, { key: "role", type: "select", options: ["user", "admin"] }, { key: "status", type: "select", options: ["active", "suspended", "banned"] }, { key: "plan", type: "select", options: ["free", "bronze", "silver", "gold"] }, { key: "planExpiresAt", type: "date" }, { key: "isVerified", type: "bool" }, { key: "language", type: "select", options: ["en", "es", "hi", "pt", "zh", "fr"] }],
    create: [{ key: "username" }, { key: "fullName" }, { key: "email" }, { key: "password" }, { key: "phone" }, { key: "role", type: "select", options: ["user", "admin"] }, { key: "plan", type: "select", options: ["free", "bronze", "silver", "gold"] }],
    sorts: ["createdAt", "username", "lastActiveAt", "followersCount"],
  },
  posts: {
    label: "admin.posts",
    columns: [{ key: "media", render: pic }, { key: "user.username" }, { key: "caption", render: (r) => (r.caption || "").slice(0, 60) }, { key: "visibility" }, { key: "status", render: (r) => r.status || "published" }, { key: "likesCount" }, { key: "isDeleted", render: (r) => (r.isDeleted ? "deleted" : "") }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "visibility", label: "admin.filter.visibility", options: ["public", "followers"] }, { key: "status", label: "admin.filter.status", options: ["published", "scheduled", "cancelled", "failed"] }, { key: "deleted", label: "common.delete", options: ["true", "false"] }],
    edit: [{ key: "caption" }, { key: "location" }, { key: "visibility", type: "select", options: ["public", "followers"] }, { key: "status", type: "select", options: ["published", "scheduled", "cancelled", "failed"] }, { key: "isDeleted", type: "bool" }],
    sorts: ["createdAt", "likesCount", "commentsCount"],
  },
  scheduled: {
    label: "admin.scheduled", dateLabel: "scheduledAt",
    columns: [{ key: "media", render: pic }, { key: "user.username" }, { key: "caption", render: (r) => (r.caption || "").slice(0, 60) }, { key: "status" }, { key: "scheduledAt", render: (r, f) => f(r.scheduledAt) }, { key: "publishedAt", render: (r, f) => f(r.publishedAt) }, { key: "publishAttempts" }, { key: "publishErrors", render: (r) => r.publishErrors?.map((e: any) => e.message).join("; ") }],
    filters: [{ key: "status", label: "admin.filter.status", options: ["scheduled", "published", "cancelled", "failed"] }],
    edit: [{ key: "caption" }, { key: "status", type: "select", options: ["scheduled", "published", "cancelled", "failed"] }, { key: "scheduledAt", type: "date" }],
    sorts: ["scheduledAt", "createdAt", "publishAttempts"],
  },
  stories: {
    label: "admin.stories",
    columns: [{ key: "media", render: pic }, { key: "user.username" }, { key: "privacy" }, { key: "media.length", render: (r) => r.media.length }, { key: "viewsCount" }, { key: "uniqueViewers" }, { key: "reactionsCount" }, { key: "state", render: (r) => (r.isDeleted ? "deleted" : r.isArchived || new Date(r.expiresAt) < new Date() ? "archived" : "active") }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "privacy", label: "admin.filter.privacy", options: ["public", "followers", "close_friends"] }, { key: "state", label: "admin.filter.state", options: ["active", "archived", "deleted"] }],
    edit: [{ key: "caption" }, { key: "privacy", type: "select", options: ["public", "followers", "close_friends"] }, { key: "isArchived", type: "bool" }, { key: "isDeleted", type: "bool" }, { key: "expiresAt", type: "date" }],
    sorts: ["createdAt", "viewsCount", "uniqueViewers"],
  },
  comments: {
    label: "admin.comments",
    columns: [{ key: "user.username" }, { key: "text" }, { key: "post.caption", render: (r) => (r.post?.caption || "").slice(0, 40) }, { key: "isHidden", render: (r) => (r.isHidden ? "hidden" : "") }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "hidden", label: "admin.filter.hidden", options: ["true", "false"] }],
    edit: [{ key: "text" }, { key: "isHidden", type: "bool" }], sorts: ["createdAt"],
  },
  subscriptions: {
    label: "admin.subscriptions",
    columns: [{ key: "user.username" }, { key: "plan" }, { key: "amount", render: (r) => `₹${r.amount}` }, { key: "status" }, { key: "razorpayOrderId" }, { key: "razorpayPaymentId" }, { key: "invoiceNumber" }, { key: "endsAt", render: (r, f) => f(r.endsAt) }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "status", label: "admin.filter.status", options: ["created", "active", "failed", "cancelled", "expired"] }, { key: "plan", label: "admin.filter.plan", options: ["bronze", "silver", "gold"] }],
    edit: [{ key: "status", type: "select", options: ["created", "active", "failed", "cancelled", "expired"] }, { key: "endsAt", type: "date" }, { key: "autoRenew", type: "bool" }, { key: "failureReason" }],
    create: [{ key: "user" }, { key: "plan", type: "select", options: ["bronze", "silver", "gold"] }, { key: "status", type: "select", options: ["active", "created"] }, { key: "endsAt", type: "date" }],
    sorts: ["createdAt", "amount", "endsAt"],
  },
  reports: {
    label: "admin.reports",
    columns: [{ key: "reporter.username" }, { key: "targetType" }, { key: "targetId" }, { key: "reason" }, { key: "status" }, { key: "resolutionNote" }, { key: "createdAt", render: (r, f) => f(r.createdAt) }],
    filters: [{ key: "status", label: "admin.filter.status", options: ["open", "reviewing", "resolved", "dismissed"] }, { key: "targetType", label: "admin.filter.targetType", options: ["user", "post", "story", "comment"] }],
    edit: [{ key: "status", type: "select", options: ["open", "reviewing", "resolved", "dismissed"] }, { key: "resolutionNote" }], sorts: ["createdAt"],
  },
  "login-history": {
    label: "admin.logins", readOnly: true,
    columns: [{ key: "createdAt", render: (r, f) => f(r.createdAt) }, { key: "email" }, { key: "browser" }, { key: "os" }, { key: "deviceType" }, { key: "ip" }, { key: "status" }, { key: "reason" }],
    filters: [{ key: "status", label: "admin.filter.status", options: ["success", "failed", "otp_required", "denied", "locked"] }, { key: "deviceType", label: "admin.filter.deviceType", options: ["Desktop", "Laptop", "Mobile", "Tablet"] }],
    edit: [], sorts: ["createdAt"],
  },
  "audit-logs": {
    label: "admin.audit", readOnly: true,
    columns: [{ key: "createdAt", render: (r, f) => f(r.createdAt) }, { key: "actor.username" }, { key: "action" }, { key: "targetType" }, { key: "targetId" }, { key: "details", render: (r) => <code className="text-[10px]">{JSON.stringify(r.details || {}).slice(0, 120)}</code> }, { key: "ip" }],
    filters: [], edit: [], sorts: ["createdAt"],
  },
};

function Overview() {
  const { t } = useI18n();
  const [s, setS] = useState<any>(null);
  useEffect(() => { axiosInstance.get("/api/admin/stats").then((r) => setS(r.data.stats)).catch(() => {}); }, []);
  if (!s) return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const I = [Users, UserCheck, ImageIcon, CalendarClock, CircleDashed, MessageCircle, Flag, Crown, IndianRupee, ShieldAlert, Heart, TrendingUp, Flag];
  const items: [string, any][] = [[t("admin.users"), s.users], [t("admin.activeUsers"), s.activeUsers], [t("admin.posts"), s.posts], [t("admin.scheduled"), s.scheduled], [t("admin.activeStories"), s.activeStories], [t("admin.comments"), s.comments], [t("admin.openReports"), s.openReports], [t("admin.activeSubs"), s.activeSubscriptions], [t("admin.revenue"), `₹${s.revenue}`], [t("admin.failedLogins"), s.failedLogins7d], [t("admin.likes"), s.likes ?? 0], [t("admin.engagement"), s.engagementPerPost ?? 0], [t("admin.reportedContent"), s.reportedTotal ?? 0]];
  const dist = Object.entries(s.planDistribution || {}).map(([k, v]) => ({ label: tv(t, k), value: Number(v) }));
  const totalU = Math.max(1, s.users), paid = dist.filter((d) => !/free|gratis|grátis|免费|gratuit|मुफ़्त/i.test(d.label)).reduce((a, d) => a + d.value, 0);
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[20px] ig-grad-anim p-5 md:p-7 text-white shadow-[0_20px_50px_-20px_rgba(150,47,191,.6)]">
        <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
        <p className="text-xs uppercase tracking-[.2em] text-white/75 font-semibold relative">{t("admin.overview")}</p>
        <p className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1 relative">₹{s.revenue}</p>
        <p className="text-sm text-white/85 relative">{t("admin.revenue")} · {t("admin.heroText")}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 ig-stagger" data-testid="admin-stats">{items.map(([k, v], i) => { const Ic = I[i]; return <StatCard key={k} label={k} value={v} icon={<Ic size={16} />} accent={i === 8} trend={i === 1 ? Math.round((s.activeUsers / totalU) * 100) : undefined} />; })}</div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2"><h3 className="font-semibold text-ig-text mb-4">{t("admin.planDist")}</h3><HBars items={dist} /></Card>
        <Card><h3 className="font-semibold text-ig-text mb-3">{t("admin.activeSubs")}</h3><Donut value={(paid / totalU) * 100} label={`${paid} / ${s.users}`} /></Card>
      </div>
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: any; onChange: (v: any) => void }) {
  const { t } = useI18n();
  if (f.type === "select") return <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{f.options!.map((o) => <option key={o} value={o}>{tv(t, o)}</option>)}</select>;
  if (f.type === "bool") return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  if (f.type === "date") return <input type="datetime-local" className={inputCls} value={value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
  return <input className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

function ResourceTable({ name }: { name: string }) {
  const { t, fmtDate } = useI18n();
  const cfg = CFG[name];
  const [q, setQ] = useState({ q: "", from: "", to: "", sort: cfg.sorts[0], order: "desc", page: 1, limit: 20 } as Record<string, any>);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [data, setData] = useState<any>({ items: [], total: 0, pages: 1 });
  const [edit, setEdit] = useState<any>(null);
  const [creating, setCreating] = useState<any>(null);
  const qs = useMemo(() => new URLSearchParams(Object.entries({ ...q, ...filters }).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, String(v)])).toString(), [q, filters]);
  const load = () => axiosInstance.get(`/api/admin/${name}?${qs}`).then((r) => setData(r.data)).catch((e) => toast.add({ type: "error", title: errorText(t, e) }));
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [qs]);
  const fmt = (d: any) => (d ? fmtDate(d, { dateStyle: "short", timeStyle: "short" }) : "—");
  const save = async () => {
    try { await axiosInstance.put(`/api/admin/${name}/${edit._id}`, Object.fromEntries(cfg.edit.map((f) => [f.key, edit[f.key]]))); setEdit(null); toast.add({ type: "success", title: t("admin.saved") }); load(); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const create = async () => {
    try { await axiosInstance.post(`/api/admin/${name}`, creating); setCreating(null); toast.add({ type: "success", title: t("admin.saved") }); load(); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const del = async (id: string) => {
    if (!confirm(t("admin.deleteConfirm"))) return;
    try { await axiosInstance.delete(`/api/admin/${name}/${id}`); load(); } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const set = (k: string, v: any) => setQ({ ...q, [k]: v, page: k === "page" ? v : 1 });
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap gap-2 items-end">
        <input className={inputCls + " sm:max-w-[220px]"} placeholder={t("admin.keyword")} value={q.q} onChange={(e) => set("q", e.target.value)} data-testid="admin-search" />
        {cfg.filters.map((f) => (
          <label key={f.key} className="text-xs text-ig-muted">{t(f.label)}
            <select className={inputCls + " min-w-[110px]"} value={filters[f.key] || ""} onChange={(e) => { setFilters({ ...filters, [f.key]: e.target.value }); set("page", 1); }}>
              <option value="">{t("common.all")}</option>{f.options.map((o) => <option key={o} value={o}>{tv(t, o)}</option>)}
            </select>
          </label>
        ))}
        <label className="text-xs text-ig-muted">{t("common.from")}{cfg.dateLabel ? ` (${cfg.dateLabel})` : ""}<input type="date" className={inputCls} value={q.from} onChange={(e) => set("from", e.target.value)} /></label>
        <label className="text-xs text-ig-muted">{t("common.to")}<input type="date" className={inputCls} value={q.to} onChange={(e) => set("to", e.target.value)} /></label>
        <label className="text-xs text-ig-muted">{t("admin.sortBy")}
          <select className={inputCls} value={q.sort} onChange={(e) => set("sort", e.target.value)}>{cfg.sorts.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <select className={inputCls + " max-w-[140px]"} value={q.order} onChange={(e) => set("order", e.target.value)}><option value="desc">{t("admin.newest")}</option><option value="asc">{t("admin.oldest")}</option></select>
        {cfg.create && <button className={btnCls} onClick={() => setCreating({})}>{t("admin.create")}</button>}
      </Card>
      <p className="text-xs text-ig-muted">{t("admin.total", { total: data.total })}</p>
      <div className="overflow-x-auto ig-card">
        <table className="ig-table w-full min-w-[720px] text-xs text-ig-text" data-testid="admin-table">
          <thead className="text-left text-ig-muted"><tr>{cfg.columns.map((c) => <th key={c.key} className="p-2 whitespace-nowrap">{c.key}</th>)}{!cfg.readOnly && <th className="p-2">{t("common.actions")}</th>}</tr></thead>
          <tbody>
            {data.items.map((r: any) => (
              <tr key={r._id} className="border-t border-ig-border align-top">
                {cfg.columns.map((c) => <td key={c.key} className="p-2 max-w-[260px] break-words">{(() => { const v = c.render ? c.render(r, fmt) : get(r, c.key); return ENUM_COLS.has(c.key) && (typeof v === "string") ? tv(t, v) : typeof v === "object" && v !== null && !("$$typeof" in v) ? String(v) : (v ?? ""); })()}</td>)}
                {!cfg.readOnly && <td className="p-2 whitespace-nowrap"><button className="text-[#0095f6] mr-2" onClick={() => setEdit({ ...r })}>{t("common.edit")}</button><button className="text-[#ed4956]" onClick={() => del(r._id)}>{t("common.delete")}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ig-text">
        <button className={btn2Cls} disabled={q.page <= 1} onClick={() => set("page", q.page - 1)}>{t("common.prev")}</button>
        <span>{t("common.page", { page: q.page, pages: Math.max(1, data.pages) })}</span>
        <button className={btn2Cls} disabled={q.page >= data.pages} onClick={() => set("page", q.page + 1)}>{t("common.next")}</button>
        <select className={inputCls + " max-w-[80px]"} value={q.limit} onChange={(e) => set("limit", +e.target.value)}>{[10, 20, 50, 100].map((n) => <option key={n}>{n}</option>)}</select>
      </div>
      {(edit || creating) && (
        <div className="fixed inset-0 z-[100] ig-backdrop flex items-center justify-center p-4">
          <Card className="ig-modal w-full max-w-md space-y-2 max-h-[90vh] overflow-auto">
            <h3 className="font-semibold text-ig-text">{edit ? t("common.edit") : t("admin.create")} · {t(cfg.label)}</h3>
            {(edit ? cfg.edit : cfg.create!).map((f) => (
              <label key={f.key} className="block text-xs text-ig-muted">{f.key}
                <FieldInput f={f} value={(edit || creating)[f.key]} onChange={(v) => (edit ? setEdit({ ...edit, [f.key]: v }) : setCreating({ ...creating, [f.key]: v }))} />
              </label>
            ))}
            <div className="flex justify-end gap-2"><button className={btn2Cls} onClick={() => { setEdit(null); setCreating(null); }}>{t("common.cancel")}</button><button className={btnCls} onClick={edit ? save : create}>{t("common.save")}</button></div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const me = useAuthStore((s: any) => s.user);
  const [tab, setTab] = useState("overview");
  if (me?.role !== "admin") return <PageShell title={t("admin.title")}><p className="text-[#ed4956]">{t("admin.notAdmin")}</p></PageShell>;
  return (
    <PageShell title={t("admin.title")} wide>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {["overview", ...Object.keys(CFG)].map((k) => <button key={k} onClick={() => setTab(k)} className={`ig-pill ${tab === k ? "ig-pill-on" : "ig-pill-off"}`}>{k === "overview" ? t("admin.overview") : t(CFG[k].label)}</button>)}
      </div>
      {tab === "overview" ? <Overview /> : <ResourceTable key={tab} name={tab} />}
    </PageShell>
  );
}
