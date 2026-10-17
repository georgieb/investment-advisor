import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { getAccountsWithHoldings, getHolding } from "@/lib/data";
import { updateHolding } from "../../actions";
import { HoldingForm } from "../../forms";

export const metadata = { title: "Edit holding · Investment Advisor" };

export default async function EditHoldingPage({ params }: PageProps<"/holdings/[id]/edit">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [holding, accounts] = await Promise.all([getHolding(id), getAccountsWithHoldings()]);
  if (!holding) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/holdings" className="text-sm text-accent hover:underline">
          ← Back to holdings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit {holding.symbol}</h1>
      </div>
      <Card>
        <HoldingForm
          accounts={accounts.map(({ id, name }) => ({ id, name }))}
          action={updateHolding.bind(null, holding.id)}
          submitLabel="Save changes"
          defaults={{
            accountId: holding.account_id,
            symbol: holding.symbol,
            name: holding.name ?? "",
            assetClass: holding.asset_class,
            quantity: String(holding.quantity),
            currentPrice: String(holding.current_price),
            costBasisPerUnit: holding.cost_basis_per_unit == null ? "" : String(holding.cost_basis_per_unit),
          }}
        />
      </Card>
    </div>
  );
}
