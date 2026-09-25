import { z } from "zod";

const style = z.object({
  fontFamily: z.string().min(1).max(80).optional(), fontSize: z.number().min(8).max(400).optional(),
  fontWeight: z.number().min(100).max(900).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  align: z.enum(["left", "center", "right"]).optional(), lineHeight: z.number().min(.5).max(3).optional(),
}).strict();
const element = z.object({
  id: z.string().min(1).max(80), type: z.enum(["text", "image", "rect", "circle", "line"]),
  x: z.number().finite(), y: z.number().finite(), width: z.number().positive().max(10000), height: z.number().positive().max(10000),
  rotation: z.number().finite().min(-360).max(360), text: z.string().max(1000).optional(), src: z.string().max(500).optional(),
  fill: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), stroke: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), strokeWidth: z.number().min(0).max(100).optional(), opacity: z.number().min(0).max(1).optional(), style: style.optional(),
}).strict();
export const designDataSchema = z.object({ version: z.literal(1), canvas: z.object({ width: z.number().int().min(320).max(8000), height: z.number().int().min(320).max(8000), backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i), backgroundImage: z.string().max(500).nullable().optional() }).strict(), elements: z.array(element).max(200) }).strict();
export type DesignData = z.infer<typeof designDataSchema>;
export type DesignElement = DesignData["elements"][number];
export function parseDesignData(value: unknown): DesignData { return designDataSchema.parse(value); }
export function cloneDesignData(value: unknown): DesignData { return parseDesignData(JSON.parse(JSON.stringify(value))); }
