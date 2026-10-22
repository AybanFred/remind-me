// Supabase Edge Function: "welcome"
//
// Sends a one-time welcome email to a newly created account. The browser calls it right after the
// user signs up or signs in for the first time. The email address is read from the caller's
// verified login token, never from the request body, so nobody can use this to email other people.
//
// Setup (run in the project folder). Brevo is used because it needs no domain of your own, only
// a verified sender address (Brevo dashboard: Senders, Domains and Dedicated IPs, Senders).
//   npx supabase secrets set BREVO_API_KEY=xkeysib-...
//   npx supabase secrets set WELCOME_FROM_EMAIL=you@example.com    (must be a verified Brevo sender)
//   npx supabase secrets set WELCOME_FROM_NAME="Remind Me"          (optional)
//   npx supabase secrets set SITE_URL=https://your-site.vercel.app  (optional)
//   npx supabase functions deploy welcome
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every function automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000 // only welcome accounts created in the last day

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// The name ends up inside HTML, so make sure it can never inject markup.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function buildEmail(name: string, siteUrl: string) {
  const safeName = escapeHtml(name)
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif;color:#1e1b4b">
    <div style="max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border-radius:14px;padding:32px">
        <h1 style="margin:0 0 4px;font-size:24px;color:#4f46e5">Welcome to Remind Me! 🎉</h1>
        <p style="margin:0 0 20px;color:#64748b;font-size:14px">Your plans, focus time and progress in one place.</p>
        <p style="font-size:16px;line-height:1.5">Hey ${safeName},</p>
        <p style="font-size:16px;line-height:1.5">Thanks for joining. Remind Me helps you stay on top of your learning, your job hunt and your daily routine. Here is how to get started:</p>
        <ul style="font-size:15px;line-height:1.7;padding-left:20px">
          <li><strong>Add your first task</strong> and give it a due date.</li>
          <li><strong>Try the Pomodoro timer</strong> for a focused 25 minutes.</li>
          <li><strong>Ask the AI coach</strong> to break a big goal into small steps.</li>
          <li><strong>Install the app</strong> on your phone from your browser menu.</li>
        </ul>
        <p style="margin:28px 0">
          <a href="${siteUrl}" style="background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;display:inline-block">Open Remind Me</a>
        </p>
        <p style="font-size:15px;line-height:1.5">Happy planning,<br>The Remind Me team</p>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:16px 0 0">
        You received this email because an account was created with this address.
        If that was not you, you can ignore this message.
      </p>
    </div>
  </body>
</html>`
  const text =
    `Welcome to Remind Me!\n\nHey ${name},\n\n` +
    'Thanks for joining. Here is how to get started:\n' +
    '- Add your first task and give it a due date.\n' +
    '- Try the Pomodoro timer for a focused 25 minutes.\n' +
    '- Ask the AI coach to break a big goal into small steps.\n' +
    '- Install the app on your phone from your browser menu.\n\n' +
    `Open Remind Me: ${siteUrl}\n\nHappy planning,\nThe Remind Me team\n\n` +
    'You received this email because an account was created with this address. If that was not you, ignore it.'
  return { html, text }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY')
    const fromEmail = Deno.env.get('WELCOME_FROM_EMAIL')
    if (!apiKey || !fromEmail) {
      console.error('BREVO_API_KEY or WELCOME_FROM_EMAIL secret is missing')
      return json({ error: 'The welcome email is not configured.' }, 500)
    }
    const fromName = Deno.env.get('WELCOME_FROM_NAME') ?? 'Remind Me'
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://remind-me-ivant.vercel.app'

    // Who is calling? Ask Supabase to check the login token that came with the request.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await admin.auth.getUser(token)
    const user = data?.user
    if (error || !user?.email) return json({ error: 'Not signed in.' }, 401)

    const meta = user.user_metadata ?? {}
    const isNew = Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_WINDOW_MS
    if (meta.welcome_sent_at || !isNew) return json({ sent: false })

    // Mark the account first, so two quick calls (for example two tabs) cannot send two emails.
    const sentAt = new Date().toISOString()
    await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...meta, welcome_sent_at: sentAt } })

    const name = String(meta.full_name || meta.name || user.email.split('@')[0]).slice(0, 60)
    const { html, text } = buildEmail(name, siteUrl)
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: user.email }],
        subject: 'Welcome to Remind Me! 🎉',
        htmlContent: html,
        textContent: text,
      }),
    })

    if (!res.ok) {
      console.error('Brevo error', res.status, await res.text())
      // Clear the mark so the next login can try again.
      await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...meta, welcome_sent_at: null } })
      return json({ error: 'The email service refused the message.' }, 502)
    }
    return json({ sent: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong sending the welcome email.' }, 500)
  }
})
