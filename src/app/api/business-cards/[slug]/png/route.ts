import { getPublicBusinessCardPng } from "@/modules/business-card/application/get-public-business-card";
import sharp from "sharp";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/business-cards/[slug]/png">,
) {
  const { slug } = await context.params;
  const image = await getPublicBusinessCardPng(slug);
  if (!image || !image.mimeType.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }
  const upstream = await fetch(image.publicUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }
  const input = Buffer.from(await upstream.arrayBuffer());
  const png =
    image.mimeType === "image/png"
      ? input
      : await sharp(input, { failOn: "warning", limitInputPixels: 40_000_000 })
          .rotate()
          .png({ compressionLevel: 9 })
          .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `attachment; filename="fumibro-${slug}.png"`,
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
