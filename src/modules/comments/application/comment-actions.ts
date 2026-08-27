"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export async function moderateCommentAction(formData: FormData) {
  const parsed = z
    .object({
      commentId: z.string().uuid(),
      mode: z.enum(["visible", "hidden", "spam", "delete"]),
      postId: z.string().uuid(),
    })
    .safeParse({
      commentId: formData.get("commentId"),
      mode: formData.get("mode"),
      postId: formData.get("postId"),
    });
  if (!parsed.success) redirect("/admin/comments?error=validation");
  const { supabase, userId } = await requireAdmin({
    nextPath: "/admin/comments",
  });
  const now = new Date().toISOString();
  const update =
    parsed.data.mode === "delete"
      ? {
          deleted_at: now,
          deleted_by: userId,
          moderated_at: now,
          moderated_by: userId,
        }
      : { status: parsed.data.mode, moderated_at: now, moderated_by: userId };
  const result = await supabase
    .from("comments")
    .update(update)
    .eq("id", parsed.data.commentId);
  if (result.error) redirect("/admin/comments?error=save");
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath("/blog");
  redirect("/admin/comments?saved=1");
}
