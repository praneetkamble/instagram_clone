"use client";

import useAuthStore from "@/store/authStore";
import { useEffect } from "react";
import { socket } from "./socket";
import { USE_SOCKETS } from "./realtime";

// Only connects when NEXT_PUBLIC_REALTIME=socket; otherwise the app uses polling and never opens a socket.
export default function SocketProvider({ children }: any) {
  const user = useAuthStore((state) => state.user);
  useEffect(() => {
    if (!user || !USE_SOCKETS) return;
    socket.connect();
    const setup = () => socket.emit("setup", user._id);
    socket.on("connect", setup);
    return () => { socket.off("connect", setup); socket.disconnect(); };
  }, [user]);
  return <>{children}</>;
}
