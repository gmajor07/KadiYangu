import { z } from "zod";
const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.");
export const loginSchema = z.object({ email, password });
export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email,
    password,
    phone: z
      .string()
      .trim()
      .max(20)
      .refine(
        (value) => !value || /^\+?[0-9 ()-]{7,20}$/.test(value),
        "Enter a valid phone number.",
      )
      .optional(),
  })
  .strict();
