import Link from "next/link";
import { registerUser } from "@/lib/register-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  name: "Enter your name.",
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters.",
  mismatch: "Passwords do not match.",
  exists: "An account with that email already exists.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Something went wrong." : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-base px-4">
      <Card className="w-full max-w-sm rounded-xl border-gray-200 bg-brand-surface">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-brand-primary">
            Create your account
          </CardTitle>
          <CardDescription className="text-gray-900">
            Join MatchPlay to track ratings and report matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerUser} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-900">
                Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Jordan Lee"
                required
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-900">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-900">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900">
                Confirm password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {errorMessage && (
              <p className="text-sm font-medium text-rose-500">{errorMessage}</p>
            )}
            <Button
              type="submit"
              className="mt-2 rounded-lg bg-brand-primary text-white hover:bg-brand-secondary"
            >
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-900/70">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
