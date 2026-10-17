/**
 * Public Supabase settings. These are safe to expose to the browser: the
 * publishable (anon) key only grants what Row Level Security policies allow.
 *
 * Never put the service role / secret key in a NEXT_PUBLIC_ variable. This app
 * does not use it at all.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase settings. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}
