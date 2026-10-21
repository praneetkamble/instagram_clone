"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function OtpForm({ destination, minutes, note, onVerify, onResend, onCancel }: {
  destination: string; minutes: number; note?: string;
  onVerify: (code: string) => Promise<void>; onResend?: () => Promise<void>; onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErr(t("validation.otp"));
    setBusy(true); setErr("");
    try { await onVerify(code); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="otp-form">
      <h2 className="text-base font-semibold text-ig-text text-center">{t("auth.otpTitle")}</h2>
      {note && <p className="text-xs text-ig-muted text-center">{note}</p>}
      <p className="text-sm text-ig-muted text-center">{t("auth.otpSent", { destination, minutes })}</p>
      <input inputMode="numeric" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder={t("auth.otpPlaceholder")}
        className="w-full bg-ig-bg border border-ig-border rounded-[3px] text-center tracking-[0.5em] text-lg px-2 py-2 text-ig-text focus:outline-none focus:border-ig-muted" />
      {err && <p className="text-xs text-[#ed4956] text-center">{err}</p>}
      <button disabled={busy} className="w-full bg-[#0095f6] text-white text-sm font-semibold rounded-lg py-[7px] disabled:opacity-50">{busy ? t("common.loading") : t("auth.verify")}</button>
      <div className="flex justify-between text-xs">
        {onResend ? <button type="button" className="text-[#0095f6]" onClick={async () => { setErr(""); try { await onResend(); } catch (e: any) { setErr(e.message); } }}>{t("auth.resend")}</button> : <span />}
        {onCancel && <button type="button" className="text-ig-muted" onClick={onCancel}>{t("common.cancel")}</button>}
      </div>
    </form>
  );
}
