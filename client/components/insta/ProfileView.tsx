"use client";
import {
  currentUser,
  formatLikeCount,
  getPostsByUserId,
  Post,
} from "@/lib/mock-data";
import {
  Grid3x3,
  Film,
  Bookmark,
  Tag,
  Settings,
  MoreHorizontal,
  Heart,
  MessageCircle,
  UserPlus,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import PostModal from "./PostModal";
import axiosInstance from "@/lib/axios";
import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import useAuthStore from "@/store/authStore";
import LoginHistory from "./LoginHistory";
import StoryViewer from "./StoryViewer";

type Tab = "posts" | "reels" | "saved" | "tagged";
const ProfileView = ({ user, isOwnProfile }: any) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("posts");
  const { t } = useI18n();
  const me = useAuthStore((s: any) => s.user);
  const [following, setFollowing] = useState<boolean>(!!user.isFollowing);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [openHL, setOpenHL] = useState<any>(null);
  const [isCF, setIsCF] = useState(false);
  useEffect(() => {
    axiosInstance.get(`/api/stories/highlights/${user.user._id}`).then((r) => setHighlights(r.data.items)).catch(() => {});
    if (!isOwnProfile) axiosInstance.get("/api/auth/close-friends").then((r) => setIsCF(r.data.closeFriends.some((u: any) => u._id === user.user._id))).catch(() => {});
  }, [user.user._id, isOwnProfile]);
  const toggleCF = async () => { const r = await axiosInstance.post(`/api/auth/close-friends/${user.user._id}`); setIsCF(r.data.isCloseFriend); };
  const [followerCount, setFollowerCount] = useState(user.user.followersCount);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const posts = user.posts;
  const handleFollowToggle = async () => {
    try {
      if (following) {
        await axiosInstance.delete(`/api/follow/${user.user._id}`);
        setFollowing(false);
        setFollowerCount((prev: number) => prev - 1);
      } else {
        await axiosInstance.post(`/api/follow/${user.user._id}`);
        setFollowing(true);
        setFollowerCount((prev: number) => prev + 1);
      }
    } catch (error) {
      console.log(error)
    }

  };

  const tabs = [
    { id: "posts" as Tab, icon: Grid3x3, label: t("profile.tabPosts") },
    { id: "reels" as Tab, icon: Film, label: t("profile.tabReels") },
    ...(isOwnProfile
      ? [{ id: "saved" as Tab, icon: Bookmark, label: t("profile.tabSaved") }]
      : []),
    { id: "tagged" as Tab, icon: Tag, label: t("profile.tabTagged") },
  ];
  return (
    <div className="bg-ig-surface md:bg-ig-ig min-h-screen">
      {/* Mobile top header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-ig-surface border-b border-ig-border z-50 h-[44px] flex items-center justify-between px-3">
        <button
          onClick={() => router.back()}
          className="p-1 text-ig-text active:opacity-60 transition-opacity"
        >
          <ChevronLeft size={24} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-ig-text">
            {user.user.username}
          </span>
          {user.user.isVerified && (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              className="text-[#0095f6] fill-current"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.177 14.232l-3.536-3.536 1.414-1.414 2.122 2.121 4.596-4.596 1.414 1.414-5.01 5.011z" />
            </svg>
          )}
        </div>
        <button className="p-1 text-ig-text active:opacity-60 transition-opacity">
          <MoreHorizontal size={22} strokeWidth={1.5} />
        </button>
      </header>
      <Sidebar />
      <div className="md:pl-[72px] xl:pl-[244px] pt-[44px] md:pt-0 pb-[56px] md:pb-0">
        <div className="max-w-[935px] mx-auto px-4 py-6 md:py-8">
          {/* Profile header */}
          <div className="flex gap-5 md:gap-16 items-start mb-5 md:mb-10">
            {/* Avatar */}
            <div className="shrink-0">
              <div
                className={`rounded-full p-[3px] ${isOwnProfile ? "" : "story-gradient"}`}
                style={
                  isOwnProfile ? { background: "hsl(var(--ig-border))" } : {}
                }
              >
                <div className="rounded-full bg-ig-surface p-[3px]">
                  <img
                    src={user.user.profilePicture}
                    alt={user.user.username}
                    className="w-[77px] h-[77px] md:w-[150px] md:h-[150px] rounded-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1 md:pt-3">
              {/* Username row — desktop only inline, mobile stacked */}
              <div className="flex items-center gap-2 mb-3">
                <h1 className="text-xl text-ig-text font-light leading-none">
                  {user.user.username}
                </h1>
                {user.user.isVerified && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    className="text-[#0095f6] fill-current shrink-0 hidden md:block"
                  >
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.177 14.232l-3.536-3.536 1.414-1.414 2.122 2.121 4.596-4.596 1.414 1.414-5.01 5.011z" />
                  </svg>
                )}
              </div>

              {/* Action buttons */}
              {isOwnProfile ? (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Link href="/settings" className="flex-1 sm:flex-none px-4 py-[7px] text-sm font-semibold text-ig-text bg-ig-hover rounded-lg hover:bg-ig-border transition-colors text-center">
                    {t("profile.editProfile")}
                  </Link>
                  <Link href="/stories/archive" className="flex-1 sm:flex-none px-4 py-[7px] text-sm font-semibold text-ig-text bg-ig-hover rounded-lg hover:bg-ig-border transition-colors text-center">
                    {t("nav.archive")}
                  </Link>
                  <Link href="/settings?tab=security" className="p-[7px] text-ig-text hover:bg-ig-hover rounded-lg transition-colors">
                    <Settings size={20} strokeWidth={1.5} />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button
                    onClick={handleFollowToggle}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-[7px] text-sm font-semibold rounded-lg transition-colors ${
                      following
                        ? "bg-ig-hover text-ig-text hover:bg-ig-border"
                        : "bg-[#0095f6] text-white hover:bg-[#1877f2]"
                    }`}
                  >
                    {following ? (
                      <>
                        <UserCheck size={15} /> {t("profile.unfollow")}
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} /> {t("profile.follow")}
                      </>
                    )}
                  </button>
                  <button className="flex-1 sm:flex-none px-4 py-[7px] text-sm font-semibold text-ig-text bg-ig-hover rounded-lg hover:bg-ig-border transition-colors text-center">
                    {t("profile.message")}
                  </button>
                  <button onClick={toggleCF} title={isCF ? t("profile.removeCloseFriend") : t("profile.addCloseFriend")} className={`px-3 py-[7px] text-xs font-semibold rounded-lg ${isCF ? "bg-green-600 text-white" : "bg-ig-hover text-ig-text"}`}>
                    ★ {isCF ? t("profile.removeCloseFriend") : t("profile.addCloseFriend")}
                  </button>
                </div>
              )}

              {/* Stats — desktop only */}
              <div className="hidden md:flex items-center gap-8 mb-4">
                <div className="text-sm text-ig-text">
                  <span className="font-semibold">{posts.length}</span> {t("profile.posts")}
                </div>
                <button className="text-sm text-ig-text hover:opacity-70">
                  <span className="font-semibold">
                    {formatLikeCount(followerCount)}
                  </span>{" "}
                  {t("profile.followers")}
                </button>
                <button className="text-sm text-ig-text hover:opacity-70">
                  <span className="font-semibold">
                    {formatLikeCount(user.user.followingCount)}
                  </span>{" "}
                  {t("profile.following")}
                </button>
              </div>

              {/* Bio — desktop */}
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-ig-text">
                  {user.user.fullName}
                </p>
                {user.user.bio && (
                  <p className="text-sm text-ig-text whitespace-pre-line mt-0.5">
                    {user.user.bio}
                  </p>
                )}
                {user.user.website && (
                  <a
                    href={`https://${user.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-ig-blue hover:underline mt-0.5 block"
                  >
                    {user.user.website}
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Bio — mobile */}
          <div className="md:hidden mb-4 -mt-1">
            <p className="text-sm font-semibold text-ig-text">
              {user.user.fullName}
            </p>
            {user.user.bio && (
              <p className="text-sm text-ig-text whitespace-pre-line mt-0.5 leading-snug">
                {user.user.bio}
              </p>
            )}
            {user.user.website && (
              <a
                href={`https://${user.user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-ig-blue mt-0.5 block"
              >
                {user.user.website}
              </a>
            )}
          </div>
          {/* Stats row — mobile */}
          <div className="md:hidden flex justify-around py-3 border-y border-ig-border mb-5">
            {[
              { label: t("profile.posts"), value: posts.length },
              { label: t("profile.followers"), value: followerCount },
              { label: t("profile.following"), value: user.user.followingCount },
            ].map(({ label, value }) => (
              <button
                key={label}
                className="flex flex-col items-center gap-0.5"
              >
                <span className="text-sm font-semibold text-ig-text">
                  {formatLikeCount(value)}
                </span>
                <span className="text-xs text-ig-text">{label}</span>
              </button>
            ))}
          </div>

          {/* Story highlights */}
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-5 md:mb-8 -mx-4 px-4">
            {highlights.map((h: any) => (
              <button key={h._id} onClick={() => h.stories.length && setOpenHL(h)} className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-[62px] h-[62px] md:w-16 md:h-16 rounded-full border-2 border-ig-border overflow-hidden">
                  <img src={h.cover} className="w-full h-full object-cover" alt="" />
                </div>
                <span className="text-xs text-ig-text truncate w-[62px] text-center">{h.title}</span>
              </button>
            ))}
            {isOwnProfile && (
              <div className="flex flex-col items-center gap-2 shrink-0">
                <Link href="/stories/archive" className="w-[62px] h-[62px] md:w-16 md:h-16 rounded-full border-2 border-dashed border-ig-border flex items-center justify-center cursor-pointer hover:border-ig-muted transition-colors">
                  <span className="text-2xl text-ig-muted font-light leading-none">
                    +
                  </span>
                </Link>
                <span className="text-xs text-ig-text">{t("story.newHighlight")}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-t border-ig-border -mx-4">
            <div className="flex justify-center gap-8 md:gap-12">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 py-3 border-t-[1px] -mt-px text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                    activeTab === id
                      ? "border-ig-text text-ig-text"
                      : "border-transparent text-ig-muted hover:text-ig-text"
                  }`}
                >
                  <Icon size={13} strokeWidth={activeTab === id ? 2.5 : 1.5} />
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Post grid */}
          {activeTab === "posts" && (
            <>
              {posts.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <div className="w-16 h-16 rounded-full border-2 border-ig-text flex items-center justify-center">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-ig-text"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle
                        cx="17.5"
                        cy="6.5"
                        r="1"
                        fill="currentColor"
                        stroke="none"
                      />
                    </svg>
                  </div>
                  <p className="text-2xl font-semibold text-ig-text">
                    {t("profile.noPosts")}
                  </p>
                  {isOwnProfile && (
                    <p className="text-sm text-ig-muted">
                      Start capturing and sharing your moments.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-[3px] -mx-4 mt-[3px]">
                  {posts.map((post: any) => (
                    <button
                      key={post._id}
                      onClick={() => setSelectedPost(post)}
                      className="relative aspect-square overflow-hidden group bg-ig-hover"
                    >
                      <img
                        src={post.media[0]?.url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-1.5 text-white font-semibold">
                          <Heart size={20} className="fill-white text-white" />
                          <span className="text-sm">
                            {formatLikeCount(post.likesCount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-white font-semibold">
                          <MessageCircle
                            size={20}
                            className="fill-white text-white"
                          />
                          <span className="text-sm">{post.commentsCount}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {/* Empty states */}
          {(activeTab === "reels" ||
            activeTab === "saved" ||
            activeTab === "tagged") && (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-16 h-16 rounded-full border-2 border-ig-text flex items-center justify-center">
                {activeTab === "reels" && (
                  <Film size={28} strokeWidth={1.5} className="text-ig-text" />
                )}
                {activeTab === "saved" && (
                  <Bookmark
                    size={28}
                    strokeWidth={1.5}
                    className="text-ig-text"
                  />
                )}
                {activeTab === "tagged" && (
                  <Tag size={28} strokeWidth={1.5} className="text-ig-text" />
                )}
              </div>
              <p className="text-2xl font-semibold text-ig-text">
                {activeTab === "reels" && "No Reels Yet"}
                {activeTab === "saved" && "Save"}
                {activeTab === "tagged" && "Photos of You"}
              </p>
              <p className="text-sm text-ig-muted text-center max-w-[220px]">
                {activeTab === "reels" && "Reels you share will appear here."}
                {activeTab === "saved" &&
                  "Save photos and videos that you want to see again."}
                {activeTab === "tagged" &&
                  "When people tag you in photos and videos, they'll appear here."}
              </p>
            </div>
          )}
        </div>
      </div>
      {isOwnProfile && (
        <div className="md:ml-[72px] xl:ml-[244px] max-w-[935px] md:mx-auto px-4 pb-20">
          <LoginHistory compact />
        </div>
      )}
      {openHL && (
        <StoryViewer readOnly groups={[{ user: user.user, stories: openHL.stories, isMine: false }]} onClose={() => setOpenHL(null)} />
      )}
      <MobileNav />
      {/* {selectedPost && (
        <PostModal
          post={selectedPost}
          posts={posts}
          onClose={() => setSelectedPost(null)}
        />
      )} */}
    </div>
  );
};

export default ProfileView;
