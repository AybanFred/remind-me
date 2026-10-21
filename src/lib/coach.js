import { supabase } from '@/lib/supabase'

// Calls the "coach" Edge Function. supabase-js automatically sends the logged-in
// user's token, which is how the function knows the caller is allowed in.
export async function callCoach(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('coach', {
    body: { action, ...payload }
  })

  if (error) {
    // When the function itself replies with an error status, the readable message is in the response body.
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  return data
}
