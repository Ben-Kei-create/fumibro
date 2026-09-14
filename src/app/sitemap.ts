import type { MetadataRoute } from "next";

import { getPublicEnvironment } from "@/lib/env/public";
import { getPublicImages } from "@/modules/images/application/get-public-images";
import {
  getPublicLibrary,
  getPublicPosts,
  getPublicProjects,
  getPublicWorks,
} from "@/modules/public-content/application/get-public-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    { NEXT_PUBLIC_SITE_URL: siteUrl },
    posts,
    projects,
    works,
    library,
    images,
  ] = await Promise.all([
    Promise.resolve(getPublicEnvironment()),
    getPublicPosts({ limit: 100 }),
    getPublicProjects(),
    getPublicWorks(),
    getPublicLibrary(),
    getPublicImages(),
  ]);
  const absolute = (path: string) => new URL(path, siteUrl).toString();
  const staticPaths = [
    "/",
    "/blog",
    "/projects",
    "/library",
    "/works",
    "/portfolio",
    "/about",
    "/contact",
    "/privacy",
    "/search",
    "/images",
  ];

  return [
    ...staticPaths.map((path) => ({ url: absolute(path) })),
    ...posts.map((post) => ({
      lastModified: new Date(post.updatedAt),
      url: absolute(`/blog/${post.slug}`),
    })),
    ...projects.map((project) => ({
      url: absolute(`/projects/${project.slug}`),
    })),
    ...works.map((work) => ({
      lastModified: new Date(work.publishedAt),
      url: absolute(`/works/${work.slug}`),
    })),
    ...library.map((item) => ({
      lastModified: new Date(item.publishedAt),
      url: absolute(`/library/${item.slug}`),
    })),
    ...images.map((item) => ({
      images: [item.display.url],
      lastModified: new Date(item.publishedAt),
      url: absolute(`/images/${item.slug}`),
    })),
  ];
}
