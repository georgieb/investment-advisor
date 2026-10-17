import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/dal";
import { signOut } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/holdings", label: "Holdings" },
  { href: "/profile", label: "Risk profile" },
] as const;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              Investment Advisor
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-muted hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Suspense fallback={<span className="h-5" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-muted">
        For educational purposes only. Not personalized investment, tax, or legal advice. Past performance does not
        guarantee future results.
      </footer>
    </div>
  );
}

async function UserMenu() {
  const user = await getOptionalUser();
  if (!user) return null;
  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      <span className="text-muted">{user.email}</span>
      <button type="submit" className="rounded-lg border border-border px-3 py-1.5 hover:bg-background">
        Sign out
      </button>
    </form>
  );
}
