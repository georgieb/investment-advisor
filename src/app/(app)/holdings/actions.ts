"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/forms";
import { accountSchema, holdingSchema } from "@/lib/portfolio/schemas";

const idSchema = z.uuid();

function refresh() {
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    account_type: parsed.data.accountType,
    institution: parsed.data.institution ?? null,
  });
  if (error) return { ok: false, message: "We couldn't add that account.", values: echoValues(formData) };

  refresh();
  return { ok: true, message: "Account added." };
}

export async function deleteAccount(id: string) {
  const { supabase, user } = await requireUser();
  const accountId = idSchema.parse(id);
  // Holdings in the account are removed by the ON DELETE CASCADE foreign key.
  const { error } = await supabase.from("accounts").delete().eq("user_id", user.id).eq("id", accountId);
  if (error) throw new Error("We couldn't delete that account.");
  refresh();
}

function toRow(data: z.infer<typeof holdingSchema>) {
  return {
    account_id: data.accountId,
    symbol: data.symbol,
    name: data.name ?? null,
    asset_class: data.assetClass,
    quantity: data.quantity,
    current_price: data.currentPrice,
    cost_basis_per_unit: data.costBasisPerUnit,
  };
}

export async function createHolding(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = holdingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const { error } = await supabase.from("holdings").insert({ user_id: user.id, ...toRow(parsed.data) });
  if (error) return { ok: false, message: "We couldn't add that holding.", values: echoValues(formData) };

  refresh();
  return { ok: true, message: `${parsed.data.symbol} added.` };
}

export async function updateHolding(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const holdingId = idSchema.parse(id);
  const parsed = holdingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const { data, error } = await supabase
    .from("holdings")
    .update(toRow(parsed.data))
    .eq("user_id", user.id)
    .eq("id", holdingId)
    .select("id");
  if (error || data.length === 0) {
    return { ok: false, message: "We couldn't update that holding.", values: echoValues(formData) };
  }

  refresh();
  redirect("/holdings");
}

export async function deleteHolding(id: string) {
  const { supabase, user } = await requireUser();
  const holdingId = idSchema.parse(id);
  const { error } = await supabase.from("holdings").delete().eq("user_id", user.id).eq("id", holdingId);
  if (error) throw new Error("We couldn't delete that holding.");
  refresh();
}
