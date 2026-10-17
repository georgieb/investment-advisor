import type { z } from "zod";

/** State returned by Server Actions to forms using useActionState. */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so fields keep their input after React resets the form. */
  values?: Record<string, string>;
};

/** Collects submitted string values, leaving out secrets. */
export function echoValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) values[key] = value;
  }
  return values;
}

export function fieldErrorsFrom(error: z.ZodError, formData?: FormData): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    ok: false,
    message: "Please fix the highlighted fields.",
    fieldErrors,
    values: formData ? echoValues(formData) : undefined,
  };
}

/** Only allow same-site relative redirects, to avoid open-redirect attacks. */
export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
