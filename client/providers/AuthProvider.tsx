"use client";
import { useEffect } from "react";
import useAuthStore from "@/store/authStore";
import axiosInstance from "@/lib/axios";

export default function AuthProvider({ children }: any) {
  const loadUser = useAuthStore((state: any) => state.loadUser);
  const setUser = useAuthStore((state: any) => state.setUser);
  useEffect(() => {
    loadUser();
    if (localStorage.getItem("accessToken")) {
      // refresh profile (language, role, plan) from the server
      axiosInstance.get("/api/auth/me").then((r) => r.data?.user && setUser(r.data.user)).catch(() => {});
    }
  }, []);
  return <>{children}</>;
}
