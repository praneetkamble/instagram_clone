"use client";
import {
  Home,
  Search,
  Compass,
  Film,
  MessageCircle,
  Heart,
  PlusSquare,
  Menu,
  Bookmark,
  Settings,
  Activity,
  Sun,
  Moon,
  LogOut,
  CalendarClock,
  Archive,
  CreditCard,
  Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import { currentUser, mockConversations } from "@/lib/mock-data";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useCreateModal } from "@/lib/createmodelcontext";
import axiosInstance from "@/lib/axios";
import { toast } from "../ui/toast";
import useAuthStore from "@/store/authStore";
import { useUnreadNotifications } from "@/lib/realtime";
const Sidebar = () => {
  const totalUnread = mockConversations.reduce((s, c) => s + c.unread, 0);
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const { open: openCreate } = useCreateModal();
  const { t } = useI18n();
  const unreadNotifs = useUnreadNotifications();
  const me = useAuthStore((state: any) => state.user);
  const navItems = [
    { label: t("nav.home"), icon: Home, href: "/", badge: 0 },
    { label: t("nav.search"), icon: Search, href: "/search", badge: 0 },
    { label: t("nav.explore"), icon: Compass, href: "/explore", badge: 0 },
    { label: t("nav.reels"), icon: Film, href: "/reels", badge: 0 },
    {
      label: t("nav.messages"),
      icon: MessageCircle,
      href: "/messages",
      badge: totalUnread,
    },
    { label: t("nav.notifications"), icon: Heart, href: "/notifications", badge: pathname === "/notifications" ? 0 : unreadNotifs },
  ];
  const logout = useAuthStore((state: any) => state.logout);

  const handlelogout = async () => {
    try { await axiosInstance.post("/api/auth/logout"); } catch {}
    logout();

    toast.add({
      type: "success",
      title: t("auth.logoutSuccess"),
    });
    router.push("/login");
  };
  const isActive = (href: string) => pathname === href;
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[72px] xl:w-[244px] bg-ig-surface border-r border-ig-border px-3 py-5 z-50 justify-between">
      <div className="flex flex-col gap-1">
        {/* Logo */}
        <Link
          href="/"
          className="h-[72px] flex items-center px-3 mb-2 rounded-lg hover:bg-ig-hover transition-colors"
        >
          <span className="xl:hidden text-ig-text">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
              <circle
                cx="17.5"
                cy="6.5"
                r="1.5"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
          <span className="hidden xl:block instagram-font text-[28px] leading-none text-ig-text">
            Instagram
          </span>
        </Link>

        {/* Nav items */}
        {navItems.map(({ label, icon: Icon, href, badge }) => (
          <Link
            key={label}
            href={href}
            className={`ig-nav-item flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-ig-hover transition-all ${isActive(href) ? "is-active font-bold" : ""}`}
          >
            <div className="relative shrink-0">
              <Icon
                size={24}
                strokeWidth={isActive(href) ? 2.5 : 1.5}
                className="text-ig-text"
              />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ed4956] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            <span
              className={`hidden xl:block text-[15px] text-ig-text ${isActive(href) ? "font-semibold" : "font-normal"}`}
            >
              {label}
            </span>
          </Link>
        ))}

        {/* Create — opens modal */}
        <button
          onClick={openCreate}
          className="ig-nav-item flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-ig-hover transition-colors w-full"
        >
          <PlusSquare
            size={24}
            strokeWidth={1.5}
            className="shrink-0 text-ig-text"
          />
          <span className="hidden xl:block text-[15px] text-ig-text font-normal">
            {t("nav.create")}
          </span>
        </button>

        {/* Profile */}
        <Link
          href="/profile"
          className={`ig-nav-item flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-ig-hover transition-all ${isActive("/profile") ? "is-active font-bold" : ""}`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
            <img
              src={me?.profilePicture || currentUser.profilePic}
              alt={me?.username || ""}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="hidden xl:block text-[15px] text-ig-text">
            {t("nav.profile")}
          </span>
        </Link>
      </div>

      {/* More */}
      <div className="relative">
        {moreOpen && (
          <div className="absolute bottom-14 left-0 w-[250px] bg-ig-surface rounded-2xl shadow-xl border border-ig-border overflow-hidden z-50">
            {[
              { icon: Settings, label: t("nav.settings"), href: "/settings" },
              { icon: CalendarClock, label: t("nav.scheduled"), href: "/scheduled" },
              { icon: Archive, label: t("nav.archive"), href: "/stories/archive" },
              { icon: CreditCard, label: t("nav.subscription"), href: "/settings?tab=subscription" },
              ...(me?.role === "admin" ? [{ icon: Shield, label: t("nav.admin"), href: "/admin" }] : []),
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ig-text hover:bg-ig-hover transition-colors"
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ig-text hover:bg-ig-hover transition-colors"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              {theme === "light" ? t("nav.darkMode") : t("nav.lightMode")}
            </button>
            <div className="h-px bg-ig-border my-1" />
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-ig-text hover:bg-ig-hover transition-colors"
              onClick={handlelogout}
            >
              <LogOut size={18} />
              {t("nav.logout")}
            </button>
          </div>
        )}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="ig-nav-item flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-ig-hover transition-colors w-full"
        >
          <Menu size={24} strokeWidth={1.5} className="text-ig-text shrink-0" />
          <span className="hidden xl:block text-[15px] text-ig-text">{t("nav.more")}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
