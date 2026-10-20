"use client";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
export default function PageShell({ children, title, subtitle, wide = false }: { children: React.ReactNode; title?: string; subtitle?: string; wide?: boolean }) {
  return (
    <div className="bg-ig-bg min-h-screen">
      <MobileHeader />
      <Sidebar />
      <div className="md:ml-[72px] xl:ml-[244px] pt-[56px] md:pt-0 pb-20 md:pb-0">
        <main className={`${wide ? "max-w-[1240px]" : "max-w-[880px]"} mx-auto px-4 md:px-8 py-6 md:py-10 ig-fade-in`}>
          {title && (
            <header className="mb-6">
              <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-ig-text">{title}</h1>
              {subtitle && <p className="text-sm text-ig-muted mt-1">{subtitle}</p>}
              <div className="mt-3 h-[3px] w-12 rounded-full ig-grad" />
            </header>
          )}
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
export const Card = ({ children, className = "", hover = false }: any) => <div className={`ig-card p-4 md:p-5 ${hover ? "ig-card-hover" : ""} ${className}`}>{children}</div>;
export const inputCls = "ig-input";
export const btnCls = "ig-btn ig-btn-primary";
export const btnGradCls = "ig-btn ig-btn-gradient";
export const btn2Cls = "ig-btn ig-btn-ghost !py-1.5 !px-3";
export const pillCls = (on: boolean) => `ig-pill ${on ? "ig-pill-on" : "ig-pill-off"}`;
export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`ig-skeleton ${className}`} />;
export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 ig-fade-in">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full ig-grad blur-xl opacity-40 scale-125" />
        <div className="relative w-20 h-20 rounded-full story-gradient p-[3px]">
          <div className="w-full h-full rounded-full bg-ig-surface flex items-center justify-center text-ig-text text-2xl">{icon || "✨"}</div>
        </div>
        <span className="absolute -top-1 -right-2 text-lg ig-float">✦</span><span className="absolute bottom-0 -left-3 text-xs ig-float-2 opacity-70">✦</span>
      </div>
      <h3 className="text-lg font-bold tracking-tight text-ig-text">{title}</h3>
      {text && <p className="text-sm text-ig-muted mt-1 max-w-xs">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function StatCard({ label, value, icon, accent = false, testid, highlight = false, trend, spark }: { label: string; value: any; icon?: React.ReactNode; accent?: boolean; testid?: string; highlight?: boolean; trend?: number; spark?: React.ReactNode }) {
  return (
    <div className={`ig-card ig-card-hover p-4 relative overflow-hidden group ${highlight ? "ring-2 ring-[#d62976]/60" : ""}`}>
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full ig-grad opacity-[.08] group-hover:opacity-[.16] transition-opacity" />
      <div className="flex items-center justify-between gap-2 relative">
        <div className="flex items-center gap-2 text-ig-muted text-xs font-medium min-w-0">{icon && <span className="w-8 h-8 shrink-0 rounded-xl ig-grad text-white flex items-center justify-center shadow-[0_6px_14px_-6px_rgba(214,41,118,.8)]">{icon}</span>}<span className="truncate">{label}</span></div>
        {trend !== undefined && <span className={`ig-chip ${trend >= 0 ? "ig-chip-up" : "ig-chip-down"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%</span>}
      </div>
      <div className="flex items-end justify-between mt-3 relative">
        <div data-testid={testid} className={`text-2xl md:text-[30px] leading-none font-extrabold tracking-tight tabular-nums ${accent ? "ig-grad-text" : "text-ig-text"}`}>{value}</div>
        {spark}
      </div>
    </div>
  );
}
