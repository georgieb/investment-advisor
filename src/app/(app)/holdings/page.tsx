import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, formatUSD } from "@/components/ui";
import { getAccountsWithHoldings } from "@/lib/data";
import { ASSET_CLASS_LABELS } from "@/lib/portfolio/analysis";
import { ACCOUNT_TYPE_LABELS } from "@/lib/portfolio/schemas";
import { deleteAccount, deleteHolding } from "./actions";
import { AccountForm, HoldingForm } from "./forms";

export const metadata = { title: "Holdings · Investment Advisor" };

export default async function HoldingsPage() {
  const accounts = await getAccountsWithHoldings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Holdings</h1>
        <p className="text-sm text-muted">
          Enter your accounts and positions. Only you can see them. Update prices whenever you want a fresh analysis.
        </p>
      </div>

      <Card title="Add an account">
        <AccountForm />
      </Card>

      {accounts.length > 0 && (
        <Card title="Add a holding">
          <HoldingForm accounts={accounts.map(({ id, name }) => ({ id, name }))} />
        </Card>
      )}

      {accounts.map((account) => {
        const total = account.holdings.reduce((s, h) => s + Number(h.quantity) * Number(h.current_price), 0);
        return (
          <Card
            key={account.id}
            title={
              <span>
                {account.name}{" "}
                <span className="font-normal text-muted">
                  · {ACCOUNT_TYPE_LABELS[account.account_type]}
                  {account.institution ? ` · ${account.institution}` : ""}
                </span>
              </span>
            }
            action={
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatUSD(total)}</span>
                <form action={deleteAccount.bind(null, account.id)}>
                  <ConfirmButton
                    variant="danger"
                    className="px-3 py-1 text-xs"
                    message={`Delete ${account.name} and all ${account.holdings.length} holdings in it? This can't be undone.`}
                  >
                    Delete account
                  </ConfirmButton>
                </form>
              </div>
            }
          >
            {account.holdings.length === 0 ? (
              <p className="text-sm text-muted">No holdings in this account yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Symbol</th>
                      <th className="py-2 pr-4 font-medium">Asset class</th>
                      <th className="py-2 pr-4 text-right font-medium">Quantity</th>
                      <th className="py-2 pr-4 text-right font-medium">Price</th>
                      <th className="py-2 pr-4 text-right font-medium">Value</th>
                      <th className="py-2 pr-4 text-right font-medium">Gain/loss</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {account.holdings.map((h) => {
                      const value = Number(h.quantity) * Number(h.current_price);
                      const gain =
                        h.cost_basis_per_unit == null ? null : value - Number(h.quantity) * Number(h.cost_basis_per_unit);
                      return (
                        <tr key={h.id} className="border-t border-border">
                          <td className="py-2 pr-4">
                            <span className="font-medium">{h.symbol}</span>
                            {h.name && <span className="block text-xs text-muted">{h.name}</span>}
                          </td>
                          <td className="py-2 pr-4">{ASSET_CLASS_LABELS[h.asset_class]}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{Number(h.quantity).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{formatUSD(Number(h.current_price), 2)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{formatUSD(value)}</td>
                          <td
                            className={`py-2 pr-4 text-right tabular-nums ${
                              gain == null ? "text-muted" : gain >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {gain == null ? "—" : formatUSD(gain)}
                          </td>
                          <td className="py-2">
                            <div className="flex justify-end gap-2">
                              <Link href={`/holdings/${h.id}/edit`} className="text-xs text-accent hover:underline">
                                Edit
                              </Link>
                              <form action={deleteHolding.bind(null, h.id)}>
                                <ConfirmButton
                                  variant="danger"
                                  className="border-0 px-0 py-0 text-xs hover:bg-transparent hover:underline"
                                  message={`Delete ${h.symbol} from ${account.name}?`}
                                >
                                  Delete
                                </ConfirmButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
