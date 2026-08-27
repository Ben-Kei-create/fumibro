import { describe, expect, it } from "vitest";

import { buildRssXml } from "@/modules/rss/domain/rss";

describe("buildRssXml", () => {
  it("escapes untrusted values and emits stable item ids", () => {
    const xml = buildRssXml({
      description: "日記 & 作品",
      feedUrl: "https://example.com/feed.xml?a=1&b=2",
      items: [
        {
          description: "<script>alert(1)</script>",
          id: "fumibro:post:1&2",
          publishedAt: "2026-08-27T00:00:00.000Z",
          title: '「猫」 & "本"',
          url: "https://example.com/blog/cat?a=1&b=2",
        },
      ],
      siteUrl: "https://example.com",
      title: "FUMIBRO",
    });

    expect(xml).toContain("日記 &amp; 作品");
    expect(xml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(xml).toContain("fumibro:post:1&amp;2");
    expect(xml).not.toContain("<script>");
  });
});
