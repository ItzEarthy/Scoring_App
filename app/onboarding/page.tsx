import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, avatarBase64: true, onboardingCompletedAt: true },
  });
  if (!user) redirect("/login");
  if (user.onboardingCompletedAt) redirect("/dashboard");

  const [sports, orgs] = await Promise.all([
    prisma.sport.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-brand-base px-4 py-10">
      <OnboardingWizard
        firstName={user.name?.split(" ")[0] ?? "there"}
        sports={sports}
        orgs={orgs}
        initialAvatar={user.avatarBase64}
      />
    </div>
  );
}
