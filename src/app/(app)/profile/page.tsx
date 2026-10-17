import { Card } from "@/components/ui";
import { getRiskProfile } from "@/lib/data";
import { TARGET_ALLOCATIONS, BUCKETS, BUCKET_LABELS } from "@/lib/portfolio/analysis";
import { RISK_LEVEL_LABELS, assessRisk, riskQuestionnaireSchema } from "@/lib/risk/questionnaire";
import { RiskForm, type RiskFormDefaults } from "./risk-form";

export const metadata = { title: "Risk profile · Investment Advisor" };

export default async function ProfilePage() {
  const profile = await getRiskProfile();

  const defaults: RiskFormDefaults = {};
  let factors: string[] = [];
  if (profile) {
    const answers = (profile.answers ?? {}) as Record<string, string>;
    Object.assign(defaults, answers, {
      age: String(profile.age),
      retirementAge: String(profile.retirement_age),
      annualIncome: String(profile.annual_income),
      emergencyFundMonths: String(profile.emergency_fund_months),
      currentRetirementSavings: String(profile.current_retirement_savings),
      monthlyContribution: String(profile.monthly_contribution),
      retirementGoal: String(profile.retirement_goal),
    });
    const parsed = riskQuestionnaireSchema.safeParse(defaults);
    if (parsed.success) factors = assessRisk(parsed.data).factors;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Risk profile</h1>
        <p className="text-sm text-muted">
          Your answers set your risk level, which determines the target allocation we compare your portfolio against.
        </p>
      </div>

      {profile && (
        <Card title="Your result">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-2xl font-semibold">{RISK_LEVEL_LABELS[profile.risk_level]}</p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Capacity</dt>
                  <dd className="font-medium">{profile.capacity_score}/100</dd>
                </div>
                <div>
                  <dt className="text-muted">Tolerance</dt>
                  <dd className="font-medium">{profile.tolerance_score}/100</dd>
                </div>
                <div>
                  <dt className="text-muted">Overall</dt>
                  <dd className="font-medium">{profile.risk_score}/100</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">
                Capacity is how much risk your situation can absorb. Tolerance is how much you&apos;re comfortable with.
                Your overall level is the lower of the two.
              </p>
              {factors.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Target allocation</p>
              <ul className="space-y-1 text-sm">
                {BUCKETS.map((b) => (
                  <li key={b} className="flex justify-between">
                    <span>{BUCKET_LABELS[b]}</span>
                    <span className="font-medium">{TARGET_ALLOCATIONS[profile.risk_level][b]}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <RiskForm defaults={defaults} />
    </div>
  );
}
