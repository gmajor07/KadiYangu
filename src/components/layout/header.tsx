import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PublicHeaderNav } from "./public-header-nav";

export async function Header() {
  const session = await getServerSession(authOptions);
  return <PublicHeaderNav authenticated={Boolean(session?.user?.id)} />;
}
