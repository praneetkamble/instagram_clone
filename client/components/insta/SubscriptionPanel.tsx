"use client";
import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import useAuthStore from "@/store/authStore";
import { useI18n, errorText } from "@/lib/i18n";
import { toast } from "../ui/toast";
import { Card, btnCls, btn2Cls, btnGradCls, Skeleton } from "./PageShell";

declare global { interface Window { Razorpay: any } }
const loadRzp = () => new Promise<boolean>((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

export default function SubscriptionPanel() {
  const { t, fmtDate } = useI18n();
  const setUser = useAuthStore((s: any) => s.setUser);
  const [info, setInfo] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [mockOrder, setMockOrder] = useState<any>(null);
  const load = async () => {
    const [p, h] = await Promise.all([axiosInstance.get("/api/subscriptions/plans"), axiosInstance.get("/api/subscriptions/history")]);
    setInfo(p.data); setHistory(h.data.items);
  };
  useEffect(() => { load().catch(() => {}); const id = setInterval(() => load().catch(() => {}), 60000); return () => clearInterval(id); }, []);
  const planName = (id: string) => info?.plans.find((p: any) => p.id === id)?.name || id;

  const verify = async (payload: any, plan: string) => {
    const v = await axiosInstance.post("/api/subscriptions/verify", payload);
    setUser(v.data.user);
    toast.add({ type: "success", title: t("sub.success", { plan: planName(plan) }) });
    load();
  };
  const fail = async (orderId: string, reason: string) => {
    await axiosInstance.post("/api/subscriptions/failure", { orderId, reason }).catch(() => {});
    toast.add({ type: "error", title: t("sub.failed", { reason }) });
    load();
  };
  const buy = async (plan: string) => {
    setBusy(plan);
    try {
      const { data: order } = await axiosInstance.post("/api/subscriptions/order", { plan });
      if (order.mockMode) { setMockOrder(order); return; }
      if (!(await loadRzp())) throw new Error("Razorpay checkout failed to load");
      const rzp = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: "InstAI", description: `${planName(plan)} plan`,
        prefill: { name: order.user.name, email: order.user.email, contact: order.user.contact },
        handler: (resp: any) => verify(resp, plan).catch((e) => toast.add({ type: "error", title: errorText(t, e) })),
        modal: { ondismiss: () => fail(order.orderId, "checkout_dismissed") },
        theme: { color: "#0095f6" },
      });
      rzp.on("payment.failed", (r: any) => fail(order.orderId, r.error?.description || "payment_failed"));
      rzp.open();
    } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); load(); }
    finally { setBusy(""); }
  };
  const mockPay = async (outcome: "success" | "failed") => {
    const order = mockOrder; setMockOrder(null);
    try {
      const { data } = await axiosInstance.post("/api/subscriptions/mock-checkout", { orderId: order.orderId, outcome });
      if (data.outcome === "success") await verify(data, order.plan);
      else await fail(order.orderId, data.error.description);
    } catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  const cancel = async () => {
    if (!confirm(t("sub.cancelConfirm"))) return;
    try { await axiosInstance.post("/api/subscriptions/cancel"); toast.add({ type: "success", title: t("sub.cancelled") }); load(); }
    catch (e) { toast.add({ type: "error", title: errorText(t, e) }); }
  };
  if (!info) return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-44" />)}</div>;
  const cur = info.current.plan;
  const open = info.paymentWindow.open;
  return (
    <div className="space-y-5" data-testid="subscription-panel">
      <div className="relative overflow-hidden rounded-[20px] ig-grad-anim p-6 md:p-8 text-white shadow-[0_20px_50px_-20px_rgba(214,41,118,.6)]">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute right-6 bottom-4 text-6xl opacity-25 select-none hidden sm:block">✦</div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight relative">{t("sub.heroTitle")}</h2>
        <p className="text-sm md:text-base text-white/85 mt-1.5 max-w-lg relative">{t("sub.heroText")}</p>
      </div>
      <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${open ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-orange-500/10 text-orange-700 dark:text-orange-400"}`} data-testid="payment-window">
        <span className={`w-2 h-2 rounded-full ${open ? "bg-green-500 animate-pulse" : "bg-orange-500"}`} />{open ? t("sub.windowOpen") : t("sub.windowClosed")}
      </div>
      <p className="text-sm text-ig-text">{t("create.quota", { used: info.quota.used, limit: info.quota.limit ?? t("create.unlimited"), plan: planName(cur) })}{info.current.expiresAt && cur !== "free" ? ` · ${t("sub.validUntil", { date: fmtDate(info.current.expiresAt) })}` : ""}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-4 ig-stagger">
        {info.plans.map((p: any, idx: number) => {
          const gold = p.id === "gold";
          const feats: [string, boolean][] = [[p.postLimit ? t("sub.posts", { count: p.postLimit }) : t("sub.unlimitedPosts"), true], [t("sub.f.stories"), true], [t("sub.f.schedule"), idx >= 1], [t("sub.f.analytics"), idx >= 2], [t("sub.f.priority"), gold], [t("sub.f.badge"), gold]];
          return (
          <div key={p.id} className={`relative rounded-[18px] transition-transform duration-300 hover:-translate-y-1.5 ${gold ? "ig-border-anim lg:-translate-y-2 lg:hover:-translate-y-3.5" : ""}`} data-plan={p.id}>
            {gold && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 ig-grad-anim text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg whitespace-nowrap">★ {t("sub.mostPopular")}</span>}
            <div className={`ig-card h-full p-5 flex flex-col !rounded-[18px] ${gold ? "!border-transparent" : ""} ${cur === p.id ? "ring-2 ring-[#0095f6]" : ""}`}>
              <h3 className="font-semibold text-ig-text flex items-center gap-2 flex-wrap">{p.name}{cur === p.id && <span className="text-[10px] font-semibold text-[#0095f6] bg-[#0095f6]/10 px-2 py-0.5 rounded-full">{t("sub.currentPlan")}</span>}</h3>
              <p className={`text-4xl font-extrabold tracking-tight mt-3 ${gold ? "ig-grad-text" : "text-ig-text"}`}>₹{p.price}<span className="text-xs font-medium text-ig-muted">{p.price ? t("sub.perMonth") : ""}</span></p>
              <ul className="mt-4 mb-5 space-y-2 flex-1">
                {feats.map(([f, ok]) => <li key={f} className={`flex items-center gap-2 text-[13px] ${ok ? "text-ig-text" : "text-ig-muted line-through opacity-60"}`}><span className={`w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${ok ? (gold ? "ig-grad text-white" : "bg-[#0095f6]/12 text-[#0095f6]") : "bg-ig-hover text-ig-muted"}`}>{ok ? "✓" : "–"}</span>{f}</li>)}
              </ul>
              {p.id === "free" ? <div className="h-[38px]" /> : (
                <button className={(cur === p.id ? btn2Cls : gold ? btnGradCls : btnCls) + " w-full !py-2.5"} disabled={!open || busy === p.id} title={!open ? t("sub.windowClosed") : ""} onClick={() => buy(p.id)}>
                  {cur === p.id ? t("sub.renew") : t("sub.choose", { plan: p.name })}
                </button>
              )}
            </div>
          </div>);
        })}
      </div>
      {info.current.subscription?.status === "active" && <button className="text-sm text-[#ed4956]" onClick={cancel}>{t("sub.cancel")}</button>}
      <Card>
        <h3 className="font-semibold text-ig-text mb-2">{t("sub.history")}</h3>
        <div className="overflow-x-auto"><table className="ig-table w-full min-w-[560px] text-xs text-ig-text">
          <thead className="text-left text-ig-muted"><tr><th>{t("common.date")}</th><th>{t("sub.plan")}</th><th>{t("sub.amount")}</th><th>{t("common.status")}</th><th>{t("sub.invoice")}</th><th>{t("common.to")}</th></tr></thead>
          <tbody>{history.map((h) => <tr key={h._id} className="border-t border-ig-border"><td className="py-1">{fmtDate(h.createdAt)}</td><td>{planName(h.plan)}</td><td>₹{h.amount}</td><td>{t(`val.${h.status}`)}{h.failureReason ? ` (${h.failureReason})` : ""}</td><td>{h.invoiceNumber || "—"}</td><td>{h.endsAt ? fmtDate(h.endsAt, { dateStyle: "medium" }) : "—"}</td></tr>)}</tbody>
        </table></div>
      </Card>
      {mockOrder && (
        <div className="fixed inset-0 z-[100] ig-backdrop flex items-center justify-center p-4">
          <Card className="ig-modal max-w-sm w-full space-y-3">
            <h3 className="font-semibold text-ig-text">{t("sub.mockTitle")}</h3>
            <p className="text-sm text-ig-text">{planName(mockOrder.plan)} · ₹{mockOrder.amount / 100} · {mockOrder.orderId}</p>
            <button className={btnCls + " w-full"} onClick={() => mockPay("success")}>{t("sub.mockPay")}</button>
            <button className={btn2Cls + " w-full"} onClick={() => mockPay("failed")}>{t("sub.mockFail")}</button>
          </Card>
        </div>
      )}
    </div>
  );
}
