import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getDb } from "@/lib/db";
import { checkInGuestPass } from "@/services/guest-passes-qr";
import { isEntryPassToken } from "@/lib/scanner/contracts";

const reply = (body: unknown, status: number) => NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request,{params}:{params:Promise<{eventId:string}>}) {
  // Reject cross-origin browser POSTs. Same-origin QR verification never navigates QR URLs.
  const origin = req.headers.get("origin");
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") return reply({ok:false,reason:"UNAUTHORIZED"},403);
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user.id) return reply({ok:false,reason:"UNAUTHORIZED"},401);
    const user = await getDb().user.findUnique({where:{id:session.user.id},select:{id:true,status:true}});
    if (!user || user.status !== "ACTIVE") return reply({ok:false,reason:"UNAUTHORIZED"},403);
    const {eventId}=await params;
    let body: unknown;
    try { body=await req.json(); } catch { return reply({ok:false,reason:"INVALID"},400); }
    const token = body && typeof body === "object" && "token" in body ? body.token : null;
    if (!isEntryPassToken(token)) return reply({ok:false,reason:"INVALID"},400);
    const result = await checkInGuestPass(user.id,eventId,token);
    // Return only display data. Database pass IDs and raw tokens never leave this endpoint.
    if (result.ok) return reply({ok:true,entry:result.entry},200);
    return reply({ok:false,reason:("detail" in result && result.detail) || result.reason,...("entry" in result && result.entry ? {entry:result.entry} : {})},result.reason === "ALREADY_USED" ? 409 : 403);
  } catch { return reply({ok:false,reason:"UNAVAILABLE"},503); }
}
