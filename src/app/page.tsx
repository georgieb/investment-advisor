import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Investment Advisor</h1>
        <p className="text-lg text-muted">
          Find out what level of risk fits you, see how your current holdings line up with it, and
          get clear suggestions for your next moves.
        </p>
      </div>
      <ul className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded-xl border border-border bg-surface p-4">
          <p className="font-medium">Risk profile</p>
          <p className="text-muted">A short questionnaire about your goals, retirement plans, and comfort with risk.</p>
        </li>
        <li className="rounded-xl border border-border bg-surface p-4">
          <p className="font-medium">Portfolio analysis</p>
          <p className="text-muted">Allocation, concentration, and drift from a target that matches your profile.</p>
        </li>
        <li className="rounded-xl border border-border bg-surface p-4">
          <p className="font-medium">Private by design</p>
          <p className="text-muted">Your holdings are visible only to you. We never share or sell your data.</p>
        </li>
      </ul>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground">
          Create an account
        </Link>
        <Link href="/login" className="rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium">
          Sign in
        </Link>
      </div>
      <p className="text-xs text-muted">
        For educational purposes only. This app does not provide personalized investment, tax, or legal advice.
      </p>
    </main>
  );
}
