import { z } from "zod";
import { ASSET_CLASSES } from "./analysis";

export const ACCOUNT_TYPES = [
  "taxable",
  "traditional_ira",
  "roth_ira",
  "employer_401k",
  "roth_401k",
  "hsa",
  "education_529",
  "cash",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable: "Taxable brokerage",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  employer_401k: "401(k) / 403(b)",
  roth_401k: "Roth 401(k)",
  hsa: "HSA",
  education_529: "529 plan",
  cash: "Cash / savings",
  other: "Other",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(100),
  accountType: z.enum(ACCOUNT_TYPES, { error: "Choose an account type" }),
  institution: optionalText(100),
});

const positiveNumber = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .finite()
    .min(0, `${label} can't be negative`)
    .max(1e12, `${label} looks too large`);

export const holdingSchema = z.object({
  accountId: z.uuid("Choose an account"),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9.\-]{1,15}$/, "Use the ticker symbol, e.g. VTI or BRK.B"),
  name: optionalText(200),
  assetClass: z.enum(ASSET_CLASSES, { error: "Choose an asset class" }),
  quantity: positiveNumber("Quantity"),
  currentPrice: positiveNumber("Current price"),
  costBasisPerUnit: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    positiveNumber("Cost basis").nullable(),
  ),
});

export type AccountFormValues = z.infer<typeof accountSchema>;
export type HoldingFormValues = z.infer<typeof holdingSchema>;
