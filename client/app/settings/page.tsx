"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageShell, { Card, inputCls, btnCls } from "@/components/insta/PageShell";
import LoginHistory from "@/components/insta/LoginHistory";
import SubscriptionPanel from "@/components/insta/SubscriptionPanel";
import OtpForm from "@/components/insta/OtpForm";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useI18n, errorText, LANGUAGES } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

const TABS = ["profile", "language", "security", "subscription", "closeFriends"] as const;

function ProfileTab() {
  const { t } = useI18n();
  const me = useAuthStore((s: any) => s.user);
  const setUser = useAuthStore((s: any) => s.setUser);
  const [f, setF] = useState({ fullName: me?.fullName || "", bio: me?.bio || "", website: me?.website || "", phone: me?.phone || "", profilePicture: me?.profilePicture || "" });
  const [err, setErr] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (f.phone && !/^\+?[1-9]\d{7,14}$/.test(f.phone.replace(/[\s()-]/g, ""))) return setErr(t("validation.phone"));
    if (!f.fullName) return setErr(t("validation.fullName"));
    try { const r = await axiosInstance.put("/api/auth/profile", f); setUser(r.data.user); toast.add({ type: "success", title: t("settings.saved") }); }
    catch (e) { setErr(errorText(t, e)); }
  };
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm text-ig-text">{label}<input type={type} className={inputCls + " mt-1"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <Card><form onSubmit={save} className="space-y-3 max-w-md">
      {field("fullName", t("auth.fullName"))}{field("phone", t("auth.phone"), "tel")}{field("bio", t("settings.bio"))}{field("website", t("settings.website"))}
      <p className="text-xs text-ig-muted">{t("auth.email")}: {me?.email}</p>
      {err && <p className="text-xs text-[#ed4956]">{err}</p>}
      <button className={btnCls}>{t("common.save")}</button>
    </form></Card>
  );
}

function LanguageTab() {
  const { t, lang } = useI18n();
  const setUser = useAuthStore((s: any) => s.setUser);
  const [target, setTarget] = useState<string>(lang);
  const [otp, setOtp] = useState<any>(null);
  const request = async () => {
    try {
      const r = await axiosInstance.post("/api/auth/language/request", { language: target });
      if (r.data.otpRequired) setOtp(r.data);
    } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const verify = async (code: string) => {
    try {
      const r = await axiosInstance.post("/api/auth/language/verify", { otpId: otp.otpId, code });
      setUser(r.data.user); setOtp(null);
      toast.add({ type: "success", title: t("settings.languageChanged") });
    } catch (e: any) { if (e?.response?.data?.code === "OTP_LOCKED") setOtp(null); throw new Error(errorText(t, e)); }
  };
  return (
    <Card className="max-w-md space-y-3">
      <p className="text-xs text-ig-muted">{t("settings.languageNote")}</p>
      {otp ? <OtpForm destination={otp.destination} minutes={otp.ttlMinutes} onVerify={verify} onResend={request} onCancel={() => setOtp(null)} /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <label key={l.code} className={`border rounded p-2 text-sm cursor-pointer text-ig-text ${target === l.code ? "border-[#0095f6]" : "border-ig-border"}`}>
                <input type="radio" name="lang" value={l.code} checked={target === l.code} onChange={() => setTarget(l.code)} className="mr-2" />
                {l.label} {lang === l.code && <span className="text-[10px] text-ig-muted">({t("settings.current")})</span>}
                <span className="block text-[10px] text-ig-muted">{l.code === "fr" ? "OTP → email" : "OTP → SMS"}</span>
              </label>
            ))}
          </div>
          <button className={btnCls} disabled={target === lang} onClick={request}>{t("common.confirm")}</button>
        </>
      )}
    </Card>
  );
}

function CloseFriendsTab() {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const load = async () => { const r = await axiosInstance.get("/api/auth/close-friends"); setList(r.data.closeFriends); };
  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setTimeout(async () => { const r = await axiosInstance.get(`/api/auth/search/users?q=${encodeURIComponent(q)}`); setResults(r.data.users); }, 250); return () => clearTimeout(id); }, [q]);
  const toggle = async (id: string) => { await axiosInstance.post(`/api/auth/close-friends/${id}`); load(); };
  const isCF = (id: string) => list.some((u) => u._id === id);
  return (
    <Card className="max-w-md space-y-3">
      <h3 className="font-semibold text-ig-text">{t("story.closeFriends")} ({list.length})</h3>
      <input className={inputCls} placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-ig-border">
        {[...list, ...results.filter((r) => !isCF(r._id))].map((u) => (
          <li key={u._id} className="flex items-center gap-2 py-2 text-sm text-ig-text">
            <img src={u.profilePicture || "/globe.svg"} className="w-8 h-8 rounded-full object-cover" alt="" />
            <span>{u.username}</span>
            <button onClick={() => toggle(u._id)} className={`ml-auto text-xs rounded px-2 py-1 ${isCF(u._id) ? "bg-green-600 text-white" : "border border-ig-border"}`}>
              {isCF(u._id) ? t("profile.removeCloseFriend") : t("profile.addCloseFriend")}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SettingsInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS as readonly string[]).includes(sp.get("tab") || "") ? (sp.get("tab") as string) : "profile";
  const labels: Record<string, string> = { profile: t("settings.editProfile"), language: t("settings.language"), security: t("settings.security"), subscription: t("nav.subscription"), closeFriends: t("story.closeFriends") };
  return (
    <PageShell title={t("settings.title")} wide>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {TABS.map((k) => <button key={k} onClick={() => router.push(`/settings?tab=${k}`)} className={`ig-pill ${tab === k ? "ig-pill-on" : "ig-pill-off"}`}>{labels[k]}</button>)}
      </div>
      {tab === "profile" && <ProfileTab />}
      {tab === "language" && <LanguageTab />}
      {tab === "security" && <LoginHistory />}
      {tab === "subscription" && <SubscriptionPanel />}
      {tab === "closeFriends" && <CloseFriendsTab />}
    </PageShell>
  );
}
export default function SettingsPage() { return <Suspense><SettingsInner /></Suspense>; }
