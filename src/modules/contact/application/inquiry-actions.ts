"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/modules/auth/application/require-admin";

const updateInquirySchema = z.object({
  adminNote: z.string().trim().max(10_000),
  inquiryId: z.string().uuid(),
  status: z.enum(["new", "in_progress", "closed", "spam"]),
});

export async function updateInquiryAction(formData: FormData) {
  const parsed = updateInquirySchema.safeParse({
    adminNote: formData.get("adminNote"),
    inquiryId: formData.get("inquiryId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const { supabase, userId } = await requireAdmin({
    nextPath: "/admin/inquiries",
  });
  const handled = parsed.data.status === "closed";
  await supabase
    .from("contact_inquiries")
    .update({
      admin_note: parsed.data.adminNote || null,
      handled_at: handled ? new Date().toISOString() : null,
      handled_by: handled ? userId : null,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.inquiryId);
  revalidatePath("/admin");
  revalidatePath("/admin/inquiries");
}
