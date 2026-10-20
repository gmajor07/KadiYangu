import "server-only";
import { getDb } from "@/lib/db";
import { cloneDesignData, parseDesignData } from "@/lib/design-data";
import { Prisma } from "@prisma/client";
import { requireOrganizationMember } from "@/services/organizations";
import { consumeBetaQuota } from "@/services/beta";
export async function createDesignFromTemplate(userId: string, templateId: string, organizationId?: string) {
  if (organizationId && !(await requireOrganizationMember(userId, organizationId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"]))) return null;
  const betaQuota = await consumeBetaQuota(userId, organizationId ?? null, "DESIGN");
  if (betaQuota === false) return null;
  const template = await getDb().template.findFirst({ where: { id: templateId, status: "PUBLISHED", isActive: true }, select: { id:true,name:true,width:true,height:true,orientation:true,designData:true,thumbnailUrl:true,previewImageUrl:true } });
  if (!template) return null;
  let data;
  try {
    const parsed = parseDesignData(template.designData);
    // Older catalog records stored their artwork only as previewImageUrl. Carry it
    // into the owned clone so Quick Customize and Advanced Editor start with the
    // same visual source as the catalog preview.
    data = { ...parsed, canvas: { ...parsed.canvas, backgroundImage: parsed.canvas.backgroundImage || template.previewImageUrl || template.thumbnailUrl || null } };
  } catch {
    data = { version: 1 as const, canvas: { width: template.width, height: template.height, backgroundColor: "#ffffff", backgroundImage: template.previewImageUrl || template.thumbnailUrl || null }, fields: [{ key: "names", label: "Names", type: "text" as const }, { key: "message", label: "Message", type: "textarea" as const }], elements: template.previewImageUrl || template.thumbnailUrl ? [] : [{ id: "title-1", type: "text" as const, fieldKey: "names", fieldLabel: "Names", editable: true, x: template.width / 2 - 300, y: template.height / 2 - 50, width: 600, height: 100, rotation: 0, text: template.name, style: { fontFamily: "serif", fontSize: 64, fontWeight: 600, color: "#203b32", align: "center" as const } }, { id: "message-1", type: "text" as const, fieldKey: "message", fieldLabel: "Message", fieldType: "textarea" as const, editable: true, x: template.width / 2 - 300, y: template.height / 2 + 80, width: 600, height: 180, rotation: 0, text: "We would love you to celebrate with us.", style: { fontFamily: "sans-serif", fontSize: 28, color: "#203b32", align: "center" as const } }] };
  }
  return getDb().design.create({ data: { userId, ...(organizationId ? { organizationId } : {}), templateId: template.id, name: `${template.name} Copy`, width: template.width, height: template.height, orientation: template.orientation, thumbnailUrl: template.previewImageUrl || template.thumbnailUrl, designData: data as unknown as Prisma.InputJsonValue }, select: { id:true } });
}
export async function getOwnedDesign(userId: string, id: string) {
  const design = await getDb().design.findUnique({ where: { id }, include: { template: { select: { id: true, name: true, slug: true, previewImageUrl: true, thumbnailUrl: true } } } });
  if (!design) return null;
  if (design.userId === userId) return design;
  if (design.organizationId && await requireOrganizationMember(userId, design.organizationId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"])) return design;
  return null;
}
export function listOwnedDesigns(userId: string, includeArchived = false, organizationId?: string) { return getDb().design.findMany({ where: { userId, ...(organizationId ? { organizationId } : { organizationId: null }), ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }) }, select: { id:true,name:true,status:true,updatedAt:true,thumbnailUrl:true,template: { select: { name:true,slug:true,thumbnailUrl:true,previewImageUrl:true } }, events: { where: { status: { not: "ARCHIVED" } }, select: { id:true,status:true } } }, orderBy: { updatedAt: "desc" } }); }
export async function updateOwnedDesign(userId: string, id: string, input: { name?: string; designData?: unknown; status?: "DRAFT"|"COMPLETED" }) { const existing = await getOwnedDesign(userId,id); if (!existing) return null; const data: Prisma.DesignUpdateInput = {}; if(input.name !== undefined) data.name = input.name.trim().slice(0,160) || existing.name; if(input.designData !== undefined) data.designData = cloneDesignData(input.designData) as unknown as Prisma.InputJsonValue; if(input.status) data.status=input.status; return getDb().design.update({ where:{id}, data }); }
export async function duplicateOwnedDesign(userId:string,id:string){ const source=await getOwnedDesign(userId,id); if(!source)return null; return getDb().design.create({data:{userId,templateId:source.templateId,name:`${source.name} Copy`.slice(0,160),designData:cloneDesignData(source.designData) as unknown as Prisma.InputJsonValue,width:source.width,height:source.height,orientation:source.orientation,thumbnailUrl:source.thumbnailUrl}}); }
export async function archiveOwnedDesign(userId:string,id:string){ const result=await getDb().design.updateMany({where:{id,userId},data:{status:"ARCHIVED"}}); return result.count>0; }

export async function createBlankDesign(userId: string, format: "portrait" | "landscape" | "square", organizationId?: string) {
  if (organizationId && !(await requireOrganizationMember(userId, organizationId, ["OWNER", "ADMIN", "MANAGER", "EDITOR"]))) return null;
  const betaQuota = await consumeBetaQuota(userId, organizationId ?? null, "DESIGN");
  if (betaQuota === false) return null;
  const sizes = { portrait: [1080, 1350], landscape: [1350, 1080], square: [1080, 1080] } as const;
  const [width, height] = sizes[format];
  return getDb().design.create({ data: { userId, ...(organizationId ? { organizationId } : {}), name: "Untitled Card", width, height, orientation: format.toUpperCase() as "PORTRAIT" | "LANDSCAPE" | "SQUARE", designData: { version: 1, canvas: { width, height, backgroundColor: "#ffffff" }, elements: [] } as Prisma.InputJsonValue }, select: { id: true } });
}

export async function deleteOwnedDesign(userId:string,id:string){ const result = await getDb().design.deleteMany({ where: { id, userId } }); return result.count > 0; }
