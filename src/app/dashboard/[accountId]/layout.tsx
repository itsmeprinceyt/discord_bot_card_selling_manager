import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAccountName } from "../../../utils/ValueFetcher/getAccountName";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Direct DB call — no fetch, no localhost, no cookies forwarding needed
  const accountName = await getAccountName(accountId, session.user.id);

  return (
    <div className="relative min-h-screen">
      {accountName && (
        <div className="fixed right-4 top-4 z-40">
          <div
            className="
              group inline-flex items-center gap-1.5
              rounded-lg border border-neutral-800 bg-neutral-900/80
              px-2 py-1
              text-[11px] font-medium text-neutral-400
              shadow-sm backdrop-blur
              transition-colors hover:border-neutral-700 hover:text-neutral-200
            "
            title={`Currently viewing: ${accountName}`}
          >
            <span className="max-w-35 truncate">{accountName}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
