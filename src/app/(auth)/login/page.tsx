import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Investment Advisor" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={typeof next === "string" ? next : "/dashboard"}
      linkError={error === "link"}
    />
  );
}
