-- Explicitly document that only the privileged Edge Function role can access AI quota metadata.
create policy "ai_usage_service_role_all" on public.ai_usage for all to service_role using (true) with check (true);
