import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type {
  PublicBusinessCardDto,
  PublicContentSummaryDto,
  PublicImageDto,
  PublicLibraryDto,
  PublicNoticeDto,
  PublicPageDto,
  PublicPostDto,
  PublicProjectSummaryDto,
  PublicTagDto,
  PublicWorkDto,
} from "@/modules/public-content/application/public-content-dto";

type ContentRow = {
  excerpt: string | null;
  feed_at: string | null;
  feed_event_type: "new" | "updated" | null;
  id: string;
  kind: "library" | "page" | "post" | "work";
  posted_at: string;
  project_id: string | null;
  publish_at: string;
  slug: string;
  title: string | null;
  updated_at: string;
};

type SearchRow = {
  excerpt: string | null;
  feed_event_type: "new" | "updated" | null;
  id: string;
  kind: ContentRow["kind"];
  project_id: string | null;
  publish_at: string;
  slug: string;
  title: string | null;
};

function contentHref(kind: ContentRow["kind"], slug: string) {
  if (kind === "post") return `/blog/${slug}`;
  if (kind === "work") return `/works/${slug}`;
  if (kind === "library") return `/library/${slug}`;
  return `/${slug}`;
}

async function getProjectMap(
  supabase: SupabaseClient,
  projectIds: Array<string | null>,
) {
  const ids = [
    ...new Set(projectIds.filter((id): id is string => Boolean(id))),
  ];
  const projects = new Map<string, PublicProjectSummaryDto>();
  if (ids.length === 0) return projects;

  const result = await supabase
    .from("projects")
    .select("id,slug,name,description,theme_key")
    .in("id", ids);

  for (const project of result.data ?? []) {
    projects.set(project.id, {
      description: project.description,
      id: project.id,
      name: project.name,
      slug: project.slug,
      themeKey: project.theme_key,
    });
  }
  return projects;
}

async function getImageMap(
  supabase: SupabaseClient,
  assetIds: Array<string | null>,
  role: "display" | "thumbnail" = "thumbnail",
) {
  const ids = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  const images = new Map<string, PublicImageDto>();
  if (ids.length === 0) return images;

  const [assetResult, variantResult] = await Promise.all([
    supabase.from("assets").select("id,alt_text").in("id", ids),
    supabase
      .from("asset_variants")
      .select("asset_id,object_path,width,height")
      .in("asset_id", ids)
      .eq("variant_role", role)
      .eq("bucket_id", "public-media"),
  ]);
  const altText = new Map(
    (assetResult.data ?? []).map((asset) => [asset.id, asset.alt_text ?? ""]),
  );

  for (const variant of variantResult.data ?? []) {
    if (!variant.width || !variant.height) continue;
    images.set(variant.asset_id, {
      altText: altText.get(variant.asset_id) ?? "",
      height: variant.height,
      url: supabase.storage
        .from("public-media")
        .getPublicUrl(variant.object_path).data.publicUrl,
      width: variant.width,
    });
  }
  return images;
}

async function getTagMap(supabase: SupabaseClient, contentIds: string[]) {
  const result = new Map<string, PublicTagDto[]>();
  if (contentIds.length === 0) return result;

  const relations = await supabase
    .from("content_tags")
    .select("content_item_id,tag_id")
    .in("content_item_id", contentIds);
  const tagIds = [
    ...new Set((relations.data ?? []).map((relation) => relation.tag_id)),
  ];
  if (tagIds.length === 0) return result;

  const tags = await supabase
    .from("tags")
    .select("id,label,slug,display_order")
    .in("id", tagIds)
    .order("display_order");
  const byId = new Map(
    (tags.data ?? []).map((tag) => [
      tag.id,
      { label: tag.label, slug: tag.slug },
    ]),
  );

  for (const relation of relations.data ?? []) {
    const tag = byId.get(relation.tag_id);
    if (!tag) continue;
    result.set(relation.content_item_id, [
      ...(result.get(relation.content_item_id) ?? []),
      tag,
    ]);
  }
  return result;
}

export async function getPublicProjects(): Promise<PublicProjectSummaryDto[]> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("projects")
    .select("id,slug,name,description,theme_key")
    .order("display_order");

  return (result.data ?? []).map((project) => ({
    description: project.description,
    id: project.id,
    name: project.name,
    slug: project.slug,
    themeKey: project.theme_key,
  }));
}

export async function getPublicProject(
  slug: string,
): Promise<PublicProjectSummaryDto | null> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("projects")
    .select("id,slug,name,description,theme_key")
    .eq("slug", slug)
    .maybeSingle();
  if (!result.data) return null;
  return {
    description: result.data.description,
    id: result.data.id,
    name: result.data.name,
    slug: result.data.slug,
    themeKey: result.data.theme_key,
  };
}

export async function getPublicPosts(
  options: {
    categorySlug?: string;
    contentId?: string;
    feedOrder?: boolean;
    limit?: number;
    projectId?: string;
    tagSlug?: string;
  } = {},
): Promise<PublicPostDto[]> {
  const supabase = createPublicSupabaseClient();
  let filteredContentIds: string[] | undefined;

  if (options.categorySlug) {
    const category = await supabase
      .from("post_categories")
      .select("id")
      .eq("slug", options.categorySlug)
      .maybeSingle();
    if (!category.data) return [];
    const relations = await supabase
      .from("posts")
      .select("content_item_id")
      .eq("post_category_id", category.data.id);
    filteredContentIds = (relations.data ?? []).map(
      (relation) => relation.content_item_id,
    );
    if (filteredContentIds.length === 0) return [];
  }
  if (options.tagSlug) {
    const tag = await supabase
      .from("tags")
      .select("id")
      .eq("slug", options.tagSlug)
      .maybeSingle();
    if (!tag.data) return [];
    const relations = await supabase
      .from("content_tags")
      .select("content_item_id")
      .eq("tag_id", tag.data.id);
    const taggedContentIds = (relations.data ?? []).map(
      (relation) => relation.content_item_id,
    );
    if (taggedContentIds.length === 0) return [];
    filteredContentIds = filteredContentIds
      ? filteredContentIds.filter((id) => taggedContentIds.includes(id))
      : taggedContentIds;
    if (filteredContentIds.length === 0) return [];
  }

  let contentQuery = supabase
    .from("content_items")
    .select(
      "id,kind,project_id,slug,title,excerpt,posted_at,publish_at,feed_at,feed_event_type,updated_at",
    )
    .eq("kind", "post")
    .order(options.feedOrder ? "feed_at" : "publish_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(Math.min(options.limit ?? 40, 100));
  if (options.projectId)
    contentQuery = contentQuery.eq("project_id", options.projectId);
  if (options.contentId)
    contentQuery = contentQuery.eq("id", options.contentId);
  if (filteredContentIds)
    contentQuery = contentQuery.in("id", filteredContentIds);
  const contentResult = await contentQuery;
  const content = (contentResult.data ?? []) as ContentRow[];
  if (content.length === 0) return [];

  const postQuery = supabase
    .from("posts")
    .select(
      "content_item_id,body_markdown,post_category_id,location_id,image_asset_id,external_url,is_spoiler",
    )
    .in(
      "content_item_id",
      content.map((item) => item.id),
    );
  const postResult = await postQuery;
  const postsById = new Map(
    (postResult.data ?? []).map((post) => [post.content_item_id, post]),
  );
  const visibleContent = content.filter((item) => postsById.has(item.id));
  const details = visibleContent.map((item) => postsById.get(item.id)!);
  const categoryIds = [
    ...new Set(details.flatMap((post) => post.post_category_id ?? [])),
  ];
  const locationIds = [
    ...new Set(details.flatMap((post) => post.location_id ?? [])),
  ];
  const [projects, images, tags, categories, locations] = await Promise.all([
    getProjectMap(
      supabase,
      visibleContent.map((item) => item.project_id),
    ),
    getImageMap(
      supabase,
      details.map((post) => post.image_asset_id),
      "display",
    ),
    getTagMap(
      supabase,
      visibleContent.map((item) => item.id),
    ),
    categoryIds.length
      ? supabase
          .from("post_categories")
          .select("id,label,slug")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
    locationIds.length
      ? supabase
          .from("locations")
          .select("id,display_name,maps_query")
          .in("id", locationIds)
      : Promise.resolve({ data: [] }),
  ]);
  const categoriesById = new Map(
    (categories.data ?? []).map((category) => [category.id, category]),
  );
  const locationsById = new Map(
    (locations.data ?? []).map((location) => [location.id, location]),
  );

  return visibleContent.map((item) => {
    const post = postsById.get(item.id)!;
    const category = post.post_category_id
      ? categoriesById.get(post.post_category_id)
      : null;
    const location = post.location_id
      ? locationsById.get(post.location_id)
      : null;
    return {
      body: post.body_markdown,
      category: category
        ? { label: category.label, slug: category.slug }
        : null,
      excerpt: item.excerpt,
      externalUrl: post.external_url,
      feedEventType: item.feed_event_type,
      id: item.id,
      image: post.image_asset_id
        ? (images.get(post.image_asset_id) ?? null)
        : null,
      isSpoiler: post.is_spoiler,
      location: location
        ? {
            displayName: location.display_name,
            mapsQuery: location.maps_query,
          }
        : null,
      postedAt: item.posted_at,
      project: item.project_id ? (projects.get(item.project_id) ?? null) : null,
      publishAt: item.publish_at,
      slug: item.slug,
      tags: tags.get(item.id) ?? [],
      title: item.title,
      updatedAt: item.updated_at,
    };
  });
}

export async function getPublicPost(slug: string) {
  const supabase = createPublicSupabaseClient();
  const content = await supabase
    .from("content_items")
    .select("id")
    .eq("kind", "post")
    .eq("slug", slug)
    .maybeSingle();
  const contentId = content.data?.id;
  if (!contentId) return null;
  const posts = await getPublicPosts({ contentId, limit: 1 });
  return posts.find((post) => post.id === contentId) ?? null;
}

async function getPublicWorksInternal(options: {
  homeOnly?: boolean;
  portfolioOnly?: boolean;
  projectId?: string;
  slug?: string;
}) {
  const supabase = createPublicSupabaseClient();
  let contentQuery = supabase
    .from("content_items")
    .select(
      "id,kind,project_id,slug,title,excerpt,posted_at,publish_at,feed_at,feed_event_type,updated_at",
    )
    .eq("kind", "work")
    .order("publish_at", { ascending: false })
    .limit(100);
  if (options.projectId)
    contentQuery = contentQuery.eq("project_id", options.projectId);
  if (options.slug) contentQuery = contentQuery.eq("slug", options.slug);
  const content = ((await contentQuery).data ?? []) as ContentRow[];
  if (content.length === 0) return [];

  let workQuery = supabase
    .from("works")
    .select(
      "content_item_id,summary,description_markdown,image_asset_id,released_on,external_url,work_type,show_on_home,home_display_order,show_in_portfolio,portfolio_display_order",
    )
    .in(
      "content_item_id",
      content.map((item) => item.id),
    );
  if (options.homeOnly) workQuery = workQuery.eq("show_on_home", true);
  if (options.portfolioOnly)
    workQuery = workQuery.eq("show_in_portfolio", true);
  const workResult = await workQuery;
  const workById = new Map(
    (workResult.data ?? []).map((work) => [work.content_item_id, work]),
  );
  const filtered = content.filter((item) => workById.has(item.id));
  const [projects, images, tags] = await Promise.all([
    getProjectMap(
      supabase,
      filtered.map((item) => item.project_id),
    ),
    getImageMap(
      supabase,
      filtered.map((item) => workById.get(item.id)?.image_asset_id ?? null),
      "display",
    ),
    getTagMap(
      supabase,
      filtered.map((item) => item.id),
    ),
  ]);

  return filtered
    .map((item): PublicWorkDto => {
      const work = workById.get(item.id)!;
      return {
        description: work.description_markdown,
        excerpt: item.excerpt,
        externalUrl: work.external_url,
        id: item.id,
        image: work.image_asset_id
          ? (images.get(work.image_asset_id) ?? null)
          : null,
        project: item.project_id
          ? (projects.get(item.project_id) ?? null)
          : null,
        publishedAt: item.publish_at,
        releasedOn: work.released_on,
        showInPortfolio: work.show_in_portfolio,
        slug: item.slug,
        summary: work.summary,
        tags: tags.get(item.id) ?? [],
        title: item.title ?? "Untitled work",
        type: work.work_type,
      };
    })
    .sort((left, right) => {
      const leftDetail = workById.get(left.id)!;
      const rightDetail = workById.get(right.id)!;
      if (options.portfolioOnly)
        return (
          leftDetail.portfolio_display_order -
          rightDetail.portfolio_display_order
        );
      if (options.homeOnly)
        return leftDetail.home_display_order - rightDetail.home_display_order;
      return right.publishedAt.localeCompare(left.publishedAt);
    });
}

export function getPublicWorks(projectId?: string) {
  return getPublicWorksInternal({ projectId });
}

export function getHomeWorks() {
  return getPublicWorksInternal({ homeOnly: true });
}

export function getPortfolioWorks() {
  return getPublicWorksInternal({ portfolioOnly: true });
}

export async function getPublicWork(slug: string) {
  const works = await getPublicWorksInternal({ slug });
  return works.find((work) => work.slug === slug) ?? null;
}

export async function getPublicLibrary(
  projectId?: string,
  slug?: string,
): Promise<PublicLibraryDto[]> {
  const supabase = createPublicSupabaseClient();
  let contentQuery = supabase
    .from("content_items")
    .select(
      "id,kind,project_id,slug,title,excerpt,posted_at,publish_at,feed_at,feed_event_type,updated_at",
    )
    .eq("kind", "library")
    .order("publish_at", { ascending: false })
    .limit(100);
  if (projectId) contentQuery = contentQuery.eq("project_id", projectId);
  if (slug) contentQuery = contentQuery.eq("slug", slug);
  const content = ((await contentQuery).data ?? []) as ContentRow[];
  if (content.length === 0) return [];

  const detailResult = await supabase
    .from("library_items")
    .select(
      "content_item_id,description_markdown,access_policy_code,download_enabled,cover_asset_id",
    )
    .in(
      "content_item_id",
      content.map((item) => item.id),
    );
  const detailById = new Map(
    (detailResult.data ?? []).map((item) => [item.content_item_id, item]),
  );
  const filtered = content.filter((item) => detailById.has(item.id));
  const [projects, covers, tags] = await Promise.all([
    getProjectMap(
      supabase,
      filtered.map((item) => item.project_id),
    ),
    getImageMap(
      supabase,
      filtered.map((item) => detailById.get(item.id)?.cover_asset_id ?? null),
      "display",
    ),
    getTagMap(
      supabase,
      filtered.map((item) => item.id),
    ),
  ]);

  return filtered.map((item) => {
    const detail = detailById.get(item.id)!;
    return {
      accessPolicy: detail.access_policy_code,
      cover: detail.cover_asset_id
        ? (covers.get(detail.cover_asset_id) ?? null)
        : null,
      description: detail.description_markdown,
      downloadEnabled: detail.download_enabled,
      excerpt: item.excerpt,
      id: item.id,
      project: item.project_id ? (projects.get(item.project_id) ?? null) : null,
      publishedAt: item.publish_at,
      slug: item.slug,
      tags: tags.get(item.id) ?? [],
      title: item.title ?? "Untitled library item",
    } satisfies PublicLibraryDto;
  });
}

export async function getPublicLibraryItem(slug: string) {
  const items = await getPublicLibrary(undefined, slug);
  return items.find((item) => item.slug === slug) ?? null;
}

export async function getPublicLibraryFiles(libraryItemId: string) {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("library_files")
    .select("id,display_name,version_label,is_primary,display_order")
    .eq("library_item_id", libraryItemId)
    .order("display_order");
  return (result.data ?? []).map((file) => ({
    displayName: file.display_name,
    id: file.id,
    isPrimary: file.is_primary,
    versionLabel: file.version_label,
  }));
}

export async function getProjectContent(
  projectId: string,
): Promise<PublicContentSummaryDto[]> {
  const [posts, works, library] = await Promise.all([
    getPublicPosts({ projectId, limit: 30 }),
    getPublicWorks(projectId),
    getPublicLibrary(projectId),
  ]);
  return [
    ...posts.map((post): PublicContentSummaryDto => ({
      excerpt: post.excerpt ?? post.body.slice(0, 160),
      feedEventType: post.feedEventType,
      href: `/blog/${post.slug}`,
      id: post.id,
      image: post.image,
      kind: "post",
      project: post.project,
      publishedAt: post.publishAt,
      title: post.title ?? "無題の投稿",
    })),
    ...works.map((work): PublicContentSummaryDto => ({
      excerpt: work.summary ?? work.excerpt,
      feedEventType: null,
      href: `/works/${work.slug}`,
      id: work.id,
      image: work.image,
      kind: "work",
      project: work.project,
      publishedAt: work.publishedAt,
      title: work.title,
    })),
    ...library.map((item): PublicContentSummaryDto => ({
      excerpt: item.excerpt,
      feedEventType: null,
      href: `/library/${item.slug}`,
      id: item.id,
      image: item.cover,
      kind: "library",
      project: item.project,
      publishedAt: item.publishedAt,
      title: item.title,
    })),
  ].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function getPublicPage(
  pageKey: string,
): Promise<PublicPageDto | null> {
  const supabase = createPublicSupabaseClient();
  const pageResult = await supabase
    .from("pages")
    .select("content_item_id,body_markdown,seo_description")
    .eq("page_key", pageKey)
    .maybeSingle();
  if (!pageResult.data) return null;
  const contentResult = await supabase
    .from("content_items")
    .select("title,updated_at")
    .eq("id", pageResult.data.content_item_id)
    .eq("kind", "page")
    .maybeSingle();
  if (!contentResult.data) return null;
  return {
    body: pageResult.data.body_markdown,
    description: pageResult.data.seo_description,
    title: contentResult.data.title ?? pageKey,
    updatedAt: contentResult.data.updated_at,
  };
}

export async function getPublicNotices(): Promise<PublicNoticeDto[]> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("notices")
    .select("id,title,body,link_url,link_label")
    .order("display_order")
    .order("starts_at", { ascending: false })
    .limit(10);
  return (result.data ?? []).map((notice) => ({
    body: notice.body,
    id: notice.id,
    linkLabel: notice.link_label,
    linkUrl: notice.link_url,
    title: notice.title,
  }));
}

export async function getPrimaryBusinessCard(): Promise<PublicBusinessCardDto | null> {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("business_cards")
    .select(
      "slug,display_name,organization,job_title,email,phone,website,address,note,png_asset_id",
    )
    .eq("is_primary", true)
    .maybeSingle();
  if (!result.data) return null;
  return {
    address: result.data.address,
    displayName: result.data.display_name,
    email: result.data.email,
    jobTitle: result.data.job_title,
    note: result.data.note,
    organization: result.data.organization,
    phone: result.data.phone,
    pngAvailable: Boolean(result.data.png_asset_id),
    slug: result.data.slug,
    website: result.data.website,
  };
}

export async function getPublicPostCategories() {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("post_categories")
    .select("label,slug")
    .order("display_order");
  return (result.data ?? []).map((category): PublicTagDto => ({
    label: category.label,
    slug: category.slug,
  }));
}

export async function getContactCategories() {
  const supabase = createPublicSupabaseClient();
  const result = await supabase
    .from("contact_categories")
    .select("id,label,slug")
    .order("display_order");
  return result.data ?? [];
}

export async function getVisitTotal(projectId?: string) {
  const supabase = createPublicSupabaseClient();
  const scopeKey = projectId ? `project:${projectId}` : "site";
  const result = await supabase
    .from("visit_counters")
    .select("total")
    .eq("scope_key", scopeKey)
    .maybeSingle();
  return Number(result.data?.total ?? 0);
}

export async function getPostInteractions(postId: string) {
  const supabase = createPublicSupabaseClient();
  const [comments, likes] = await Promise.all([
    supabase
      .from("comments")
      .select("id,display_name,body,submitted_at")
      .eq("post_id", postId)
      .order("submitted_at"),
    supabase
      .from("post_like_counts")
      .select("like_count")
      .eq("post_id", postId)
      .maybeSingle(),
  ]);
  return {
    comments: (comments.data ?? []).map((comment) => ({
      body: comment.body,
      displayName: comment.display_name,
      id: comment.id,
      submittedAt: comment.submitted_at,
    })),
    likeCount: Number(likes.data?.like_count ?? 0),
  };
}

export async function searchPublicContent(query: string) {
  const normalized = query.trim();
  if (!normalized || normalized.length > 100) return [];
  const supabase = createPublicSupabaseClient();
  const result = await supabase.rpc("search_public_content", {
    p_limit: 50,
    p_offset: 0,
    p_query: normalized,
  });
  const rows = (result.data ?? []) as SearchRow[];
  const projects = await getProjectMap(
    supabase,
    rows.map((row) => row.project_id),
  );
  return rows.map((row): PublicContentSummaryDto => ({
    excerpt: row.excerpt,
    feedEventType: row.feed_event_type,
    href: contentHref(row.kind, row.slug),
    id: row.id,
    image: null,
    kind: row.kind,
    project: row.project_id ? (projects.get(row.project_id) ?? null) : null,
    publishedAt: row.publish_at,
    title: row.title ?? "無題の投稿",
  }));
}

export async function getTaggedContent(tagSlug: string) {
  const supabase = createPublicSupabaseClient();
  const tag = await supabase
    .from("tags")
    .select("id,label,slug")
    .eq("slug", tagSlug)
    .maybeSingle();
  if (!tag.data) return null;
  const relations = await supabase
    .from("content_tags")
    .select("content_item_id")
    .eq("tag_id", tag.data.id);
  const ids = new Set(
    (relations.data ?? []).map((item) => item.content_item_id),
  );
  const [posts, works, library] = await Promise.all([
    getPublicPosts({ tagSlug, limit: 100 }),
    getPublicWorks(),
    getPublicLibrary(),
  ]);
  const items: PublicContentSummaryDto[] = [
    ...posts.map((post) => ({
      excerpt: post.excerpt ?? post.body.slice(0, 160),
      feedEventType: post.feedEventType,
      href: `/blog/${post.slug}`,
      id: post.id,
      image: post.image,
      kind: "post" as const,
      project: post.project,
      publishedAt: post.publishAt,
      title: post.title ?? "無題の投稿",
    })),
    ...works
      .filter((work) => ids.has(work.id))
      .map((work) => ({
        excerpt: work.summary ?? work.excerpt,
        feedEventType: null,
        href: `/works/${work.slug}`,
        id: work.id,
        image: work.image,
        kind: "work" as const,
        project: work.project,
        publishedAt: work.publishedAt,
        title: work.title,
      })),
    ...library
      .filter((item) => ids.has(item.id))
      .map((item) => ({
        excerpt: item.excerpt,
        feedEventType: null,
        href: `/library/${item.slug}`,
        id: item.id,
        image: item.cover,
        kind: "library" as const,
        project: item.project,
        publishedAt: item.publishedAt,
        title: item.title,
      })),
  ].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return { items, tag: { label: tag.data.label, slug: tag.data.slug } };
}

export { contentHref };
