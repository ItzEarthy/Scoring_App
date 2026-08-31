import { redirect } from "next/navigation";
import { getVerifiedSiteAdminUserId } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteAdminUserId = await getVerifiedSiteAdminUserId();
  if (!siteAdminUserId) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
