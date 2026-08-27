# FUMIBRO

FUMIBRO is a personal media site, portfolio, and extensible Project hub backed
by a shared, purpose-built CMS. Phase 1 favors stability, data ownership,
security, and readable code over elaborate visuals.

The architecture and immutable decisions are documented in
[`docs/architecture.md`](docs/architecture.md) and [`docs/adr`](docs/adr).

## Runtime and tools

- Node.js `24.20.0` (the application contract is `24.x`)
- npm `11.x`; use `npm ci` and commit `package-lock.json`
- Next.js `16.3.3`, TypeScript, Tailwind CSS
- Supabase Postgres, Auth, and Storage
- Vercel deployment target using Node.js 24

Do not use the machine default runtime implicitly:

```bash
nvm install
nvm use
node --version
```

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and replace every placeholder. Never
   commit `.env.local`.
3. Install and start Docker Desktop if using the local Supabase stack.
4. Run `npm run db:start`, then `npm run db:reset` to apply migrations and seed.
5. Run `npm run dev` and open `http://localhost:3000`.

The first hosted project setup also requires disabling public sign-up and
anonymous Auth, creating the single admin user, assigning
`app_metadata.role = "admin"`, and enrolling TOTP before Admin access is used.
Do not place authorization flags in editable user metadata.

After the user and trusted `app_metadata` are configured, open `/admin/login`.
The first login enrolls a TOTP authenticator; later Quick posts reuse the active
AAL2 session instead of asking for a code on every post. There is no public
signup or Admin-user creation screen in the application.

Public CMS reads use a cookie-free Supabase client so an administrator browsing
the public site cannot accidentally render draft data from their privileged
session. Public routes are rendered on demand and reflect Admin publication,
Trash, and Revision changes without a redeploy.

Phase 1 Admin now manages Blog, Works/Portfolio projection, Library metadata,
About/Privacy Pages, Projects, post categories, tags, locations, the Home
bulletin board, business cards, media, and Contact inquiries. Works, Library,
and Pages are saved through AAL2 database commands that capture Revisions; the
browser cannot update their canonical root/detail tables directly.

Comments support approval-first or immediate publication. Public writes pass
through same-origin Route Handlers with bounded JSON, a honeypot, minimum form
time, and HMAC-keyed rate limits; browsers never insert the table directly.
Likes and site/Project counters reuse one random first-party visitor cookie.
Only purpose-specific HMAC values are stored, never the raw cookie or IP. Cookie
deletion and a different browser may be counted again, so these are
best-effort unique visitors rather than identity tracking.

## Environment variables

| Name                                   | Exposure     | Purpose                            |
| -------------------------------------- | ------------ | ---------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Browser-safe | Canonical public origin            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser-safe | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | RLS-scoped public key              |
| `SUPABASE_SECRET_KEY`                  | Server only  | Narrow privileged operations       |
| `VISITOR_HMAC_SECRET`                  | Server only  | Domain-separated visitor/like HMAC |

The secret key bypasses RLS. It must only be imported from `server-only`
modules and must never be logged or exposed through a Client Component.

## Database and migrations

The canonical schema lives under `supabase/migrations`; `supabase/seed.sql`
contains deterministic bootstrap data. Never make an undocumented Dashboard-only
schema change. Create a migration with the pinned CLI:

```bash
npx supabase migration new descriptive_change
```

Useful commands:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
```

PGroonga is the required Phase 1 search engine. The migration enables it and
builds the `content_items.search_text` index so Japanese content is searchable.
If the target project cannot enable PGroonga, deployment must stop; do not
silently switch production semantics.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

CI runs the first four gates on Node 24 for every pull request and push to
`main`. Database tests require a running local Supabase stack.

## Supabase Storage

The buckets have non-overlapping duties:

- `private-originals`: source images and source PDFs
- `public-media`: processed display images, thumbnails, published card PNGs
- `private-downloads`: delivery PDFs and future paid/restricted ZIP files

Paid, restricted, and email-gated Library files never move to a public bucket.
Delivery routes issue short-lived signed URLs only after an access-policy check.
Phase 1 permits anonymous delivery only for a published `free_download` item
whose `download_enabled` flag is on. The Admin upload flow accepts PDF/ZIP up to
100 MB, checks declared size and magic bytes, stores SHA-256 metadata, and keeps
object paths out of public projections. `public`, `email_gate`, `paid`, and
`restricted` files are deny-by-default until their future grant flow exists.

Blog image uploads are limited to one JPEG, PNG, or WebP file of at most 20 MB.
The browser receives a short-lived upload token for a UUID path in
`private-originals`. A Node.js processor then checks byte length, magic bytes,
actual decode, dimensions, animation, and a 40-megapixel limit. Only stripped,
compressed WebP display and thumbnail variants are written to `public-media`.
Authenticated browsers cannot write that public bucket directly.

Published business-card images reuse the validated media asset. PNG downloads
prefer a stored `card_png` variant and otherwise convert the processed public
display image to PNG in the server-only download route; private originals are
never returned.

An interrupted upload can leave an `uploaded` or `failed` asset without public
variants. It is not public and is visible in Admin Media. Do not delete these
rows or private objects blindly: first verify age, processing state, references,
and object path. A future maintenance job may automate this same conservative
check.

## Vercel deployment

1. Create or select a Vercel project and link this repository.
2. Set the project runtime to Node.js 24; do not rely on the account default.
3. Add every key from `.env.example` separately for Development, Preview, and
   Production, using the matching Supabase project for each environment.
4. Apply and verify Supabase migrations before promoting the matching app build.
5. Run the quality gates, deploy a Preview, perform the acceptance checklist,
   then promote to Production.

Cloud project creation is intentionally not automated by this repository. See
[`docs/deployment.md`](docs/deployment.md) for the full release runbook.

## Backup and recovery

Use three independent layers:

1. Supabase database backups or `pg_dump` for Postgres.
2. A scheduled copy/export of all three Storage buckets, preserving object paths
   and checksums.
3. Admin CSV and JSON exports for portable content recovery and migration.

Test restoration into a non-production project. A backup that has never been
restored is not considered verified. Detailed commands, retention, and the
contact-data deletion procedure are in
[`docs/backup-restore.md`](docs/backup-restore.md).

Permanent deletion first creates a `purge_jobs` record, recalculates exclusive
asset references, and records the Storage manifest. Storage failure keeps a
retryable failed job; database content is removed only after every listed object
has been removed. Shared assets are excluded and must survive. Backups remain
the recovery path after a completed purge.

## Phase boundary

Phase 1 includes the CMS, public pages, Admin, Privacy, Contact storage,
revisions, media processing, interactions, PGroonga search, RSS, and portable
exports. It provides ports and idempotent source metadata for future imports.
It does not connect AI providers, Gmail/KDP, mail delivery, payments, AdSense,
Maps API, or social networks. The first planned Phase 2 feature is the
human-reviewed AI Handoff Inbox.
