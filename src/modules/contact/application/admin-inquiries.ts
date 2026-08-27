import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export type AdminInquiryDto = {
  adminNote: string;
  category: string;
  email: string;
  id: string;
  message: string;
  name: string;
  status: "closed" | "in_progress" | "new" | "spam";
  subject: string | null;
  submittedAt: string;
};

export async function getAdminInquiries(): Promise<AdminInquiryDto[]> {
  const { supabase } = await requireAdmin({ nextPath: "/admin/inquiries" });
  const [inquiries, categories] = await Promise.all([
    supabase
      .from("contact_inquiries")
      .select(
        "id,category_id,name,email,subject,message,status,admin_note,submitted_at",
      )
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(100),
    supabase.from("contact_categories").select("id,label"),
  ]);
  const labels = new Map(
    (categories.data ?? []).map((category) => [category.id, category.label]),
  );
  return (inquiries.data ?? []).map((inquiry) => ({
    adminNote: inquiry.admin_note ?? "",
    category: labels.get(inquiry.category_id) ?? "その他",
    email: inquiry.email,
    id: inquiry.id,
    message: inquiry.message,
    name: inquiry.name,
    status: inquiry.status,
    subject: inquiry.subject,
    submittedAt: inquiry.submitted_at,
  }));
}
