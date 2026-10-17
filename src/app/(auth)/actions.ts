"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { echoValues, fieldErrorsFrom, safeRedirectPath, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password").max(72),
});

const signupSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(72, "Use at most 72 characters")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for every failure so we don't reveal which emails have accounts.
    return {
      ok: false,
      message: "Incorrect email or password, or your email isn't confirmed yet.",
      values: echoValues(formData),
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName || null },
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=/profile` : undefined,
    },
  });

  if (error && error.code === "weak_password") {
    return { ok: false, fieldErrors: { password: [error.message] }, values: echoValues(formData) };
  }
  if (error && error.status !== 422) {
    return { ok: false, message: "We couldn't create your account. Please try again.", values: echoValues(formData) };
  }

  // Same response whether or not the email was already registered.
  return {
    ok: true,
    message: "Check your email for a confirmation link to finish creating your account.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
