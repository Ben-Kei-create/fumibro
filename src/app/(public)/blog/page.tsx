import type { Metadata } from "next";

import { BlogIndex } from "@/modules/blog/ui/blog-index";
import {
  getPublicPostCategories,
  getPublicPosts,
} from "@/modules/public-content/application/get-public-content";

export const metadata: Metadata = {
  description: "短文から長文まで、FUMIBROのすべての投稿。",
  title: "Blog",
};

export default async function BlogPage() {
  const [posts, categories] = await Promise.all([
    getPublicPosts(),
    getPublicPostCategories(),
  ]);
  return <BlogIndex categories={categories} posts={posts} />;
}
