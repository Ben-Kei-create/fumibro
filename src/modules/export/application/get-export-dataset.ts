import "server-only";

import { z } from "zod";

import type { ExportRow } from "@/modules/export/domain/csv";

export const exportDatasetSchema = z.enum([
  "blog",
  "library",
  "portfolio",
  "project",
  "projects",
  "works",
]);

export type ExportDataset = z.infer<typeof exportDatasetSchema>;

type AdminSupabase = Awaited<
  ReturnType<
    typeof import("@/modules/auth/application/require-admin-api").requireAdminApi
  >
>["supabase"];

const commonColumns = [
  "id",
  "kind",
  "project_slug",
  "slug",
  "title",
  "excerpt",
  "status",
  "posted_at",
  "publish_at",
  "first_published_at",
  "feed_at",
  "feed_event_type",
  "source_system",
  "source_external_id",
  "tags",
  "body_markdown",
  "category_slug",
  "location_name",
  "location_maps_query",
  "external_url",
  "is_spoiler",
  "watermark_enabled",
  "summary",
  "description_markdown",
  "work_type",
  "released_on",
  "show_on_home",
  "show_in_portfolio",
  "access_policy",
  "download_enabled",
  "inline_preview_enabled",
  "created_at",
  "updated_at",
] as const;

export type ExportResult = {
  columns: string[];
  datasetLabel: string;
  rows: ExportRow[];
};

async function contentRows(
  supabase: AdminSupabase,
  dataset: Exclude<ExportDataset, "projects">,
  projectId?: string,
): Promise<ExportResult> {
  let idsForPortfolio: string[] | undefined;
  if (dataset === "portfolio") {
    const workResult = await supabase
      .from("works")
      .select("content_item_id")
      .eq("show_in_portfolio", true);
    if (workResult.error) throw new Error("portfolio_lookup_failed");
    idsForPortfolio = (workResult.data ?? []).map(
      (work) => work.content_item_id,
    );
    if (!idsForPortfolio.length)
      return {
        columns: [...commonColumns],
        datasetLabel: "portfolio",
        rows: [],
      };
  }

  let query = supabase
    .from("content_items")
    .select(
      "id,kind,project_id,slug,title,excerpt,status,posted_at,publish_at,first_published_at,feed_at,feed_event_type,source_system,source_external_id,created_at,updated_at",
    )
    .order("created_at")
    .limit(10_000);
  if (dataset === "blog") query = query.eq("kind", "post");
  if (dataset === "library") query = query.eq("kind", "library");
  if (dataset === "works" || dataset === "portfolio")
    query = query.eq("kind", "work");
  if (dataset === "project") query = query.eq("project_id", projectId!);
  if (idsForPortfolio) query = query.in("id", idsForPortfolio);
  const contentResult = await query;
  if (contentResult.error) throw new Error("content_export_failed");
  const content = contentResult.data ?? [];
  const contentIds = content.map((item) => item.id);
  const projectIds = [
    ...new Set(content.flatMap((item) => item.project_id ?? [])),
  ];

  const [projects, tagRelations, posts, works, library] = await Promise.all([
    projectIds.length
      ? supabase.from("projects").select("id,slug").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? supabase
          .from("content_tags")
          .select("content_item_id,tag_id")
          .in("content_item_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? supabase
          .from("posts")
          .select(
            "content_item_id,body_markdown,post_category_id,location_id,external_url,is_spoiler,watermark_enabled",
          )
          .in("content_item_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? supabase
          .from("works")
          .select(
            "content_item_id,summary,description_markdown,released_on,external_url,work_type,show_on_home,show_in_portfolio",
          )
          .in("content_item_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? supabase
          .from("library_items")
          .select(
            "content_item_id,description_markdown,access_policy_code,download_enabled,inline_preview_enabled",
          )
          .in("content_item_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    [projects, tagRelations, posts, works, library].some(
      (result) => result.error,
    )
  )
    throw new Error("content_detail_export_failed");

  const tagIds = [
    ...new Set((tagRelations.data ?? []).map((relation) => relation.tag_id)),
  ];
  const categoryIds = [
    ...new Set(
      (posts.data ?? []).flatMap((post) => post.post_category_id ?? []),
    ),
  ];
  const locationIds = [
    ...new Set((posts.data ?? []).flatMap((post) => post.location_id ?? [])),
  ];
  const [tags, categories, locations] = await Promise.all([
    tagIds.length
      ? supabase.from("tags").select("id,slug").in("id", tagIds)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length
      ? supabase.from("post_categories").select("id,slug").in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase
          .from("locations")
          .select("id,display_name,maps_query")
          .in("id", locationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ([tags, categories, locations].some((result) => result.error))
    throw new Error("taxonomy_export_failed");

  const projectMap = new Map(
    (projects.data ?? []).map((item) => [item.id, item.slug]),
  );
  const tagMap = new Map((tags.data ?? []).map((item) => [item.id, item.slug]));
  const tagsByContent = new Map<string, string[]>();
  for (const relation of tagRelations.data ?? []) {
    const slug = tagMap.get(relation.tag_id);
    if (slug)
      tagsByContent.set(relation.content_item_id, [
        ...(tagsByContent.get(relation.content_item_id) ?? []),
        slug,
      ]);
  }
  const postMap = new Map(
    (posts.data ?? []).map((item) => [item.content_item_id, item]),
  );
  const workMap = new Map(
    (works.data ?? []).map((item) => [item.content_item_id, item]),
  );
  const libraryMap = new Map(
    (library.data ?? []).map((item) => [item.content_item_id, item]),
  );
  const categoryMap = new Map(
    (categories.data ?? []).map((item) => [item.id, item.slug]),
  );
  const locationMap = new Map(
    (locations.data ?? []).map((item) => [item.id, item]),
  );

  const rows = content.map((item): ExportRow => {
    const post = postMap.get(item.id);
    const work = workMap.get(item.id);
    const libraryItem = libraryMap.get(item.id);
    const location = post?.location_id
      ? locationMap.get(post.location_id)
      : undefined;
    return {
      ...item,
      access_policy: libraryItem?.access_policy_code ?? null,
      body_markdown: post?.body_markdown ?? null,
      category_slug: post?.post_category_id
        ? (categoryMap.get(post.post_category_id) ?? null)
        : null,
      description_markdown:
        work?.description_markdown ?? libraryItem?.description_markdown ?? null,
      download_enabled: libraryItem?.download_enabled ?? null,
      external_url: post?.external_url ?? work?.external_url ?? null,
      inline_preview_enabled: libraryItem?.inline_preview_enabled ?? null,
      is_spoiler: post?.is_spoiler ?? null,
      location_maps_query: location?.maps_query ?? null,
      location_name: location?.display_name ?? null,
      project_slug: item.project_id
        ? (projectMap.get(item.project_id) ?? null)
        : null,
      released_on: work?.released_on ?? null,
      show_in_portfolio: work?.show_in_portfolio ?? null,
      show_on_home: work?.show_on_home ?? null,
      summary: work?.summary ?? null,
      tags: (tagsByContent.get(item.id) ?? []).sort().join(" "),
      watermark_enabled: post?.watermark_enabled ?? null,
      work_type: work?.work_type ?? null,
    };
  });
  return { columns: [...commonColumns], datasetLabel: dataset, rows };
}

export async function getExportDataset(
  supabase: AdminSupabase,
  dataset: ExportDataset,
  projectId?: string,
): Promise<ExportResult> {
  if (dataset === "projects") {
    const result = await supabase
      .from("projects")
      .select(
        "id,slug,name,description,theme_key,display_order,is_active,created_at,updated_at,deleted_at",
      )
      .order("display_order");
    if (result.error) throw new Error("project_export_failed");
    return {
      columns: [
        "id",
        "slug",
        "name",
        "description",
        "theme_key",
        "display_order",
        "is_active",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
      datasetLabel: "projects",
      rows: result.data ?? [],
    };
  }

  if (dataset === "project") {
    const parsedId = z.string().uuid().safeParse(projectId);
    if (!parsedId.success) throw new Error("project_id_required");
    const project = await supabase
      .from("projects")
      .select("slug")
      .eq("id", parsedId.data)
      .maybeSingle();
    if (project.error || !project.data) throw new Error("project_not_found");
    const result = await contentRows(supabase, dataset, parsedId.data);
    return { ...result, datasetLabel: `project-${project.data.slug}` };
  }
  return contentRows(supabase, dataset);
}
