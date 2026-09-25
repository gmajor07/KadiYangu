import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { categorySchema, templateSchema } from "@/lib/validation/catalog";
import type { CatalogFormState } from "@/types/catalog";
type Result = { ok: true; id: string } | { ok: false; state: CatalogFormState };
function failure(error: unknown): Result {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return {
        ok: false,
        state: {
          message: "That slug is already in use. Choose another.",
          errors: { slug: ["Slug must be unique."] },
        },
      };
    if (error.code === "P2025" || error.code === "P2003")
      return {
        ok: false,
        state: {
          message:
            "The record or category no longer exists. Refresh and try again.",
        },
      };
  }
  console.error("Catalog update unavailable");
  return {
    ok: false,
    state: { message: "Changes could not be saved. Please try again later." },
  };
}
const recordId = z.string().min(1).max(100).optional();
export async function saveCategory(
  input: unknown,
  id?: string,
): Promise<Result> {
  await requireAdmin(); // Every mutation authorizes, independently of page/layout checks.
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      state: {
        message: "Please check the highlighted fields.",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
    };
  if (!recordId.safeParse(id).success)
    return { ok: false, state: { message: "Invalid category identifier." } };
  try {
    const record = id
      ? await getDb().eventCategory.update({ where: { id }, data: parsed.data })
      : await getDb().eventCategory.create({ data: parsed.data });
    return { ok: true, id: record.id };
  } catch (error) {
    return failure(error);
  }
}
export async function saveTemplate(
  input: unknown,
  id?: string,
): Promise<Result> {
  await requireAdmin();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      state: {
        message: "Please check the highlighted fields.",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
    };
  if (!recordId.safeParse(id).success)
    return { ok: false, state: { message: "Invalid template identifier." } };
  try {
    const data = parsed.data;
    const category = await getDb().eventCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category)
      return {
        ok: false,
        state: {
          message: "Select an existing category.",
          errors: { categoryId: ["Category does not exist."] },
        },
      };
    const previous = id
      ? await getDb().template.findUniqueOrThrow({
          where: { id },
          select: { designData: true },
        })
      : null;
    const prior = previous?.designData;
    const designData = {
      ...(prior && typeof prior === "object" && !Array.isArray(prior)
        ? prior
        : {}),
      version: 1,
      canvas: { width: data.width, height: data.height },
      elements:
        prior &&
        typeof prior === "object" &&
        !Array.isArray(prior) &&
        Array.isArray(prior.elements)
          ? prior.elements
          : [],
    };
    const record = id
      ? await getDb().template.update({
          where: { id },
          data: { ...data, designData },
        })
      : await getDb().template.create({ data: { ...data, designData } });
    return { ok: true, id: record.id };
  } catch (error) {
    return failure(error);
  }
}
