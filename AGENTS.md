<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FUMIBRO engineering rules

## Mission and priorities

FUMIBRO is a long-lived personal media, portfolio, and Project hub. Optimize in
this order: security and data durability, maintainability, responsive usability,
admin editability, and replaceable integrations. Phase 1 deliberately uses a
plain interface. Do not trade domain clarity for visual novelty.

## Fixed platform

- Next.js `16.3.3` or a later reviewed 16.x security patch; App Router only.
- Node.js `24.x`, pinned by `engines`, `.nvmrc`, and CI. npm and every direct
  dependency are lockfile-pinned.
- TypeScript strict mode, Tailwind CSS, PostgreSQL/Supabase, `@supabase/ssr`, and
  the default Node.js runtime. Do not introduce Edge Runtime without an ADR.
- Vercel hosts the application. Supabase owns Auth, Postgres, and Storage.

Before changing Next.js code, read the relevant bundled documentation under
`node_modules/next/dist/docs/`. Before Supabase work, check the current Supabase
changelog and official documentation.

## Architecture boundaries

- This is a modular monolith. Route files compose UI and call application
  services; they must not contain reusable SQL or domain rules.
- Domain modules live in `src/modules/<domain>`. Server-only data access lives in
  `src/server` or a module's `infrastructure` folder and imports `server-only`.
- Public reads return minimal DTOs. Never pass raw database rows, private asset
  paths, source external IDs, contact details, or visitor keys to Client
  Components.
- `content_items` is the canonical root for Blog, Works, Library, and Pages.
  Portfolio and Home are projections of existing content; never duplicate their
  source data.
- Projects share one CMS and schema. Visual variation is selected with
  `projects.theme_key` through `src/themes/registry.ts`; themes must not fork the
  data model.
- Future providers are accessed only through ports in `src/integrations/ports`.
  Phase 1 must not implement Gemini, Gmail, KDP, Claude, ChatGPT, payment, email,
  social, Maps API, or AdSense integrations.

## Data invariants

- Database identifiers and columns are `snake_case`; TypeScript values and
  functions are `camelCase`; components and exported types are `PascalCase`;
  route folders and URL slugs are `kebab-case`.
- External imports are idempotent on `(source_system, source_external_id)`, even
  while a matching item is in Trash. `source_system` records immutable origin.
- Blog category is an admin-managed `post_categories` relation and is distinct
  from many-to-many tags.
- Public content requires `status = 'published'`, `publish_at <= now()`, and
  `deleted_at is null`. Use the shared predicate/view instead of reimplementing
  it per page.
- Normal deletion is soft deletion. Purge is explicit, audited, requires fresh
  confirmation, and must account for revisions and Storage objects.
- Publishing, material updates, AI/import updates, and restores snapshot the
  previous state in `content_revisions` within the same transaction.
- Japanese search uses a migration-reproducible PGroonga index on
  `content_items.search_text`. Keep search text generation centralized.

## Authentication and security

- Public sign-up and anonymous Auth are disabled. Admin authorization comes
  only from trusted `app_metadata`, never `user_metadata`.
- Admin routes require an AAL2 Supabase session. `proxy.ts` refreshes sessions
  and performs convenience redirects only; every Server Action, Route Handler,
  and data mutation calls the server-side authorization guard again.
- A valid AAL2 session is enough for mobile Quick posting. Destructive purge
  requires a fresh confirmation check.
- Every exposed-schema table has RLS plus explicit grants. An authenticated role
  alone is not authorization. Views must use `security_invoker`.
- Secret/service keys are server-only and may only be used by narrowly scoped
  adapters. Never prefix them with `NEXT_PUBLIC_`, log them, or return them.
- Validate all untrusted input with shared schemas. Treat comments and contact
  messages as plain text. Validate uploads by size, allowlisted MIME type, magic
  bytes, and actual decode. Phase 1 accepts JPEG, PNG, and WebP images only.
- Verify same-origin requests for public writes and combine a honeypot, minimum
  form time, and rate limit. Never persist raw IP addresses or browser
  fingerprints.
- Anonymous visitor cookies are random, first-party, HttpOnly, Secure in
  production, and SameSite=Lax. Persist only domain-separated HMAC values.

## Storage responsibilities

- `private-originals`: source images and source PDFs; never direct public URLs.
- `public-media`: only processed display images, thumbnails, and published card
  PNGs.
- `private-downloads`: PDFs and future paid/restricted ZIP delivery objects.
- Library `email_gate`, `paid`, and `restricted` downloads deny by default in
  Phase 1. Signed URLs are short-lived and issued only after policy checks.

## React and Next.js conventions

- Prefer Server Components. Use the smallest practical Client Component for
  browser state and event handlers.
- Await Next.js request APIs and route `params`/`searchParams`. Use `proxy.ts`,
  not legacy middleware.
- Fetch independent data in parallel. Do not call internal Route Handlers from
  Server Components; call the application layer directly.
- Authenticate inside every Server Action. Return minimal serializable results.
- Use `next/link` for internal links and `next/image` for content images with a
  correct responsive `sizes` value.
- Admin/auth responses are dynamic and must never use shared caching or ISR.

## Required quality gates

For each milestone, run the relevant subset; before completion run all:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run db:test       # when the local Supabase stack is available
npm run test:e2e      # after a production build and Playwright install
```

Add or update tests with every behavioral change. Migrations, RLS policies,
Storage policies, backup implications, and environment variables must be
documented in the same change. Never commit `.env.local`, secrets, generated
downloads, or private user data.
