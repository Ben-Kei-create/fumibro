import {
  getHomeWorks,
  getPublicNotices,
  getPublicPosts,
} from "@/modules/public-content/application/get-public-content";
import { HomeContent } from "@/modules/home/ui/home-content";

export default async function HomePage() {
  const [posts, notices, works] = await Promise.all([
    getPublicPosts({ feedOrder: true, limit: 4 }),
    getPublicNotices(),
    getHomeWorks(),
  ]);

  return <HomeContent notices={notices} posts={posts} works={works} />;
}
