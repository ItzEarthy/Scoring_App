"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trophy, Users, Plus, UserCircle, Check, ArrowRight, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { AvatarPicker } from "@/components/avatar-picker";
import {
  onboardingSelectSportsAction,
  onboardingCreateOrgAction,
  onboardingJoinOrgAction,
  completeOnboardingAction,
  type OnboardingActionState,
} from "@/lib/onboarding/onboarding-actions";

type Sport = { id: string; name: string };
type Org = { id: string; name: string };

const STEPS = ["Sports", "Organization", "Avatar"] as const;
const idleState: OnboardingActionState = { status: "idle" };

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-heading text-xs font-bold ${
              i < step
                ? "border-brand-primary bg-brand-primary text-brand-base"
                : i === step
                ? "border-brand-primary text-brand-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`hidden font-heading text-xs font-semibold tracking-wide uppercase sm:block ${
              i <= step ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="h-0.5 flex-1 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function NextButton({ label = "Continue" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending ? "Saving..." : label}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

function SportsStep({ sports, onNext }: { sports: Sport[]; onNext: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState(async (_prev: OnboardingActionState, formData: FormData) => {
    const result = await onboardingSelectSportsAction(_prev, formData);
    if (result.status === "success") onNext();
    return result;
  }, idleState);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {sports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sports are configured on this platform yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sports.map((sport) => {
            const isSelected = selected.has(sport.id);
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => toggle(sport.id)}
                className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm font-medium transition ${
                  isSelected
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                    : "border-border text-foreground hover:border-brand-primary/50"
                }`}
              >
                <Trophy className={`h-4 w-4 shrink-0 ${isSelected ? "text-brand-primary" : "text-muted-foreground"}`} />
                {sport.name}
                <input type="checkbox" name="sportIds" value={sport.id} checked={isSelected} readOnly hidden />
              </button>
            );
          })}
        </div>
      )}
      {state.status === "error" && (
        <p className="flex items-center gap-2 text-sm text-rose-600">
          <ShieldAlert className="h-4 w-4" />
          {state.message}
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size === 0 ? "You can also skip and add sports later." : `${selected.size} selected`}
        </p>
        <NextButton />
      </div>
    </form>
  );
}

function OrgStep({ orgs, onNext }: { orgs: Org[]; onNext: () => void }) {
  const [mode, setMode] = useState<"join" | "create">(orgs.length > 0 ? "join" : "create");
  const [search, setSearch] = useState("");
  const [joinState, joinAction] = useActionState(async (_prev: OnboardingActionState, formData: FormData) => {
    const result = await onboardingJoinOrgAction(_prev, formData);
    if (result.status === "success") onNext();
    return result;
  }, idleState);
  const [createState, createAction] = useActionState(async (_prev: OnboardingActionState, formData: FormData) => {
    const result = await onboardingCreateOrgAction(_prev, formData);
    if (result.status === "success") onNext();
    return result;
  }, idleState);

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "join" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setMode("join")}
        >
          <Users className="h-4 w-4" />
          Join an Org
        </Button>
        <Button
          type="button"
          variant={mode === "create" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setMode("create")}
        >
          <Plus className="h-4 w-4" />
          Create an Org
        </Button>
      </div>

      {mode === "join" ? (
        orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations exist yet — create the first one.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orgs.length > 5 && (
              <SearchInput value={search} onChange={setSearch} placeholder="Search organizations..." />
            )}
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {filtered.map((org) => (
                <form key={org.id} action={joinAction} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <span className="font-medium text-foreground">{org.name}</span>
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Button type="submit" size="sm" variant="outline" className="border-brand-primary text-brand-primary">
                    Join
                  </Button>
                </form>
              ))}
            </div>
            {joinState.status === "error" && (
              <p className="flex items-center gap-2 text-sm text-rose-600">
                <ShieldAlert className="h-4 w-4" />
                {joinState.message}
              </p>
            )}
          </div>
        )
      ) : (
        <form action={createAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="onboarding-org-name" className="text-sm font-medium text-foreground">
              Organization name
            </label>
            <Input id="onboarding-org-name" name="name" placeholder="Downtown Sports Club" required />
          </div>
          <NextButton label="Create & Continue" />
          {createState.status === "error" && (
            <p className="flex items-center gap-2 text-sm text-rose-600 sm:ml-2">
              <ShieldAlert className="h-4 w-4" />
              {createState.message}
            </p>
          )}
        </form>
      )}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onNext} className="text-muted-foreground">
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function AvatarStep({
  initialAvatar,
  fallbackText,
  onDone,
}: {
  initialAvatar: string | null;
  fallbackText: string;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <AvatarPicker initialAvatar={initialAvatar} fallbackText={fallbackText} onSaved={() => setSaved(true)} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {saved ? "Avatar saved." : "You can also skip and set one later from Account Settings."}
        </p>
        <form action={completeOnboardingAction}>
          <NextButton label="Finish" />
        </form>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onDone} className="self-start text-muted-foreground">
        Skip and go to dashboard
      </Button>
    </div>
  );
}

const STEP_META = [
  { icon: Trophy, title: "Pick your sports", description: "Choose the sports you want to play — you can change this anytime." },
  { icon: Users, title: "Join a club", description: "Join an existing organization or start your own." },
  { icon: UserCircle, title: "Add a photo", description: "Help teammates recognize you on the leaderboard." },
] as const;

export function OnboardingWizard({
  firstName,
  sports,
  orgs,
  initialAvatar,
}: {
  firstName: string;
  sports: Sport[];
  orgs: Org[];
  initialAvatar: string | null;
}) {
  const [step, setStep] = useState(0);
  const meta = STEP_META[step];
  const Icon = meta.icon;

  function finish() {
    completeOnboardingAction();
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-brand-primary uppercase sm:text-3xl">
          Welcome to MatchPlay, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">Let&apos;s get your account set up in a few quick steps.</p>
      </div>

      <Card className="bg-brand-surface">
        <CardHeader>
          <StepProgress step={step} />
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5 text-brand-primary" />
            {meta.title}
          </CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 0 && <SportsStep sports={sports} onNext={() => setStep(1)} />}
          {step === 1 && <OrgStep orgs={orgs} onNext={() => setStep(2)} />}
          {step === 2 && (
            <AvatarStep initialAvatar={initialAvatar} fallbackText={firstName.slice(0, 2).toUpperCase()} onDone={finish} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
