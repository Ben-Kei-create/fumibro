import "server-only";

import { requireAdmin } from "@/modules/auth/application/require-admin";

type QuickPostOption = {
  id: string;
  label: string;
};

export type QuickPostOptions = {
  categories: QuickPostOption[];
  hasError: boolean;
  projects: QuickPostOption[];
  tags: QuickPostOption[];
};

export async function getQuickPostOptions(): Promise<QuickPostOptions> {
  const { supabase } = await requireAdmin({ nextPath: "/admin/quick" });
  const [projectsResult, categoriesResult, tagsResult] = await Promise.all([
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
      projectsResult.error || categoriesResult.error || tagsResult.error,
    ),
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
