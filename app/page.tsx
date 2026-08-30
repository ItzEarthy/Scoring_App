import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Swords, TrendingUp, Users } from "lucide-react";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="flex flex-1 flex-col bg-brand-base">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 text-brand-primary">
            <Trophy className="h-5 w-5" />
            <span className="text-lg font-bold tracking-tight">MatchPlay</span>
          </div>
          <Button
            render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
            className="rounded-lg bg-brand-primary text-white hover:bg-brand-secondary"
          >
            {isLoggedIn ? "Go to Dashboard" : "Log In"}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <span className="rounded-full bg-brand-secondary/30 px-4 py-1 text-sm font-medium text-brand-primary">
            Skill ratings for every club and every sport
          </span>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Track matches. Rate players. Settle the score.
          </h1>
          <p className="max-w-xl text-lg text-gray-900/70">
            MatchPlay keeps a fair, up-to-date skill rating for every player in your
            organization, powered by OpenSkill, so the leaderboard always reflects
            reality.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
              className="rounded-lg bg-brand-primary px-6 py-2 text-white hover:bg-brand-secondary"
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started"}
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="rounded-xl border-gray-200 bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-5 w-5 text-brand-primary" />
                  Report Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-900/70">
                  Log results as they happen and let the ledger track every match
                  from scheduling to confirmation.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-gray-200 bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-brand-primary" />
                  Live Ratings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-900/70">
                  Every result updates player ratings automatically, so rankings
                  always reflect current form.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-gray-200 bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-brand-primary" />
                  Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-900/70">
                  Run separate leagues and clubs side by side, each with its own
                  sports, rules, and members.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-900/50">
        MatchPlay
      </footer>
    </div>
  );
}
