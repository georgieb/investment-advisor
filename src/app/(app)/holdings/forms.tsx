"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import type { FormState } from "@/lib/forms";
import { ASSET_CLASSES, ASSET_CLASS_LABELS } from "@/lib/portfolio/analysis";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/portfolio/schemas";
import { createAccount, createHolding } from "./actions";

export function AccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createAccount, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <Field label="Account name" name="name" error={errors.name}>
        <Input name="name" placeholder="e.g. Schwab brokerage" required maxLength={100} defaultValue={values.name} invalid={!!errors.name} />
      </Field>
      <Field label="Type" name="accountType" error={errors.accountType}>
        <Select name="accountType" required defaultValue={values.accountType ?? "taxable"} invalid={!!errors.accountType}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Institution (optional)" name="institution" error={errors.institution}>
        <Input name="institution" placeholder="e.g. Charles Schwab" maxLength={100} defaultValue={values.institution} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </Button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export type HoldingDefaults = Partial<Record<
  "accountId" | "symbol" | "name" | "assetClass" | "quantity" | "currentPrice" | "costBasisPerUnit",
  string
>>;

export function HoldingForm({
  accounts,
  defaults = {},
  action: submit = createHolding,
  submitLabel = "Add holding",
}: {
  accounts: { id: string; name: string }[];
  defaults?: HoldingDefaults;
  action?: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submit, {});
  const errors = state.fieldErrors ?? {};
  const values: HoldingDefaults = { ...defaults, ...state.values };

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Account" name="accountId" error={errors.accountId}>
          <Select name="accountId" required defaultValue={values.accountId} invalid={!!errors.accountId}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Symbol" name="symbol" error={errors.symbol}>
          <Input
            name="symbol"
            placeholder="VTI"
            required
            maxLength={15}
            autoCapitalize="characters"
            defaultValue={values.symbol}
            invalid={!!errors.symbol}
          />
        </Field>
        <Field label="Name (optional)" name="name" error={errors.name}>
          <Input name="name" placeholder="Vanguard Total Stock Market ETF" maxLength={200} defaultValue={values.name} />
        </Field>
        <Field label="Asset class" name="assetClass" error={errors.assetClass}>
          <Select name="assetClass" required defaultValue={values.assetClass ?? "us_equity"} invalid={!!errors.assetClass}>
            {ASSET_CLASSES.map((c) => (
              <option key={c} value={c}>
                {ASSET_CLASS_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity (shares/units)" name="quantity" error={errors.quantity}>
          <Input name="quantity" type="number" inputMode="decimal" min={0} step="any" required defaultValue={values.quantity} invalid={!!errors.quantity} />
        </Field>
        <Field label="Current price ($)" name="currentPrice" error={errors.currentPrice}>
          <Input name="currentPrice" type="number" inputMode="decimal" min={0} step="any" required defaultValue={values.currentPrice} invalid={!!errors.currentPrice} />
        </Field>
        <Field label="Cost basis per unit ($, optional)" name="costBasisPerUnit" error={errors.costBasisPerUnit}>
          <Input name="costBasisPerUnit" type="number" inputMode="decimal" min={0} step="any" defaultValue={values.costBasisPerUnit} invalid={!!errors.costBasisPerUnit} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
