import { getSiteRssFeed } from "@/modules/rss/application/get-rss-feed";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await getSiteRssFeed();
  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
