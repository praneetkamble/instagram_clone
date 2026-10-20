"use client";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileHeader from "./MobileHeader";
export default function PageShell({ children, title, wide = false }: { children: React.ReactNode; title?: string; wide?: boolean }) {
  return (
    <div className="bg-ig-surface md:bg-ig-ig min-h-screen">
      <MobileHeader />
      <Sidebar />
      <div className="md:ml-[72px] xl:ml-[244px] pt-[60px] md:pt-0 pb-16 md:pb-0">
        <main className={`${wide ? "max-w-[1300px]" : "max-w-[900px]"} mx-auto px-4 md:px-8 py-6`}>
          {title && <h1 className="text-xl font-semibold text-ig-text mb-4">{title}</h1>}
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
export const Card = ({ children, className = "" }: any) => <div className={`bg-ig-surface border border-ig-border rounded-lg p-4 ${className}`}>{children}</div>;
export const inputCls = "w-full bg-ig-bg border border-ig-border rounded px-2 py-2 text-sm text-ig-text focus:outline-none focus:border-ig-muted";
export const btnCls = "bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
export const btn2Cls = "bg-ig-hover border border-ig-border text-ig-text rounded-lg px-3 py-1.5 text-sm disabled:opacity-50";
