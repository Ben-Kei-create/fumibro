-- Keep the service integration role limited to ingestion. Human review and
-- conversion require an authenticated AAL2 Admin session.

revoke all on function public.admin_convert_ai_handoff(
  uuid, public.ai_handoff_destination, uuid
) from service_role;

revoke all on function public.admin_ignore_ai_handoff(uuid)
  from service_role;

revoke all on function public.admin_mark_ai_handoff_error(uuid, text)
  from service_role;
