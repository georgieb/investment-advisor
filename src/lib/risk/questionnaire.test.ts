import { describe, expect, it } from "vitest";
import {
  assessRisk,
  levelForScore,
  riskQuestionnaireSchema,
  type RiskQuestionnaire,
} from "./questionnaire";

const base: RiskQuestionnaire = {
  age: 30,
  retirementAge: 65,
  annualIncome: 120_000,
  emergencyFundMonths: 6,
  currentRetirementSavings: 60_000,
  monthlyContribution: 1_000,
  retirementGoal: 2_000_000,
  incomeStability: "stable",
  withdrawalNeed: "gt_20",
  primaryGoal: "growth",
  experience: "moderate",
  drawdownReaction: "hold",
  tradeoff: "d",
};

describe("assessRisk", () => {
  it("rates a young, stable, comfortable investor as aggressive or moderately aggressive", () => {
    const result = assessRisk(base);
    expect(["moderately_aggressive", "aggressive"]).toContain(result.riskLevel);
  });

  it("uses the lower of capacity and tolerance", () => {
    const result = assessRisk({ ...base, drawdownReaction: "sell_all", tradeoff: "a", primaryGoal: "preserve" });
    expect(result.riskScore).toBe(Math.min(result.capacityScore, result.toleranceScore));
    expect(result.riskScore).toBe(result.toleranceScore);
    expect(result.factors.join(" ")).toMatch(/comfort level sets it/);
  });

  it("caps capacity when money is needed soon, however bold the answers", () => {
    const result = assessRisk({
      ...base,
      withdrawalNeed: "lt_3",
      drawdownReaction: "buy_more",
      tradeoff: "e",
      primaryGoal: "max_growth",
      experience: "extensive",
    });
    expect(result.capacityScore).toBeLessThanOrEqual(25);
    expect(["conservative", "moderately_conservative"]).toContain(result.riskLevel);
  });

  it("flags a thin emergency fund", () => {
    const result = assessRisk({ ...base, emergencyFundMonths: 1 });
    expect(result.factors.join(" ")).toMatch(/emergency fund/);
  });

  it("produces scores between 0 and 100", () => {
    const lowest = assessRisk({
      ...base,
      age: 70,
      retirementAge: 70,
      emergencyFundMonths: 0,
      incomeStability: "none",
      withdrawalNeed: "lt_3",
      primaryGoal: "preserve",
      experience: "none",
      drawdownReaction: "sell_all",
      tradeoff: "a",
    });
    expect(lowest.riskScore).toBe(0);
    expect(lowest.riskLevel).toBe("conservative");
  });
});

describe("levelForScore", () => {
  it.each([
    [0, "conservative"],
    [19, "conservative"],
    [20, "moderately_conservative"],
    [59, "moderate"],
    [79, "moderately_aggressive"],
    [100, "aggressive"],
  ] as const)("%d -> %s", (score, level) => {
    expect(levelForScore(score)).toBe(level);
  });
});

describe("riskQuestionnaireSchema", () => {
  it("coerces form strings", () => {
    const parsed = riskQuestionnaireSchema.parse({
      ...base,
      age: "30",
      retirementAge: "65",
      annualIncome: "120000",
    });
    expect(parsed.age).toBe(30);
  });

  it("rejects a retirement age before the current age", () => {
    const result = riskQuestionnaireSchema.safeParse({ ...base, age: 50, retirementAge: 40 });
    expect(result.success).toBe(false);
  });

  it("rejects unknown answers", () => {
    const result = riskQuestionnaireSchema.safeParse({ ...base, drawdownReaction: "panic" });
    expect(result.success).toBe(false);
  });
});
