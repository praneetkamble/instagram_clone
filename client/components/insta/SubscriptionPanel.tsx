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
    <div className="space-y-4" data-testid="subscription-panel">
      <div className={`rounded-lg p-3 text-sm ${open ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-orange-500/10 text-orange-700 dark:text-orange-400"}`} data-testid="payment-window">
        {open ? t("sub.windowOpen") : t("sub.windowClosed")}
      </div>
      <p className="text-sm text-ig-text">{t("create.quota", { used: info.quota.used, limit: info.quota.limit ?? t("create.unlimited"), plan: planName(cur) })}{info.current.expiresAt && cur !== "free" ? ` · ${t("sub.validUntil", { date: fmtDate(info.current.expiresAt) })}` : ""}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
        {info.plans.map((p: any) => (
          <div key={p.id} className={`relative rounded-[16px] ${p.id === "gold" ? "ig-grad p-[2px] shadow-[0_12px_32px_-12px_rgba(220,39,67,.55)] lg:-translate-y-1" : ""}`}>
          {p.id === "gold" && <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 ig-grad text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow">★ {p.name}</span>}
          <div className={`ig-card ig-card-hover h-full p-5 flex flex-col ${p.id === "gold" ? "!border-transparent !rounded-[14px]" : ""} ${cur === p.id ? "ring-2 ring-[#0095f6]" : ""}`}>
            <h3 className="font-semibold text-ig-text flex items-center gap-2">{p.name}{cur === p.id && <span className="text-[10px] font-semibold text-[#0095f6] bg-[#0095f6]/10 px-2 py-0.5 rounded-full">{t("sub.currentPlan")}</span>}</h3>
            <p className={`text-3xl font-extrabold tracking-tight mt-2 ${p.id === "gold" ? "ig-grad-text" : "text-ig-text"}`}>₹{p.price}<span className="text-xs font-normal text-ig-muted">{p.price ? t("sub.perMonth") : ""}</span></p>
            <p className="text-sm text-ig-muted mb-4 flex-1">✓ {p.postLimit ? t("sub.posts", { count: p.postLimit }) : t("sub.unlimitedPosts")}</p>
            {p.id === "free" ? null : (
              <button className={(cur === p.id ? btn2Cls : p.id === "gold" ? btnGradCls : btnCls) + " w-full"} disabled={!open || busy === p.id} title={!open ? t("sub.windowClosed") : ""} onClick={() => buy(p.id)}>
                {cur === p.id ? t("sub.renew") : t("sub.choose", { plan: p.name })}
              </button>
            )}
          </div></div>
        ))}
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
