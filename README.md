# Remind Me

A personal productivity app for staying focused on **upskilling, job hunting and daily routines**. Plan tasks, work through them on a Kanban board, run Pomodoro focus sessions, track streaks, and get help from an AI coach. It installs on a phone like a native app.

I built it as a junior developer to solve a real problem for myself, and to practice a full-stack workflow end to end: auth, a relational database with row-level security, serverless functions, charts, and PWA deployment.

## Features

- **Tasks:** add, edit, complete and delete tasks with notes, a category (upskilling, job hunt, daily) and an optional due date. Filter by category.
- **Kanban board:** drag cards between To Do, Doing and Done, or reorder within a column. Order and status persist to the database.
- **Focus timer:** 25-minute focus and 5-minute break Pomodoro, optionally linked to a task. Sessions are saved, and the countdown keeps running across pages and shows in the browser tab title.
- **Dashboard:** current streak, tasks completed this week by category, and a chart of focus hours over the last 7 days, all from real data.
- **Reminders:** browser notifications when a task is almost due or overdue, with an on/off switch. Permission is requested only after the user has a task with a due date.
- **AI coach:** break a goal into suggested tasks you can review and add in bulk, get a daily plan from your open tasks, and a short check-in message based on your real stats.
- **Auth:** email/password and Google sign-in. Every user only ever sees their own data.
- **Themes:** eight daisyUI themes, plus "follow my system".
- **Installable PWA:** works from the home screen, with the app shell cached.

## Tech stack

| Area | Choice |
| --- | --- |
| Frontend | Vue 3 (Composition API), Vite, Vue Router, Pinia |
| Styling | Tailwind CSS 4, daisyUI 5 |
| Backend | Supabase: Postgres, Auth, Row Level Security, Edge Functions (Deno) |
| AI | Groq API (`openai/gpt-oss-120b`), called only from the Edge Function so the key never reaches the browser |
| Drag and drop | vue-draggable-plus |
| Charts | Chart.js with vue-chartjs |
| PWA | vite-plugin-pwa (Workbox) |
| Tests | Vitest |
| Hosting | Vercel |

## How it is put together

- **Pinia stores** (`src/stores`) are the only code that talks to Supabase. Components call store actions and read state.
- **Pure logic** (`src/lib/stats.js`, `src/lib/reminders.js`) holds the streak, weekly-count and reminder-selection rules as plain functions with unit tests, separate from Vue and the database.
- **Row Level Security** on every table means the database itself enforces that users can only read and write their own rows, even though the browser talks to it directly.
- **The AI key stays server-side.** The browser calls the `coach` Edge Function with the user's login token. The function checks the input, calls Groq, validates the JSON that comes back, and returns only the result.

## Running it locally

You need Node 20+ and a free [Supabase](https://supabase.com) project.

```sh
git clone https://github.com/AybanFred/remind-me.git
cd remind-me
npm install
cp .env.example .env   # then fill in your own values
npm run dev
```

`.env` needs your Supabase **Project URL** and **anon public key** (Project Settings, API):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database

In the Supabase SQL Editor, run these in order:

1. `supabase/reference/tasks.sql`
2. `supabase/migrations/20261021000000_focus_sessions.sql`

### Google sign-in (optional)

Enable the Google provider in Supabase (Authentication, Providers) with a Google OAuth client. In Google Cloud, the authorized redirect URI is your Supabase callback, `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase (Authentication, URL Configuration), add your site URLs (`http://localhost:5173` for development, plus your deployed domain) to the Redirect URLs.

### AI coach (optional)

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set GROQ_API_KEY=<your-groq-key>
npx supabase functions deploy coach
```

A free Groq key is available from [console.groq.com](https://console.groq.com).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run test:unit` | Run the unit tests |
| `npm run lint` | Lint and format-check |
| `npm run generate-pwa-assets` | Rebuild the PWA icons from `public/icon.svg` |

## Known limitations

- Reminders only fire while the app is open (in a tab or the installed app). Delivering them when the app is fully closed would need web push, which is not built yet.
- The focus timer lives in memory, so refreshing the page mid-session resets it.
- The AI coach runs on a free-tier model, so it is subject to daily limits and its suggestions are good but not perfect.
