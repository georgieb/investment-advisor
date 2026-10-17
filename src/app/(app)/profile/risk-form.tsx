"use client";

import { useActionState } from "react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { CHOICE_QUESTIONS } from "@/lib/risk/questionnaire";
import { saveRiskProfile } from "./actions";

export type RiskFormDefaults = Partial<Record<string, string>>;

const NUMBER_FIELDS = [
  { name: "age", label: "Your age", step: "1", hint: undefined },
  { name: "retirementAge", label: "Age you plan to retire", step: "1", hint: "If you're already retired, enter your current age." },
  { name: "annualIncome", label: "Annual household income ($)", step: "any", hint: undefined },
  { name: "emergencyFundMonths", label: "Emergency savings (months of expenses)", step: "0.5", hint: "Cash you could access right away, not counting investments." },
  { name: "currentRetirementSavings", label: "Current retirement savings ($)", step: "any", hint: "401(k), IRA and similar accounts." },
  { name: "monthlyContribution", label: "Monthly retirement contribution ($)", step: "any", hint: "Include any employer match." },
  { name: "retirementGoal", label: "Retirement savings goal ($, in today's dollars)", step: "any", hint: "A common rule of thumb is 25× the yearly spending you'll need from savings." },
] as const;

export function RiskForm({ defaults }: { defaults: RiskFormDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRiskProfile, {});
  const errors = state.fieldErrors ?? {};
  const values = { ...defaults, ...state.values };

  return (
    <form action={action} className="flex flex-col gap-6">
      <Card title="Your situation and retirement plans">
        <div className="grid gap-4 sm:grid-cols-2">
          {NUMBER_FIELDS.map((f) => (
            <Field key={f.name} label={f.label} name={f.name} error={errors[f.name]} hint={f.hint}>
              <Input
                name={f.name}
                type="number"
                inputMode="decimal"
                min={0}
                step={f.step}
                required
                defaultValue={values[f.name]}
                invalid={!!errors[f.name]}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Your goals and comfort with risk">
        <div className="flex flex-col gap-6">
          {Object.values(CHOICE_QUESTIONS).map((q) => (
            <fieldset key={q.id} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{q.prompt}</legend>
              {q.options.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    value={o.value}
                    required
                    defaultChecked={values[q.id] === o.value}
                    className="accent-accent"
                  />
                  {o.label}
                </label>
              ))}
              {errors[q.id]?.map((e) => (
                <p key={e} className="text-xs text-danger">
                  {e}
                </p>
              ))}
            </fieldset>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save and calculate my risk level"}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
