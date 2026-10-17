import "server-only";
import { requireUser } from "@/lib/dal";
import type { HoldingInput, RiskProfileInput } from "@/lib/portfolio/analysis";

/*
 * Reads for the signed-in user. Each function resolves the user itself, and the
 * database's RLS policies limit every query to that user's rows.
 *
 * Results are intentionally NOT cached with "use cache": portfolio data is
 * private and must never be stored in a shared server cache.
 */

export async function getRiskProfile() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("risk_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Could not load your risk profile.");
  return data;
}

export async function getAccountsWithHoldings() {
  const { supabase, user } = await requireUser();
  const [accounts, holdings] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("holdings").select("*").eq("user_id", user.id).order("symbol"),
  ]);
  if (accounts.error || holdings.error) throw new Error("Could not load your holdings.");

  return accounts.data.map((account) => ({
    ...account,
    holdings: holdings.data.filter((h) => h.account_id === account.id),
  }));
}

export async function getHolding(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load this holding.");
  return data;
}

type HoldingRow = Awaited<ReturnType<typeof getAccountsWithHoldings>>[number]["holdings"][number];
type RiskProfileRow = NonNullable<Awaited<ReturnType<typeof getRiskProfile>>>;

export function toHoldingInput(h: HoldingRow): HoldingInput {
  return {
    id: h.id,
    accountId: h.account_id,
    symbol: h.symbol,
    assetClass: h.asset_class,
    quantity: Number(h.quantity),
    currentPrice: Number(h.current_price),
    costBasisPerUnit: h.cost_basis_per_unit == null ? null : Number(h.cost_basis_per_unit),
  };
}

export function toRiskProfileInput(p: RiskProfileRow): RiskProfileInput {
  return {
    riskLevel: p.risk_level,
    age: p.age,
    retirementAge: p.retirement_age,
    emergencyFundMonths: Number(p.emergency_fund_months),
    currentRetirementSavings: Number(p.current_retirement_savings),
    monthlyContribution: Number(p.monthly_contribution),
    retirementGoal: Number(p.retirement_goal),
  };
}
