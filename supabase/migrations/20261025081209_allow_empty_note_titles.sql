-- Permit an empty title while the user is editing; UI displays it as "Untitled note".
alter table public.notes drop constraint if exists notes_title_length;
alter table public.notes add constraint notes_title_length
  check (char_length(btrim(title)) <= 160);
