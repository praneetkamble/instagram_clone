"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import useAuthStore from "@/store/authStore";

const publicRoutes = ["/login", "/signup"];
export default function AuthGuard({ children }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state: any) => state.user);
  const hydrated = useAuthStore((state: any) => state.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    if (!user && !publicRoutes.includes(pathname)) router.replace("/login");
    if (user && publicRoutes.includes(pathname)) router.replace("/");
  }, [user, hydrated, pathname, router]);
  if (!hydrated) return null;
  if (!user && !publicRoutes.includes(pathname)) return null;
  return children;
}
