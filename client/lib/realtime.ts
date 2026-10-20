"use client";
import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import axiosInstance from "./axios";
import useAuthStore from "@/store/authStore";
// NEXT_PUBLIC_REALTIME=socket → Socket.io push (needs a long-running server, e.g. local dev).
// Anything else (default) → HTTP polling, which works on Vercel serverless with no socket server.
export const REALTIME: "socket" | "poll" = process.env.NEXT_PUBLIC_REALTIME === "socket" ? "socket" : "poll";
export const USE_SOCKETS = REALTIME === "socket";
export const POLL_MS = Number(process.env.NEXT_PUBLIC_POLL_MS || 4000);

export function rtEmit(event: string, ...args: any[]) {
  if (USE_SOCKETS && socket.connected) socket.emit(event, ...args);
}
export function rtOn(event: string, fn: (...a: any[]) => void) {
  if (!USE_SOCKETS) return () => {};
  socket.on(event, fn);
  return () => { socket.off(event, fn); };
}
/** Calls fn every `ms` while the tab is visible (and once immediately when it becomes visible again). */
export function usePoll(fn: () => any, ms = POLL_MS, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const tick = async () => { if (busy || document.visibilityState !== "visible") return; busy = true; try { await ref.current(); } catch {} finally { busy = false; } };
    const id = setInterval(tick, ms);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [ms, enabled]);
}

/** Unread notifications badge, refreshed every 15s while visible (works without sockets). */
export function useUnreadNotifications() {
  const user = useAuthStore((s: any) => s.user);
  const [n, setN] = useState(0);
  const load = async () => { if (!user) return; const r = await axiosInstance.get("/api/notifications/unread-count"); setN(r.data.unread || 0); };
  useEffect(() => { load().catch(() => {}); }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  usePoll(load, 15000, !!user);
  return n;
}
