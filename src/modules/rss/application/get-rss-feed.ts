import "server-only";

import { getPublicEnvironment } from "@/lib/env/public";
import {
  getProjectContent,
  getPublicLibrary,
  getPublicPosts,
  getPublicProject,
  getPublicWorks,
} from "@/modules/public-content/application/get-public-content";
import { buildRssXml, type RssItem } from "@/modules/rss/domain/rss";

function absoluteUrl(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

function renderFeed({
  description,
  feedPath,
  items,
  title,
}: {
  description: string;
  feedPath: string;
  items: RssItem[];
  title: string;
}) {
  const siteUrl = getPublicEnvironment().NEXT_PUBLIC_SITE_URL;
  return buildRssXml({
    description,
    feedUrl: absoluteUrl(siteUrl, feedPath),
    items: items.slice(0, 50),
    siteUrl,
    title,
  });
}

export async function getSiteRssFeed() {
  const [posts, works, library] = await Promise.all([
    getPublicPosts({ limit: 50 }),
    getPublicWorks(),
    getPublicLibrary(),
  ]);
  const siteUrl = getPublicEnvironment().NEXT_PUBLIC_SITE_URL;
  const items: RssItem[] = [
    ...posts.map((post) => ({
      description: post.excerpt ?? post.body.slice(0, 500),
      id: `fumibro:post:${post.id}`,
      publishedAt: post.publishAt,
      title: post.title ?? "無題の投稿",
      url: absoluteUrl(siteUrl, `/blog/${post.slug}`),
    })),
    ...works.map((work) => ({
      description: work.summary ?? work.excerpt,
      id: `fumibro:work:${work.id}`,
      publishedAt: work.publishedAt,
      title: work.title,
      url: absoluteUrl(siteUrl, `/works/${work.slug}`),
    })),
    ...library.map((item) => ({
      description: item.excerpt,
      id: `fumibro:library:${item.id}`,
      publishedAt: item.publishedAt,
      title: item.title,
      url: absoluteUrl(siteUrl, `/library/${item.slug}`),
    })),
  ].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return renderFeed({
    description: "FUMIBROのBlog・Works・Library最新情報",
    feedPath: "/feed.xml",
    items,
    title: "FUMIBRO",
  });
}

export async function getProjectRssFeed(projectSlug: string) {
  const project = await getPublicProject(projectSlug);
  if (!project) return null;
  const siteUrl = getPublicEnvironment().NEXT_PUBLIC_SITE_URL;
  const content = await getProjectContent(project.id);
  return renderFeed({
    description: project.description ?? `${project.name}の最新情報`,
    feedPath: `/projects/${project.slug}/feed.xml`,
    items: content.map((item) => ({
      description: item.excerpt,
      id: `fumibro:${item.kind}:${item.id}`,
      publishedAt: item.publishedAt,
      title: item.title,
      url: absoluteUrl(siteUrl, item.href),
    })),
    title: `FUMIBRO / ${project.name}`,
  });
}
