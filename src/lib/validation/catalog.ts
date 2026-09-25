import { z } from "zod";
import { isSafeImagePath } from "@/lib/catalog/images";
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens.",
  );
const text = z.string().trim().min(2).max(100);
const description = z.string().trim().min(10).max(2000);
const image = z
  .string()
  .trim()
  .max(300)
  .refine(
    isSafeImagePath,
    "Use a local /images/ or /demo/ image path (SVG, PNG, JPG, WebP, AVIF).",
  );
const optionalImage = z
  .union([image, z.literal("")])
  .transform((value) => value || null);
const integer = (min: number, max: number) =>
  z
    .union([z.number(), z.string().regex(/^\d+$/, "Enter a whole number.")])
    .transform((value) => Number(value))
    .pipe(z.number().int().min(min).max(max));
export const categorySchema = z
  .object({
    name: text,
    slug: slugSchema,
    description,
    imageUrl: optionalImage,
    icon: z
      .string()
      .trim()
      .max(8)
      .refine((value) => !/[<>]/.test(value), "Use a short text symbol.")
      .transform((value) => value || null),
    sortOrder: integer(0, 100000),
    isActive: z.boolean(),
  })
  .strict();
export const templateSchema = z
  .object({
    name: text,
    slug: slugSchema,
    description,
    thumbnailUrl: image,
    previewImageUrl: optionalImage,
    categoryId: z.string().min(1).max(100),
    isPremium: z.boolean(),
    price: z
      .union([z.literal(""), z.null(), integer(1, 2147483647)])
      .transform((value) => (value === "" ? null : value)),
    currency: z.literal("TZS"),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    isFeatured: z.boolean(),
    isActive: z.boolean(),
    orientation: z.enum(["PORTRAIT", "LANDSCAPE", "SQUARE"]),
    width: integer(320, 8000),
    height: integer(320, 8000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isPremium && value.price === null)
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Premium templates require a positive whole-TZS price.",
      });
    if (!value.isPremium && value.price !== null)
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Leave price empty for free templates.",
      });
    const valid =
      value.orientation === "SQUARE"
        ? value.width === value.height
        : value.orientation === "PORTRAIT"
          ? value.height > value.width
          : value.width > value.height;
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["orientation"],
        message: "Canvas dimensions must match the selected orientation.",
      });
  });
export const catalogFilterSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: slugSchema.or(z.literal("")).catch(""),
  tier: z.enum(["", "free", "premium"]).catch(""),
  orientation: z.enum(["", "PORTRAIT", "LANDSCAPE", "SQUARE"]).catch(""),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type CatalogFilters = z.infer<typeof catalogFilterSchema>;
export type SearchParams = Record<string, string | string[] | undefined>;
export function parseCatalogFilters(params: SearchParams = {}): CatalogFilters {
  return catalogFilterSchema.parse(
    Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    ),
  );
}
