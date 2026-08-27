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
  "project_id",
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
  "tag_ids",
  "body_markdown",
  "post_category_id",
  "category_slug",
  "location_id",
  "location_name",
  "location_maps_query",
  "external_url",
  "is_spoiler",
  "watermark_enabled",
  "image_asset_id",
  "summary",
  "description_markdown",
  "work_type",
  "released_on",
  "show_on_home",
  "home_display_order",
  "show_in_portfolio",
  "portfolio_display_order",
  "access_policy",
  "download_enabled",
  "inline_preview_enabled",
  "cover_asset_id",
  "library_files",
  "created_at",
  "updated_at",
] as const;

export type ExportResult = {
  columns: string[];
  datasetLabel: string;
  rows: ExportRow[];
};

type ContentExportRecord = {
  created_at: string;
  excerpt: string | null;
  feed_at: string | null;
  feed_event_type: string | null;
  first_published_at: string | null;
  id: string;
  kind: string;
  posted_at: string;
  project_id: string | null;
  publish_at: string | null;
  slug: string;
  source_external_id: string | null;
  source_system: string;
  status: string;
  title: string | null;
  updated_at: string;
};

async function loadInChunks<T>(
  ids: string[],
  query: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = await query(ids.slice(offset, offset + 50));
    if (result.error) throw new Error("chunked_export_query_failed");
    rows.push(...(result.data ?? []));
  }
  return rows;
}

async function contentRows(
  supabase: AdminSupabase,
  dataset: Exclude<ExportDataset, "projects">,
  projectId?: string,
): Promise<ExportResult> {
  const content: ContentExportRecord[] = [];
  for (let offset = 0; ; offset += 200) {
    let query = supabase
      .from("content_items")
      .select(
        "id,kind,project_id,slug,title,excerpt,status,posted_at,publish_at,first_published_at,feed_at,feed_event_type,source_system,source_external_id,created_at,updated_at",
      )
      .order("created_at")
      .order("id")
      .range(offset, offset + 199);
    if (dataset === "blog") query = query.eq("kind", "post");
    if (dataset === "library") query = query.eq("kind", "library");
    if (dataset === "works" || dataset === "portfolio")
      query = query.eq("kind", "work");
    if (dataset === "project") query = query.eq("project_id", projectId!);
    const page = await query;
    if (page.error) throw new Error("content_export_failed");
    const rows = (page.data ?? []) as ContentExportRecord[];
    content.push(...rows);
    if (rows.length < 200) break;
  }
  const contentIds = content.map((item) => item.id);
  const projectIds = [
    ...new Set(content.flatMap((item) => item.project_id ?? [])),
  ];

  const [projects, tagRelations, posts, works, library, libraryFiles] =
    await Promise.all([
      loadInChunks(projectIds, (ids) =>
        supabase.from("projects").select("id,slug").in("id", ids),
      ),
      loadInChunks(contentIds, (ids) =>
        supabase
          .from("content_tags")
          .select("content_item_id,tag_id")
          .in("content_item_id", ids),
      ),
      loadInChunks(contentIds, (ids) =>
        supabase
          .from("posts")
          .select(
            "content_item_id,body_markdown,post_category_id,location_id,image_asset_id,external_url,is_spoiler,watermark_enabled",
          )
          .in("content_item_id", ids),
      ),
      loadInChunks(contentIds, (ids) =>
        supabase
          .from("works")
          .select(
            "content_item_id,summary,description_markdown,image_asset_id,released_on,external_url,work_type,show_on_home,home_display_order,show_in_portfolio,portfolio_display_order",
          )
          .in("content_item_id", ids),
      ),
      loadInChunks(contentIds, (ids) =>
        supabase
          .from("library_items")
          .select(
            "content_item_id,description_markdown,access_policy_code,download_enabled,inline_preview_enabled,cover_asset_id",
          )
          .in("content_item_id", ids),
      ),
      loadInChunks(contentIds, (ids) =>
        supabase
          .from("library_files")
          .select(
            "id,library_item_id,asset_id,version_label,display_name,display_order,is_primary,deleted_at",
          )
          .in("library_item_id", ids),
      ),
    ]);

  const tagIds = [...new Set(tagRelations.map((relation) => relation.tag_id))];
  const categoryIds = [
    ...new Set(posts.flatMap((post) => post.post_category_id ?? [])),
  ];
  const locationIds = [
    ...new Set(posts.flatMap((post) => post.location_id ?? [])),
  ];
  const [tags, categories, locations] = await Promise.all([
    loadInChunks(tagIds, (ids) =>
      supabase.from("tags").select("id,slug").in("id", ids),
    ),
    loadInChunks(categoryIds, (ids) =>
      supabase.from("post_categories").select("id,slug").in("id", ids),
    ),
    loadInChunks(locationIds, (ids) =>
      supabase
        .from("locations")
        .select("id,display_name,maps_query")
        .in("id", ids),
    ),
  ]);

  const projectMap = new Map(projects.map((item) => [item.id, item.slug]));
  const tagMap = new Map(tags.map((item) => [item.id, item.slug]));
  const tagsByContent = new Map<string, string[]>();
  for (const relation of tagRelations) {
    const slug = tagMap.get(relation.tag_id);
    if (slug)
      tagsByContent.set(relation.content_item_id, [
        ...(tagsByContent.get(relation.content_item_id) ?? []),
        slug,
      ]);
  }
  const postMap = new Map(posts.map((item) => [item.content_item_id, item]));
  const workMap = new Map(works.map((item) => [item.content_item_id, item]));
  const libraryMap = new Map(
    library.map((item) => [item.content_item_id, item]),
  );
  const filesByLibrary = new Map<
    string,
    Array<(typeof libraryFiles)[number]>
  >();
  for (const file of libraryFiles) {
    filesByLibrary.set(file.library_item_id, [
      ...(filesByLibrary.get(file.library_item_id) ?? []),
      file,
    ]);
  }
  const categoryMap = new Map(categories.map((item) => [item.id, item.slug]));
  const locationMap = new Map(locations.map((item) => [item.id, item]));

  const rows = content
    .filter(
      (item) =>
        dataset !== "portfolio" ||
        workMap.get(item.id)?.show_in_portfolio === true,
    )
    .map((item): ExportRow => {
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
          work?.description_markdown ??
          libraryItem?.description_markdown ??
          null,
        download_enabled: libraryItem?.download_enabled ?? null,
        external_url: post?.external_url ?? work?.external_url ?? null,
        cover_asset_id: libraryItem?.cover_asset_id ?? null,
        home_display_order: work?.home_display_order ?? null,
        image_asset_id: post?.image_asset_id ?? work?.image_asset_id ?? null,
        inline_preview_enabled: libraryItem?.inline_preview_enabled ?? null,
        is_spoiler: post?.is_spoiler ?? null,
        location_maps_query: location?.maps_query ?? null,
        location_name: location?.display_name ?? null,
        location_id: post?.location_id ?? null,
        library_files: libraryItem
          ? JSON.stringify(filesByLibrary.get(item.id) ?? [])
          : null,
        portfolio_display_order: work?.portfolio_display_order ?? null,
        post_category_id: post?.post_category_id ?? null,
        project_slug: item.project_id
          ? (projectMap.get(item.project_id) ?? null)
          : null,
        released_on: work?.released_on ?? null,
        show_in_portfolio: work?.show_in_portfolio ?? null,
        show_on_home: work?.show_on_home ?? null,
        summary: work?.summary ?? null,
        tags: (tagsByContent.get(item.id) ?? []).sort().join(" "),
        tag_ids: tagRelations
          .filter((relation) => relation.content_item_id === item.id)
          .map((relation) => relation.tag_id)
          .sort()
          .join(" "),
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
