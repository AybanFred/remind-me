-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- One row = one focus session (a completed pomodoro, or one stopped early).

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Optional link to a task. If the task is deleted later, we keep the session and just clear the link.
  -- NOTE: if your tasks.id column is NOT a uuid (e.g. bigint), change "uuid" to match on the next line.
  task_id uuid references public.tasks (id) on delete set null,
  started_at timestamptz not null default now(),
  minutes_focused integer not null check (minutes_focused >= 0)
);

-- Makes "my sessions from the last 7 days" queries (dashboard, Phase 5) fast.
create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);

-- Row-level security: every query is automatically limited to the logged-in user's rows.
alter table public.focus_sessions enable row level security;

create policy "Users manage their own focus sessions"
  on public.focus_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
