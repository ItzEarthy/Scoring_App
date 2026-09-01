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
      <header className="border-b-2 border-border bg-brand-primary text-brand-base">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-brand-secondary" />
            <span className="font-heading text-xl font-bold tracking-wider uppercase">
              MatchPlay
            </span>
          </div>
          <Button
            render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
            variant="secondary"
          >
            {isLoggedIn ? "Dashboard" : "Log In"}
          </Button>
        </div>
        <div className="stripe-bar h-1.5 w-full" />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <span className="rounded-sm border-2 border-brand-primary bg-brand-secondary/40 px-4 py-1 font-heading text-sm font-semibold tracking-widest text-brand-primary uppercase">
            Skill ratings for every club and every sport
          </span>
          <h1 className="max-w-2xl font-heading text-5xl leading-[1.05] font-bold tracking-tight text-foreground uppercase sm:text-6xl">
            Track Matches.
            <br />
            Rate Players.
            <br />
            <span className="text-brand-primary">Settle the Score.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            MatchPlay keeps a fair, up-to-date skill rating for every player in your
            organization, powered by OpenSkill, so the leaderboard always reflects
            reality.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href={isLoggedIn ? "/dashboard" : "/login"} />}
              size="lg"
              className="px-8"
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started"}
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Swords className="h-5 w-5 text-brand-primary" />
                  Report Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Log results as they happen and let the ledger track every match
                  from scheduling to confirmation.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-brand-primary" />
                  Live Ratings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Every result updates player ratings automatically, so rankings
                  always reflect current form.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-brand-surface">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-brand-primary" />
                  Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Run separate leagues and clubs side by side, each with its own
                  sports, rules, and members.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-border">
        <div className="stripe-bar h-1.5 w-full" />
        <div className="bg-brand-primary py-6 text-center font-heading text-sm tracking-widest text-brand-base uppercase">
          MatchPlay
        </div>
      </footer>
    </div>
  );
}
