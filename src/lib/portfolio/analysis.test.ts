import { describe, expect, it } from "vitest";
import {
  TARGET_ALLOCATIONS,
  analyzePortfolio,
  futureValue,
  projectRetirement,
  type HoldingInput,
  type RiskProfileInput,
} from "./analysis";

const holding = (overrides: Partial<HoldingInput>): HoldingInput => ({
  id: crypto.randomUUID(),
  accountId: "acct-1",
  symbol: "VTI",
  assetClass: "us_equity",
  quantity: 1,
  currentPrice: 100,
  costBasisPerUnit: null,
  ...overrides,
});

const profile: RiskProfileInput = {
  riskLevel: "moderate",
  age: 40,
  retirementAge: 65,
  emergencyFundMonths: 6,
  currentRetirementSavings: 200_000,
  monthlyContribution: 1_500,
  retirementGoal: 1_000_000,
};

describe("TARGET_ALLOCATIONS", () => {
  it("sums to 100% for every risk level", () => {
    for (const [level, target] of Object.entries(TARGET_ALLOCATIONS)) {
      const total = Object.values(target).reduce((a, b) => a + b, 0);
      expect(total, level).toBe(100);
    }
  });
});

describe("analyzePortfolio", () => {
  it("computes totals, gains and allocation", () => {
    const result = analyzePortfolio(
      [
        holding({ symbol: "VTI", quantity: 10, currentPrice: 200, costBasisPerUnit: 150 }),
        holding({ symbol: "BND", assetClass: "bond", quantity: 20, currentPrice: 50 }),
        holding({ symbol: "GLD", assetClass: "commodity", quantity: 5, currentPrice: 200, accountId: "acct-2" }),
      ],
      null,
    );
    expect(result.totalValue).toBe(4000);
    expect(result.totalCostBasis).toBe(1500);
    expect(result.unrealizedGain).toBe(500);
    const byBucket = Object.fromEntries(result.allocation.map((r) => [r.bucket, r.actualPct]));
    expect(byBucket).toMatchObject({ us_equity: 50, bond: 25, alternatives: 25, cash: 0 });
    expect(result.byAccount).toEqual([
      { accountId: "acct-1", value: 3000, pct: 75 },
      { accountId: "acct-2", value: 1000, pct: 25 },
    ]);
    expect(result.allocation.every((r) => r.targetPct === null)).toBe(true);
    expect(result.suggestions.map((s) => s.kind)).toContain("complete_profile");
  });

  it("suggests rebalancing when drift exceeds the threshold", () => {
    // 100% US stocks vs. a moderate target of 38% US / 35% bonds.
    const result = analyzePortfolio([holding({ quantity: 100, currentPrice: 100 })], profile);
    const sell = result.suggestions.find((s) => s.kind === "rebalance_sell");
    const buyBonds = result.suggestions.find((s) => s.kind === "rebalance_buy" && s.title.includes("Bonds"));
    expect(sell?.amount).toBe(6200);
    expect(buyBonds?.amount).toBe(3500);
  });

  it("does not suggest rebalancing a portfolio on target", () => {
    const target = TARGET_ALLOCATIONS.moderate;
    const result = analyzePortfolio(
      [
        holding({ symbol: "VTI", currentPrice: target.us_equity }),
        holding({ symbol: "VXUS", assetClass: "intl_equity", currentPrice: target.intl_equity }),
        holding({ symbol: "BND", assetClass: "bond", currentPrice: target.bond }),
        holding({ symbol: "CASH", assetClass: "cash", currentPrice: target.cash }),
        holding({ symbol: "VNQ", assetClass: "real_estate", currentPrice: target.alternatives }),
      ],
      profile,
    );
    expect(result.suggestions.filter((s) => s.kind.startsWith("rebalance"))).toEqual([]);
  });

  it("combines the same symbol across accounts when checking concentration", () => {
    const result = analyzePortfolio(
      [
        holding({ symbol: "AAPL", accountId: "a", currentPrice: 80 }),
        holding({ symbol: "AAPL", accountId: "b", currentPrice: 80 }),
        ...Array.from({ length: 10 }, (_, i) => holding({ symbol: `F${i}`, currentPrice: 84 })),
      ],
      null,
    );
    const concentrated = result.suggestions.filter((s) => s.kind === "concentration");
    expect(concentrated.map((s) => s.title)).toEqual([expect.stringContaining("AAPL")]);
    expect(result.topPositions[0]).toMatchObject({ symbol: "AAPL", value: 160 });
  });

  it("doesn't flag broad index funds as concentrated", () => {
    const result = analyzePortfolio(
      [
        holding({ symbol: "VTI", currentPrice: 600 }),
        holding({ symbol: "VXUS", assetClass: "intl_equity", currentPrice: 250 }),
        holding({ symbol: "NVDA", currentPrice: 150 }),
      ],
      null,
    );
    expect(result.suggestions.filter((s) => s.kind === "concentration").map((s) => s.title)).toEqual([
      expect.stringContaining("NVDA"),
    ]);
  });

  it("doesn't flag bond or cash funds as concentrated", () => {
    const result = analyzePortfolio(
      [
        holding({ symbol: "BND", assetClass: "bond", currentPrice: 900 }),
        holding({ symbol: "SCHD", currentPrice: 100 }),
      ],
      null,
    );
    expect(result.suggestions.filter((s) => s.kind === "concentration").map((s) => s.title)).toEqual([]);
  });

  it("warns about a thin emergency fund", () => {
    const result = analyzePortfolio([], { ...profile, emergencyFundMonths: 1 });
    expect(result.suggestions.map((s) => s.kind)).toEqual(["add_holdings", "emergency_fund"]);
  });

  it("handles an empty portfolio", () => {
    const result = analyzePortfolio([], null);
    expect(result.totalValue).toBe(0);
    expect(result.allocation.every((r) => r.actualPct === 0)).toBe(true);
  });
});

describe("retirement projection", () => {
  it("matches the closed-form future value", () => {
    expect(futureValue(1000, 0, 0.12, 1)).toBeCloseTo(1000 * 1.01 ** 12, 6);
    expect(futureValue(0, 100, 0, 2)).toBe(2400);
  });

  it("computes the extra monthly saving that closes the gap", () => {
    const short = { ...profile, retirementGoal: 5_000_000 };
    const projection = projectRetirement(short);
    expect(projection.additionalMonthlyNeeded).toBeGreaterThan(0);
    const closed = projectRetirement({
      ...short,
      monthlyContribution: short.monthlyContribution + projection.additionalMonthlyNeeded,
    });
    expect(closed.projectedValue).toBeCloseTo(short.retirementGoal, -1);
  });

  it("needs nothing extra when on track", () => {
    expect(projectRetirement({ ...profile, retirementGoal: 100 }).additionalMonthlyNeeded).toBe(0);
  });

  it("asks for the full shortfall at retirement age", () => {
    const projection = projectRetirement({ ...profile, age: 65, currentRetirementSavings: 400_000 });
    expect(projection.years).toBe(0);
    expect(projection.additionalMonthlyNeeded).toBe(600_000);
  });
});
