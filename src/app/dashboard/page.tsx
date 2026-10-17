import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";
import AccountsClient from "../(components)/Pages/AccountsClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const firstName = (session.user.name ?? "there").split(" ")[0];

  return <AccountsClient firstName={firstName} />;
}
