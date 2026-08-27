import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

export type PostFormOption = {
  id: string;
  label: string;
};

export type PostFormOptions = {
  categories: PostFormOption[];
  hasError: boolean;
  locations: PostFormOption[];
  projects: PostFormOption[];
  tags: PostFormOption[];
};

export async function getPostFormOptions(
  nextPath = "/admin/posts",
): Promise<PostFormOptions> {
  const { supabase } = await requireAdmin({ nextPath });
  const [projectsResult, categoriesResult, locationsResult, tagsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id,name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order"),
      supabase
        .from("post_categories")
        .select("id,label")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order"),
      supabase
        .from("locations")
        .select("id,display_name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order"),
      supabase
        .from("tags")
        .select("id,label")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order")
        .limit(100),
    ]);

  return {
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      label: category.label,
    })),
    hasError: Boolean(
      projectsResult.error ||
      categoriesResult.error ||
      locationsResult.error ||
      tagsResult.error,
    ),
    locations: (locationsResult.data ?? []).map((location) => ({
      id: location.id,
      label: location.display_name,
    })),
    projects: (projectsResult.data ?? []).map((project) => ({
      id: project.id,
      label: project.name,
    })),
    tags: (tagsResult.data ?? []).map((tag) => ({
      id: tag.id,
      label: tag.label,
    })),
  };
}
