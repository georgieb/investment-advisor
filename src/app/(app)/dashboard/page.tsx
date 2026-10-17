import Link from "next/link";
import { Card, formatPct, formatUSD } from "@/components/ui";
import { getAccountsWithHoldings, getRiskProfile, toHoldingInput, toRiskProfileInput } from "@/lib/data";
import { ASSET_CLASS_LABELS, BUCKET_LABELS, REBALANCE_THRESHOLD_PP, analyzePortfolio } from "@/lib/portfolio/analysis";
import { RISK_LEVEL_LABELS } from "@/lib/risk/questionnaire";

export const metadata = { title: "Dashboard · Investment Advisor" };

export default async function DashboardPage() {
  const [accounts, profile] = await Promise.all([getAccountsWithHoldings(), getRiskProfile()]);
  const holdings = accounts.flatMap((a) => a.holdings.map(toHoldingInput));
  const analysis = analyzePortfolio(holdings, profile ? toRiskProfileInput(profile) : null);
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Portfolio value" value={formatUSD(analysis.totalValue)} />
        <Stat
          label="Unrealized gain/loss"
          value={formatUSD(analysis.unrealizedGain)}
          tone={analysis.unrealizedGain >= 0 ? "text-success" : "text-danger"}
          hint="On holdings with a cost basis"
        />
        <Stat
          label="Risk level"
          value={profile ? RISK_LEVEL_LABELS[profile.risk_level] : "Not set"}
          hint={profile ? `Score ${profile.risk_score}/100` : undefined}
          href="/profile"
        />
        <Stat
          label="Retirement projection"
          value={
            analysis.retirement?.fundedRatio != null
              ? `${Math.round(analysis.retirement.fundedRatio * 100)}% of goal`
              : "—"
          }
          hint={
            analysis.retirement
              ? `${formatUSD(analysis.retirement.projectedValue)} in ${analysis.retirement.years} yrs (today's dollars)`
              : undefined
          }
        />
      </div>

      <Card title="Suggested moves">
        {analysis.suggestions.length === 0 ? (
          <p className="text-sm text-muted">
            Your portfolio is within {REBALANCE_THRESHOLD_PP} points of your target allocation. Nothing to do right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {analysis.suggestions.map((s) => (
              <li
                key={s.title}
                className={`rounded-lg border-l-4 bg-background p-3 ${s.severity === "warning" ? "border-warning" : "border-accent"}`}
              >
                <p className="text-sm font-medium">
                  {s.kind === "complete_profile" ? (
                    <Link href="/profile" className="hover:underline">{s.title} →</Link>
                  ) : s.kind === "add_holdings" ? (
                    <Link href="/holdings" className="hover:underline">{s.title} →</Link>
                  ) : (
                    s.title
                  )}
                </p>
                <p className="text-sm text-muted">{s.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Allocation vs. target">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 font-medium">Asset</th>
                <th className="py-2 text-right font-medium">Value</th>
                <th className="py-2 text-right font-medium">Actual</th>
                <th className="py-2 text-right font-medium">Target</th>
                <th className="py-2 text-right font-medium">Drift</th>
              </tr>
            </thead>
            <tbody>
              {analysis.allocation.map((row) => (
                <tr key={row.bucket} className="border-t border-border">
                  <td className="py-2">
                    {BUCKET_LABELS[row.bucket]}
                    <AllocationBar actual={row.actualPct} target={row.targetPct} />
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatUSD(row.value)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPct(row.actualPct)}</td>
                  <td className="py-2 text-right tabular-nums">{row.targetPct == null ? "—" : `${row.targetPct}%`}</td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      row.driftPct != null && Math.abs(row.driftPct) >= REBALANCE_THRESHOLD_PP ? "font-medium text-warning" : ""
                    }`}
                  >
                    {row.driftPct == null ? "—" : `${row.driftPct > 0 ? "+" : ""}${row.driftPct.toFixed(1)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="By asset class">
            <Breakdown
              rows={analysis.byAssetClass.map((r) => ({ label: ASSET_CLASS_LABELS[r.assetClass], value: r.value, pct: r.pct }))}
            />
          </Card>
          <Card title="By account">
            <Breakdown
              rows={analysis.byAccount.map((r) => ({ label: accountNames.get(r.accountId) ?? "Account", value: r.value, pct: r.pct }))}
            />
          </Card>
          <Card title="Largest positions">
            <Breakdown rows={analysis.topPositions.map((r) => ({ label: r.symbol, value: r.value, pct: r.pct }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone = "", href }: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function AllocationBar({ actual, target }: { actual: number; target: number | null }) {
  return (
    <div className="relative mt-1 h-1.5 w-full max-w-40 rounded-full bg-border" aria-hidden>
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, actual)}%` }} />
      {target != null && (
        <div className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground" style={{ left: `${Math.min(100, target)}%` }} />
      )}
    </div>
  );
}

function Breakdown({ rows }: { rows: { label: string; value: number; pct: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">No holdings yet.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center justify-between gap-4">
          <span>{r.label}</span>
          <span className="tabular-nums text-muted">
            {formatUSD(r.value)} · {formatPct(r.pct)}
          </span>
        </li>
      ))}
    </ul>
  );
}
