import "server-only";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "./options";
import { getDb } from "@/lib/db";
import { canAccessAdmin, isActive } from "@/lib/permissions";
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) redirect("/login");
  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user || !isActive(user)) redirect("/login?error=AccountUnavailable");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!canAccessAdmin(user)) notFound();
  return user;
}
