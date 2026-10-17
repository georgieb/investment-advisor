import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer: the single place that decides who the current user is.
 *
 * getClaims() verifies the session JWT (signature and expiry) rather than
 * trusting the cookie contents, so a forged cookie cannot impersonate a user.
 * Call this at the top of every page and Server Action that touches user data.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    redirect("/login");
  }
  return {
    supabase,
    user: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
  };
}

/** Like requireUser, but returns null instead of redirecting. */
export async function getOptionalUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
