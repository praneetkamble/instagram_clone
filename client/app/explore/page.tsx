"use client";
import { Compass } from "lucide-react";
import PageShell, { EmptyState } from "@/components/insta/PageShell";
import ExploreGrid, { useAllPosts } from "@/components/insta/ExploreGrid";
import { useI18n } from "@/lib/i18n";
export default function ExplorePage() {
  const { t } = useI18n();
  const posts = useAllPosts(60);
  return (
    <PageShell title={t("nav.explore")} subtitle="Discover posts from creators across InstAI" wide>
      {posts && !posts.length ? <EmptyState icon={<Compass size={26} />} title="Nothing to explore yet" text="Posts from the community will appear here." /> : <ExploreGrid posts={posts} />}
    </PageShell>
  );
}
