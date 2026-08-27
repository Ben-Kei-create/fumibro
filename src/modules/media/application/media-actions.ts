"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/modules/auth/application/require-admin";

const altTextSchema = z.object({
  altText: z.string().trim().max(500),
  assetId: z.string().uuid(),
});

export async function updateImageAltTextAction(formData: FormData) {
  const parsed = altTextSchema.safeParse({
    altText: formData.get("altText"),
    assetId: formData.get("assetId"),
  });

  if (!parsed.success) {
    redirect("/admin/media?error=invalid");
  }

  const { supabase } = await requireAdmin({ nextPath: "/admin/media" });
  const { data, error } = await supabase
    .from("assets")
    .update({ alt_text: parsed.data.altText || null })
    .eq("id", parsed.data.assetId)
    .eq("kind", "image")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect("/admin/media?error=save");
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin/posts");
  revalidatePath("/blog");
  redirect("/admin/media?saved=alt");
}
