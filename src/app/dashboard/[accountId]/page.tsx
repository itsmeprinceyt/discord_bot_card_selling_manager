import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AccountSingle from "../../(components)/Pages/AccountSingle";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) redirect("/login");

  return <AccountSingle accountId={accountId} />;
}
