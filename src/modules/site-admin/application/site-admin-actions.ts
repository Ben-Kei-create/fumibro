"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseTokyoDateTimeLocal } from "@/lib/datetime/tokyo";
import { requireAdmin } from "@/modules/auth/application/require-admin";

const optionalUuid = z.union([z.literal(""), z.string().uuid()]);
const slug = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const optionalHttpUrl = z.union([
  z.literal(""),
  z
    .string()
    .max(2000)
    .refine((value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }),
]);

export async function saveProjectAction(formData: FormData) {
  const parsed = z
    .object({
      description: z.string().trim().max(5000),
      displayOrder: z.coerce.number().int(),
      id: optionalUuid,
      isActive: z.boolean(),
      name: z.string().trim().min(1).max(120),
      slug,
      themeKey: slug,
    })
    .safeParse({
      description: formData.get("description") ?? "",
      displayOrder: formData.get("displayOrder") ?? 0,
      id: formData.get("id") ?? "",
      isActive: formData.get("isActive") === "on",
      name: formData.get("name"),
      slug: formData.get("slug"),
      themeKey: formData.get("themeKey") ?? "default",
    });
  if (!parsed.success) redirect("/admin/projects?error=validation");
  const { supabase } = await requireAdmin({ nextPath: "/admin/projects" });
  const values = {
    description: parsed.data.description || null,
    display_order: parsed.data.displayOrder,
    is_active: parsed.data.isActive,
    name: parsed.data.name,
    slug: parsed.data.slug,
    theme_key: parsed.data.themeKey,
  };
  const result = parsed.data.id
    ? await supabase.from("projects").update(values).eq("id", parsed.data.id)
    : await supabase.from("projects").insert(values);
  if (result.error) redirect("/admin/projects?error=save");
  revalidatePath("/projects");
  revalidatePath("/admin/projects");
  redirect("/admin/projects?saved=1");
}

export async function saveTaxonomyAction(formData: FormData) {
  const kind = z
    .enum(["tag", "category", "location"])
    .safeParse(formData.get("kind"));
  const id = optionalUuid.safeParse(formData.get("id") ?? "");
  if (!kind.success || !id.success)
    redirect("/admin/settings?error=validation");
  const { supabase } = await requireAdmin({ nextPath: "/admin/settings" });
  let result;
  if (kind.data === "location") {
    const value = z
      .object({
        displayName: z.string().trim().min(1).max(160),
        displayOrder: z.coerce.number().int(),
        isActive: z.boolean(),
        mapsQuery: z.string().trim().min(1).max(500),
      })
      .safeParse({
        displayName: formData.get("label"),
        displayOrder: formData.get("displayOrder") ?? 0,
        isActive: formData.get("isActive") === "on",
        mapsQuery: formData.get("mapsQuery"),
      });
    if (!value.success) redirect("/admin/settings?error=validation");
    const payload = {
      display_name: value.data.displayName,
      display_order: value.data.displayOrder,
      is_active: value.data.isActive,
      maps_query: value.data.mapsQuery,
    };
    result = id.data
      ? await supabase.from("locations").update(payload).eq("id", id.data)
      : await supabase.from("locations").insert(payload);
  } else {
    const value = z
      .object({
        displayOrder: z.coerce.number().int(),
        iconKey: z.union([z.literal(""), slug]),
        isActive: z.boolean(),
        label: z.string().trim().min(1).max(80),
        slug,
      })
      .safeParse({
        displayOrder: formData.get("displayOrder") ?? 0,
        iconKey: formData.get("iconKey") ?? "",
        isActive: formData.get("isActive") === "on",
        label: formData.get("label"),
        slug: formData.get("slug"),
      });
    if (!value.success) redirect("/admin/settings?error=validation");
    const base = {
      display_order: value.data.displayOrder,
      is_active: value.data.isActive,
      label: value.data.label,
      slug: value.data.slug,
    };
    if (kind.data === "tag")
      result = id.data
        ? await supabase.from("tags").update(base).eq("id", id.data)
        : await supabase.from("tags").insert(base);
    else {
      const payload = { ...base, icon_key: value.data.iconKey || null };
      result = id.data
        ? await supabase
            .from("post_categories")
            .update(payload)
            .eq("id", id.data)
        : await supabase.from("post_categories").insert(payload);
    }
  }
  if (result.error) redirect("/admin/settings?error=save");
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

export async function saveNoticeAction(formData: FormData) {
  const parsed = z
    .object({
      body: z.string().trim().min(1).max(3000),
      displayOrder: z.coerce.number().int(),
      endsAt: z.string(),
      id: optionalUuid,
      linkLabel: z.string().trim().max(100),
      linkUrl: z.union([
        z.literal(""),
        z
          .string()
          .max(2000)
          .refine(
            (value) =>
              (value.startsWith("/") && !value.startsWith("//")) ||
              optionalHttpUrl.safeParse(value).success,
          ),
      ]),
      startsAt: z.string(),
      status: z.enum(["draft", "published", "hidden"]),
      title: z.string().trim().min(1).max(200),
    })
    .safeParse({
      body: formData.get("body"),
      displayOrder: formData.get("displayOrder") ?? 0,
      endsAt: formData.get("endsAt") ?? "",
      id: formData.get("id") ?? "",
      linkLabel: formData.get("linkLabel") ?? "",
      linkUrl: formData.get("linkUrl") ?? "",
      startsAt: formData.get("startsAt"),
      status: formData.get("status"),
      title: formData.get("title"),
    });
  if (!parsed.success) redirect("/admin/notices?error=validation");
  let startsAt: string;
  let endsAt: string | null;
  try {
    startsAt = parseTokyoDateTimeLocal(parsed.data.startsAt);
    endsAt = parsed.data.endsAt
      ? parseTokyoDateTimeLocal(parsed.data.endsAt)
      : null;
  } catch {
    redirect("/admin/notices?error=date");
  }
  const { supabase, userId } = await requireAdmin({
    nextPath: "/admin/notices",
  });
  const payload = {
    body: parsed.data.body,
    display_order: parsed.data.displayOrder,
    ends_at: endsAt,
    link_label: parsed.data.linkLabel || null,
    link_url: parsed.data.linkUrl || null,
    starts_at: startsAt,
    status: parsed.data.status,
    title: parsed.data.title,
    updated_by: userId,
  };
  const result = parsed.data.id
    ? await supabase.from("notices").update(payload).eq("id", parsed.data.id)
    : await supabase.from("notices").insert({ ...payload, created_by: userId });
  if (result.error) redirect("/admin/notices?error=save");
  revalidatePath("/");
  revalidatePath("/admin/notices");
  redirect("/admin/notices?saved=1");
}

export async function archiveNoticeAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/notices?error=validation");
  const { supabase, userId } = await requireAdmin({
    nextPath: "/admin/notices",
  });
  const result = await supabase
    .from("notices")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id.data);
  if (result.error) redirect("/admin/notices?error=save");
  revalidatePath("/");
  revalidatePath("/admin/notices");
  redirect("/admin/notices?archived=1");
}

export async function saveBusinessCardAction(formData: FormData) {
  const parsed = z
    .object({
      address: z.string().trim().max(500),
      displayName: z.string().trim().min(1).max(120),
      displayOrder: z.coerce.number().int(),
      email: z.union([z.literal(""), z.string().email().max(254)]),
      id: optionalUuid,
      imageAssetId: optionalUuid,
      isPrimary: z.boolean(),
      isPublished: z.boolean(),
      jobTitle: z.string().trim().max(120),
      note: z.string().trim().max(2000),
      organization: z.string().trim().max(160),
      phone: z.string().trim().max(80),
      slug,
      website: optionalHttpUrl,
    })
    .safeParse({
      address: formData.get("address") ?? "",
      displayName: formData.get("displayName"),
      displayOrder: formData.get("displayOrder") ?? 0,
      email: formData.get("email") ?? "",
      id: formData.get("id") ?? "",
      imageAssetId: formData.get("imageAssetId") ?? "",
      isPrimary: formData.get("isPrimary") === "on",
      isPublished: formData.get("isPublished") === "on",
      jobTitle: formData.get("jobTitle") ?? "",
      note: formData.get("note") ?? "",
      organization: formData.get("organization") ?? "",
      phone: formData.get("phone") ?? "",
      slug: formData.get("slug"),
      website: formData.get("website") ?? "",
    });
  if (!parsed.success) redirect("/admin/business-cards?error=validation");
  const { supabase, userId } = await requireAdmin({
    nextPath: "/admin/business-cards",
  });
  const payload = {
    address: parsed.data.address || null,
    display_name: parsed.data.displayName,
    display_order: parsed.data.displayOrder,
    email: parsed.data.email || null,
    is_primary: parsed.data.isPrimary,
    is_published: parsed.data.isPublished,
    job_title: parsed.data.jobTitle || null,
    note: parsed.data.note || null,
    organization: parsed.data.organization || null,
    phone: parsed.data.phone || null,
    png_asset_id: parsed.data.imageAssetId || null,
    slug: parsed.data.slug,
    updated_by: userId,
    website: parsed.data.website || null,
  };
  const result = parsed.data.id
    ? await supabase
        .from("business_cards")
        .update(payload)
        .eq("id", parsed.data.id)
    : await supabase
        .from("business_cards")
        .insert({ ...payload, created_by: userId });
  if (result.error) redirect("/admin/business-cards?error=save");
  revalidatePath("/about");
  revalidatePath("/admin/business-cards");
  redirect("/admin/business-cards?saved=1");
}
