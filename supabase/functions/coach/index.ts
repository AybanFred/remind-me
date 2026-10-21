// Supabase Edge Function: "coach"
//
// The browser never sees the AI provider's API key. The frontend calls this function,
// the function calls the AI (Groq), and only the answer goes back.
//
// Setup (run in the project folder):
//   npx supabase secrets set GROQ_API_KEY=gsk_...
//   npx supabase functions deploy coach
//
// The Supabase gateway already rejects callers who aren't logged in (verify_jwt is on by
// default), so only signed-in users of this app can use your API quota.

// Groq's API follows the same format as OpenAI's, so a plain fetch() is all we need.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// This model supports "strict" JSON schemas. If Groq retires it, pick another model
// from console.groq.com/docs/structured-outputs that supports them.
const MODEL = 'openai/gpt-oss-120b'
const CATEGORIES = ['upskilling', 'job_hunt', 'daily']

// The browser calls us from another origin, so we must answer CORS requests.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Anything that came from the browser is untrusted: cap its size before it reaches the prompt.
function clip(value: unknown, max: number): string {
  return String(value ?? '').slice(0, max)
}

// One place that talks to the AI. `schema` forces the answer to be valid JSON of that shape.
async function ask(opts: {
  system: string
  user: string
  effort: 'low' | 'medium'
  schema?: Record<string, unknown>
}): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    console.error('GROQ_API_KEY secret is missing')
    throw new HttpError(500, 'The AI service is not configured correctly.')
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      reasoning_effort: opts.effort,
      max_completion_tokens: 4000, // the model's thinking tokens count toward this, so leave room
      ...(opts.schema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'answer', strict: true, schema: opts.schema },
            },
          }
        : {}),
    }),
  })

  if (res.status === 429) throw new HttpError(429, 'The AI is busy or the daily limit was reached. Try again later.')
  if (res.status === 401) {
    console.error('Groq rejected the API key - check the GROQ_API_KEY secret')
    throw new HttpError(500, 'The AI service is not configured correctly.')
  }
  if (!res.ok) {
    console.error('Groq error', res.status, await res.text())
    throw new HttpError(502, 'The AI service returned an error.')
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'length') {
    throw new HttpError(502, 'The AI ran out of space before finishing. Please try again.')
  }
  const text = choice?.message?.content
  if (!text) throw new HttpError(502, 'The AI sent back an empty answer.')
  return text
}

const ABOUT_USER =
  'The user is a junior web/app developer who is unemployed, working on upskilling, ' +
  'job hunting and daily routines. They use a personal task app called Remind Me. ' +
  'Be practical, specific and kind. No emojis, no hype.'

// ---------- 1. Break a goal into tasks ----------

// What the three built-in categories mean, so the AI sorts tasks sensibly.
const BUILT_IN_MEANINGS: Record<string, string> = {
  upskilling: 'learning skills or building projects',
  job_hunt: 'applications, CV/portfolio, networking, interview prep',
  daily: 'routines and everyday admin',
}

// The user's own categories arrive from the browser. Accept at most 20 well-formed ones;
// anything odd falls back to the built-in three.
function readCategories(raw: unknown): { key: string; label: string }[] {
  const list = Array.isArray(raw)
    ? raw
        .filter((c) => c && /^[a-z0-9_]{1,40}$/.test(String(c.key)))
        .slice(0, 20)
        .map((c) => ({ key: String(c.key), label: clip(c.label, 40) || String(c.key) }))
    : []
  return list.length ? list : CATEGORIES.map((key) => ({ key, label: key }))
}

function breakdownSchema(keys: string[]) {
  return {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            notes: { type: 'string' },
            category: { type: 'string', enum: keys },
          },
          required: ['title', 'notes', 'category'],
          additionalProperties: false,
        },
      },
    },
    required: ['tasks'],
    additionalProperties: false,
  }
}

async function breakdown(body: { goal?: string; categories?: unknown }) {
  const goal = clip(body.goal, 500).trim()
  if (!goal) throw new HttpError(400, 'Type a goal first.')

  const categories = readCategories(body.categories)
  const keys = categories.map((c) => c.key)
  const categoryGuide = categories
    .map((c) => `${c.key} = "${c.label}"${BUILT_IN_MEANINGS[c.key] ? ` (${BUILT_IN_MEANINGS[c.key]})` : ''}`)
    .join('; ')

  const answer = await ask({
    effort: 'low',
    schema: breakdownSchema(keys),
    system:
      `${ABOUT_USER}\n\n` +
      'Turn the goal into 3 to 8 small, concrete tasks, in the order they should be done. ' +
      'Each title starts with a verb, is under 80 characters, and can be finished in one sitting ' +
      '(about two hours at most). "notes" is one short sentence saying how to do it or what "done" looks like. ' +
      `Put each task in the best-fitting category, using its key. Categories: ${categoryGuide}.`,
    user: `<goal>\n${goal}\n</goal>`,
  })

  const parsed = JSON.parse(answer)
  return {
    tasks: parsed.tasks.slice(0, 8).map((t: Record<string, string>) => ({
      title: clip(t.title, 120),
      notes: clip(t.notes, 300),
      category: keys.includes(t.category) ? t.category : keys[0],
    })),
  }
}

// ---------- 2. Daily plan ----------

const planSchema = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['task_id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['intro', 'steps'],
  additionalProperties: false,
}

async function plan(body: { now?: string; tasks?: Array<Record<string, unknown>> }) {
  const tasks = (body.tasks ?? []).slice(0, 40).map((t) => ({
    id: clip(t.id, 64),
    title: clip(t.title, 120),
    category: clip(t.category, 20),
    status: clip(t.status, 10),
    due_at: t.due_at ? clip(t.due_at, 40) : null,
    overdue: Boolean(t.overdue),
  }))

  const answer = await ask({
    effort: 'medium',
    schema: planSchema,
    system:
      `${ABOUT_USER}\n\n` +
      'Pick the tasks to work on today, at most 5, in the order to do them. ' +
      'Overdue tasks and tasks due today come first. Tasks with status "doing" are already in progress, ' +
      'so favor finishing them. Mix categories when nothing is urgent, and do not overload the day. ' +
      '"reason" is one short sentence. Use only task ids that appear in the list. ' +
      '"intro" is one or two sentences framing the day. If there are no open tasks, return no steps ' +
      'and use the intro to suggest adding a goal.',
    user:
      `Current local time: ${clip(body.now, 60)}\n\n` +
      `<open_tasks>\n${JSON.stringify(tasks)}\n</open_tasks>`,
  })

  const parsed = JSON.parse(answer)
  const knownIds = new Set(tasks.map((t) => t.id))
  return {
    intro: clip(parsed.intro, 500),
    // Drop any id the model invented.
    steps: parsed.steps
      .filter((s: { task_id: string }) => knownIds.has(s.task_id))
      .slice(0, 5)
      .map((s: { task_id: string; reason: string }) => ({
        task_id: s.task_id,
        reason: clip(s.reason, 300),
      })),
  }
}

// ---------- 3. Check-in ----------

async function checkin(body: { stats?: Record<string, unknown> }) {
  const s = body.stats ?? {}
  const week = (s.completedThisWeek ?? {}) as Record<string, unknown>
  // Category names are the user's own, so cap how many and how long they can be.
  const completedThisWeek = Object.fromEntries(
    Object.entries(week)
      .slice(0, 20)
      .map(([name, count]) => [clip(name, 40), Number(count) || 0]),
  )
  const stats = {
    streak_days: Number(s.streak) || 0,
    completed_this_week_by_category: completedThisWeek,
    open_tasks: Number(s.openTasks) || 0,
    overdue_tasks: Number(s.overdueTasks) || 0,
    focus_minutes_today: Number(s.focusMinutesToday) || 0,
    focus_minutes_last_7_days: Number(s.focusMinutesWeek) || 0,
  }

  const message = await ask({
    effort: 'low',
    system:
      `${ABOUT_USER}\n\n` +
      'Write a short check-in message of two or three sentences based ONLY on the stats given. ' +
      'Mention at least one real number. Name one thing going well, and one concrete next step ' +
      '(for example an overdue task or a neglected category). Be honest: if the numbers are low, ' +
      'say so gently instead of cheering. Never invent numbers or facts that are not in the stats.',
    user: `<stats>\n${JSON.stringify(stats)}\n</stats>`,
  })
  return { message: clip(message, 800).trim() }
}

// ---------- Entry point ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    switch (body.action) {
      case 'breakdown':
        return json(await breakdown(body))
      case 'plan':
        return json(await plan(body))
      case 'checkin':
        return json(await checkin(body))
      default:
        throw new HttpError(400, 'Unknown action.')
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong talking to the AI.' }, 500)
  }
})
