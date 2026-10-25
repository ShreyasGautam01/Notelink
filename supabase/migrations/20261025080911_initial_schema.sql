-- NoteLink initial schema: private notes, directional links, and server-only AI quota records.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled note',
  content text not null default '',
  category text,
  color text not null default '#D9E8E4',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_title_length check (char_length(btrim(title)) <= 160),
  constraint notes_content_length check (char_length(content) <= 50000),
  constraint notes_category_length check (category is null or char_length(category) <= 80),
  constraint notes_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint notes_user_id_id_unique unique (user_id, id)
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_user_category_idx on public.notes (user_id, category) where category is not null;

create table if not exists public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_note_id uuid not null,
  target_note_id uuid not null,
  label text not null default 'RELATED_TO',
  created_at timestamptz not null default now(),
  constraint note_links_not_self check (source_note_id <> target_note_id),
  constraint note_links_label_check check (label in ('RELATED_TO', 'DEPENDS_ON', 'CONTRADICTS', 'IS_EXAMPLE_OF', 'EXTENDS', 'REFERENCES')),
  constraint note_links_unique_relation unique (user_id, source_note_id, target_note_id, label),
  constraint note_links_source_owner_fk foreign key (user_id, source_note_id) references public.notes (user_id, id) on delete cascade,
  constraint note_links_target_owner_fk foreign key (user_id, target_note_id) references public.notes (user_id, id) on delete cascade
);

create index if not exists note_links_source_idx on public.note_links (user_id, source_note_id);
create index if not exists note_links_target_idx on public.note_links (user_id, target_note_id);

-- Stores usage metadata only; browser roles have no access to this table.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('explain', 'improve', 'summarize', 'generate')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at before update on public.notes for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.note_links enable row level security;
alter table public.ai_usage enable row level security;

revoke all on public.notes from anon;
revoke all on public.note_links from anon;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.note_links to authenticated;
grant all on public.ai_usage to service_role;

create policy "notes_select_own" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "note_links_select_own" on public.note_links for select to authenticated using ((select auth.uid()) = user_id);
create policy "note_links_insert_own" on public.note_links for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "note_links_update_own" on public.note_links for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "note_links_delete_own" on public.note_links for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.ai_usage is 'Server-only AI action usage metadata. Never store note text or generated output here.';
