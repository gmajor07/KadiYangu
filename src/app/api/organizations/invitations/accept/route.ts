import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getDb } from "@/lib/db";
import { acceptOrganizationInvitation } from "@/services/organizations";
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const user = await getDb().user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.token !== "string" || body.token.length < 20) return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  const result = await acceptOrganizationInvitation(user.id, user.email, body.token);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.reason === "EMAIL_MISMATCH" ? 403 : 409 });
  return NextResponse.json({ organizationId: result.organizationId });
}
