import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import NavPill from "./NavPill";

export default async function Navbar() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;

  return (
    <NavPill
      name={session.user.name ?? "User"}
      email={session.user.email ?? ""}
      image={session.user.image ?? null}
      isAdmin={Boolean(session.user.is_admin)}
    />
  );
}
