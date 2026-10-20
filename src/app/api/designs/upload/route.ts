import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { putImage } from "@/lib/storage";
export async function POST(request: Request) { try { const session=await getServerSession(authOptions); if(!session?.user.id)return NextResponse.json({error:"Authentication required."},{status:401}); const file=(await request.formData()).get("file"); if(!(file instanceof File))return NextResponse.json({error:"Image file is required."},{status:400}); const stored=await putImage("designs",file); return NextResponse.json({url:stored.url}); } catch { return NextResponse.json({error:"Invalid image or upload unavailable."},{status:415}); } }
