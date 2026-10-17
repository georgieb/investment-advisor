"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/forms";
import {
  CHOICE_QUESTIONS,
  QUESTIONNAIRE_VERSION,
  assessRisk,
  riskQuestionnaireSchema,
} from "@/lib/risk/questionnaire";

export async function saveRiskProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();

  const parsed = riskQuestionnaireSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrorsFrom(parsed.error, formData);

  const q = parsed.data;
  const result = assessRisk(q);
  const answers = Object.fromEntries(
    Object.keys(CHOICE_QUESTIONS).map((id) => [id, q[id as keyof typeof CHOICE_QUESTIONS]]),
  );

  const { error } = await supabase.from("risk_profiles").upsert({
    user_id: user.id,
    age: q.age,
    retirement_age: q.retirementAge,
    annual_income: q.annualIncome,
    emergency_fund_months: q.emergencyFundMonths,
    current_retirement_savings: q.currentRetirementSavings,
    monthly_contribution: q.monthlyContribution,
    retirement_goal: q.retirementGoal,
    answers,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    capacity_score: result.capacityScore,
    tolerance_score: result.toleranceScore,
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
  });
  if (error) {
    return { ok: false, message: "We couldn't save your profile. Please try again.", values: echoValues(formData) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true, message: "Your risk profile has been saved." };
}
