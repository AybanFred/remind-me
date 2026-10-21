-- Reference: the `tasks` table the app expects. This is NOT a migration (it lives outside
-- supabase/migrations on purpose). Use it to set up a fresh Supabase project:
-- SQL Editor -> New query -> paste -> Run. Run it BEFORE the focus_sessions migration.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  category text not null default 'daily' check (category in ('upskilling', 'job_hunt', 'daily')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  due_at timestamptz,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users manage their own tasks"
  on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
