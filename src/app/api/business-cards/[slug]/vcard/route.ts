import { getPublicBusinessCard } from "@/modules/business-card/application/get-public-business-card";
import { createVCard } from "@/modules/business-card/domain/vcard";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/business-cards/[slug]/vcard">,
) {
  const { slug } = await context.params;
  const card = await getPublicBusinessCard(slug);
  if (!card) return new Response("Not found", { status: 404 });
  const body = createVCard({
    address: card.address,
    displayName: card.display_name,
    email: card.email,
    jobTitle: card.job_title,
    links: card.links,
    note: card.note,
    organization: card.organization,
    phone: card.phone,
    website: card.website,
  });
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `attachment; filename="fumibro-${slug}.vcf"`,
      "Content-Type": "text/vcard; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
