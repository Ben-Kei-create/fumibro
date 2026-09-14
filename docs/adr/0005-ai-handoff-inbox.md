# ADR-0005: Human-reviewed AI Handoff Inbox

- Status: Accepted
- Date: 2026-08-30

## Context

ChatGPT, Gemini, Claude, Gmail, and KDP may later suggest content for FUMIBRO.
Those systems must not write public CMS tables or publish without an Admin
decision. Re-delivery is normal, so ingestion must also be idempotent.

## Decision

`public.ai_handoff_inbox` is an RLS-protected staging table. Its source identity
is unique on `(source_system, source_external_id)`. Candidates always begin as
`pending` and retain their bounded JSON payload and normalized suggestions.

External adapters receive only EXECUTE on
`public.service_enqueue_ai_handoff(...)`. The `service_role` has no direct table
privileges on the Inbox. The SECURITY DEFINER command fixes `search_path`,
validates source, URLs, project, JSON shape and size, and records an audit event.
PUBLIC, `anon`, and `authenticated` EXECUTE are revoked.

Only an AAL2 Admin can read or review candidates. Conversion is performed by
`public.admin_convert_ai_handoff(...)`, which reuses the canonical Blog, Works,
and Library commands. Portfolio is a Works projection. Notices are inserted by
the same guarded transaction because they are not `content_items`. Every
conversion creates a draft; publishing remains a separate normal CMS action.
Ignored and failed reviews are audited.

Provider fetching and Google Drive/Gmail connectivity are separate adapters
behind `src/integrations/ports` and are not part of this milestone.

## Consequences

- A leaked browser session cannot enqueue or mutate Inbox rows directly.
- Possession of the server secret permits only the bounded enqueue RPC for this
  workflow, not direct Inbox table writes.
- Duplicate provider deliveries return the existing Inbox identity without
  overwriting the first candidate.
- Real content remains canonical in `content_items`; the Inbox holds workflow
  and provenance, not a second published copy.
- The Inbox may be backed up with the database. Its payload can contain source
  text, so exports and logs must not expose it.
