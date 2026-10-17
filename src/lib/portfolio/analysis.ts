import type { RiskLevel } from "@/lib/risk/questionnaire";

export const ASSET_CLASSES = [
  "us_equity",
  "intl_equity",
  "bond",
  "cash",
  "real_estate",
  "commodity",
  "crypto",
  "other",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  us_equity: "US stocks",
  intl_equity: "International stocks",
  bond: "Bonds",
  cash: "Cash & equivalents",
  real_estate: "Real estate",
  commodity: "Commodities",
  crypto: "Crypto",
  other: "Other",
};

/** Allocation buckets used for targets. Real estate, commodities, crypto and other roll up into alternatives. */
export const BUCKETS = ["us_equity", "intl_equity", "bond", "cash", "alternatives"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  us_equity: "US stocks",
  intl_equity: "International stocks",
  bond: "Bonds",
  cash: "Cash",
  alternatives: "Alternatives",
};

export function bucketFor(assetClass: AssetClass): Bucket {
  switch (assetClass) {
    case "us_equity":
    case "intl_equity":
    case "bond":
    case "cash":
      return assetClass;
    default:
      return "alternatives";
  }
}

/** Target allocation (percent of portfolio) for each risk level. Each row sums to 100. */
export const TARGET_ALLOCATIONS: Record<RiskLevel, Record<Bucket, number>> = {
  conservative: { us_equity: 15, intl_equity: 5, bond: 60, cash: 20, alternatives: 0 },
  moderately_conservative: { us_equity: 25, intl_equity: 10, bond: 50, cash: 12, alternatives: 3 },
  moderate: { us_equity: 38, intl_equity: 17, bond: 35, cash: 5, alternatives: 5 },
  moderately_aggressive: { us_equity: 50, intl_equity: 22, bond: 20, cash: 3, alternatives: 5 },
  aggressive: { us_equity: 60, intl_equity: 27, bond: 5, cash: 2, alternatives: 6 },
};

/**
 * Long-run *real* (after-inflation) annual return assumptions per risk level,
 * used only for the retirement projection. Deliberately modest.
 */
export const EXPECTED_REAL_RETURN: Record<RiskLevel, number> = {
  conservative: 0.02,
  moderately_conservative: 0.03,
  moderate: 0.04,
  moderately_aggressive: 0.05,
  aggressive: 0.055,
};

/** Drift (percentage points) from target before we suggest rebalancing. */
export const REBALANCE_THRESHOLD_PP = 5;
/** A single position above this share of the portfolio is flagged as concentrated. */
export const CONCENTRATION_THRESHOLD = 0.1;

/** Asset classes that usually hold diversified funds rather than single securities. */
const DIVERSIFIED_BY_DEFAULT: ReadonlySet<AssetClass> = new Set(["bond", "cash"]);

/**
 * Common broad-market index funds, which are diversified on their own and so
 * aren't flagged as concentrated. Stage 1 has no security metadata; once a
 * market data or brokerage API is connected, use its fund/ETF flag instead.
 */
export const BROAD_INDEX_FUNDS: ReadonlySet<string> = new Set([
  // US total market / S&P 500
  "VTI", "VOO", "SPY", "IVV", "SPLG", "ITOT", "SCHB", "SCHX", "SCHK", "VV", "VTSAX", "VFIAX", "FXAIX", "FSKAX", "FZROX", "SWTSX", "SWPPX",
  // International / global
  "VXUS", "VEA", "VWO", "IXUS", "IEFA", "IEMG", "SCHF", "SCHE", "VT", "ACWI", "VTIAX", "FTIHX", "FZILX", "SWISX",
  // Target-date style balanced funds
  "VBIAX", "VSMGX", "VASGX", "AOR", "AOM", "AOA", "AOK",
]);

export type HoldingInput = {
  id: string;
  accountId: string;
  symbol: string;
  assetClass: AssetClass;
  quantity: number;
  currentPrice: number;
  costBasisPerUnit: number | null;
};

export type AllocationRow = {
  bucket: Bucket;
  value: number;
  /** Percent of total, 0-100. */
  actualPct: number;
  targetPct: number | null;
  /** actualPct - targetPct, in percentage points. */
  driftPct: number | null;
};

export type Suggestion = {
  kind: "rebalance_buy" | "rebalance_sell" | "concentration" | "emergency_fund" | "retirement_gap" | "complete_profile" | "add_holdings";
  severity: "info" | "warning";
  title: string;
  detail: string;
  /** Dollar amount, where relevant. */
  amount?: number;
};

export type RiskProfileInput = {
  riskLevel: RiskLevel;
  age: number;
  retirementAge: number;
  emergencyFundMonths: number;
  currentRetirementSavings: number;
  monthlyContribution: number;
  retirementGoal: number;
};

export type RetirementProjection = {
  years: number;
  annualRealReturn: number;
  projectedValue: number;
  goal: number;
  /** projectedValue / goal; null when there is no goal. */
  fundedRatio: number | null;
  /** Additional monthly contribution needed to reach the goal (0 if on track). */
  additionalMonthlyNeeded: number;
};

export type PortfolioAnalysis = {
  totalValue: number;
  totalCostBasis: number;
  /** Unrealized gain on holdings that have a cost basis. */
  unrealizedGain: number;
  allocation: AllocationRow[];
  byAssetClass: { assetClass: AssetClass; value: number; pct: number }[];
  byAccount: { accountId: string; value: number; pct: number }[];
  topPositions: { symbol: string; value: number; pct: number }[];
  retirement: RetirementProjection | null;
  suggestions: Suggestion[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Future value of a lump sum plus level monthly contributions. */
export function futureValue(
  present: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
): number {
  const months = Math.round(years * 12);
  const r = annualReturn / 12;
  if (r === 0) return present + monthlyContribution * months;
  const growth = (1 + r) ** months;
  return present * growth + monthlyContribution * ((growth - 1) / r);
}

export function projectRetirement(profile: RiskProfileInput): RetirementProjection {
  const years = Math.max(0, profile.retirementAge - profile.age);
  const annualRealReturn = EXPECTED_REAL_RETURN[profile.riskLevel];
  const projectedValue = futureValue(
    profile.currentRetirementSavings,
    profile.monthlyContribution,
    annualRealReturn,
    years,
  );
  const goal = profile.retirementGoal;
  const shortfall = Math.max(0, goal - projectedValue);

  let additionalMonthlyNeeded = 0;
  if (shortfall > 0) {
    const months = Math.round(years * 12);
    const r = annualRealReturn / 12;
    additionalMonthlyNeeded =
      months === 0 ? shortfall : r === 0 ? shortfall / months : (shortfall * r) / ((1 + r) ** months - 1);
  }

  return {
    years,
    annualRealReturn,
    projectedValue: round2(projectedValue),
    goal,
    fundedRatio: goal > 0 ? projectedValue / goal : null,
    additionalMonthlyNeeded: round2(additionalMonthlyNeeded),
  };
}

export function analyzePortfolio(
  holdings: HoldingInput[],
  profile: RiskProfileInput | null,
): PortfolioAnalysis {
  const valued = holdings.map((h) => ({ ...h, value: h.quantity * h.currentPrice }));
  const totalValue = valued.reduce((sum, h) => sum + h.value, 0);
  const pctOf = (v: number) => (totalValue > 0 ? (v / totalValue) * 100 : 0);

  let totalCostBasis = 0;
  let valueWithBasis = 0;
  for (const h of valued) {
    if (h.costBasisPerUnit != null) {
      totalCostBasis += h.quantity * h.costBasisPerUnit;
      valueWithBasis += h.value;
    }
  }

  const sumBy = <K extends string>(key: (h: (typeof valued)[number]) => K) => {
    const map = new Map<K, number>();
    for (const h of valued) map.set(key(h), (map.get(key(h)) ?? 0) + h.value);
    return map;
  };

  const bucketTotals = sumBy((h) => bucketFor(h.assetClass));
  const target = profile ? TARGET_ALLOCATIONS[profile.riskLevel] : null;

  const allocation: AllocationRow[] = BUCKETS.map((bucket) => {
    const value = bucketTotals.get(bucket) ?? 0;
    const actualPct = pctOf(value);
    const targetPct = target ? target[bucket] : null;
    return {
      bucket,
      value: round2(value),
      actualPct: round2(actualPct),
      targetPct,
      driftPct: targetPct == null ? null : round2(actualPct - targetPct),
    };
  });

  const byAssetClass = [...sumBy((h) => h.assetClass)]
    .map(([assetClass, value]) => ({ assetClass, value: round2(value), pct: round2(pctOf(value)) }))
    .sort((a, b) => b.value - a.value);

  const byAccount = [...sumBy((h) => h.accountId)]
    .map(([accountId, value]) => ({ accountId, value: round2(value), pct: round2(pctOf(value)) }))
    .sort((a, b) => b.value - a.value);

  // The same symbol can be held in several accounts; combine before ranking.
  const bySymbol = new Map<string, { value: number; assetClass: AssetClass }>();
  for (const h of valued) {
    const prev = bySymbol.get(h.symbol);
    bySymbol.set(h.symbol, { value: (prev?.value ?? 0) + h.value, assetClass: h.assetClass });
  }
  const positions = [...bySymbol]
    .map(([symbol, { value, assetClass }]) => ({ symbol, assetClass, value: round2(value), pct: round2(pctOf(value)) }))
    .sort((a, b) => b.value - a.value);

  const retirement = profile ? projectRetirement(profile) : null;

  // --- Suggestions ---------------------------------------------------------
  const suggestions: Suggestion[] = [];

  if (!profile) {
    suggestions.push({
      kind: "complete_profile",
      severity: "info",
      title: "Complete your risk profile",
      detail: "Answer a few questions so we can set a target allocation and suggest moves for you.",
    });
  }

  if (holdings.length === 0) {
    suggestions.push({
      kind: "add_holdings",
      severity: "info",
      title: "Add your holdings",
      detail: "Add the accounts and positions you own so we can analyze your portfolio.",
    });
  }

  if (profile && profile.emergencyFundMonths < 3) {
    suggestions.push({
      kind: "emergency_fund",
      severity: "warning",
      title: "Build your emergency fund first",
      detail: `You have about ${profile.emergencyFundMonths} months of expenses saved. Aim for 3–6 months in cash before you add market risk.`,
    });
  }

  if (target && totalValue > 0) {
    const drifted = allocation
      .filter((row) => row.driftPct != null && Math.abs(row.driftPct) >= REBALANCE_THRESHOLD_PP)
      .sort((a, b) => Math.abs(b.driftPct!) - Math.abs(a.driftPct!));
    for (const row of drifted) {
      const amount = round2(Math.abs((row.driftPct! / 100) * totalValue));
      const over = row.driftPct! > 0;
      suggestions.push({
        kind: over ? "rebalance_sell" : "rebalance_buy",
        severity: "warning",
        title: `${over ? "Reduce" : "Increase"} ${BUCKET_LABELS[row.bucket]} by about ${usd(amount)}`,
        detail: `${BUCKET_LABELS[row.bucket]} make up ${row.actualPct.toFixed(1)}% of your portfolio vs. a ${row.targetPct}% target for your risk level.${
          over
            ? " Consider directing new contributions elsewhere, or selling in tax-advantaged accounts first to avoid capital gains taxes."
            : " Consider directing new contributions here."
        }`,
        amount,
      });
    }
  }

  if (totalValue > 0 && positions.length > 1) {
    for (const p of positions) {
      if (
        p.pct / 100 > CONCENTRATION_THRESHOLD &&
        !DIVERSIFIED_BY_DEFAULT.has(p.assetClass) &&
        !BROAD_INDEX_FUNDS.has(p.symbol)
      ) {
        suggestions.push({
          kind: "concentration",
          severity: "warning",
          title: `${p.symbol} is ${p.pct.toFixed(1)}% of your portfolio`,
          detail:
            "A single company or narrow fund at this size can move your whole portfolio. Consider whether you'd be comfortable if it lost half its value. (Broad index funds are fine to hold in larger amounts.)",
          amount: p.value,
        });
      }
    }
  }

  if (retirement && retirement.goal > 0 && retirement.additionalMonthlyNeeded > 0 && retirement.years === 0) {
    suggestions.push({
      kind: "retirement_gap",
      severity: "warning",
      title: `Your retirement savings are about ${usd(retirement.additionalMonthlyNeeded)} short of your goal`,
      detail:
        "You've reached your target retirement age. Consider revisiting your goal, your retirement date, or how much you plan to withdraw each year.",
      amount: retirement.additionalMonthlyNeeded,
    });
  } else if (retirement && retirement.goal > 0 && retirement.additionalMonthlyNeeded > 0) {
    suggestions.push({
      kind: "retirement_gap",
      severity: "warning",
      title: `Save about ${usd(retirement.additionalMonthlyNeeded)} more per month for retirement`,
      detail: `At your current pace, you're projected to reach ${usd(retirement.projectedValue)} (in today's dollars) of your ${usd(retirement.goal)} goal in ${retirement.years} years, assuming a ${(retirement.annualRealReturn * 100).toFixed(1)}% annual return after inflation.`,
      amount: retirement.additionalMonthlyNeeded,
    });
  }

  return {
    totalValue: round2(totalValue),
    totalCostBasis: round2(totalCostBasis),
    unrealizedGain: round2(valueWithBasis - totalCostBasis),
    allocation,
    byAssetClass,
    byAccount,
    topPositions: positions.slice(0, 10).map(({ symbol, value, pct }) => ({ symbol, value, pct })),
    retirement,
    suggestions,
  };
}
