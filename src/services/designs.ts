import "server-only";
import { getDb } from "@/lib/db";
import { cloneDesignData, parseDesignData } from "@/lib/design-data";
import { Prisma } from "@prisma/client";
export async function createDesignFromTemplate(userId: string, templateId: string) {
  const template = await getDb().template.findFirst({ where: { id: templateId, status: "PUBLISHED", isActive: true }, select: { id:true,name:true,width:true,height:true,orientation:true,designData:true,thumbnailUrl:true,previewImageUrl:true } });
  if (!template) return null;
  const data = parseDesignData(template.designData);
  return getDb().design.create({ data: { userId, templateId: template.id, name: `${template.name} Copy`, width: template.width, height: template.height, orientation: template.orientation, thumbnailUrl: template.previewImageUrl || template.thumbnailUrl, designData: data as unknown as Prisma.InputJsonValue }, select: { id:true } });
}
export function getOwnedDesign(userId: string, id: string) { return getDb().design.findFirst({ where: { id, userId }, include: { template: { select: { id:true,name:true,slug:true } } } }); }
export function listOwnedDesigns(userId: string, includeArchived = false) { return getDb().design.findMany({ where: { userId, ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }) }, include: { template: { select: { name:true,slug:true } } }, orderBy: { updatedAt: "desc" } }); }
export async function updateOwnedDesign(userId: string, id: string, input: { name?: string; designData?: unknown; status?: "DRAFT"|"COMPLETED" }) { const existing = await getOwnedDesign(userId,id); if (!existing) return null; const data: Prisma.DesignUpdateInput = {}; if(input.name !== undefined) data.name = input.name.trim().slice(0,160) || existing.name; if(input.designData !== undefined) data.designData = cloneDesignData(input.designData) as unknown as Prisma.InputJsonValue; if(input.status) data.status=input.status; return getDb().design.update({ where:{id}, data }); }
export async function duplicateOwnedDesign(userId:string,id:string){ const source=await getOwnedDesign(userId,id); if(!source)return null; return getDb().design.create({data:{userId,templateId:source.templateId,name:`${source.name} Copy`.slice(0,160),designData:cloneDesignData(source.designData) as unknown as Prisma.InputJsonValue,width:source.width,height:source.height,orientation:source.orientation,thumbnailUrl:source.thumbnailUrl}}); }
export async function archiveOwnedDesign(userId:string,id:string){ const result=await getDb().design.updateMany({where:{id,userId},data:{status:"ARCHIVED"}}); return result.count>0; }
