import { getServerSession } from "next-auth";
import { authOptions } from "../../app/api/auth/[...nextauth]/route";

export default async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.is_admin) return null;
  return session;
}
