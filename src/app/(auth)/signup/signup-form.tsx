"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { signUp } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const errors = state.fieldErrors ?? {};

  if (state.ok) {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name (optional)" name="displayName" error={errors.displayName}>
        <Input name="displayName" autoComplete="name" maxLength={100} defaultValue={state.values?.displayName} />
      </Field>
      <Field label="Email" name="email" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} invalid={!!errors.email} />
      </Field>
      <Field
        label="Password"
        name="password"
        error={errors.password}
        hint="At least 12 characters, with upper and lowercase letters and a number."
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          required
          invalid={!!errors.password}
        />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
