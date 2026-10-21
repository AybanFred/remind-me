-- Subtasks: an optional checklist inside a to-do task.
-- Run once in the Supabase SQL Editor (or with `npx supabase db push`).

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Deleting a task deletes its subtasks with it.
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index subtasks_task_idx on public.subtasks (task_id);

alter table public.subtasks enable row level security;

-- The "exists" check stops someone attaching a subtask to another person's task.
create policy "Users manage their own subtasks"
  on public.subtasks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid())
  );
