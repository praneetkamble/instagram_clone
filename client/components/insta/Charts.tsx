"use client";
import { useId, useState } from "react";

const STOPS = ["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"];

export function AreaChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, P = { l: 30, r: 12, t: 16, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => P.l + (i / n) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => [data.length === 1 ? W / 2 : x(i), y(d.value)]);
  // smooth curve (catmull-rom → bezier)
  const path = pts.reduce((acc, p, i, a) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const p0 = a[i - 2] || a[i - 1], p1 = a[i - 1], p3 = a[i + 1] || p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, p1[1] + (p[1] - p0[1]) / 6], c2 = [p[0] - (p3[0] - p1[0]) / 6, p[1] - (p3[1] - p1[1]) / 6];
    return `${acc} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p[0]},${p[1]}`;
  }, "");
  const area = `${path} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" onMouseLeave={() => setHover(null)} data-testid="timeline-chart">
      <defs>
        <linearGradient id={`l${id}`} x1="0" x2="1">{STOPS.map((c, i) => <stop key={c} offset={`${i * 25}%`} stopColor={c} />)}</linearGradient>
        <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d62976" stopOpacity=".35" /><stop offset="100%" stopColor="#962fbf" stopOpacity="0" /></linearGradient>
      </defs>
      {ticks.map((tk) => <g key={tk}><line x1={P.l} x2={W - P.r} y1={y(tk)} y2={y(tk)} stroke="currentColor" className="text-ig-border" strokeDasharray="3 5" /><text x={P.l - 8} y={y(tk) + 4} textAnchor="end" fontSize="10" className="fill-ig-muted">{tk}</text></g>)}
      <path d={area} fill={`url(#a${id})`} />
      <path d={path} fill="none" stroke={`url(#l${id})`} strokeWidth="3" strokeLinecap="round" style={{ strokeDasharray: 2000, strokeDashoffset: 2000, animation: "igDraw 1.4s ease forwards" }} />
      {pts.map(([px, py], i) => (
        <g key={i} onMouseEnter={() => setHover(i)}>
          <rect x={px - 20} y={P.t} width={40} height={H - P.t - P.b} fill="transparent" />
          <circle cx={px} cy={py} r={hover === i ? 6 : 3.5} fill="#fff" stroke="#d62976" strokeWidth="2.5" style={{ transition: "r .15s" }} />
          {(data.length <= 12 || i % Math.ceil(data.length / 8) === 0) && <text x={px} y={H - 8} textAnchor="middle" fontSize="10" className="fill-ig-muted">{data[i].label}</text>}
        </g>
      ))}
      {hover !== null && (() => { const [px, py] = pts[hover]; const tx = Math.min(Math.max(px, 50), W - 50); return <g><line x1={px} x2={px} y1={P.t} y2={H - P.b} stroke="#d62976" strokeOpacity=".3" /><rect x={tx - 40} y={py - 34} width="80" height="24" rx="8" fill="#111" /><text x={tx} y={py - 18} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{data[hover].value} · {data[hover].label}</text></g>; })()}
    </svg>
  );
}

export function Donut({ value, label, size = 150 }: { value: number; label: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  const r = 54, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} data-testid="completion-donut">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <defs><linearGradient id={`d${id}`} x1="0" y1="0" x2="1" y2="1">{STOPS.map((s, i) => <stop key={s} offset={`${i * 25}%`} stopColor={s} />)}</linearGradient></defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-ig-hover" strokeWidth="14" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={`url(#d${id})`} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-extrabold ig-grad-text">{Math.round(v)}%</span><span className="text-[11px] text-ig-muted">{label}</span></div>
    </div>
  );
}

export function HBars({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="flex justify-between text-xs mb-1"><span className="text-ig-text font-medium">{it.label}</span><span className="text-ig-muted tabular-nums">{it.value}</span></div>
          <div className="h-2.5 rounded-full bg-ig-hover overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: it.color || `linear-gradient(90deg, ${STOPS[i % 5]}, ${STOPS[(i + 2) % 5]})`, transition: "width 1s cubic-bezier(.2,.8,.2,1)" }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, w = 80, h = 26 }: { values: number[]; w?: number; h?: number }) {
  const max = Math.max(1, ...values), n = Math.max(1, values.length - 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i / n) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return <svg width={w} height={h} className="overflow-visible"><path d={d} fill="none" stroke="#d62976" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
