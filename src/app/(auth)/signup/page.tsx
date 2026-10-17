import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account · Investment Advisor" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <SignupForm />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
