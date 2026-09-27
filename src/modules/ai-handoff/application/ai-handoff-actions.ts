"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  convertAiHandoffSchema,
  type ConvertibleAiHandoffDestination,
} from "@/modules/ai-handoff/domain/ai-handoff";
import { requireAdmin } from "@/modules/auth/application/require-admin";

const handoffIdSchema = z.string().uuid();

function revalidateAiHandoffPaths(
  destination?: ConvertibleAiHandoffDestination,
) {
  for (const path of [
    "/admin",
    "/admin/ai-inbox",
    "/admin/posts",
    "/admin/works",
    "/admin/library",
    "/admin/notices",
  ]) {
    revalidatePath(path);
  }

  if (destination === "blog") revalidatePath("/blog");
  if (destination === "works" || destination === "portfolio") {
    revalidatePath("/works");
    revalidatePath("/portfolio");
  }
  if (destination === "library") revalidatePath("/library");
  if (destination === "notice") revalidatePath("/");
}

export async function convertAiHandoffAction(formData: FormData) {
  const parsed = convertAiHandoffSchema.safeParse({
    destination: formData.get("destination"),
    handoffId: formData.get("handoffId"),
    projectId: formData.get("projectId") ?? "",
  });

  if (!parsed.success) redirect("/admin/ai-inbox?error=validation");

  const { supabase } = await requireAdmin({ nextPath: "/admin/ai-inbox" });
  const { error } = await supabase.rpc("admin_convert_ai_handoff", {
    p_destination: parsed.data.destination,
    p_handoff_id: parsed.data.handoffId,
    p_project_id: parsed.data.projectId || null,
  });

  if (error) {
    await supabase.rpc("admin_mark_ai_handoff_error", {
      p_error: `変換処理に失敗しました（${error.code || "unknown"}）`,
      p_handoff_id: parsed.data.handoffId,
    });
    revalidateAiHandoffPaths();
    redirect("/admin/ai-inbox?error=convert");
  }

  revalidateAiHandoffPaths(parsed.data.destination);
  redirect(
    `/admin/ai-inbox?saved=${encodeURIComponent(parsed.data.destination)}`,
  );
}

export async function ignoreAiHandoffAction(formData: FormData) {
  const handoffId = handoffIdSchema.safeParse(formData.get("handoffId"));
  if (!handoffId.success) redirect("/admin/ai-inbox?error=validation");

  const { supabase } = await requireAdmin({ nextPath: "/admin/ai-inbox" });
  const { error } = await supabase.rpc("admin_ignore_ai_handoff", {
    p_handoff_id: handoffId.data,
  });
  if (error) redirect("/admin/ai-inbox?error=ignore");

  revalidateAiHandoffPaths();
  redirect("/admin/ai-inbox?saved=ignored");
}
