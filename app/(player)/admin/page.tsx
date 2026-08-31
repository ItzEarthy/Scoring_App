import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Trophy } from "lucide-react";

export default async function AdminPage() {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <ShieldCheck className="h-6 w-6 text-brand-primary" />
          Site Admin
        </h1>
        <p className="mt-1 text-gray-900/70">
          Platform-wide administration, separate from any single organization&apos;s settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/sports">
          <Card className="h-full rounded-xl border-gray-200 bg-white transition hover:border-brand-primary">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-brand-primary" />
                Sports Catalog
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-900/70">
                Create, edit, and deactivate the sports organizations can offer.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
