"use server";
import { requireUser } from "@/lib/auth/guards";
import { claimPersonalBeta } from "@/services/beta";
import { redirect } from "next/navigation";
export async function claimBeta() { const user = await requireUser("/dashboard/beta"); const grant = await claimPersonalBeta(user.id); redirect(grant ? "/dashboard/beta?claimed=1" : "/dashboard/beta?error=unavailable"); }
