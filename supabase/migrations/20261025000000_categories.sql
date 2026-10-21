-- Custom task categories. Each user gets their own list (the app adds Upskilling, Job hunt and
-- Daily the first time), and can rename, recolour, add and remove them.
-- Run once in the Supabase SQL Editor (or with `npx supabase db push`).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The short id stored on each task (e.g. "job_hunt"). It never changes, so renaming is free.
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (char_length(label) between 1 and 40),
  -- Either a theme colour name (follows the theme) or a fixed #rrggbb colour.
  color text not null default 'primary' check (
    color in ('primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error')
    or color ~ '^#[0-9a-fA-F]{6}$'
  ),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.categories enable row level security;

create policy "Users manage their own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tasks.category used to allow only the three built-in values. Remove that rule (whatever it
-- was named) so custom categories can be stored, and make sure the column is plain text.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.tasks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.tasks alter column category drop default;
alter table public.tasks alter column category type text using category::text;
alter table public.tasks alter column category set default 'daily';
alter table public.tasks add constraint tasks_category_key_check check (category ~ '^[a-z0-9_]{1,40}$');
