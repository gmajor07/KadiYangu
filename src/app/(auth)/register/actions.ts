"use server";
import { registerUser } from "@/services/registration";
export async function registerAction(
  _previous: { ok: boolean; message: string },
  form: FormData,
) {
  return registerUser({
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    password: form.get("password"),
  });
}
