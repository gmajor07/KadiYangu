import "server-only";import {getDb} from "@/lib/db";
export const DEFAULT_DESIGN_PRICES={STANDARD:1000,PREMIUM:2000} as const;
export async function getActiveDesignPrices(){const rows=await getDb().pricingRule.findMany({where:{isActive:true,effectiveFrom:{lte:new Date()},OR:[{effectiveTo:null},{effectiveTo:{gt:new Date()}}],tier:{in:["STANDARD","PREMIUM"]}},orderBy:{effectiveFrom:"desc"}});const result:Record<"STANDARD"|"PREMIUM",number>={...DEFAULT_DESIGN_PRICES};for(const row of rows){if(row.tier!=="CUSTOM"&&row.amount!==null)result[row.tier]=row.amount}return result;}
