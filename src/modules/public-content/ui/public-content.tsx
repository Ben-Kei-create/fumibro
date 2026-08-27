import Image from "next/image";
import Link from "next/link";

import type {
  PublicContentSummaryDto,
  PublicImageDto,
  PublicLibraryDto,
  PublicPostDto,
  PublicWorkDto,
} from "@/modules/public-content/application/public-content-dto";

export function formatPublicDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function PublicImage({
  image,
  priority = false,
}: {
  image: PublicImageDto;
  priority?: boolean;
}) {
  return (
    <Image
      alt={image.altText}
      className="h-full w-full object-cover"
      height={image.height}
      priority={priority}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 720px"
      src={image.url}
      width={image.width}
    />
  );
}

export function SafeRichText({ value }: { value: string }) {
  const blocks = value.replaceAll("\\n", "\n").split(/\n{2,}/u);

  return (
    <div className="space-y-5 text-[1.02rem] leading-8 text-stone-700">
      {blocks.map((block, index) => {
        const text = block.trim();
        if (!text) return null;
        if (text.startsWith("## ")) {
          return (
            <h2
              className="pt-4 text-2xl font-bold tracking-tight text-stone-950"
              key={`${index}-${text}`}
            >
              {text.slice(3)}
            </h2>
          );
        }
        if (text.startsWith("# ")) {
          return (
            <h2
              className="text-3xl font-bold tracking-tight text-stone-950"
              key={`${index}-${text}`}
            >
              {text.slice(2)}
            </h2>
          );
        }
        const lines = text.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul className="list-disc space-y-2 pl-6" key={`${index}-${text}`}>
              {lines.map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={`${index}-${text}`}>
            {text}
          </p>
        );
      })}
    </div>
  );
}

export function PageHeading({
  description,
  eyebrow,
  title,
}: {
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? (
        <p className="text-sm font-semibold tracking-[0.18em] text-stone-500">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-stone-950 sm:text-5xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-5 text-base leading-8 text-stone-600 sm:text-lg">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
      {children}
    </div>
  );
}

export function PostCard({ post }: { post: PublicPostDto }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {post.image ? (
        <Link
          className="block aspect-[16/9] overflow-hidden"
          href={`/blog/${post.slug}`}
        >
          <PublicImage image={post.image} />
        </Link>
      ) : null}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
          <time dateTime={post.publishAt}>
            {formatPublicDate(post.publishAt)}
          </time>
          {post.feedEventType ? (
            <span className="rounded-full bg-stone-900 px-2 py-1 text-[0.65rem] font-bold tracking-wide text-white">
              {post.feedEventType.toUpperCase()}
            </span>
          ) : null}
          {post.project ? (
            <Link href={`/projects/${post.project.slug}`}>
              {post.project.name}
            </Link>
          ) : null}
        </div>
        <h2 className="mt-3 text-xl font-bold text-stone-950">
          <Link href={`/blog/${post.slug}`}>{post.title ?? "無題の投稿"}</Link>
        </h2>
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap leading-7 text-stone-600">
          {post.excerpt ?? post.body}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.category ? (
            <Link
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700"
              href={`/blog/categories/${post.category.slug}`}
            >
              {post.category.label}
            </Link>
          ) : null}
          {post.tags.map((tag) => (
            <Link
              className="text-xs text-stone-500 hover:text-stone-900"
              href={`/tags/${tag.slug}`}
              key={tag.slug}
            >
              #{tag.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

export function WorkCard({
  portfolio = false,
  work,
}: {
  portfolio?: boolean;
  work: PublicWorkDto;
}) {
  const href = portfolio ? `/portfolio/${work.slug}` : `/works/${work.slug}`;
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {work.image ? (
        <Link className="block aspect-[4/3] overflow-hidden" href={href}>
          <PublicImage image={work.image} />
        </Link>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 text-sm font-medium text-stone-500">
          {work.type}
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {work.project?.name ?? work.type}
        </p>
        <h2 className="mt-2 text-xl font-bold text-stone-950">
          <Link href={href}>{work.title}</Link>
        </h2>
        <p className="mt-3 line-clamp-3 leading-7 text-stone-600">
          {work.summary ?? work.excerpt ?? work.description}
        </p>
      </div>
    </article>
  );
}

export function LibraryCard({ item }: { item: PublicLibraryDto }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {item.cover ? (
        <Link
          className="block aspect-[4/3] overflow-hidden"
          href={`/library/${item.slug}`}
        >
          <PublicImage image={item.cover} />
        </Link>
      ) : null}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-stone-500">
            {item.project?.name ?? "FUMIBRO"}
          </p>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
            {item.accessPolicy.replaceAll("_", " ")}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-bold text-stone-950">
          <Link href={`/library/${item.slug}`}>{item.title}</Link>
        </h2>
        <p className="mt-3 line-clamp-3 leading-7 text-stone-600">
          {item.excerpt ?? item.description}
        </p>
      </div>
    </article>
  );
}

export function ContentSummaryCard({
  item,
}: {
  item: PublicContentSummaryDto;
}) {
  return (
    <article className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4">
      {item.image ? (
        <Link
          className="h-24 w-28 shrink-0 overflow-hidden rounded-lg"
          href={item.href}
        >
          <PublicImage image={item.image} />
        </Link>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {item.kind} · {formatPublicDate(item.publishedAt)}
        </p>
        <h2 className="mt-1 truncate text-lg font-bold text-stone-950">
          <Link href={item.href}>{item.title}</Link>
        </h2>
        {item.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">
            {item.excerpt}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function AdSlot() {
  return (
    <aside
      aria-label="将来の広告掲載枠"
      className="rounded-xl border border-dashed border-stone-300 px-4 py-3 text-center text-xs tracking-wide text-stone-400"
    >
      ADVERTISEMENT SPACE
    </aside>
  );
}
