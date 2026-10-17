import { z } from "zod";

/**
 * Risk profile questionnaire.
 *
 * The assessment combines two independent dimensions:
 *   - Risk capacity: how much risk the user can afford to take, from objective
 *     facts (time horizon, emergency savings, income stability, retirement progress).
 *   - Risk tolerance: how much risk the user is willing to take, from their
 *     answers about goals, experience, and how they react to losses.
 *
 * When the two disagree, the lower one wins. Someone who loves risk but cannot
 * afford a drawdown should not be told to take one, and someone who can afford
 * risk but would panic-sell in a crash will do worse than the plan assumes.
 */

export const QUESTIONNAIRE_VERSION = 1;

export const RISK_LEVELS = [
  "conservative",
  "moderately_conservative",
  "moderate",
  "moderately_aggressive",
  "aggressive",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  conservative: "Conservative",
  moderately_conservative: "Moderately conservative",
  moderate: "Moderate",
  moderately_aggressive: "Moderately aggressive",
  aggressive: "Aggressive",
};

type Option = { value: string; label: string; points: number };
type ChoiceQuestion = { id: string; prompt: string; options: readonly Option[] };

/** Multiple-choice questions. `points` run from 0 (least risk) to 4 (most risk). */
export const CHOICE_QUESTIONS = {
  incomeStability: {
    id: "incomeStability",
    prompt: "How stable is your income over the next few years?",
    options: [
      { value: "none", label: "I have no regular income / I'm retired", points: 0 },
      { value: "unstable", label: "Unpredictable (commission, freelance, seasonal)", points: 1 },
      { value: "somewhat", label: "Somewhat stable", points: 2 },
      { value: "stable", label: "Stable (salaried, secure job)", points: 3 },
      { value: "very_stable", label: "Very stable, with multiple income sources", points: 4 },
    ],
  },
  withdrawalNeed: {
    id: "withdrawalNeed",
    prompt: "When do you expect to need a significant part of this money?",
    options: [
      { value: "lt_3", label: "Within 3 years", points: 0 },
      { value: "3_5", label: "In 3–5 years", points: 1 },
      { value: "6_10", label: "In 6–10 years", points: 2 },
      { value: "11_20", label: "In 11–20 years", points: 3 },
      { value: "gt_20", label: "More than 20 years from now", points: 4 },
    ],
  },
  primaryGoal: {
    id: "primaryGoal",
    prompt: "What is your primary investment goal?",
    options: [
      { value: "preserve", label: "Protect what I have", points: 0 },
      { value: "income", label: "Generate steady income", points: 1 },
      { value: "balanced", label: "Balance growth and stability", points: 2 },
      { value: "growth", label: "Grow my wealth over time", points: 3 },
      { value: "max_growth", label: "Maximize long-term growth", points: 4 },
    ],
  },
  experience: {
    id: "experience",
    prompt: "How would you describe your investing experience?",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "limited", label: "Limited (savings accounts, CDs, a 401(k) on autopilot)", points: 1 },
      { value: "moderate", label: "Moderate (I pick funds or stocks myself)", points: 2 },
      { value: "extensive", label: "Extensive (I've invested through several market cycles)", points: 4 },
    ],
  },
  drawdownReaction: {
    id: "drawdownReaction",
    prompt: "Your portfolio drops 25% in a few months. What do you do?",
    options: [
      { value: "sell_all", label: "Sell everything to avoid further losses", points: 0 },
      { value: "sell_some", label: "Sell some to reduce risk", points: 1 },
      { value: "hold", label: "Hold and wait for a recovery", points: 3 },
      { value: "buy_more", label: "Buy more while prices are low", points: 4 },
    ],
  },
  tradeoff: {
    id: "tradeoff",
    prompt: "Which one-year range of outcomes would you choose for a $10,000 investment?",
    options: [
      { value: "a", label: "Between $9,800 and $10,400", points: 0 },
      { value: "b", label: "Between $9,200 and $11,000", points: 1 },
      { value: "c", label: "Between $8,500 and $12,000", points: 2 },
      { value: "d", label: "Between $7,500 and $13,500", points: 3 },
      { value: "e", label: "Between $6,000 and $15,500", points: 4 },
    ],
  },
} as const satisfies Record<string, ChoiceQuestion>;

export type ChoiceQuestionId = keyof typeof CHOICE_QUESTIONS;

type ChoiceValue<Q extends ChoiceQuestionId> =
  (typeof CHOICE_QUESTIONS)[Q]["options"][number]["value"];

function choiceSchema<Q extends ChoiceQuestionId>(id: Q) {
  const values = CHOICE_QUESTIONS[id].options.map((o) => o.value) as [
    ChoiceValue<Q>,
    ...ChoiceValue<Q>[],
  ];
  return z.enum(values, { error: "Please choose an answer" });
}

const money = (label: string, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .min(0, `${label} can't be negative`)
    .max(max, `${label} looks too large`);

export const riskQuestionnaireSchema = z
  .object({
    age: z.coerce.number().int().min(18, "You must be at least 18").max(120),
    retirementAge: z.coerce.number().int().min(18).max(120),
    annualIncome: money("Annual income", 1e11),
    emergencyFundMonths: money("Emergency fund", 1200),
    currentRetirementSavings: money("Retirement savings", 1e13),
    monthlyContribution: money("Monthly contribution", 1e9),
    retirementGoal: money("Retirement goal", 1e13),
    incomeStability: choiceSchema("incomeStability"),
    withdrawalNeed: choiceSchema("withdrawalNeed"),
    primaryGoal: choiceSchema("primaryGoal"),
    experience: choiceSchema("experience"),
    drawdownReaction: choiceSchema("drawdownReaction"),
    tradeoff: choiceSchema("tradeoff"),
  })
  .refine((v) => v.retirementAge >= v.age, {
    path: ["retirementAge"],
    message: "Target retirement age can't be before your current age",
  });

export type RiskQuestionnaire = z.infer<typeof riskQuestionnaireSchema>;

export type RiskAssessment = {
  capacityScore: number;
  toleranceScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  /** Plain-language reasons that most influenced the result. */
  factors: string[];
};

function points<Q extends ChoiceQuestionId>(id: Q, value: ChoiceValue<Q>): number {
  const option = CHOICE_QUESTIONS[id].options.find((o) => o.value === value);
  if (!option) throw new Error(`Unknown answer ${value} for ${id}`);
  return option.points;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Scales a 0-4 answer to 0-100. */
const scale = (p: number) => (p / 4) * 100;

export function levelForScore(score: number): RiskLevel {
  if (score < 20) return "conservative";
  if (score < 40) return "moderately_conservative";
  if (score < 60) return "moderate";
  if (score < 80) return "moderately_aggressive";
  return "aggressive";
}

export function assessRisk(q: RiskQuestionnaire): RiskAssessment {
  const factors: string[] = [];
  const yearsToRetirement = Math.max(0, q.retirementAge - q.age);

  // --- Capacity (objective) -------------------------------------------------
  // Time horizon: 0 years -> 0, 30+ years -> 100.
  const horizonScore = clamp((yearsToRetirement / 30) * 100, 0, 100);
  const withdrawalScore = scale(points("withdrawalNeed", q.withdrawalNeed));
  // Emergency fund: 0 months -> 0, 6+ months -> 100.
  const emergencyScore = clamp((q.emergencyFundMonths / 6) * 100, 0, 100);
  const incomeScore = scale(points("incomeStability", q.incomeStability));

  let capacityScore =
    0.3 * horizonScore + 0.3 * withdrawalScore + 0.2 * emergencyScore + 0.2 * incomeScore;

  // Someone who needs the money soon can't absorb a drawdown regardless of the rest.
  if (q.withdrawalNeed === "lt_3") {
    capacityScore = Math.min(capacityScore, 25);
    factors.push("You expect to need this money within 3 years, which limits how much risk you can take.");
  }
  if (q.emergencyFundMonths < 3) {
    factors.push(
      "Your emergency fund covers less than 3 months of expenses. Building it up comes before taking more market risk.",
    );
  }
  if (yearsToRetirement >= 25) {
    factors.push(`With about ${yearsToRetirement} years until retirement, you have time to recover from downturns.`);
  } else if (yearsToRetirement <= 5) {
    factors.push(`Retirement is ${yearsToRetirement === 0 ? "here" : `about ${yearsToRetirement} years away`}, so protecting what you have matters more.`);
  }

  // --- Tolerance (subjective) ------------------------------------------------
  const toleranceScore =
    0.35 * scale(points("drawdownReaction", q.drawdownReaction)) +
    0.25 * scale(points("tradeoff", q.tradeoff)) +
    0.25 * scale(points("primaryGoal", q.primaryGoal)) +
    0.15 * scale(points("experience", q.experience));

  if (q.drawdownReaction === "sell_all" || q.drawdownReaction === "sell_some") {
    factors.push("You said you'd sell during a large drop, so a steadier portfolio is more likely to work for you.");
  }

  const capacity = Math.round(capacityScore);
  const tolerance = Math.round(toleranceScore);
  const riskScore = Math.min(capacity, tolerance);

  if (capacity + 20 <= tolerance) {
    factors.push("You're comfortable with more risk than your situation can support, so your capacity sets the level.");
  } else if (tolerance + 20 <= capacity) {
    factors.push("Your situation could support more risk than you're comfortable with, so your comfort level sets it.");
  }

  return {
    capacityScore: capacity,
    toleranceScore: tolerance,
    riskScore,
    riskLevel: levelForScore(riskScore),
    factors,
  };
}
