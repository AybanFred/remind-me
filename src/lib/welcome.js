// Decides whether to ask the server to send the welcome email. The server checks the same rules
// again (it never trusts the browser); this only avoids a pointless request on every login.

export const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000 // only accounts created in the last day

export function shouldSendWelcome(user, now = Date.now()) {
  if (!user?.email || !user.created_at) return false
  if (user.user_metadata?.welcome_sent_at) return false
  return now - new Date(user.created_at).getTime() < NEW_ACCOUNT_MS
}
