-- "Very important" tag on tasks. Shown as a red tag on the list, the board and the task details.
-- Run once in the Supabase SQL Editor (or with `npx supabase db push`).

alter table public.tasks add column if not exists important boolean not null default false;
