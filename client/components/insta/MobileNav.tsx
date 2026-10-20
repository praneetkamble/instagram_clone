"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Compass, Film, PlusSquare } from "lucide-react";
import useAuthStore from "@/store/authStore";
import { useCreateModal } from "@/lib/createmodelcontext";

export default function MobileNav() {
  const pathname = usePathname();
  const me: any = useAuthStore((st: any) => st.user);
  const { open: openCreate } = useCreateModal();
  const isActive = (href: string) => pathname === href;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-ig-surface border-t border-ig-border z-50 flex items-center justify-around px-2 safe-area-pb h-[50px]">
      <Link href="/" className="flex items-center justify-center p-2">
        <Home
          size={24}
          strokeWidth={isActive("/") ? 2.5 : 1.5}
          className="text-ig-text"
        />
      </Link>

      <Link href="/search" className="flex items-center justify-center p-2">
        <Search
          size={24}
          strokeWidth={isActive("/search") ? 2.5 : 1.5}
          className="text-ig-text"
        />
      </Link>

      {/* Create */}
      <button
        onClick={openCreate}
        className="flex items-center justify-center p-2 active:opacity-60 transition-opacity"
      >
        <PlusSquare size={24} strokeWidth={1.5} className="text-ig-text" />
      </button>

      <Link href="/reels" className="flex items-center justify-center p-2">
        <Film
          size={24}
          strokeWidth={isActive("/reels") ? 2.5 : 1.5}
          className="text-ig-text"
        />
      </Link>

      <Link href="/profile" className="flex items-center justify-center p-2">
        <div
          className={`w-6 h-6 rounded-full overflow-hidden ${isActive("/profile") ? "ring-2 ring-ig-text ring-offset-1 ring-offset-ig-surface" : ""}`}
        >
          <img
            src={me?.profilePicture || "https://i.pravatar.cc/150?img=8"}
            alt={me?.username || "profile"}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>
    </nav>
  );
}
