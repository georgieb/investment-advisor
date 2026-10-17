"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { signIn } from "../actions";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4">
      {linkError && (
        <p className="text-sm text-danger">That link is invalid or has expired. Please sign in or sign up again.</p>
      )}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} invalid={!!errors.email} />
      </Field>
      <Field label="Password" name="password" error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" required invalid={!!errors.password} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
