import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getOwnedDesign } from "@/services/designs";
import { parseDesignData } from "@/lib/design-data";
import { CardEditorV2 as CardEditor } from "@/components/editor/card-editor-v2";
import { resolvePremiumPrice } from "@/services/commerce";
export const dynamic="force-dynamic";
export default async function EditorPage({params}:{params:Promise<{designId:string}>}){const user=await requireUser();const {designId}=await params;const design=await getOwnedDesign(user.id,designId);if(!design||design.status==="ARCHIVED")notFound();let data;try{data=parseDesignData(design.designData)}catch{notFound()}const premiumPrice=await resolvePremiumPrice(user.id,design.id);return <CardEditor id={design.id} initialName={design.name} initialData={data} width={design.width} height={design.height} premiumPrice={premiumPrice?.amount ?? null} premiumCurrency={premiumPrice?.currency ?? "TZS"}/>}
