-- Time tracking: projects, the tasks inside them, and the time entries logged against them.
-- Run once in the Supabase SQL Editor (or with `npx supabase db push`).

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  client text check (char_length(client) <= 80),
  color text not null default '#4f46e5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  -- Archived projects disappear from the pickers but keep their hours in the reports.
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- "restrict" means a project that has hours logged cannot be deleted by accident (archive it instead).
  project_id uuid references public.projects (id) on delete restrict,
  -- If a task is deleted, the hours stay on the project.
  task_id uuid references public.project_tasks (id) on delete set null,
  description text not null default '' check (char_length(description) <= 200),
  started_at timestamptz not null,
  -- A null end means the timer is running right now.
  ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);

create index time_entries_user_started_idx on public.time_entries (user_id, started_at desc);
create index project_tasks_project_idx on public.project_tasks (project_id);

-- At most ONE running timer per user, enforced by the database itself (also across devices).
create unique index time_entries_one_running_idx on public.time_entries (user_id) where ended_at is null;

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.time_entries enable row level security;

create policy "Users manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The extra "exists" checks stop someone attaching their rows to another person's project.
create policy "Users manage their own project tasks"
  on public.project_tasks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

create policy "Users manage their own time entries"
  on public.time_entries for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
    and (task_id is null or exists (select 1 from public.project_tasks t where t.id = task_id and t.user_id = auth.uid()))
  );
