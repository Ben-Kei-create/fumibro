import "server-only";

import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { ContactMessageInput } from "@/modules/contact/domain/contact-message";

export type ContactSubmissionResult =
  { ok: true } | { message: string; ok: false; status: 400 | 429 | 500 };

export async function submitContactMessage(
  input: ContactMessageInput,
  rateLimitKey: string,
  duplicateLimitKey: string,
): Promise<ContactSubmissionResult> {
  const supabase = createServiceSupabaseClient();
  const [rateResult, duplicateResult] = await Promise.all([
    supabase.rpc("service_consume_rate_limit", {
      p_action_key: "contact.submit",
      p_limit: 5,
      p_subject_key: rateLimitKey,
      p_window_seconds: 3600,
    }),
    supabase.rpc("service_consume_rate_limit", {
      p_action_key: "contact.duplicate",
      p_limit: 1,
      p_subject_key: duplicateLimitKey,
      p_window_seconds: 300,
    }),
  ]);
  if (rateResult.error || duplicateResult.error) {
    return { message: "送信を処理できませんでした。", ok: false, status: 500 };
  }
  if (!rateResult.data || !duplicateResult.data) {
    return {
      message: "送信回数が上限に達しました。時間をおいてお試しください。",
      ok: false,
      status: 429,
    };
  }

  const category = await supabase
    .from("contact_categories")
    .select("id")
    .eq("id", input.categoryId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!category.data) {
    return { message: "問い合わせ種別が無効です。", ok: false, status: 400 };
  }

  const insertion = await supabase.from("contact_inquiries").insert({
    category_id: category.data.id,
    email: input.email,
    message: input.message,
    name: input.name,
    subject: input.subject || null,
  });
  if (insertion.error) {
    return { message: "送信を保存できませんでした。", ok: false, status: 500 };
  }
  return { ok: true };
}
