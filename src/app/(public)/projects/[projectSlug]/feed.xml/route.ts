import { getProjectRssFeed } from "@/modules/rss/application/get-rss-feed";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/projects/[projectSlug]/feed.xml">,
) {
  const { projectSlug } = await context.params;
  const xml = await getProjectRssFeed(projectSlug);
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
